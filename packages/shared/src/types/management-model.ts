// Management Model types — org model catalog

export type ManagementModelType = 'spotify' | 'safe' | 'scrum-at-scale' | 'team-topologies';

export interface GroupMember {
  agentId: string;
  role: string;
  joinedAt: Date;
}

export interface AgentGroup {
  id: string;
  name: string;
  type: string;
  members: GroupMember[];
  metadata: Record<string, unknown>;
}

export interface TopologyConfig {
  modelType: ManagementModelType;
  groups: AgentGroup[];
  cadence: CadenceConfig;
  escalationPaths: EscalationPath[];
}

export interface CadenceConfig {
  sprintLengthDays: number;
  standupFrequency: 'daily' | 'twice-daily' | 'weekly';
  retrospectiveFrequency: 'per-sprint' | 'monthly' | 'quarterly';
  planningFrequency: 'per-sprint' | 'per-pi' | 'quarterly';
}

export interface EscalationPath {
  fromGroup: string;
  toGroup: string;
  triggerConditions: string[];
}

export interface ManagementConfig {
  id: string;
  tenantId: string;
  modelType: ManagementModelType;
  topology: TopologyConfig;
  cadence: CadenceConfig;
  escalationPaths: EscalationPath[];
}
