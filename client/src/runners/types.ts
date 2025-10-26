export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  seed?: number;
}

export type TokenCallback = (token: string) => void;

export interface Runner {
  /**
   * Test if the runner is available and working
   */
  test(): Promise<void>;

  /**
   * Generate text with streaming
   */
  generate(
    prompt: string,
    options: GenerateOptions,
    onToken: TokenCallback
  ): Promise<void>;
}
