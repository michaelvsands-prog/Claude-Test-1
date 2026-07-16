import React from 'react';
import { AppProvider, useApp } from './store/AppContext.jsx';
import UploadsTab from './components/UploadsTab.jsx';
import MappingTab from './components/MappingTab.jsx';
import ExportTab from './components/ExportTab.jsx';

const TABS = [
  { id: 'uploads', label: 'Uploads' },
  { id: 'mapping', label: 'Mapping' },
  { id: 'export', label: 'Export' },
];

function Shell() {
  const { state, dispatch } = useApp();

  if (!state.hydrated) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-name">SRM Crosswalk</div>
            <div className="brand-sub">Beacon Advisory Partners · Engagement Accelerator</div>
          </div>
        </div>
        <div className="privacy-badge" title="Files are parsed in your browser and stored locally. Nothing is transmitted to any server.">
          <span className="dot" /> Data never leaves this laptop
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${state.activeTab === t.id ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TAB', tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {state.activeTab === 'uploads' && <UploadsTab />}
        {state.activeTab === 'mapping' && <MappingTab />}
        {state.activeTab === 'export' && <ExportTab />}
      </main>

      <footer className="app-footer">
        Demonstration tool · Synthetic data only · © Beacon Advisory Partners
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
