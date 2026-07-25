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

function enrichCandidate(candidate: StoryWinnerCandidate) {
  return {
    ...candidate,
    average: candidate.scores.length
      ? candidate.scores.reduce((sum, score) => sum + score, 0) / candidate.scores.length
      : null,
    voteCount: candidate.scores.length,
    fiveCount: candidate.scores.filter((score) => score === 5).length,
  };
}

export function chooseStoryWinner(candidates: StoryWinnerCandidate[]) {
  return candidates
    .filter((candidate) => candidate.content.trim() && candidate.scores.length > 0)
    .map(enrichCandidate)
    .sort((a, b) =>
      (b.average ?? 0) - (a.average ?? 0) ||
      b.voteCount - a.voteCount ||
      b.fiveCount - a.fiveCount ||
      a.participantId.localeCompare(b.participantId)
    )[0] ?? null;
}

export function pickStoryWinner(
  candidates: StoryWinnerCandidate[],
  opts: { forcedParticipantId?: string } = {}
) {
  const withContent = candidates.filter((candidate) => candidate.content.trim());

  if (opts.forcedParticipantId) {
    const forced = withContent.find((candidate) => candidate.participantId === opts.forcedParticipantId);
    return forced ? enrichCandidate(forced) : null;
  }

  const voted = chooseStoryWinner(candidates);
  if (voted) return voted;

  const fallback = [...withContent].sort((a, b) => a.participantId.localeCompare(b.participantId))[0];
  return fallback ? enrichCandidate(fallback) : null;
}

const CANON_HEAD_CHARS = 900;
const CANON_TAIL_CHARS = 2600;
const CANON_OMISSION_MARK = '\n\n[…capítulos intermediários omitidos para caber no contexto…]\n\n';

function snapBack(text: string, index: number) {
  for (const sep of ['\n\n', '\n', ' ']) {
    const at = text.lastIndexOf(sep, index);
    if (at > 0) return at + sep.length;
  }
  return index;
}
function snapForward(text: string, index: number) {
  for (const sep of ['\n\n', '\n', ' ']) {
    const at = text.indexOf(sep, index);
    if (at !== -1 && at < text.length - 1) return at + sep.length;
  }
  return index;
}

export function clampCanon(canonText: string) {
  const text = canonText.trim();
  if (text.length <= CANON_HEAD_CHARS + CANON_TAIL_CHARS + CANON_OMISSION_MARK.length) return text;
  const head = text.slice(0, snapBack(text, CANON_HEAD_CHARS)).trim();
  const tail = text.slice(snapForward(text, text.length - CANON_TAIL_CHARS)).trim();
  return `${head}${CANON_OMISSION_MARK}${tail}`;
}

