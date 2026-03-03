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
  // Platform extension channels
  audit: (tenantId: string) => `${tenantId}:governance:audit`,
  telemetry: (tenantId: string) => `${tenantId}:governance:telemetry`,
  modelRoute: (tenantId: string) => `${tenantId}:model-router:route`,
  enhancement: (tenantId: string, agentId: string) => `${tenantId}:enhancement:${agentId}`,
  memorySync: (tenantId: string) => `${tenantId}:memory:sync`,
  failureAlert: (tenantId: string) => `${tenantId}:governance:failure-alert`,
  // DWI lifecycle channels — consumed by billing-service
  dwiWorkItemCreated: (tenantId: string) => `${tenantId}:dwi:work-item-created`,
  prLinked: (tenantId: string) => `${tenantId}:pr:linked`,
  ciCompleted: (tenantId: string) => `${tenantId}:ci:completed`,
  prApproved: (tenantId: string) => `${tenantId}:pr:approved`,
  prMerged: (tenantId: string) => `${tenantId}:pr:merged`,
  dwiWorkItemClosed: (tenantId: string) => `${tenantId}:dwi:work-item-closed`,
} as const;
