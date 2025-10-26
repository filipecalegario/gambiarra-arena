#!/usr/bin/env node
import { GambiarraClient } from '../net/ws.js';
import { MockRunner } from '../runners/mock.js';

const NUM_CLIENTS = 5;
const SERVER_URL = process.env.SERVER_URL || 'ws://localhost:3000/ws';
const PIN = process.env.PIN || '123456';

async function createClient(id: number) {
  const participantId = `sim-${id}`;
  const nickname = `Simulado ${id}`;

  const client = new GambiarraClient({
    url: SERVER_URL,
    participantId,
    nickname,
    pin: PIN,
    runner: 'mock',
    model: 'simulator',
  });

  const runner = new MockRunner();

  try {
    await client.connect();
    console.log(`✓ Client ${id} connected`);

    client.on('challenge', async (challenge) => {
      console.log(`[Client ${id}] Received challenge: Round ${challenge.round}`);

      let seq = 0;
      const startTime = Date.now();
      let firstTokenTime: number | null = null;

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

          client.sendToken({
            round: challenge.round,
            seq,
            content: token,
          });

          seq++;
        }
      );

      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const latencyMsFirstToken = firstTokenTime ? firstTokenTime - startTime : undefined;

      client.sendComplete({
        round: challenge.round,
        tokens: seq,
        latency_ms_first_token: latencyMsFirstToken,
        duration_ms: durationMs,
        model_info: {
          name: 'simulator',
          runner: 'mock',
        },
      });

      console.log(`[Client ${id}] Completed ${seq} tokens in ${(durationMs / 1000).toFixed(2)}s`);
    });

    client.on('close', () => {
      console.log(`[Client ${id}] Disconnected`);
    });
  } catch (error) {
    console.error(`[Client ${id}] Failed to connect:`, error);
  }

  return client;
}

async function main() {
  console.log(`\n🎮 Starting ${NUM_CLIENTS} simulated clients...\n`);

  const clients = [];

  for (let i = 1; i <= NUM_CLIENTS; i++) {
    clients.push(await createClient(i));
    // Stagger connections slightly
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n✓ All ${NUM_CLIENTS} clients connected and ready\n`);
  console.log('Press Ctrl+C to stop simulation\n');

  // Keep alive
  process.on('SIGINT', () => {
    console.log('\n\nShutting down simulation...');
    clients.forEach((c) => c.disconnect());
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('Simulation failed:', error);
  process.exit(1);
});
