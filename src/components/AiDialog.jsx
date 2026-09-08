import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { askQuestionWithImage } from '../lib/gemini';

export function AiDialog({ imageBase64, rect, onClose, language = 'en' }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);

  const t = {
    en: {
      askAi: "Ask AI",
      thinking: "Thinking...",
      selectQuestion: "Select a question to ask.",
      placeholder: "Ask something...",
      explain: "Explain",
      transcribe: "Transcribe"
    },
    ko: {
      askAi: "AI에게 묻기",
      thinking: "생각 중...",
      selectQuestion: "질문을 입력하세요.",
      placeholder: "무엇이든 물어보세요...",
      explain: "설명하기",
      transcribe: "텍스트 변환"
    }
  }[language];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    try {
      const finalQuestion = language === 'ko' ? `${question} (Please reply in Korean)` : question;
      const answer = await askQuestionWithImage(finalQuestion, imageBase64);
      setResponse(answer);
    } catch (err) {
      console.error(err);
      setResponse(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTranscribe = async () => {
    setLoading(true);
    try {
      const prompt = language === 'ko' 
        ? "이 이미지의 필기를 있는 그대로 정확하게 전사하세요. 텍스트만 출력하세요." 
        : "Transcribe the handwriting in this image exactly as written. Output only the text.";
      const answer = await askQuestionWithImage(prompt, imageBase64);
      setResponse(answer);
    } catch (err) {
      console.error(err);
      setResponse(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async () => {
    setLoading(true);
    try {
      const prompt = language === 'ko'
        ? "이 이미지의 내용을 자세히 설명하세요. 수학 방정식이 있다면 풀이와 함께 설명하세요. 답변은 한국어로 작성해주세요."
        : "Explain the contents of this image in detail. If there are math equations, solve and explain them.";
      const answer = await askQuestionWithImage(prompt, imageBase64);
      setResponse(answer);
    } catch (err) {
      console.error(err);
      setResponse(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Position the dialog near the lasso selection
  // Fallback to center if rect is missing or it goes offscreen
  let top = '50%';
  let left = '50%';
  let transform = 'translate(-50%, -50%)';

  if (rect) {
    const dialogHeightEstimate = 400; // estimated
    const yPos = rect.y + rect.height + 20;
    
    if (yPos + dialogHeightEstimate > window.innerHeight) {
      // Put it above if it would overflow the bottom
      top = `${Math.max(20, rect.y - dialogHeightEstimate - 20)}px`;
    } else {
      top = `${yPos}px`;
    }
    
    left = `${Math.min(Math.max(20, rect.x), window.innerWidth - 320 - 20)}px`;
    transform = 'none';
  }

  return (
    <div 
      className="glass animate-in"
      style={{
        position: 'fixed',
        top,
        left,
        transform,
        width: '320px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)' }}>{t.askAi}</h3>
        <button onClick={onClose} style={{ padding: '0.4rem', borderRadius: '50%', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(139,115,85,0.1)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>✕</button>
      </div>

      <div style={{ marginBottom: '1.2rem', maxHeight: '120px', overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(139,115,85,0.05)' }}>
        <img src={imageBase64} alt="Selected area" style={{ width: '100%', display: 'block', objectFit: 'contain' }} />
      </div>

      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        marginBottom: '1.2rem',
        maxHeight: '200px',
        fontSize: '0.95rem',
        color: response?.startsWith('Error:') ? '#ef4444' : 'var(--text-main)',
        lineHeight: 1.6
      }}>
        {response ? (
          <ReactMarkdown 
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {response}
          </ReactMarkdown>
        ) : (loading ? <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}><Loader2 className="animate-spin" size={16} /> {t.thinking}</div> : t.selectQuestion)}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t.placeholder}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            background: 'white',
            color: 'var(--text-main)',
            outline: 'none',
            boxShadow: 'inset 0 2px 4px rgba(139,115,85,0.05)',
            fontFamily: 'inherit'
          }}
          disabled={loading}
        />
        <button 
          type="submit" 
          disabled={loading || !question.trim()}
          style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: question.trim() ? 'var(--primary)' : 'white', color: question.trim() ? 'white' : 'var(--text-muted)', border: '1px solid var(--border-color)' }}
        >
          <Send size={18} />
        </button>
      </form>

      <div style={{ display: 'flex', marginTop: '0.75rem', gap: '0.5rem' }}>
        <button 
          type="button"
          onClick={handleExplain} 
          disabled={loading}
          style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: '600', backgroundColor: 'rgba(226,149,120,0.1)', color: 'var(--primary)', border: 'none', borderRadius: '16px', cursor: 'pointer' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(226,149,120,0.2)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(226,149,120,0.1)'}
        >
          {t.explain}
        </button>
        <button 
          type="button"
          onClick={handleTranscribe} 
          disabled={loading}
          style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: '600', backgroundColor: 'white', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '16px', cursor: 'pointer' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#FAF5F0'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
        >
          {t.transcribe}
        </button>
      </div>
    </div>
  );
}
