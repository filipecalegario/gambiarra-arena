#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { GambiarraClient } from './net/ws.js';
import { OllamaRunner } from './runners/ollama.js';
import { LMStudioRunner } from './runners/lmstudio.js';
import { MockRunner } from './runners/mock.js';
import type { Runner } from './runners/types.js';

const program = new Command();

program
  .name('gambiarra-client')
  .description('Cliente para Gambiarra LLM Club Arena')
  .version('1.0.0')
  .requiredOption('--url <url>', 'WebSocket server URL', 'ws://localhost:3000/ws')
  .requiredOption('--pin <pin>', 'Session PIN')
  .requiredOption('--participant-id <id>', 'Participant ID')
  .requiredOption('--nickname <name>', 'Participant nickname')
  .option('--runner <type>', 'Runner type (ollama, lmstudio, mock)', 'ollama')
  .option('--model <model>', 'Model name', 'llama3.1:8b')
  .option('--temperature <temp>', 'Temperature', parseFloat, 0.8)
  .option('--max-tokens <tokens>', 'Max tokens', parseInt, 400)
  .option('--ollama-url <url>', 'Ollama API URL', 'http://localhost:11434')
  .option('--lmstudio-url <url>', 'LM Studio API URL', 'http://localhost:1234')
  .parse();

const options = program.opts();

async function main() {
  console.log(chalk.bold.cyan('\n🎮 Gambiarra LLM Club Client\n'));

  // Create runner
  let runner: Runner;

  switch (options.runner) {
    case 'ollama':
      console.log(chalk.gray(`Using Ollama at ${options.ollamaUrl}`));
      runner = new OllamaRunner(options.ollamaUrl, options.model);
      break;
    case 'lmstudio':
      console.log(chalk.gray(`Using LM Studio at ${options.lmstudioUrl}`));
      runner = new LMStudioRunner(options.lmstudioUrl, options.model);
      break;
    case 'mock':
      console.log(chalk.yellow('Using Mock runner (simulated tokens)'));
      runner = new MockRunner();
      break;
    default:
      console.error(chalk.red(`Unknown runner: ${options.runner}`));
      process.exit(1);
  }

  // Test runner
  try {
    await runner.test();
    console.log(chalk.green('✓ Runner connection OK\n'));
  } catch (error) {
    console.error(chalk.red('✗ Runner connection failed:'), error);
    process.exit(1);
  }

  // Create client
  const client = new GambiarraClient({
    url: options.url,
    participantId: options.participantId,
    nickname: options.nickname,
    pin: options.pin,
    runner: options.runner,
    model: options.model,
  });

  // Connect
  try {
    await client.connect();
    console.log(chalk.green('✓ Connected to server\n'));
  } catch (error) {
    console.error(chalk.red('✗ Failed to connect:'), error);
    process.exit(1);
  }

  // Handle challenges
  client.on('challenge', async (challenge) => {
    console.log(chalk.bold.yellow(`\n📢 New Challenge - Round ${challenge.round}`));
    console.log(chalk.gray(`Prompt: ${challenge.prompt}`));
    console.log(chalk.gray(`Max tokens: ${challenge.max_tokens}, Deadline: ${challenge.deadline_ms}ms\n`));

    try {
      let seq = 0;
      const startTime = Date.now();
      let firstTokenTime: number | null = null;
      const allTokens: string[] = [];

      await runner.generate(
        challenge.prompt,
        {
          maxTokens: challenge.max_tokens,
          temperature: challenge.temperature,
          seed: challenge.seed,
        },
        (token) => {
          if (firstTokenTime === null) {
            firstTokenTime = Date.now();
          }

          allTokens.push(token);

          // Send token to server
          client.sendToken({
            round: challenge.round,
            seq,
            content: token,
          });

          // Log progress
          process.stdout.write(chalk.gray('.'));
          seq++;
        }
      );

      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const latencyMsFirstToken = firstTokenTime ? firstTokenTime - startTime : undefined;

      console.log(chalk.green(`\n\n✓ Completed ${seq} tokens in ${(durationMs / 1000).toFixed(2)}s`));

      if (latencyMsFirstToken) {
        console.log(chalk.gray(`  First token latency: ${latencyMsFirstToken}ms`));
      }

      // Send completion
      client.sendComplete({
        round: challenge.round,
        tokens: seq,
        latency_ms_first_token: latencyMsFirstToken,
        duration_ms: durationMs,
        model_info: {
          name: options.model,
          runner: options.runner,
        },
      });
    } catch (error) {
      console.error(chalk.red('✗ Generation failed:'), error);

      client.sendError({
        round: challenge.round,
        code: 'GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Handle disconnect
  client.on('close', () => {
    console.log(chalk.yellow('\n⚠️  Disconnected from server'));
    process.exit(0);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nShutting down...'));
    client.disconnect();
    process.exit(0);
  });

  console.log(chalk.green('✓ Ready and waiting for challenges...'));
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
