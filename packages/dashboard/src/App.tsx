import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ValueDashboard } from './pages/ValueDashboard.js';
import { AgentStatus } from './pages/AgentStatus.js';
import { AuditTrail } from './pages/AuditTrail.js';
import { TelemetryDashboard } from './pages/TelemetryDashboard.js';
import { FailurePatterns } from './pages/FailurePatterns.js';
import { ModelRouter } from './pages/ModelRouter.js';
import { SkillCatalog } from './pages/SkillCatalog.js';
import { ManagementModel } from './pages/ManagementModel.js';
import { EnhancementPipeline } from './pages/EnhancementPipeline.js';
import { InsuranceDashboard } from './pages/InsuranceDashboard.js';

export function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <nav style={navStyle}>
          <h1 style={titleStyle}>AgentCoders Dashboard</h1>
          <div style={linksContainer}>
            <Link to="/" style={linkStyle}>Value</Link>
            <Link to="/agents" style={linkStyle}>Agents</Link>
            <Link to="/audit" style={linkStyle}>Audit</Link>
            <Link to="/telemetry" style={linkStyle}>Telemetry</Link>
            <Link to="/failures" style={linkStyle}>Failures</Link>
            <Link to="/models" style={linkStyle}>Models</Link>
            <Link to="/skills" style={linkStyle}>Skills</Link>
            <Link to="/management" style={linkStyle}>Management</Link>
            <Link to="/enhancements" style={linkStyle}>Enhancements</Link>
            <Link to="/insurance" style={linkStyle}>Insurance</Link>
          </div>
        </nav>
        <main style={mainStyle}>
          <Routes>
            <Route path="/" element={<ValueDashboard />} />
            <Route path="/agents" element={<AgentStatus />} />
            <Route path="/audit" element={<AuditTrail />} />
            <Route path="/telemetry" element={<TelemetryDashboard />} />
            <Route path="/failures" element={<FailurePatterns />} />
            <Route path="/models" element={<ModelRouter />} />
            <Route path="/skills" element={<SkillCatalog />} />
            <Route path="/management" element={<ManagementModel />} />
            <Route path="/enhancements" element={<EnhancementPipeline />} />
            <Route path="/insurance" element={<InsuranceDashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  padding: '1rem 1.5rem',
  backgroundColor: '#1a237e',
  color: '#fff',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 700,
};

const linksContainer: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem 1rem',
};

const linkStyle: React.CSSProperties = {
  color: '#bbdefb',
  textDecoration: 'none',
  fontSize: '0.875rem',
  padding: '0.25rem 0.5rem',
  borderRadius: '4px',
  transition: 'background-color 0.15s',
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  padding: '1.5rem',
};
