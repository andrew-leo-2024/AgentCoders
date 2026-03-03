/**
 * sse-handler.ts — Server-Sent Events endpoint for real-time dashboard updates.
 *
 * Subscribes to tenant-scoped Redis pub/sub channels and forwards events
 * to connected dashboard clients via SSE.
 */

import type * as http from 'node:http';
import { Redis } from 'ioredis';
import { RedisChannels, createLogger } from '@agentcoders/shared';

const logger = createLogger('tenant-manager:sse');

export function handleSseConnection(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  tenantId: string,
  redisUrl: string,
): void {
  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  // Send initial heartbeat
  res.write('event: connected\ndata: {"status":"connected"}\n\n');

  // Dedicated Redis subscriber for this SSE connection
  const subscriber = new Redis(redisUrl);

  const channels = [
    RedisChannels.agentHeartbeat(tenantId),
    RedisChannels.audit(tenantId),
    RedisChannels.telemetry(tenantId),
    RedisChannels.failureAlert(tenantId),
    RedisChannels.telegramOutbound(tenantId),
    RedisChannels.dwiWorkItemCreated(tenantId),
    RedisChannels.prLinked(tenantId),
    RedisChannels.ciCompleted(tenantId),
    RedisChannels.prApproved(tenantId),
    RedisChannels.prMerged(tenantId),
    RedisChannels.dwiWorkItemClosed(tenantId),
  ];

  subscriber.subscribe(...channels).catch((err: Error) => {
    logger.error({ err: err.message, tenantId }, 'SSE Redis subscribe failed');
  });

  subscriber.on('message', (channel: string, message: string) => {
    // Extract event type from channel name (e.g., "tenant-123:governance:audit" → "audit")
    const eventType = channel.replace(`${tenantId}:`, '').replace(/[:/]/g, '-');
    res.write(`event: ${eventType}\ndata: ${message}\n\n`);
  });

  // Keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => {
    res.write(':ping\n\n');
  }, 30_000);

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
    subscriber.unsubscribe().catch(() => {});
    subscriber.disconnect();
    logger.info({ tenantId }, 'SSE client disconnected');
  });

  logger.info({ tenantId, channelCount: channels.length }, 'SSE client connected');
}
