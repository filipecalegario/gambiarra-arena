import type { Runner, GenerateOptions, TokenCallback } from './types.js';

export class LMStudioRunner implements Runner {
  constructor(
    private baseUrl: string,
    private model: string
  ) {}

  async test(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/models`);
    if (!response.ok) {
      throw new Error(`LM Studio not available at ${this.baseUrl}`);
    }
  }

  async generate(
    prompt: string,
    options: GenerateOptions,
    onToken: TokenCallback
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        max_tokens: options.maxTokens || 400,
        temperature: options.temperature || 0.8,
        seed: options.seed,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`LM Studio API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || !line.startsWith('data: ')) continue;

        const data = line.slice(6); // Remove 'data: ' prefix
        if (data === '[DONE]') {
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.text;
          if (token) {
            onToken(token);
          }
        } catch (err) {
          console.error('Failed to parse LM Studio response:', line);
        }
      }
    }
  }
}
