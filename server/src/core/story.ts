import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import type { WebSocketHub } from '../ws/hub.js';
import type { EventLogger } from './eventlog.js';
import type { RoundManager } from './rounds.js';

export interface StoryWinnerCandidate {
  participantId: string;
  nickname: string;
  content: string;
  scores: number[];
}

export function chooseStoryWinner(candidates: StoryWinnerCandidate[]) {
  return candidates
    .filter((candidate) => candidate.content.trim() && candidate.scores.length > 0)
    .map((candidate) => ({
      ...candidate,
      average: candidate.scores.reduce((sum, score) => sum + score, 0) / candidate.scores.length,
      voteCount: candidate.scores.length,
      fiveCount: candidate.scores.filter((score) => score === 5).length,
    }))
    .sort((a, b) =>
      b.average - a.average ||
      b.voteCount - a.voteCount ||
      b.fiveCount - a.fiveCount ||
      a.participantId.localeCompare(b.participantId)
    )[0] ?? null;
}

export function buildStoryPrompt(input: {
  title: string;
  canonText: string;
  chapter: number;
  totalChapters: number;
}) {
  const finalChapter = input.chapter === input.totalChapters;
  return `COMPETIÇÃO: CÂNONE COMUNITÁRIO — ${input.title}\n\n` +
    `CÂNONE ATUAL (preserve fatos, personagens e tom):\n---\n${input.canonText}\n---\n\n` +
    `Escreva APENAS a continuação correspondente ao capítulo ${input.chapter} de ${input.totalChapters}. ` +
    `Não resuma nem repita o cânone. Produza de 180 a 260 palavras, com coerência, criatividade e estilo próprio. ` +
    `Use humor quando combinar com a história. ` +
    (finalChapter
      ? 'Este é o capítulo final: resolva o conflito principal, recupere ao menos um detalhe anterior e termine com uma frase memorável.'
      : 'Crie uma virada surpreendente mas plausível e deixe um gancho claro para o próximo capítulo.');
}

export class StoryManager {
  constructor(
    private prisma: PrismaClient,
    private rounds: RoundManager,
    private hub: WebSocketHub,
    private logger: FastifyBaseLogger,
    private eventLogger?: EventLogger
  ) {}

