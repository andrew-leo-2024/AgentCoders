import { spawn, type ChildProcess } from 'node:child_process';
import type { Logger } from '@agentcoders/shared';

export interface ClaudeCodeResult {
  exitCode: number;
  output: string;
  tokensUsed: { input: number; output: number };
  turns: number;
  durationMs: number;
  exitReason: 'completed' | 'timeout' | 'max-turns' | 'error';
}

export interface ClaudeCodeStreamEvent {
  type: string;
  subtype?: string;
  content?: string;
  session_id?: string;
  total_cost_usd?: number;
  usage?: { input_tokens: number; output_tokens: number };
  result?: string;
}

export interface ClaudeCodeOptions {
  prompt: string;
  workDir: string;
  maxTurns: number;
  timeoutMs: number;
  allowedTools?: string[];
  systemPrompt?: string;
  model?: string;
}

export class ClaudeCodeExecutor {
  private currentProcess: ChildProcess | null = null;
  private aborted = false;

  constructor(private readonly logger: Logger) {}

  async execute(options: ClaudeCodeOptions): Promise<ClaudeCodeResult> {
    const {
      prompt,
      workDir,
      maxTurns,
      timeoutMs,
      allowedTools,
      systemPrompt,
      model,
    } = options;

    const args = [
      '-p', prompt,
      '--output-format', 'stream-json',
      '--max-turns', String(maxTurns),
    ];

    if (allowedTools?.length) {
      for (const tool of allowedTools) {
        args.push('--allowedTools', tool);
      }
    }

    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    if (model) {
      args.push('--model', model);
    }

    const startTime = Date.now();
    this.aborted = false;

    return new Promise<ClaudeCodeResult>((resolve) => {
      const proc: ChildProcess = spawn('claude', args, {
        cwd: workDir,
        stdio: 'pipe',
      });

      this.currentProcess = proc;

      const timer = setTimeout(() => {
        this.aborted = true;
        proc.kill('SIGTERM');
        setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 10_000);
      }, timeoutMs);

      let output = '';
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let turns = 0;
      let exitReason: ClaudeCodeResult['exitReason'] = 'completed';

      const processLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const event: ClaudeCodeStreamEvent = JSON.parse(line);

          if (event.type === 'assistant' && event.subtype === 'text') {
            output += event.content ?? '';
          }

          if (event.usage) {
            totalInputTokens += event.usage.input_tokens;
            totalOutputTokens += event.usage.output_tokens;
          }

          if (event.type === 'turn_end') {
            turns++;
          }

          if (event.type === 'result') {
            output = event.result ?? output;
          }
        } catch {
          output += line + '\n';
        }
      };

      let buffer = '';
      proc.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          processLine(line);
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        this.logger.debug({ stderr: data.toString() }, 'Claude Code stderr');
      });

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        this.currentProcess = null;

        if (buffer) processLine(buffer);

        if (this.aborted) {
          exitReason = 'timeout';
        } else if (code !== 0) {
          exitReason = 'error';
        }

        resolve({
          exitCode: code ?? 1,
          output,
          tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
          turns,
          durationMs: Date.now() - startTime,
          exitReason,
        });
      });

      proc.on('error', (err: Error) => {
        clearTimeout(timer);
        this.currentProcess = null;
        this.logger.error({ err }, 'Claude Code process error');

        resolve({
          exitCode: 1,
          output: '',
          tokensUsed: { input: totalInputTokens, output: totalOutputTokens },
          turns,
          durationMs: Date.now() - startTime,
          exitReason: this.aborted ? 'timeout' : 'error',
        });
      });
    });
  }

  kill(): void {
    if (this.currentProcess) {
      this.logger.warn('Killing Claude Code process');
      this.currentProcess.kill('SIGTERM');
      const proc = this.currentProcess;
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 10_000);
    }
  }

  get isRunning(): boolean {
    return this.currentProcess !== null;
  }
}
