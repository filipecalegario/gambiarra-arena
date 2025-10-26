import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import { createHash } from 'crypto';

export interface CastVoteParams {
  roundId: string;
  voterId: string;
  participantId: string;
  score: number;
}

export class VoteManager {
  constructor(
    private prisma: PrismaClient,
    private logger: FastifyBaseLogger
  ) {}

  async castVote(params: CastVoteParams) {
    const { roundId, voterId, participantId, score } = params;

    // Hash voter ID for privacy
    const voterHash = createHash('sha256').update(voterId).digest('hex');

    // Check if round exists and is ended
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
    });

    if (!round) {
      throw new Error('Round not found');
    }

    // Allow voting during and after round
    // if (!round.endedAt) {
    //   throw new Error('Round not ended yet');
    // }

    // Check if participant exists
    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new Error('Participant not found');
    }

    // Validate score
    if (score < 1 || score > 5) {
      throw new Error('Score must be between 1 and 5');
    }

    // Upsert vote (prevent duplicate voting)
    const vote = await this.prisma.vote.upsert({
      where: {
        roundId_voterHash_participantId: {
          roundId,
          voterHash,
          participantId,
        },
      },
      create: {
        roundId,
        voterHash,
        participantId,
        score,
      },
      update: {
        score,
      },
    });

    this.logger.info({ roundId, participantId, score }, 'Vote cast');

    return vote;
  }

  async getRoundVotes(roundId: string) {
    return this.prisma.vote.findMany({
      where: { roundId },
      include: { participant: true },
    });
  }

  async getScoreboard(roundId: string) {
    const votes = await this.prisma.vote.findMany({
      where: { roundId },
      include: { participant: true },
    });

    const metrics = await this.prisma.metrics.findMany({
      where: { roundId },
      include: { participant: true },
    });

    // Aggregate votes by participant
    const votesByParticipant = new Map<string, number[]>();
    for (const vote of votes) {
      if (!votesByParticipant.has(vote.participantId)) {
        votesByParticipant.set(vote.participantId, []);
      }
      votesByParticipant.get(vote.participantId)!.push(vote.score);
    }

    // Calculate scoreboard
    const scoreboard = metrics.map((m) => {
      const participantVotes = votesByParticipant.get(m.participantId) || [];
      const totalVotes = participantVotes.length;
      const avgScore = totalVotes > 0
        ? participantVotes.reduce((a, b) => a + b, 0) / totalVotes
        : 0;

      return {
        participant_id: m.participantId,
        nickname: m.participant.nickname,
        tokens: m.tokens,
        latency_first_token_ms: m.latencyFirstTokenMs,
        duration_ms: m.durationMs,
        tps_avg: m.tpsAvg,
        votes: totalVotes,
        avg_score: avgScore,
        total_score: avgScore * totalVotes,
      };
    });

    // Sort by total_score descending
    scoreboard.sort((a, b) => b.total_score - a.total_score);

    return scoreboard;
  }
}