  async getState(sessionId: string) {
    const story = await this.prisma.storyCompetition.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      include: {
        chapters: {
          orderBy: { index: 'asc' },
          include: {
            round: {
              include: {
                metrics: { include: { participant: true }, orderBy: { createdAt: 'asc' } },
                votes: true,
              },
            },
          },
        },
      },
    });
    if (!story) return null;

    return {
      ...story,
      chapters: story.chapters.map((chapter) => ({
        ...chapter,
        round: {
          ...chapter.round,
          responses: chapter.round.metrics.map((metric) => {
            const votes = chapter.round.votes.filter((vote) => vote.participantId === metric.participantId);
            return {
              participantId: metric.participantId,
              nickname: metric.participant.nickname,
              model: metric.participant.model,
              content: metric.generatedContent ?? '',
              completedAt: metric.createdAt,
              voteCount: votes.length,
              averageScore: votes.length ? votes.reduce((sum, vote) => sum + vote.score, 0) / votes.length : null,
            };
          }),
          metrics: undefined,
          votes: undefined,
        },
      })),
    };
  }

  private async broadcast(sessionId: string) {
    this.hub.broadcastToTelao({ type: 'story_state', story: await this.getState(sessionId) });
  }

  async create(input: { sessionId: string; title: string; seedText: string; totalChapters: number; maxTokens?: number; temperature?: number; deadlineMs?: number }) {
    const active = await this.prisma.storyCompetition.findFirst({
      where: { sessionId: input.sessionId, status: { not: 'completed' } },
    });
    if (active) throw new Error('Já existe uma história em andamento nesta sessão');
    const story = await this.prisma.storyCompetition.create({
      data: {
        sessionId: input.sessionId,
        title: input.title.trim(),
        seedText: input.seedText.trim(),
        canonText: input.seedText.trim(),
        totalChapters: input.totalChapters,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        deadlineMs: input.deadlineMs,
      },
    });
    await this.eventLogger?.log({ sessionId: input.sessionId, eventType: 'story_created', actorType: 'admin', targetType: 'story', targetId: story.id, metadata: { title: story.title, totalChapters: story.totalChapters } });
    await this.broadcast(input.sessionId);
    return story;
  }

  async startNextChapter(storyId: string) {
    const story = await this.prisma.storyCompetition.findUnique({ where: { id: storyId } });
    if (!story) throw new Error('História não encontrada');
    if (story.status !== 'ready') throw new Error('A história não está pronta para um novo capítulo');
    if (story.currentChapter >= story.totalChapters) throw new Error('Todos os capítulos já foram concluídos');
    const index = story.currentChapter + 1;
    const prompt = buildStoryPrompt({ title: story.title, canonText: story.canonText, chapter: index, totalChapters: story.totalChapters });
    const round = await this.rounds.createRound({ sessionId: story.sessionId, prompt, maxTokens: story.maxTokens, temperature: story.temperature, deadlineMs: story.deadlineMs });
    const chapter = await this.prisma.storyChapter.create({ data: { storyId, roundId: round.id, index, prompt } });
    await this.prisma.storyCompetition.update({ where: { id: storyId }, data: { currentChapter: index, status: 'generating' } });
    await this.rounds.startRound(round.id);
    await this.eventLogger?.log({ sessionId: story.sessionId, eventType: 'story_chapter_started', actorType: 'admin', targetType: 'story_chapter', targetId: chapter.id, metadata: { index, roundId: round.id } });
    await this.broadcast(story.sessionId);
    return chapter;
  }

  async openVoting(storyId: string) {
    const story = await this.prisma.storyCompetition.findUnique({ where: { id: storyId }, include: { chapters: { orderBy: { index: 'desc' }, take: 1 } } });
    if (!story) throw new Error('História não encontrada');
    if (story.status !== 'generating') throw new Error('O capítulo não está recebendo continuações');
    const chapter = story.chapters[0];
    if (!chapter) throw new Error('Capítulo atual não encontrado');
    await this.hub.flushPendingMetrics(chapter.roundId);
    await this.rounds.stopRound(chapter.roundId);
    await this.prisma.storyCompetition.update({ where: { id: storyId }, data: { status: 'voting' } });
    await this.eventLogger?.log({ sessionId: story.sessionId, eventType: 'story_voting_opened', actorType: 'admin', targetType: 'story_chapter', targetId: chapter.id });
    await this.broadcast(story.sessionId);
  }

  async canonize(storyId: string) {
    const story = await this.prisma.storyCompetition.findUnique({ where: { id: storyId }, include: { chapters: { orderBy: { index: 'desc' }, take: 1, include: { round: { include: { metrics: { include: { participant: true } }, votes: true } } } } } });
    if (!story) throw new Error('História não encontrada');
    if (story.status !== 'voting') throw new Error('A votação deste capítulo não está aberta');
    const chapter = story.chapters[0];
    const winner = chooseStoryWinner(chapter.round.metrics.map((metric) => ({
      participantId: metric.participantId,
      nickname: metric.participant.nickname,
      content: metric.generatedContent ?? '',
      scores: chapter.round.votes.filter((vote) => vote.participantId === metric.participantId).map((vote) => vote.score),
    })));
    if (!winner) throw new Error('É necessário ao menos um voto válido para definir o cânone');
    await this.rounds.closeVoting(chapter.roundId);
    const completed = story.currentChapter === story.totalChapters;
    await this.prisma.$transaction([
      this.prisma.storyChapter.update({ where: { id: chapter.id }, data: { winningParticipantId: winner.participantId, winningNickname: winner.nickname, winningContent: winner.content.trim(), winningScore: winner.average, winningVotes: winner.voteCount, canonicalizedAt: new Date() } }),
      this.prisma.storyCompetition.update({ where: { id: storyId }, data: { canonText: `${story.canonText.trim()}\n\n${winner.content.trim()}`, status: completed ? 'completed' : 'ready', completedAt: completed ? new Date() : null } }),
    ]);
    await this.eventLogger?.log({ sessionId: story.sessionId, eventType: 'story_chapter_canonized', actorType: 'system', targetType: 'story_chapter', targetId: chapter.id, metadata: { participantId: winner.participantId, nickname: winner.nickname, average: winner.average, votes: winner.voteCount } });
    if (completed) await this.eventLogger?.log({ sessionId: story.sessionId, eventType: 'story_completed', actorType: 'system', targetType: 'story', targetId: story.id });
    this.logger.info({ storyId, chapter: chapter.index, winner: winner.nickname }, 'Story chapter added to canon');
    await this.broadcast(story.sessionId);
    return winner;
  }
}
