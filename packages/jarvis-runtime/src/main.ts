import { Jarvis } from './jarvis.js';

const jarvis = new Jarvis();
jarvis.start().catch((err) => {
  console.error('Fatal: Jarvis runtime failed to start', err);
  process.exit(1);
});
