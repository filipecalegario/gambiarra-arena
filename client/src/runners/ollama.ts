import type { Runner, GenerateOptions, TokenCallback } from './types.js';

export class OllamaRunner implements Runner {
  constructor(
    private baseUrl: string,
    private model: string
  ) {}

  async test(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama not available at ${this.baseUrl}`);
    }
  }

  async generate(
    prompt: string,
    options: GenerateOptions,
    onToken: TokenCallback
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: true,
        options: {
          num_predict: options.maxTokens || 400,
          temperature: options.temperature || 0.8,
          seed: options.seed,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
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
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);
          if (data.response) {
            onToken(data.response);
          }
          if (data.done) {
            return;
          }
        } catch (err) {
          console.error('Failed to parse Ollama response:', line);
        }
      }
    }
  }
}
