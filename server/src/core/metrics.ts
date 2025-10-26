import { PrismaClient } from '@prisma/client';

export class MetricsManager {
  constructor(private prisma: PrismaClient) {}

  async getSessionMetrics(sessionId: string) {
    const rounds = await this.prisma.round.findMany({
      where: { sessionId },
      include: {
        metrics: {
          include: { participant: true },
        },
        votes: true,
      },
    });

    const totalRounds = rounds.length;
    const completedRounds = rounds.filter((r) => r.endedAt).length;
    const totalParticipants = new Set(
      rounds.flatMap((r) => r.metrics.map((m) => m.participantId))
    ).size;
    const totalTokens = rounds.reduce(
      (sum, r) => sum + r.metrics.reduce((s, m) => s + m.tokens, 0),
      0
    );
    const totalVotes = rounds.reduce((sum, r) => sum + r.votes.length, 0);

    return {
      session_id: sessionId,
      total_rounds: totalRounds,
      completed_rounds: completedRounds,
      total_participants: totalParticipants,
      total_tokens: totalTokens,
      total_votes: totalVotes,
    };
  }

  async exportToCSV(sessionId: string): Promise<string> {
    const rounds = await this.prisma.round.findMany({
      where: { sessionId },
      include: {
        metrics: {
          include: { participant: true },
        },
        votes: {
          include: { participant: true },
        },
      },
      orderBy: { index: 'asc' },
    });

    const rows: string[] = [];

    // Header
    rows.push(
      'round,participant_id,nickname,tokens,latency_first_token_ms,duration_ms,tps_avg,votes,avg_score'
    );

    // Data
    for (const round of rounds) {
      for (const metric of round.metrics) {
        const participantVotes = round.votes.filter(
          (v) => v.participantId === metric.participantId
        );
        const voteCount = participantVotes.length;
        const avgScore =
          voteCount > 0
            ? participantVotes.reduce((sum, v) => sum + v.score, 0) / voteCount
            : 0;

        rows.push(
          [
            round.index,
            metric.participantId,
            metric.participant.nickname,
            metric.tokens,
            metric.latencyFirstTokenMs ?? '',
            metric.durationMs,
            metric.tpsAvg?.toFixed(2) ?? '',
            voteCount,
            avgScore.toFixed(2),
          ].join(',')
        );
      }
    }

    return rows.join('\n');
  }
}
