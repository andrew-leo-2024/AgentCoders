import React, { useEffect, useState } from 'react';
import { api, type AgentInfo } from '../api/client';

const TENANT_ID = 'demo-tenant';

export function AgentStatus() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAgents(TENANT_ID).then(setAgents).catch((err: Error) => setError(err.message));
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case 'working': return '#4caf50';
      case 'idle': return '#2196f3';
      case 'polling': return '#2196f3';
      case 'reviewing': return '#9c27b0';
      case 'blocked': return '#ff9800';
      case 'error': return '#f44336';
      case 'offline': return '#9e9e9e';
      default: return '#666';
    }
  };

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;

  return (
    <div>
      <h1>Agent Status</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
            <th style={{ padding: '0.75rem' }}>Agent</th>
            <th style={{ padding: '0.75rem' }}>Vertical</th>
            <th style={{ padding: '0.75rem' }}>Role</th>
            <th style={{ padding: '0.75rem' }}>Status</th>
            <th style={{ padding: '0.75rem' }}>Current WI</th>
            <th style={{ padding: '0.75rem' }}>Completed Today</th>
          </tr>
        </thead>
        <tbody>
          {agents.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>No agents registered</td></tr>
          )}
          {agents.map((agent) => (
            <tr key={agent.agentId} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{agent.agentId}</td>
              <td style={{ padding: '0.75rem' }}>{agent.vertical}</td>
              <td style={{ padding: '0.75rem' }}>{agent.role}</td>
              <td style={{ padding: '0.75rem' }}>
                <span style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: statusColor(agent.status),
                  marginRight: '0.5rem',
                }} />
                {agent.status}
              </td>
              <td style={{ padding: '0.75rem' }}>
                {agent.currentWorkItemId ? `#${agent.currentWorkItemId}` : '\u2014'}
              </td>
              <td style={{ padding: '0.75rem' }}>{agent.workItemsCompletedToday}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
