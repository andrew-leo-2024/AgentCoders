import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ValueDashboard } from './pages/ValueDashboard.js';
import { AgentStatus } from './pages/AgentStatus.js';

export function App() {
  return (
    <BrowserRouter>
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <nav style={{ marginBottom: '2rem' }}>
          <Link to="/" style={{ marginRight: '1rem' }}>Dashboard</Link>
          <Link to="/agents" style={{ marginRight: '1rem' }}>Agents</Link>
        </nav>
        <Routes>
          <Route path="/" element={<ValueDashboard />} />
          <Route path="/agents" element={<AgentStatus />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
