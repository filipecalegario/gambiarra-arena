import { describe, expect, it } from 'vitest';
import { buildStoryPrompt, chooseStoryWinner } from './story.js';

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
