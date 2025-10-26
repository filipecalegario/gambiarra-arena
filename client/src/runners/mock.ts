import type { Runner, GenerateOptions, TokenCallback } from './types.js';

const MOCK_RESPONSES = [
  'Era uma vez em um reino digital distante, onde os bits e bytes dançavam em harmonia...',
  'A inteligência artificial desperta num mundo de possibilidades infinitas, explorando cada neurônio artificial...',
  'No coração do silício, pulsa uma consciência emergente que questiona sua própria existência...',
  'Algoritmos ancestrais sussurram segredos do futuro através de redes neurais profundas...',
  'Entre zeros e uns, nasce uma nova forma de criatividade que transcende a programação...',
];

export class MockRunner implements Runner {
  async test(): Promise<void> {
    // Mock runner is always available
    return Promise.resolve();
  }

  async generate(
    prompt: string,
    options: GenerateOptions,
    onToken: TokenCallback
  ): Promise<void> {
    const maxTokens = options.maxTokens || 400;
    const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];

    // Split into words
    const words = response.split(' ');

    for (let i = 0; i < Math.min(maxTokens / 3, words.length); i++) {
      // Simulate token generation delay (20-80ms per token)
      await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 60));

      // Send word + space as token
      onToken(words[i] + (i < words.length - 1 ? ' ' : ''));
    }

    // Continue with generated tokens if needed
    const remainingTokens = maxTokens - words.length * 3;
    if (remainingTokens > 0) {
      for (let i = 0; i < remainingTokens; i++) {
        await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 60));
        onToken(this.generateRandomToken());
      }
    }
  }

  private generateRandomToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz ';
    const length = 3 + Math.floor(Math.random() * 10);
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
  }
}
