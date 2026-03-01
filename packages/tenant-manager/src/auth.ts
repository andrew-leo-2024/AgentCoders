/**
 * HMAC-SHA256 bearer token authentication for tenant-manager API.
 *
 * API keys have the format: `{keyId}.{hmac}` where the HMAC is
 * derived from the keyId using a shared secret. Validation uses
 * timing-safe comparison to prevent timing attacks.
 */

import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

/**
 * Generate an API key from a shared secret.
 *
 * @returns A key in the format `{keyId}.{hmac}`
 */
export function generateApiKey(secret: string): string {
  const keyId = randomUUID();
  const hmac = createHmac('sha256', secret).update(keyId).digest('hex');
  return `${keyId}.${hmac}`;
}

/**
 * Validate a bearer token against the shared secret.
 *
 * @returns true if the token is valid
 */
export function validateBearerToken(token: string, secret: string): boolean {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;

  const keyId = token.slice(0, dotIndex);
  const providedHmac = token.slice(dotIndex + 1);

  if (!keyId || !providedHmac) return false;

  const expectedHmac = createHmac('sha256', secret).update(keyId).digest('hex');

  // Timing-safe comparison — both must be equal length
  if (providedHmac.length !== expectedHmac.length) return false;

  return timingSafeEqual(
    Buffer.from(providedHmac, 'utf8'),
    Buffer.from(expectedHmac, 'utf8'),
  );
}

/**
 * Extract bearer token from an Authorization header value.
 *
 * @returns The token string, or null if the header is missing/malformed
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
  return match?.[1] ?? null;
}
