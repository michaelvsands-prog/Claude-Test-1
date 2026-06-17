import React from 'react';
import './FolderBar.css';

export default function FolderBar({ folders, active, onSelect }) {
  return (
    <div className="folder-bar">
      {folders.map(folder => (
        <button
          key={folder}
          className={`folder-tab ${folder === active ? 'folder-tab--active' : ''}`}
          onClick={() => onSelect(folder)}
        >
          {folder}
        </button>
      ))}
    </div>
  );
}
