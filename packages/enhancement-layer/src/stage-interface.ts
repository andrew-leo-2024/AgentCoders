import type { EnhancementStageType } from '@agentcoders/shared';

export interface EnhancementStage {
  name: string;
  type: EnhancementStageType;
  execute(input: string, context: StageContext): Promise<StageOutput>;
}

export interface StageContext {
  tenantId: string;
  agentId: string;
  workItemId?: number;
  metadata: Record<string, unknown>;
}

export interface StageOutput {
  content: string;
  modified: boolean;
  details: Record<string, unknown>;
}
