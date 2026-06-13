import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import './UploadButton.css';

export default function UploadButton({ onUpload }) {
  const inputRef = useRef(null);
  const [state, setState] = useState('idle'); // idle | uploading | done | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setState('uploading');
    setProgress(0);
    setError(null);

    try {
      await onUpload(file, (p) => setProgress(p));
      setState('done');
      setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      setError(err.message);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  return (
    <div className="upload-wrap">
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <button
        className={`upload-btn upload-btn--${state}`}
        onClick={() => state === 'idle' && inputRef.current.click()}
        disabled={state === 'uploading'}
      >
        {state === 'idle' && <><Plus size={18} /><span>Add</span></>}
        {state === 'uploading' && <span>{progress}%</span>}
        {state === 'done' && <span>✓</span>}
        {state === 'error' && <span title={error}>!</span>}
      </button>
    </div>
  );
}
