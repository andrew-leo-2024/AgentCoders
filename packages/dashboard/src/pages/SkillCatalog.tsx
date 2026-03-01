import React, { useEffect, useState } from 'react';
import { api, Skill } from '../api/client.js';

export function SkillCatalog() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSkills()
      .then(setSkills)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={loadingStyle}>Loading skill catalog...</div>;
  if (error) return <div style={errorStyle}>Error: {error}</div>;

  // Group by category
  const grouped: Record<string, Skill[]> = {};
  for (const skill of skills) {
    if (!grouped[skill.category]) grouped[skill.category] = [];
    grouped[skill.category].push(skill);
  }

  const sortedCategories = Object.keys(grouped).sort();

  return (
    <div>
      <h1 style={headingStyle}>Skill Catalog</h1>
      <p style={subtitleStyle}>{skills.length} skills across {sortedCategories.length} categories</p>

      {sortedCategories.length === 0 ? (
        <div style={emptyState}>No skills registered yet.</div>
      ) : (
        sortedCategories.map((category) => (
          <div key={category} style={categorySection}>
            <h2 style={categoryHeading}>
              <span style={categoryBadge}>{category}</span>
              <span style={categoryCount}>{grouped[category].length} skills</span>
            </h2>
            <div style={skillGridStyle}>
              {grouped[category].map((skill) => (
                <div key={skill.id} style={skillCardStyle}>
                  <div style={skillCardHeader}>
                    <span style={skillName}>{skill.name}</span>
                    <span style={skillVersion}>v{skill.version}</span>
                  </div>
                  <p style={skillDescription}>{skill.description}</p>
                  <div style={skillFooter}>
                    <span style={skill.isEnabled ? enabledBadge : disabledBadge}>
                      {skill.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <span style={skillDate}>
                      Added {new Date(skill.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

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
  padding: '3rem', textAlign: 'center', color: '#999', fontSize: '1rem',
};

const categorySection: React.CSSProperties = { marginBottom: '2rem' };
const categoryHeading: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.75rem',
  fontSize: '1rem', marginBottom: '0.75rem',
};
const categoryBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.3rem 0.75rem',
  backgroundColor: '#ede7f6', color: '#4527a0',
  borderRadius: '16px', fontSize: '0.9rem', fontWeight: 600,
};
const categoryCount: React.CSSProperties = {
  fontSize: '0.8rem', color: '#999',
};

const skillGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem',
};
const skillCardStyle: React.CSSProperties = {
  border: '1px solid #e0e0e0', borderRadius: '8px',
  padding: '1rem', display: 'flex', flexDirection: 'column',
  transition: 'box-shadow 0.15s',
};
const skillCardHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: '0.5rem',
};
const skillName: React.CSSProperties = {
  fontSize: '0.95rem', fontWeight: 600, color: '#212121',
};
const skillVersion: React.CSSProperties = {
  fontSize: '0.75rem', fontFamily: 'monospace',
  backgroundColor: '#f5f5f5', padding: '0.15rem 0.4rem',
  borderRadius: '3px', color: '#666',
};
const skillDescription: React.CSSProperties = {
  fontSize: '0.8rem', color: '#555', lineHeight: '1.4',
  flex: 1, margin: '0 0 0.75rem 0',
};
const skillFooter: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const enabledBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.15rem 0.5rem',
  backgroundColor: '#e8f5e9', color: '#2e7d32',
  borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
};
const disabledBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.15rem 0.5rem',
  backgroundColor: '#f5f5f5', color: '#9e9e9e',
  borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
};
const skillDate: React.CSSProperties = {
  fontSize: '0.7rem', color: '#bbb',
};
