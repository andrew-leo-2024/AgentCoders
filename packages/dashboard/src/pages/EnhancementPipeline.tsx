import React, { useEffect, useState } from 'react';
import { api, EnhancementRun, EnhancementStage } from '../api/client.js';

const TENANT_ID = 'demo-tenant';

export function EnhancementPipeline() {
  const [runs, setRuns] = useState<EnhancementRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    api.getEnhancementRuns(TENANT_ID)
      .then(setRuns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={loadingStyle}>Loading enhancement pipeline...</div>;
  if (error) return <div style={errorStyle}>Error: {error}</div>;

  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  const statusCounts = {
    queued: runs.filter((r) => r.status === 'queued').length,
    running: runs.filter((r) => r.status === 'running').length,
    passed: runs.filter((r) => r.status === 'passed').length,
    failed: runs.filter((r) => r.status === 'failed').length,
  };

  return (
    <div>
      <h1 style={headingStyle}>Enhancement Pipeline</h1>
      <p style={subtitleStyle}>Pipeline run history and stage analysis</p>

      {/* Summary Bar */}
      <div style={summaryBarStyle}>
        <span style={{ ...summaryPill, backgroundColor: '#e3f2fd', color: '#1565c0' }}>
          {statusCounts.queued} Queued
        </span>
        <span style={{ ...summaryPill, backgroundColor: '#fff8e1', color: '#f57f17' }}>
          {statusCounts.running} Running
        </span>
        <span style={{ ...summaryPill, backgroundColor: '#e8f5e9', color: '#2e7d32' }}>
          {statusCounts.passed} Passed
        </span>
        <span style={{ ...summaryPill, backgroundColor: '#ffebee', color: '#c62828' }}>
          {statusCounts.failed} Failed
        </span>
        <span style={totalCount}>{runs.length} total runs</span>
      </div>

      {/* Run List */}
      {sortedRuns.length === 0 ? (
        <div style={emptyState}>No enhancement runs found.</div>
      ) : (
        <div style={runListStyle}>
          {sortedRuns.map((run) => {
            const isExpanded = expandedRunId === run.id;
            const duration = run.completedAt
              ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
              : null;

            return (
              <div key={run.id} style={runCardStyle}>
                <div
                  style={runCardHeader}
                  onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                >
                  <div style={runCardLeft}>
                    <span style={expandIcon}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                    <span style={runStatusBadge(run.status)}>{run.status}</span>
                    <span style={monoStyle}>{run.id.slice(0, 12)}</span>
                  </div>
                  <div style={runCardMeta}>
                    <span style={runMetaItem}>
                      Agent: <strong>{run.agentId}</strong>
                    </span>
                    <span style={runMetaItem}>
                      WI: <strong>{run.workItemId}</strong>
                    </span>
                    {run.overallScore !== null && (
                      <span style={scoreBadge(run.overallScore)}>
                        Score: {run.overallScore}
                      </span>
                    )}
                    {duration !== null && (
                      <span style={runMetaItem}>{formatDuration(duration)}</span>
                    )}
                    <span style={runMetaDate}>
                      {new Date(run.startedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={stagesContainer}>
                    <div style={stagesPipeline}>
                      {run.stages.map((stage, idx) => (
                        <StageBlock key={idx} stage={stage} isLast={idx === run.stages.length - 1} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StageBlock({ stage, isLast }: { stage: EnhancementStage; isLast: boolean }) {
  const durationMs = stage.durationMs;
  const durationStr = durationMs !== null ? `${(durationMs / 1000).toFixed(1)}s` : '--';

  return (
    <div style={stageBlockWrapper}>
      <div style={{ ...stageBlock, ...stageStatusStyle(stage.status) }}>
        <div style={stageName}>{stage.name}</div>
        <div style={stageStatusText}>{stage.status}</div>
        {stage.score !== null && <div style={stageScore}>Score: {stage.score}</div>}
        <div style={stageDuration}>{durationStr}</div>
      </div>
      {!isLast && <div style={stageConnector} />}
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${min}m ${sec}s`;
}

const stageStatusStyle = (status: EnhancementStage['status']): React.CSSProperties => {
  switch (status) {
    case 'passed': return { borderColor: '#4caf50', backgroundColor: '#f1f8e9' };
    case 'failed': return { borderColor: '#f44336', backgroundColor: '#fce4ec' };
    case 'running': return { borderColor: '#ff9800', backgroundColor: '#fff8e1' };
    case 'pending': return { borderColor: '#bdbdbd', backgroundColor: '#fafafa' };
    case 'skipped': return { borderColor: '#9e9e9e', backgroundColor: '#f5f5f5' };
  }
};

const runStatusBadge = (status: EnhancementRun['status']): React.CSSProperties => {
  const colors: Record<string, { bg: string; fg: string }> = {
    queued: { bg: '#e3f2fd', fg: '#1565c0' },
    running: { bg: '#fff8e1', fg: '#f57f17' },
    passed: { bg: '#e8f5e9', fg: '#2e7d32' },
    failed: { bg: '#ffebee', fg: '#c62828' },
  };
  const c = colors[status] || { bg: '#f5f5f5', fg: '#666' };
  return {
    display: 'inline-block', padding: '0.2rem 0.6rem',
    backgroundColor: c.bg, color: c.fg,
    borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
  };
};

const scoreBadge = (score: number): React.CSSProperties => ({
  display: 'inline-block', padding: '0.15rem 0.5rem',
  backgroundColor: score >= 80 ? '#e8f5e9' : score >= 50 ? '#fff8e1' : '#ffebee',
  color: score >= 80 ? '#2e7d32' : score >= 50 ? '#f57f17' : '#c62828',
  borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
});

// --- Styles ---

const headingStyle: React.CSSProperties = { margin: '0 0 0.25rem 0' };
const subtitleStyle: React.CSSProperties = { color: '#666', marginTop: 0 };

const loadingStyle: React.CSSProperties = {
  padding: '2rem', textAlign: 'center', color: '#666', fontSize: '1.1rem',
};
const errorStyle: React.CSSProperties = {
  padding: '1rem', backgroundColor: '#fdecea', color: '#c62828',
  borderRadius: '6px', border: '1px solid #ef9a9a',
};
const emptyState: React.CSSProperties = {
  padding: '3rem', textAlign: 'center', color: '#999',
};

const summaryBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem',
};
const summaryPill: React.CSSProperties = {
  padding: '0.375rem 0.75rem', borderRadius: '16px',
  fontSize: '0.8rem', fontWeight: 600,
};
const totalCount: React.CSSProperties = {
  marginLeft: 'auto', fontSize: '0.8rem', color: '#999',
};

const runListStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.5rem',
};
const runCardStyle: React.CSSProperties = {
  border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden',
};
const runCardHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '0.75rem 1rem', cursor: 'pointer',
  backgroundColor: '#fafafa',
};
const runCardLeft: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem',
};
const expandIcon: React.CSSProperties = {
  fontSize: '0.65rem', color: '#999', width: '14px',
};
const monoStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: '0.8rem', color: '#555',
};
const runCardMeta: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem',
};
const runMetaItem: React.CSSProperties = { color: '#666' };
const runMetaDate: React.CSSProperties = { color: '#999', fontSize: '0.75rem' };

const stagesContainer: React.CSSProperties = {
  padding: '1rem', borderTop: '1px solid #eee',
};
const stagesPipeline: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto',
};
const stageBlockWrapper: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
};
const stageBlock: React.CSSProperties = {
  padding: '0.75rem', borderRadius: '6px',
  border: '2px solid', minWidth: '120px', textAlign: 'center',
};
const stageName: React.CSSProperties = {
  fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem',
};
const stageStatusText: React.CSSProperties = {
  fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em',
};
const stageScore: React.CSSProperties = {
  fontSize: '0.75rem', fontWeight: 600, marginTop: '0.25rem',
};
const stageDuration: React.CSSProperties = {
  fontSize: '0.7rem', color: '#999', marginTop: '0.15rem',
};
const stageConnector: React.CSSProperties = {
  width: '24px', height: '2px', backgroundColor: '#ccc', flexShrink: 0,
};