export function buildStoryPrompt(input: {
  title: string;
  canonText: string;
  chapter: number;
  totalChapters: number;
}) {
  const finalChapter = input.chapter === input.totalChapters;
  return `COMPETIÇÃO: CÂNONE COMUNITÁRIO — ${input.title}\n\n` +
    `CÂNONE ATUAL (preserve fatos, personagens e tom):\n---\n${clampCanon(input.canonText)}\n---\n\n` +
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

  async canonize(storyId: string, opts: { participantId?: string } = {}) {
    const story = await this.prisma.storyCompetition.findUnique({ where: { id: storyId }, include: { chapters: { orderBy: { index: 'desc' }, take: 1, include: { round: { include: { metrics: { include: { participant: true } }, votes: true } } } } } });
    if (!story) throw new Error('História não encontrada');
    if (story.status !== 'voting') throw new Error('A votação deste capítulo não está aberta');
    const chapter = story.chapters[0];
    const winner = pickStoryWinner(chapter.round.metrics.map((metric) => ({
      participantId: metric.participantId,
      nickname: metric.participant.nickname,
      content: metric.generatedContent ?? '',
      scores: chapter.round.votes.filter((vote) => vote.participantId === metric.participantId).map((vote) => vote.score),
    })), { forcedParticipantId: opts.participantId });
    if (!winner) throw new Error(opts.participantId ? 'A continuação escolhida não foi encontrada ou está vazia' : 'Não há continuações para tornar cânone');
    const manual = !!opts.participantId;
    await this.rounds.closeVoting(chapter.roundId);
    const completed = story.currentChapter === story.totalChapters;
    await this.prisma.$transaction([
      this.prisma.storyChapter.update({ where: { id: chapter.id }, data: { winningParticipantId: winner.participantId, winningNickname: winner.nickname, winningContent: winner.content.trim(), winningScore: winner.average, winningVotes: winner.voteCount, canonicalizedAt: new Date() } }),
      this.prisma.storyCompetition.update({ where: { id: storyId }, data: { canonText: `${story.canonText.trim()}\n\n${winner.content.trim()}`, status: completed ? 'completed' : 'ready', completedAt: completed ? new Date() : null } }),
    ]);
    await this.eventLogger?.log({ sessionId: story.sessionId, eventType: 'story_chapter_canonized', actorType: manual ? 'admin' : 'system', targetType: 'story_chapter', targetId: chapter.id, metadata: { participantId: winner.participantId, nickname: winner.nickname, average: winner.average, votes: winner.voteCount, manual } });
    if (completed) await this.eventLogger?.log({ sessionId: story.sessionId, eventType: 'story_completed', actorType: 'system', targetType: 'story', targetId: story.id });
    this.logger.info({ storyId, chapter: chapter.index, winner: winner.nickname, manual }, 'Story chapter added to canon');
    await this.broadcast(story.sessionId);
    return winner;
  }

  async cancelChapter(storyId: string) {
    const story = await this.prisma.storyCompetition.findUnique({ where: { id: storyId }, include: { chapters: { orderBy: { index: 'desc' }, take: 1 } } });
    if (!story) throw new Error('História não encontrada');
    if (story.status !== 'generating' && story.status !== 'voting') throw new Error('Só é possível cancelar um capítulo em geração ou votação');
    const chapter = story.chapters[0];
    if (!chapter || chapter.canonicalizedAt) throw new Error('Não há capítulo ativo para cancelar');
    await this.prisma.round.delete({ where: { id: chapter.roundId } });
    await this.prisma.storyCompetition.update({ where: { id: storyId }, data: { currentChapter: Math.max(0, story.currentChapter - 1), status: 'ready' } });
    await this.eventLogger?.log({ sessionId: story.sessionId, eventType: 'story_chapter_cancelled', actorType: 'admin', targetType: 'story_chapter', targetId: chapter.id, metadata: { index: chapter.index } });
    this.hub.broadcastToTelao({ type: 'round_started', round: Math.max(0, story.currentChapter - 1), session_id: story.sessionId });
    await this.broadcast(story.sessionId);
    this.logger.info({ storyId, chapter: chapter.index }, 'Story chapter cancelled and rolled back');
    return { cancelledChapter: chapter.index };
  }
  
  async deleteStory(storyId: string) {
    const story = await this.prisma.storyCompetition.findUnique({ where: { id: storyId }, include: { chapters: true } });
    if (!story) throw new Error('História não encontrada');
    const roundIds = story.chapters.map((chapter) => chapter.roundId);
    await this.prisma.$transaction([
      ...(roundIds.length ? [this.prisma.round.deleteMany({ where: { id: { in: roundIds } } })] : []),
      this.prisma.storyCompetition.delete({ where: { id: storyId } }),
    ]);
    await this.eventLogger?.log({ sessionId: story.sessionId, eventType: 'story_discarded', actorType: 'admin', targetType: 'story', targetId: story.id, metadata: { title: story.title, chaptersRemoved: story.chapters.length } });
    this.hub.broadcastToTelao({ type: 'round_started', round: 0, session_id: story.sessionId });
    await this.broadcast(story.sessionId);
    this.logger.info({ storyId }, 'Story discarded — ready for a fresh competition');
    return { discarded: story.id };
  }
}
