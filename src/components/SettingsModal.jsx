import { useState } from 'react';
import { validateGeminiApiKey } from '../lib/gemini';
import { KeyRound, Globe, Trash2, X } from 'lucide-react';

export function SettingsModal({ onClose, apiKey, onSaveApiKey, language, onToggleLanguage, onClearData, allowClose = true }) {
  const [key, setKey] = useState(apiKey || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const t = {
    title: language === 'ko' ? '설정' : 'Settings',
    apiKey: language === 'ko' ? 'Gemini API 키' : 'Gemini API Key',
    apiKeyDesc: language === 'ko' ? '이 앱은 이미지 처리를 위해 무료 Google Gemini API 키가 필요합니다. 키는 로컬에만 저장됩니다.' : 'This app requires a free Google Gemini API key to process images. Your key is only used locally.',
    placeholder: 'AIzaSy...',
    save: language === 'ko' ? '키 저장' : 'Save Key',
    validating: language === 'ko' ? '확인 중...' : 'Validating...',
    language: language === 'ko' ? '언어' : 'Language',
    languageToggle: language === 'ko' ? '🇺🇸 English' : '🇰🇷 한국어',
    dangerZone: language === 'ko' ? '위험 구역' : 'Danger Zone',
    clearData: language === 'ko' ? '모든 데이터 삭제' : 'Clear All Data',
    clearDesc: language === 'ko' ? '저장된 모든 문서를 삭제합니다. 이 작업은 되돌릴 수 없습니다.' : 'Delete all saved documents. This cannot be undone.',
    invalidKey: language === 'ko' ? '잘못된 API 키입니다. 확인 후 다시 시도해주세요.' : 'Invalid API key. Please check and try again.',
    keySaved: language === 'ko' ? '키가 저장되었습니다.' : 'Key saved successfully.',
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (key.trim()) {
      setIsLoading(true);
      setError('');
      setSuccess('');
      const isValid = await validateGeminiApiKey(key.trim());
      setIsLoading(false);
      if (isValid) {
        onSaveApiKey(key.trim());
        setSuccess(t.keySaved);
        if (allowClose && !apiKey) {
          onClose(); // Auto close if it was forcing entry
        }
      } else {
        setError(t.invalidKey);
      }
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
      zIndex: 10001
    }}>
      <div className="glass animate-in" style={{ padding: '2.5rem', maxWidth: '450px', width: '90%', position: 'relative' }}>
        {allowClose && (
          <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        )}
        
        <h2 style={{ marginTop: 0, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.75rem', color: 'var(--text-main)' }}>
          {t.title}
        </h2>

        {/* API Key Section */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <KeyRound size={18} />
            {t.apiKey}
          </h3>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            {t.apiKeyDesc}
          </p>
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && <p style={{ color: '#e11d48', fontSize: '0.9rem', margin: 0 }}>{error}</p>}
            {success && <p style={{ color: '#16a34a', fontSize: '0.9rem', margin: 0 }}>{success}</p>}
            <input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t.placeholder}
              style={{
                padding: '0.85rem',
                borderRadius: '12px',
                border: '2px solid var(--border-color)',
                background: 'var(--bg-color)',
                color: 'var(--text-main)',
                fontSize: '1.05rem',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
            <button type="submit" disabled={isLoading} style={{ backgroundColor: 'var(--primary)', color: 'white', border: 'none', opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer', padding: '0.85rem', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 'bold' }}>
              {isLoading ? t.validating : t.save}
            </button>
          </form>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '2rem 0', opacity: 0.5 }} />

        {/* Language Section */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={18} />
            {t.language}
          </h3>
          <button 
            onClick={onToggleLanguage}
            className="dark-btn"
            style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', borderRadius: '12px' }}
          >
            {t.languageToggle}
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '2rem 0', opacity: 0.5 }} />

        {/* Danger Zone */}
        <div>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e11d48' }}>
            <Trash2 size={18} />
            {t.dangerZone}
          </h3>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            {t.clearDesc}
          </p>
          <button 
            onClick={onClearData}
            style={{ 
              width: '100%', 
              padding: '0.85rem', 
              borderRadius: '12px', 
              border: '2px solid #e11d48', 
              background: 'transparent', 
              color: '#e11d48', 
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '1.05rem',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fff1f2'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {t.clearData}
          </button>
        </div>

      </div>
    </div>
  );
}
