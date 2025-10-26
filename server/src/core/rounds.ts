import { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { WebSocketHub } from '../ws/hub.js';

export interface CreateRoundParams {
  sessionId: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  deadlineMs?: number;
  seed?: number;
}

export class RoundManager {
  constructor(
    private prisma: PrismaClient,
    private hub: WebSocketHub,
    private logger: FastifyBaseLogger
  ) {}

  async createRound(params: CreateRoundParams) {
    const session = await this.prisma.session.findUnique({
      where: { id: params.sessionId },
      include: { rounds: true },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const nextIndex = session.rounds.length + 1;

    const round = await this.prisma.round.create({
      data: {
        sessionId: params.sessionId,
        index: nextIndex,
        prompt: params.prompt,
        maxTokens: params.maxTokens ?? 400,
        temperature: params.temperature ?? 0.8,
        deadlineMs: params.deadlineMs ?? 90000,
        seed: params.seed,
      },
    });

    this.logger.info({ roundId: round.id, index: round.index }, 'Round created');

    return round;
  }

  async startRound(roundId: string) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: { session: true },
    });

    if (!round) {
      throw new Error('Round not found');
    }

    if (round.startedAt) {
      throw new Error('Round already started');
    }

    const updatedRound = await this.prisma.round.update({
      where: { id: roundId },
      data: { startedAt: new Date() },
    });

    // Broadcast challenge to all participants
    this.hub.broadcast({
      type: 'challenge',
      session_id: round.sessionId,
      round: round.index,
      prompt: round.prompt,
      max_tokens: round.maxTokens,
      temperature: round.temperature,
      deadline_ms: round.deadlineMs,
      seed: round.seed,
    });

    this.logger.info({ roundId, index: round.index }, 'Round started');

    return updatedRound;
  }

  async stopRound(roundId: string) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
    });

    if (!round) {
      throw new Error('Round not found');
    }

    if (!round.startedAt) {
      throw new Error('Round not started');
    }

    if (round.endedAt) {
      throw new Error('Round already ended');
    }

    const updatedRound = await this.prisma.round.update({
      where: { id: roundId },
      data: { endedAt: new Date() },
    });

    this.logger.info({ roundId, index: round.index }, 'Round stopped');

    return updatedRound;
  }

  async getCurrentRound(sessionId: string) {
    return this.prisma.round.findFirst({
      where: {
        sessionId,
        startedAt: { not: null },
        endedAt: null,
      },
      orderBy: { index: 'desc' },
    });
  }

  async getRoundMetrics(roundId: string) {
    return this.prisma.metrics.findMany({
      where: { roundId },
      include: { participant: true },
    });
  }
}
