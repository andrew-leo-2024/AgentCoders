import { AgentRuntime } from './runtime.js';

const runtime = new AgentRuntime();
runtime.start().catch((err) => {
  console.error('Fatal: agent runtime failed to start', err);
  process.exit(1);
});
