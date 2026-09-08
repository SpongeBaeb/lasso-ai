import { useState, useEffect, useRef } from 'react';

export function RenameModal({ isOpen, currentName, onConfirm, onCancel, label }) {
  const [value, setValue] = useState(currentName || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setValue(currentName || '');
      // Small delay to let animation start, then focus
      setTimeout(() => inputRef.current?.select(), 100);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="rename-overlay" onClick={onCancel}>
      <div className="rename-modal animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="rename-emoji">✏️</div>
        <p className="rename-label">{label || 'Enter a new name'}</p>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="rename-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            maxLength={60}
          />
          <div className="rename-actions">
            <button type="button" className="rename-cancel-btn" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="rename-confirm-btn" disabled={!value.trim()}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
