import React, { useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import ImportUrlModal from './ImportUrlModal';
import './UploadButton.css';

export default function ImportUrlButton({ onImport }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="upload-btn" onClick={() => setOpen(true)}>
        <LinkIcon size={16} />
        <span>Link</span>
      </button>

      {open && (
        <ImportUrlModal
          onConfirm={async (url) => {
            await onImport(url);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
