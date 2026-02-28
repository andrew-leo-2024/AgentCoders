import { spawn, type ChildProcess } from 'node:child_process';
import type { Logger } from '@agentcoders/shared';

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitClient {
  constructor(
    private readonly workDir: string,
    private readonly logger: Logger,
  ) {}

  async exec(args: string[], timeoutMs = 60_000): Promise<GitExecResult> {
    return new Promise((resolve, reject) => {
      const proc: ChildProcess = spawn('git', args, {
        cwd: this.workDir,
        stdio: 'pipe',
      });

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`git ${args.join(' ')} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 1 });
      });

      proc.on('error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async createBranch(workItemId: number, slug: string): Promise<string> {
    const branchName = `ai/${workItemId}-${slug}`;
    await this.exec(['fetch', 'origin']);
    await this.exec(['checkout', '-b', branchName, 'origin/main']);
    this.logger.info({ branchName, workItemId }, 'Created branch');
    return branchName;
  }

  async commitAndPush(branch: string, message: string): Promise<void> {
    await this.exec(['add', '-A']);
    const status = await this.exec(['status', '--porcelain']);
    if (!status.stdout) {
      this.logger.info('No changes to commit');
      return;
    }
    await this.exec(['commit', '-m', message]);
    await this.exec(['push', 'origin', branch]);
    this.logger.info({ branch }, 'Committed and pushed');
  }

  async rebase(baseBranch: string): Promise<{ success: boolean; conflictFiles?: string[] }> {
    await this.exec(['fetch', 'origin']);
    const result = await this.exec(['rebase', `origin/${baseBranch}`]);

    if (result.exitCode !== 0) {
      await this.exec(['rebase', '--abort']);
      const conflictFiles = result.stderr
        .split('\n')
        .filter((line) => line.includes('CONFLICT'))
        .map((line) => line.replace(/^CONFLICT.*: /, ''));
      this.logger.warn({ conflictFiles }, 'Rebase failed — conflicts detected');
      return { success: false, conflictFiles };
    }

    return { success: true };
  }

  async getCommitsBehind(baseBranch: string): Promise<number> {
    await this.exec(['fetch', 'origin']);
    const result = await this.exec(['rev-list', '--count', `HEAD..origin/${baseBranch}`]);
    return parseInt(result.stdout, 10) || 0;
  }

  async getCurrentBranch(): Promise<string> {
    const result = await this.exec(['rev-parse', '--abbrev-ref', 'HEAD']);
    return result.stdout;
  }

  async cleanWorkspace(): Promise<void> {
    await this.exec(['checkout', 'main']);
    await this.exec(['pull', 'origin', 'main']);
  }

  async createRevertCommit(commitHash: string): Promise<string> {
    const result = await this.exec(['revert', '--no-edit', commitHash]);
    if (result.exitCode !== 0) {
      throw new Error(`Failed to revert ${commitHash}: ${result.stderr}`);
    }
    const logResult = await this.exec(['rev-parse', 'HEAD']);
    return logResult.stdout;
  }
}
