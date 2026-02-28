import React, { useEffect, useState } from 'react';

interface Agent {
  agentId: string;
  vertical: string;
  status: string;
  currentWorkItemId: number | null;
  lastHeartbeat: string;
  workItemsCompletedToday: number;
}

export function AgentStatus() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    // Placeholder — will fetch from API
    setAgents([
      { agentId: 'agent-backend-1', vertical: 'backend', status: 'working', currentWorkItemId: 42, lastHeartbeat: new Date().toISOString(), workItemsCompletedToday: 3 },
      { agentId: 'agent-backend-2', vertical: 'backend', status: 'idle', currentWorkItemId: null, lastHeartbeat: new Date().toISOString(), workItemsCompletedToday: 5 },
      { agentId: 'agent-frontend-1', vertical: 'frontend', status: 'working', currentWorkItemId: 55, lastHeartbeat: new Date().toISOString(), workItemsCompletedToday: 2 },
    ]);
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case 'working': return '#4caf50';
      case 'idle': return '#2196f3';
      case 'blocked': return '#ff9800';
      case 'error': return '#f44336';
      case 'offline': return '#9e9e9e';
      default: return '#666';
    }
  };

  return (
    <div>
      <h1>Agent Status</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
            <th style={{ padding: '0.75rem' }}>Agent</th>
            <th style={{ padding: '0.75rem' }}>Vertical</th>
            <th style={{ padding: '0.75rem' }}>Status</th>
            <th style={{ padding: '0.75rem' }}>Current WI</th>
            <th style={{ padding: '0.75rem' }}>Completed Today</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.agentId} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{agent.agentId}</td>
              <td style={{ padding: '0.75rem' }}>{agent.vertical}</td>
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
                {agent.currentWorkItemId ? `#${agent.currentWorkItemId}` : '—'}
              </td>
              <td style={{ padding: '0.75rem' }}>{agent.workItemsCompletedToday}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
