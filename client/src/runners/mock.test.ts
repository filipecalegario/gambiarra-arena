import { describe, it, expect } from 'vitest';
import { MockRunner } from './mock';

describe('MockRunner', () => {
  it('should test successfully', async () => {
    const runner = new MockRunner();
    await expect(runner.test()).resolves.toBeUndefined();
  });

  it('should generate tokens', async () => {
    const runner = new MockRunner();
    const tokens: string[] = [];

    await runner.generate(
      'Test prompt',
      { maxTokens: 50 },
      (token) => {
        tokens.push(token);
      }
    );

    expect(tokens.length).toBeGreaterThan(0);
  });

  it('should respect max tokens limit', async () => {
    const runner = new MockRunner();
    const tokens: string[] = [];
    const maxTokens = 100;

    await runner.generate(
      'Test prompt',
      { maxTokens },
      (token) => {
        tokens.push(token);
      }
    );

    // Should generate approximately maxTokens/3 to maxTokens worth of content
    expect(tokens.length).toBeLessThanOrEqual(maxTokens);
  });
});
