import { useState } from 'react';

export function ApiKeyModal({ onSave }) {
  const [key, setKey] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (key.trim()) {
      onSave(key.trim());
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div className="glass animate-in" style={{ padding: '2rem', maxWidth: '400px', width: '100%' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Enter Gemini API Key</h2>
        <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1.5rem' }}>
          This app requires a free Google Gemini API key to process images. Your key is only used locally.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIzaSy..."
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'rgba(0,0,0,0.2)',
              color: 'white',
              fontSize: '1rem'
            }}
          />
          <button type="submit" style={{ backgroundColor: 'var(--primary)', color: 'white', border: 'none' }}>
            Save Key
          </button>
        </form>
      </div>
    </div>
  );
}
