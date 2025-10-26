import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { RoundManager } from '../core/rounds.js';
import { VoteManager } from '../core/votes.js';
import { MetricsManager } from '../core/metrics.js';
import type { WebSocketHub } from '../ws/hub.js';

const CreateSessionSchema = z.object({
  pinLength: z.number().optional().default(6),
});

const CreateRoundSchema = z.object({
  prompt: z.string(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  deadlineMs: z.number().optional(),
  seed: z.number().optional(),
});

const StartRoundSchema = z.object({
  roundId: z.string(),
});

const StopRoundSchema = z.object({
  roundId: z.string(),
});

const CastVoteSchema = z.object({
  roundId: z.string(),
  participantId: z.string(),
  score: z.number().min(1).max(5),
});

const KickParticipantSchema = z.object({
  participantId: z.string(),
});

export async function setupRoutes(
  app: FastifyInstance,
  hub: WebSocketHub,
  roundManager: RoundManager,
  voteManager: VoteManager,
  metricsManager: MetricsManager
) {
  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // Get active session
  app.get('/session', async (request, reply) => {
    const session = await app.prisma.session.findFirst({
      where: { status: 'active' },
      include: {
        participants: true,
        rounds: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return reply.code(404).send({ error: 'No active session' });
    }

    // Don't return PIN hash
    const { pinHash, ...sessionData } = session;

    return sessionData;
  });

  // Get current round
  app.get('/rounds/current', async (request, reply) => {
    const session = await app.prisma.session.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return reply.code(404).send({ error: 'No active session' });
    }

    const round = await roundManager.getCurrentRound(session.id);

    if (!round) {
      return reply.code(404).send({ error: 'No active round' });
    }

    // Get live tokens
    const tokens = await hub.getCurrentRoundTokens(round.index);

    return {
      ...round,
      liveTokens: Object.fromEntries(tokens),
    };
  });

  // Get scoreboard
  app.get('/scoreboard', async (request, reply) => {
    const session = await app.prisma.session.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return reply.code(404).send({ error: 'No active session' });
    }

    const round = await roundManager.getCurrentRound(session.id);

    if (!round) {
      return reply.code(404).send({ error: 'No active round' });
    }

    const scoreboard = await voteManager.getScoreboard(round.id);

    return scoreboard;
  });

  // Get metrics
  app.get('/metrics', async (request, reply) => {
    const session = await app.prisma.session.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return reply.code(404).send({ error: 'No active session' });
    }

    const metrics = await metricsManager.getSessionMetrics(session.id);

    return metrics;
  });

  // Export CSV
  app.get('/export.csv', async (request, reply) => {
    const session = await app.prisma.session.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return reply.code(404).send({ error: 'No active session' });
    }

    const csv = await metricsManager.exportToCSV(session.id);

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="session-${session.id}.csv"`);

    return csv;
  });

  // Create session
  app.post('/session', async (request, reply) => {
    const body = CreateSessionSchema.parse(request.body);

    // Generate PIN
    const pin = Math.random()
      .toString()
      .slice(2, 2 + body.pinLength)
      .padStart(body.pinLength, '0');
    const pinHash = await bcrypt.hash(pin, 10);

    // End previous active sessions
    await app.prisma.session.updateMany({
      where: { status: 'active' },
      data: { status: 'ended' },
    });

    // Create new session
    const session = await app.prisma.session.create({
      data: {
        pinHash,
        status: 'active',
      },
    });

    app.log.info({ sessionId: session.id, pin }, 'Session created');

    return {
      session_id: session.id,
      pin, // Only return PIN on creation
      created_at: session.createdAt,
    };
  });

  // Create round
  app.post('/rounds', async (request, reply) => {
    const body = CreateRoundSchema.parse(request.body);

    const session = await app.prisma.session.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return reply.code(404).send({ error: 'No active session' });
    }

    const round = await roundManager.createRound({
      sessionId: session.id,
      ...body,
    });

    return round;
  });

  // Start round
  app.post('/rounds/start', async (request, reply) => {
    const body = StartRoundSchema.parse(request.body);

    const round = await roundManager.startRound(body.roundId);

    return round;
  });

  // Stop round
  app.post('/rounds/stop', async (request, reply) => {
    const body = StopRoundSchema.parse(request.body);

    const round = await roundManager.stopRound(body.roundId);

    return round;
  });

  // Cast vote
  app.post('/votes', async (request, reply) => {
    const body = CastVoteSchema.parse(request.body);

    // Use IP address as voter ID if not provided
    const voterId = request.ip;

    const vote = await voteManager.castVote({
      roundId: body.roundId,
      voterId,
      participantId: body.participantId,
      score: body.score,
    });

    return vote;
  });

  // Close voting
  app.post('/votes/close', async (request, reply) => {
    // This would typically disable voting for a round
    // For now, we'll just return success
    return { status: 'ok' };
  });

  // Kick participant
  app.post('/participants/kick', async (request, reply) => {
    const body = KickParticipantSchema.parse(request.body);

    await app.prisma.participant.delete({
      where: { id: body.participantId },
    });

    return { status: 'ok' };
  });
}
