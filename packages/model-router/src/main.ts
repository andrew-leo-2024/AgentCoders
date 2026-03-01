import { createServer, type Server } from 'node:http';
import { createLogger } from '@agentcoders/shared';
import { getConfig } from './config.js';
import { ModelRouter } from './router.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAIProvider } from './providers/openai.js';
import { GoogleProvider } from './providers/google.js';
import { OllamaProvider } from './providers/ollama.js';
import { RoutingStrategyEngine } from './strategy.js';
import { FallbackChainExecutor } from './fallback-chain.js';
import { CostCalculator } from './cost-calculator.js';
import { TokenBucketRateLimiter } from './rate-limiter.js';
import { HealthMonitor } from './health-monitor.js';
import { ModelRegistry } from './model-registry.js';

export type { RouteOptions } from './router.js';

const logger = createLogger('model-router');

let healthServer: Server | null = null;

/**
 * Creates a ModelRouter instance with all available providers registered.
 * Providers are registered based on available API keys in config.
 */
export function createModelRouter(): ModelRouter {
  const config = getConfig();

  const router = new ModelRouter({
    defaultStrategy: config.DEFAULT_STRATEGY,
    rateLimit: config.RATE_LIMIT_RPM,
  });

  // Register providers based on available API keys
  if (config.ANTHROPIC_API_KEY) {
    try {
      router.registerProvider(new AnthropicProvider(config.ANTHROPIC_API_KEY));
      logger.info('Anthropic provider registered');
    } catch (err) {
      logger.warn({ err }, 'Failed to register Anthropic provider');
    }
  }

  if (config.OPENAI_API_KEY) {
    try {
      router.registerProvider(new OpenAIProvider(config.OPENAI_API_KEY));
      logger.info('OpenAI provider registered');
    } catch (err) {
      logger.warn({ err }, 'Failed to register OpenAI provider');
    }
  }

  if (config.GOOGLE_API_KEY) {
    try {
      router.registerProvider(new GoogleProvider(config.GOOGLE_API_KEY));
      logger.info('Google provider registered');
    } catch (err) {
      logger.warn({ err }, 'Failed to register Google provider');
    }
  }

  // Ollama doesn't require an API key — always register
  try {
    router.registerProvider(new OllamaProvider(config.OLLAMA_BASE_URL));
    logger.info('Ollama provider registered');
  } catch (err) {
    logger.warn({ err }, 'Failed to register Ollama provider');
  }

  return router;
}

/**
 * Starts the HTTP health check server on the configured port.
 */
async function startHealthServer(port: number): Promise<void> {
  healthServer = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    if (req.url === '/readyz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready: true, service: 'model-router' }));
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  return new Promise((resolve) => {
    healthServer!.listen(port, () => {
      logger.info({ port }, 'Health server started');
      resolve();
    });
  });
}

/**
 * Main entry point when running as a standalone service.
 */
async function main(): Promise<void> {
  const config = getConfig();

  logger.info({
    defaultProvider: config.DEFAULT_PROVIDER,
    defaultStrategy: config.DEFAULT_STRATEGY,
    rateLimit: config.RATE_LIMIT_RPM,
  }, 'Starting model-router service');

  const router = createModelRouter();

  await startHealthServer(config.HEALTH_PORT);

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down model-router service...');
    if (healthServer) {
      healthServer.close();
    }
    logger.info('Model-router service shut down');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info({ port: config.HEALTH_PORT }, 'Model-router service started');

  // Keep reference alive for library consumers
  return void router;
}

// Re-export all public API
export { ModelRouter } from './router.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { OpenAIProvider } from './providers/openai.js';
export { GoogleProvider } from './providers/google.js';
export { OllamaProvider } from './providers/ollama.js';
export { BaseProvider } from './providers/base.js';
export { RoutingStrategyEngine } from './strategy.js';
export { FallbackChainExecutor } from './fallback-chain.js';
export { CostCalculator } from './cost-calculator.js';
export { TokenBucketRateLimiter } from './rate-limiter.js';
export { HealthMonitor } from './health-monitor.js';
export { ModelRegistry } from './model-registry.js';
export { getConfig } from './config.js';

// Auto-start when run as main module
// Use import.meta.url to detect if we're the entry point
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) {
  main().catch((err) => {
    logger.error({ err }, 'Fatal: model-router service failed to start');
    process.exit(1);
  });
}
