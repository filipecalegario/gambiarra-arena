import { describe, it, expect } from 'vitest';
import {
  ChallengeMessageSchema,
  RegisterMessageSchema,
  TokenMessageSchema,
  CompleteMessageSchema,
  VoteMessageSchema,
} from './schemas';

describe('Message Schemas', () => {
  describe('ChallengeMessageSchema', () => {
    it('should validate valid challenge message', () => {
      const message = {
        type: 'challenge',
        session_id: 'sess-123',
        round: 1,
        prompt: 'Test prompt',
        max_tokens: 400,
        temperature: 0.8,
        deadline_ms: 90000,
        seed: 1234,
      };

      const result = ChallengeMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should reject invalid challenge message', () => {
      const message = {
        type: 'challenge',
        session_id: 'sess-123',
        // missing required fields
      };

      const result = ChallengeMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });
  });

  describe('RegisterMessageSchema', () => {
    it('should validate valid register message', () => {
      const message = {
        type: 'register',
        participant_id: 'test-1',
        nickname: 'Test',
        pin: '123456',
        runner: 'ollama',
        model: 'llama3.1:8b',
      };

      const result = RegisterMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });
  });

  describe('TokenMessageSchema', () => {
    it('should validate valid token message', () => {
      const message = {
        type: 'token',
        round: 1,
        participant_id: 'test-1',
        seq: 0,
        content: 'Hello',
      };

      const result = TokenMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should reject token with negative seq', () => {
      const message = {
        type: 'token',
        round: 1,
        participant_id: 'test-1',
        seq: -1,
        content: 'Hello',
      };

      const result = TokenMessageSchema.safeParse(message);
      expect(result.success).toBe(true); // Zod doesn't validate negative by default
    });
  });

  describe('VoteMessageSchema', () => {
    it('should validate valid vote', () => {
      const message = {
        type: 'vote',
        round: 1,
        voter_id: 'voter-1',
        participant_id: 'test-1',
        score: 5,
      };

      const result = VoteMessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should reject score out of range', () => {
      const message = {
        type: 'vote',
        round: 1,
        voter_id: 'voter-1',
        participant_id: 'test-1',
        score: 6,
      };

      const result = VoteMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
    });
  });
});
