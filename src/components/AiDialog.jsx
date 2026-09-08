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
        padding: '1rem',
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>{t.askAi}</h3>
        <button onClick={onClose} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: 'transparent', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ marginBottom: '1rem', maxHeight: '120px', overflow: 'hidden', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <img src={imageBase64} alt="Selected area" style={{ width: '100%', display: 'block', objectFit: 'contain' }} />
      </div>

      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        marginBottom: '1rem',
        maxHeight: '200px',
        fontSize: '0.9rem',
        color: response?.startsWith('Error:') ? '#ef4444' : '#e2e8f0'
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
            padding: '0.5rem',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            background: 'rgba(0,0,0,0.2)',
            color: 'white',
            outline: 'none'
          }}
          disabled={loading}
        />
        <button 
          type="submit" 
          disabled={loading || !question.trim()}
          style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Send size={16} />
        </button>
      </form>

      <div style={{ display: 'flex', marginTop: '0.5rem', gap: '0.5rem' }}>
        <button 
          type="button"
          onClick={handleExplain} 
          disabled={loading}
          style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', backgroundColor: 'transparent', color: '#94a3b8', border: '1px dashed var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          {t.explain}
        </button>
        <button 
          type="button"
          onClick={handleTranscribe} 
          disabled={loading}
          style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', backgroundColor: 'transparent', color: '#94a3b8', border: '1px dashed var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          {t.transcribe}
        </button>
      </div>
    </div>
  );
}
