import React, { useEffect, useState } from 'react';
import { api, ManagementConfig, ManagementGroup } from '../api/client.js';

const TENANT_ID = 'demo-tenant';

export function ManagementModel() {
  const [config, setConfig] = useState<ManagementConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getManagementConfig(TENANT_ID)
      .then(setConfig)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={loadingStyle}>Loading management model...</div>;
  if (error) return <div style={errorStyle}>Error: {error}</div>;
  if (!config) return <div style={emptyState}>No management configuration found.</div>;

  // Build tree structure
  const rootGroups = config.groups.filter((g) => g.parentId === null);
  const childrenOf = (parentId: string): ManagementGroup[] =>
    config.groups.filter((g) => g.parentId === parentId);

  return (
    <div>
      <h1 style={headingStyle}>Management Model</h1>
      <p style={subtitleStyle}>Organizational topology and governance</p>

      {/* Model Type */}
      <div style={modelTypeBanner}>
        <span style={modelTypeLabel}>Model Type:</span>
        <span style={modelTypeValue}>{config.modelType}</span>
      </div>

      {/* Cadence Config */}
      <h2 style={sectionHeading}>Cadence Configuration</h2>
      <div style={cadenceGrid}>
        <div style={cadenceCard}>
          <div style={cadenceLabel}>Standup</div>
          <div style={cadenceCron}>{config.cadence.standupCron}</div>
        </div>
        <div style={cadenceCard}>
          <div style={cadenceLabel}>Review</div>
          <div style={cadenceCron}>{config.cadence.reviewCron}</div>
        </div>
        <div style={cadenceCard}>
          <div style={cadenceLabel}>Planning</div>
          <div style={cadenceCron}>{config.cadence.planningCron}</div>
        </div>
      </div>

      {/* Group Topology */}
      <h2 style={sectionHeading}>Group Topology</h2>
      {rootGroups.length === 0 ? (
        <div style={emptyState}>No groups configured.</div>
      ) : (
        <div style={treeContainer}>
          {rootGroups.map((group) => (
            <GroupNode key={group.id} group={group} childrenOf={childrenOf} depth={0} />
          ))}
        </div>
      )}

      {/* Escalation Policies */}
      <h2 style={sectionHeading}>Escalation Policies</h2>
      {config.escalationPolicies.length === 0 ? (
        <div style={emptyState}>No escalation policies defined.</div>
      ) : (
        <div style={escalationContainer}>
          {config.escalationPolicies
            .sort((a, b) => a.level - b.level)
            .map((policy, idx) => (
              <div key={idx} style={escalationStep}>
                <div style={escalationLevel}>L{policy.level}</div>
                <div style={escalationArrow}>{idx < config.escalationPolicies.length - 1 ? '-->' : ''}</div>
                <div style={escalationDetails}>
                  <div style={escalationTarget}>{policy.target}</div>
                  <div style={escalationTimeout}>Timeout: {policy.timeoutMinutes}min</div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function GroupNode({
  group,
  childrenOf,
  depth,
}: {
  group: ManagementGroup;
  childrenOf: (parentId: string) => ManagementGroup[];
  depth: number;
}) {
  const children = childrenOf(group.id);

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div style={groupNodeStyle}>
        <div style={groupHeader}>
          <span style={groupIcon}>{children.length > 0 ? '\u25BC' : '\u25CF'}</span>
          <span style={groupName}>{group.name}</span>
          <span style={groupId}>{group.id}</span>
        </div>
        {group.agents.length > 0 && (
          <div style={agentList}>
            {group.agents.map((agent) => (
              <span key={agent} style={agentPill}>{agent}</span>
            ))}
          </div>
        )}
        {group.escalationPath.length > 0 && (
          <div style={escalationPathRow}>
            <span style={escalationPathLabel}>Escalation:</span>
            {group.escalationPath.map((step, i) => (
              <span key={i}>
                <span style={escalationPathStep}>{step}</span>
                {i < group.escalationPath.length - 1 && <span style={escalationPathSep}> &rarr; </span>}
              </span>
            ))}
          </div>
        )}
      </div>
      {children.map((child) => (
        <GroupNode key={child.id} group={child} childrenOf={childrenOf} depth={depth + 1} />
      ))}
    </div>
  );
}

// --- Styles ---

const headingStyle: React.CSSProperties = { margin: '0 0 0.25rem 0' };
const subtitleStyle: React.CSSProperties = { color: '#666', marginTop: 0 };
const sectionHeading: React.CSSProperties = { fontSize: '1.1rem', marginTop: '2rem', marginBottom: '0.75rem' };
const emptyState: React.CSSProperties = { padding: '2rem', textAlign: 'center', color: '#999' };

const loadingStyle: React.CSSProperties = {
  padding: '2rem', textAlign: 'center', color: '#666', fontSize: '1.1rem',
};
const errorStyle: React.CSSProperties = {
  padding: '1rem', backgroundColor: '#fdecea', color: '#c62828',
  borderRadius: '6px', border: '1px solid #ef9a9a',
};

const modelTypeBanner: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.75rem',
  padding: '0.75rem 1rem', backgroundColor: '#e8eaf6',
  borderRadius: '8px', marginBottom: '1rem',
};
const modelTypeLabel: React.CSSProperties = { fontSize: '0.85rem', color: '#5c6bc0' };
const modelTypeValue: React.CSSProperties = {
  fontSize: '1.1rem', fontWeight: 700, color: '#1a237e',
};

const cadenceGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem',
};
const cadenceCard: React.CSSProperties = {
  border: '1px solid #e0e0e0', borderRadius: '8px',
  padding: '1rem', textAlign: 'center',
};
const cadenceLabel: React.CSSProperties = {
  fontSize: '0.8rem', color: '#666', textTransform: 'uppercase',
  letterSpacing: '0.05em', marginBottom: '0.5rem',
};
const cadenceCron: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: '1rem', fontWeight: 600, color: '#333',
};

const treeContainer: React.CSSProperties = { marginBottom: '1rem' };
const groupNodeStyle: React.CSSProperties = {
  padding: '0.75rem', margin: '0.375rem 0',
  backgroundColor: '#fafafa', borderRadius: '6px',
  border: '1px solid #eee', borderLeft: '3px solid #5c6bc0',
};
const groupHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem',
};
const groupIcon: React.CSSProperties = { fontSize: '0.6rem', color: '#5c6bc0' };
const groupName: React.CSSProperties = { fontWeight: 600, fontSize: '0.9rem' };
const groupId: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: '0.7rem', color: '#999',
};

const agentList: React.CSSProperties = {
  display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.5rem',
};
const agentPill: React.CSSProperties = {
  display: 'inline-block', padding: '0.15rem 0.5rem',
  backgroundColor: '#e3f2fd', color: '#1565c0',
  borderRadius: '12px', fontSize: '0.75rem', fontFamily: 'monospace',
};

const escalationPathRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.25rem',
  marginTop: '0.375rem', fontSize: '0.75rem',
};
const escalationPathLabel: React.CSSProperties = { color: '#999', marginRight: '0.25rem' };
const escalationPathStep: React.CSSProperties = {
  padding: '0.1rem 0.4rem', backgroundColor: '#fff3e0',
  color: '#e65100', borderRadius: '3px', fontSize: '0.7rem',
};
const escalationPathSep: React.CSSProperties = { color: '#ccc' };

const escalationContainer: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap',
};
const escalationStep: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem',
};
const escalationLevel: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '32px', height: '32px', borderRadius: '50%',
  backgroundColor: '#ff8f00', color: '#fff',
  fontSize: '0.8rem', fontWeight: 700,
};
const escalationArrow: React.CSSProperties = {
  color: '#bbb', fontFamily: 'monospace', fontSize: '0.9rem',
};
const escalationDetails: React.CSSProperties = {};
const escalationTarget: React.CSSProperties = { fontWeight: 600, fontSize: '0.85rem' };
const escalationTimeout: React.CSSProperties = { fontSize: '0.7rem', color: '#999' };
