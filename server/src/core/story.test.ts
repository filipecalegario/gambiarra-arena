import { describe, expect, it } from 'vitest';
import { buildStoryPrompt, chooseStoryWinner, clampCanon, pickStoryWinner } from './story.js';

describe('community canon rules', () => {
  it('includes the accumulated canon and asks intermediate chapters for a hook', () => {
    const prompt = buildStoryPrompt({ title: 'Teste', canonText: 'Um rádio falou sozinho.', chapter: 2, totalChapters: 3 });
    expect(prompt).toContain('Um rádio falou sozinho.');
    expect(prompt).toContain('capítulo 2 de 3');
    expect(prompt).toContain('gancho claro');
  });

  it('asks the final chapter to resolve the conflict', () => {
    const prompt = buildStoryPrompt({ title: 'Teste', canonText: 'Início', chapter: 3, totalChapters: 3 });
    expect(prompt).toContain('capítulo final');
    expect(prompt).toContain('resolva o conflito principal');
  });

  it('uses average, vote count, fives and stable id as tie breakers', () => {
    const winner = chooseStoryWinner([
      { participantId: 'b', nickname: 'B', content: 'Texto B', scores: [5, 3] },
      { participantId: 'a', nickname: 'A', content: 'Texto A', scores: [4, 4, 4] },
    ]);
    expect(winner?.participantId).toBe('a');
    expect(winner?.average).toBe(4);
  });

  it('does not crown an unvoted response', () => {
    expect(chooseStoryWinner([{ participantId: 'a', nickname: 'A', content: 'Texto', scores: [] }])).toBeNull();
  });
});

describe('pickStoryWinner (never stalls a live event)', () => {
  const noVotes = [
    { participantId: 'b', nickname: 'B', content: 'Texto B', scores: [] },
    { participantId: 'a', nickname: 'A', content: 'Texto A', scores: [] },
  ];

  it('falls back to the first author by stable id when nobody voted', () => {
    const winner = pickStoryWinner(noVotes);
    expect(winner?.participantId).toBe('a');
    expect(winner?.average).toBeNull();
    expect(winner?.voteCount).toBe(0);
  });

  it('honours the presenter manual pick even against the vote leader', () => {
    const winner = pickStoryWinner([
      { participantId: 'a', nickname: 'A', content: 'Texto A', scores: [5, 5] },
      { participantId: 'b', nickname: 'B', content: 'Texto B', scores: [1] },
    ], { forcedParticipantId: 'b' });
    expect(winner?.participantId).toBe('b');
    expect(winner?.average).toBe(1);
  });

  it('refuses a manual pick that has no content', () => {
    expect(pickStoryWinner([{ participantId: 'a', nickname: 'A', content: '   ', scores: [4] }], { forcedParticipantId: 'a' })).toBeNull();
  });

  it('still prefers the vote leader when no manual pick is given', () => {
    const winner = pickStoryWinner([
      { participantId: 'a', nickname: 'A', content: 'A', scores: [2] },
      { participantId: 'b', nickname: 'B', content: 'B', scores: [5] },
    ]);
    expect(winner?.participantId).toBe('b');
  });
});

describe('clampCanon (keeps the prompt within a small context)', () => {
  it('leaves a short canon untouched', () => {
    const text = 'Um rádio falou sozinho.';
    expect(clampCanon(text)).toBe(text);
  });

  it('keeps the opening and the most recent text but drops the middle', () => {
    const head = 'ABERTURA: ' + 'a'.repeat(1200);
    const tail = 'DESFECHO: ' + 'z'.repeat(3000);
    const clamped = clampCanon(`${head}\n\n${'m'.repeat(4000)}\n\n${tail}`);
    expect(clamped.startsWith('ABERTURA:')).toBe(true);
    expect(clamped).toContain('omitidos');
    expect(clamped.endsWith('z')).toBe(true);
    expect(clamped.length).toBeLessThan(head.length + tail.length + 200);
  });
});
