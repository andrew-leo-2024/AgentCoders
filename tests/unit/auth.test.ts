import { describe, it, expect } from 'vitest';
import { generateApiKey, validateBearerToken, extractBearerToken } from '../../packages/tenant-manager/src/auth.js';

const TEST_SECRET = 'a-very-secure-test-secret-that-is-at-least-32-chars';

describe('API Key Authentication', () => {
  describe('generateApiKey', () => {
    it('should generate a key in {uuid}.{hmac} format', () => {
      const key = generateApiKey(TEST_SECRET);
      const parts = key.split('.');
      expect(parts).toHaveLength(2);
      // UUID part
      expect(parts[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      // HMAC hex part (SHA-256 = 64 hex chars)
      expect(parts[1]).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique keys each call', () => {
      const key1 = generateApiKey(TEST_SECRET);
      const key2 = generateApiKey(TEST_SECRET);
      expect(key1).not.toBe(key2);
    });
  });

  describe('validateBearerToken', () => {
    it('should accept a valid generated key', () => {
      const key = generateApiKey(TEST_SECRET);
      expect(validateBearerToken(key, TEST_SECRET)).toBe(true);
    });

    it('should reject a key generated with a different secret', () => {
      const key = generateApiKey(TEST_SECRET);
      expect(validateBearerToken(key, 'wrong-secret-that-is-also-32-chars-long!')).toBe(false);
    });

    it('should reject a tampered HMAC', () => {
      const key = generateApiKey(TEST_SECRET);
      const tampered = key.slice(0, -4) + 'dead';
      expect(validateBearerToken(tampered, TEST_SECRET)).toBe(false);
    });

    it('should reject a token without a dot separator', () => {
      expect(validateBearerToken('nodot', TEST_SECRET)).toBe(false);
    });

    it('should reject an empty string', () => {
      expect(validateBearerToken('', TEST_SECRET)).toBe(false);
    });

    it('should reject a token with empty keyId', () => {
      expect(validateBearerToken('.abcdef1234567890', TEST_SECRET)).toBe(false);
    });

    it('should reject a token with empty HMAC', () => {
      expect(validateBearerToken('some-key-id.', TEST_SECRET)).toBe(false);
    });
  });

  describe('extractBearerToken', () => {
    it('should extract token from valid Bearer header', () => {
      expect(extractBearerToken('Bearer my-token-here')).toBe('my-token-here');
    });

    it('should be case-insensitive for Bearer prefix', () => {
      expect(extractBearerToken('bearer my-token')).toBe('my-token');
      expect(extractBearerToken('BEARER my-token')).toBe('my-token');
    });

    it('should return null for missing header', () => {
      expect(extractBearerToken(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(extractBearerToken('')).toBeNull();
    });

    it('should return null for non-Bearer scheme', () => {
      expect(extractBearerToken('Basic abc123')).toBeNull();
    });

    it('should return null for Bearer with no token', () => {
      expect(extractBearerToken('Bearer ')).toBeNull();
    });
  });
});
