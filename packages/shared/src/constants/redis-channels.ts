// Redis channel name constructors — all prefixed with tenantId for multi-tenant isolation

export const RedisChannels = {
  vertical: (tenantId: string, namespace: string) => `${tenantId}:vertical:${namespace}`,
  crossVerticalNew: (tenantId: string) => `${tenantId}:cross-vertical:new-request`,
  crossVerticalCompleted: (tenantId: string) => `${tenantId}:cross-vertical:completed`,
  telegramInbound: (tenantId: string, vertical: string) => `${tenantId}:telegram:${vertical}`,
  telegramOutbound: (tenantId: string) => `${tenantId}:telegram:outbound`,
  telegramDecision: (tenantId: string) => `${tenantId}:telegram:decision`,
  agentProgress: (tenantId: string, agentId: string) => `${tenantId}:agent:${agentId}:progress`,
  agentHeartbeat: (tenantId: string) => `${tenantId}:agent:heartbeat`,
} as const;
