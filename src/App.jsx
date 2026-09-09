import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { MousePointer2, Pen, Crop, Upload, Home, Trash2, FileText, Undo2, Redo2, Download, Loader2, Eraser, Settings, LassoSelect, Type } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { LassoCanvas } from './components/LassoCanvas';
import { AiDialog } from './components/AiDialog';
import { SettingsModal } from './components/SettingsModal';
import { PdfViewer } from './components/PdfViewer';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { RenameModal } from './components/RenameModal';
import { initGemini } from './lib/gemini';
import { saveDocumentMetadata, saveAnnotations, getDocument, getAllDocuments, deleteDocument, renameDocument, clearAllDocuments } from './lib/storage';
import lassoImg from './assets/lasso.png';

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [language, setLanguage] = useState(localStorage.getItem('app_lang') || 'en');
  const [workspaceName, setWorkspaceName] = useState(localStorage.getItem('workspace_name') || "Bapsaju Jaehong");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleClearData = async () => {
    if (window.confirm(language === 'en' ? 'Are you sure you want to delete all saved notes? This cannot be undone.' : '모든 노트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      await clearAllDocuments();
      setSavedDocs([]);
      setApiKey('');
      localStorage.removeItem('gemini_api_key');
      setIsSettingsOpen(false);
    }
  };

  // Rename modal state
  const [renameModal, setRenameModal] = useState({ isOpen: false, currentName: '', label: '', onConfirm: null });

  const openRenameModal = (currentName, label, onConfirm) => {
    setRenameModal({ isOpen: true, currentName, label, onConfirm });
  };

  const closeRenameModal = () => {
    setRenameModal({ isOpen: false, currentName: '', label: '', onConfirm: null });
  };

  const handleRenameWorkspace = () => {
    openRenameModal(
      workspaceName,
      language === 'ko' ? '워크스페이스 이름을 입력하세요' : 'Rename your workspace',
      (newName) => {
        setWorkspaceName(newName);
        localStorage.setItem('workspace_name', newName);
        closeRenameModal();
      }
    );
  };

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'ko' : 'en';
    setLanguage(newLang);
    localStorage.setItem('app_lang', newLang);
  };

  const t = {
    en: {
      title: workspaceName,
      upload: "Upload a PDF",
      uploadDesc: "Drag and drop a PDF file here.",
      choose: "Choose PDF",
      blank: "Blank Note",
      blankDesc: "Start scribbling on a blank whiteboard.",
      create: "Create Note",
      saved: "Saved Documents",
      noSaved: "No saved documents yet."
    },
    ko: {
      title: workspaceName,
      upload: "PDF 업로드",
      uploadDesc: "여기에 PDF 파일을 드래그 앤 드롭하세요.",
      choose: "PDF 선택",
      blank: "새 빈 노트",
      blankDesc: "빈 화이트보드에 자유롭게 메모하세요.",
      create: "노트 생성",
      saved: "저장된 문서",
      noSaved: "아직 저장된 문서가 없습니다."
    }
  }[language];

  // Storage state
  const [savedDocs, setSavedDocs] = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [pdfFile, setPdfFile] = useState(null); // Object URL
  const [annotations, setAnnotations] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [documentName, setDocumentName] = useState('');

  // Tool state
  const [toolMode, setToolMode] = useState('pen'); // 'scroll', 'pen', 'lasso', 'eraser'
  const previousToolRef = useRef('pen');

  const handleSetToolMode = (newMode) => {
    if (newMode === 'lasso' && toolMode !== 'lasso') {
      previousToolRef.current = toolMode;
    }
    setToolMode(newMode);
  };
  const [penColor, setPenColor] = useState('#4A3F35');
  const [penThickness, setPenThickness] = useState(4);
  const [fontSize, setFontSize] = useState(24);
  const [isDragging, setIsDragging] = useState(false);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPoint = useRef(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Capture state
  const [selectedArea, setSelectedArea] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);

  const contentRef = useRef(null);

  useEffect(() => {
    if (activeDocumentId) {
      loadDoc(activeDocumentId);
    } else {
      refreshDocList();
    }
  }, [activeDocumentId, language]);

  // Aggressive touch prevention for iOS Safari on the workspace
  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const preventTouch = (e) => {
      // Prevent scrolling if not in scroll mode, or if we have a PDF (PDF handles its own scroll sometimes, but let's be safe)
      if (toolMode !== 'scroll') {
        e.preventDefault();
      }
    };

    content.addEventListener('touchmove', preventTouch, { passive: false });
    
    return () => {
      content.removeEventListener('touchmove', preventTouch);
    };
  }, [toolMode, pdfFile]);

  useEffect(() => {
    if (apiKey) {
      initGemini(apiKey);
    }
  }, [apiKey]);

  useEffect(() => {
    refreshDocList();
  }, []);

  const refreshDocList = async () => {
    const docs = await getAllDocuments();
    setSavedDocs(docs);
  };

  const handleSaveApiKey = (key) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
    initGemini(key);
  };

  const loadDoc = async (id) => {
    const doc = await getDocument(id);
    if (doc) {
      if (doc.pdfBlob) {
        const url = URL.createObjectURL(doc.pdfBlob);
        setPdfFile(url);
      } else {
        setPdfFile(null);
      }
      setAnnotations(doc.annotations);
      setDocumentName(doc.name);
      setActiveDocumentId(id);
      handleSetToolMode('pen');
    }
  };

  const closeDoc = () => {
    if (pdfFile) URL.revokeObjectURL(pdfFile);
    setPdfFile(null);
    setAnnotations([]);
    setRedoStack([]);
    setActiveDocumentId(null);
    setShowExportMenu(false);
    setSelectedArea(null);
    setImageBase64(null);
    refreshDocList();
  };

  const handleDeleteDoc = async (id, e) => {
    e.stopPropagation();
    await deleteDocument(id);
    setCameraOffset({ x: 0, y: 0 });
    refreshDocList();
  };

  const handleRenameDoc = async (id, currentName, e) => {
    e.stopPropagation();
    openRenameModal(
      currentName,
      language === 'ko' ? '문서 이름을 입력하세요' : 'Rename document',
      async (newName) => {
        if (newName !== currentName) {
          await renameDocument(id, newName);
          refreshDocList();
        }
        closeRenameModal();
      }
    );
  };

  const handleFileUpload = async (file) => {
    if (file && file.type === 'application/pdf') {
      const id = Date.now().toString();
      await saveDocumentMetadata(id, file.name, file);
      await loadDoc(id);
    }
  };

  const handleCreateBlankNote = async () => {
    const id = Date.now().toString();
    await saveDocumentMetadata(id, `Quick Note ${new Date().toLocaleDateString()}`, null);
    await loadDoc(id);
  };

  const handleFileChange = (e) => {
    handleFileUpload(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files[0]);
  };

  const handlePathsChange = (newPaths) => {
    setAnnotations(newPaths);
    setRedoStack([]);
    if (activeDocumentId) {
      saveAnnotations(activeDocumentId, newPaths);
    }
  };

  const handleUndo = () => {
    if (annotations.length === 0) return;
    const lastPath = annotations[annotations.length - 1];
    const newAnnotations = annotations.slice(0, -1);
    setAnnotations(newAnnotations);
    setRedoStack(prev => [...prev, lastPath]);
    if (activeDocumentId) {
      saveAnnotations(activeDocumentId, newAnnotations);
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const pathToRestore = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    const newAnnotations = [...annotations, pathToRestore];
    setAnnotations(newAnnotations);
    setRedoStack(newRedoStack);
    if (activeDocumentId) {
      saveAnnotations(activeDocumentId, newAnnotations);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!activeDocumentId) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [annotations, redoStack, activeDocumentId]);

  const handleWorkspacePointerDown = (e) => {
    if (toolMode === 'scroll' && !pdfFile) {
      e.target.setPointerCapture(e.pointerId);
      setIsPanning(true);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleWorkspacePointerMove = (e) => {
    if (isPanning && toolMode === 'scroll' && !pdfFile) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      setCameraOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleWorkspacePointerUp = (e) => {
    if (isPanning) {
      e.target.releasePointerCapture(e.pointerId);
      setIsPanning(false);
      lastPanPoint.current = null;
    }
  };

  const handleExport = async (format) => {
    setShowExportMenu(false);
    setIsExporting(true);

    // Wait for React to render the loading state
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const toolbar = document.getElementById('floating-toolbar');
      if (toolbar) toolbar.style.display = 'none';

      // We capture the contentRef which contains everything
      const canvas = await html2canvas(contentRef.current, {
        windowWidth: contentRef.current.scrollWidth,
        windowHeight: contentRef.current.scrollHeight,
        width: contentRef.current.scrollWidth,
        height: contentRef.current.scrollHeight,
        backgroundColor: pdfFile ? '#ffffff' : '#e2e8f0', // Match background
        useCORS: true,
      });

      if (toolbar) toolbar.style.display = 'flex';

      const dataUrl = canvas.toDataURL('image/png');
      const filename = `${documentName || 'Note'}_${new Date().toISOString().split('T')[0]}`;

      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = dataUrl;
        link.click();
      } else if (format === 'pdf') {
        // Calculate aspect ratio
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const orientation = imgWidth > imgHeight ? 'l' : 'p';

        const pdf = new jsPDF({
          orientation: orientation,
          unit: 'px',
          format: [imgWidth, imgHeight]
        });

        pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`${filename}.pdf`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleLassoComplete = async (rect) => {
    handleSetToolMode(previousToolRef.current); // Revert to previous tool

    // Wait for React to flush the DOM update and remove LassoCanvas
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Hide toolbar to prevent it from being captured if it overlaps
      const toolbar = document.getElementById('floating-toolbar');
      if (toolbar) toolbar.style.display = 'none';

      const content = contentRef.current;
      if (!content) return;

      const bounds = content.getBoundingClientRect();
      
      // Calculate the crop coordinates relative to the scrollable content's top-left corner
      const cropX = (rect.x - bounds.left) + content.scrollLeft;
      const cropY = (rect.y - bounds.top) + content.scrollTop;

      const canvas = await html2canvas(content, {
        x: cropX,
        y: cropY,
        width: rect.width,
        height: rect.height,
        backgroundColor: '#f8f4eb', // Match new cozy background
        useCORS: true,
      });

      if (toolbar) toolbar.style.display = 'flex';

      const dataUrl = canvas.toDataURL('image/png');
      setImageBase64(dataUrl);
      setSelectedArea(rect);
    } catch (err) {
      console.error('Failed to capture:', err);
    }
  };

  const handleCloseDialog = () => {
    setSelectedArea(null);
    setImageBase64(null);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}>
      <button 
        onClick={() => { setIsSettingsOpen(true); setSelectedArea(null); setImageBase64(null); }}
        style={{ position: 'fixed', top: '1.25rem', left: '1.25rem', zIndex: 9999, background: 'var(--panel-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.6rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(12px)', boxShadow: 'var(--shadow-medium)', opacity: 0.3, transition: 'all 0.3s ease' }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'rotate(45deg)'; e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'rotate(0deg)'; e.currentTarget.style.opacity = '0.3'; }}
        title={language === 'ko' ? '설정' : 'Settings'}
      >
        <Settings size={24} />
      </button>

      {(!apiKey || isSettingsOpen) && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          apiKey={apiKey}
          onSaveApiKey={handleSaveApiKey}
          language={language}
          onToggleLanguage={toggleLanguage}
          onClearData={handleClearData}
          allowClose={!!apiKey}
        />
      )}

      {/* Home Screen */}
      {!activeDocumentId && (
        <div className="home-container">
          <h1 className="home-title" onClick={handleRenameWorkspace} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }} title={language === 'ko' ? '클릭하여 이름 변경' : 'Click to rename'}>
            <img src={lassoImg} alt="Lasso" style={{ height: '1.2em', objectFit: 'contain' }} />
            {t.title}
            <Pen size={20} color="var(--text-muted)" style={{ opacity: 0.6 }} />
          </h1>

          <div className="home-grid">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`home-card upload-card ${isDragging ? 'dragging' : ''}`}
            >
              <h2>{t.upload}</h2>
              <p>{t.uploadDesc}</p>
              <label className="primary-btn" style={{ position: 'relative', overflow: 'hidden' }}>
                <Upload size={20} />
                {t.choose}
                <input 
                  type="file" 
                  accept="application/pdf" 
                  onChange={handleFileChange} 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
                />
              </label>
            </div>

            <div
              onClick={handleCreateBlankNote}
              className="home-card blank-note-card"
            >
              <h2>{t.blank}</h2>
              <p>{t.blankDesc}</p>
              <button className="dark-btn">
                <Pen size={20} />
                {t.create}
              </button>
            </div>
          </div>

          <h2 className="section-title">{t.saved}</h2>
          {savedDocs.length === 0 ? (
            <p className="empty-text">{t.noSaved}</p>
          ) : (
            <div className="saved-docs-grid">
              {savedDocs.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => loadDoc(doc.id)}
                  className="glass"
                  style={{
                    backgroundColor: 'white',
                    padding: '2rem',
                    borderRadius: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.2rem',
                    transition: 'all 0.3s ease',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-soft)'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = 'var(--shadow-medium)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-soft)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <FileText size={32} color="var(--primary)" />
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      <button
                        onClick={(e) => handleRenameDoc(doc.id, doc.name, e)}
                        style={{ background: 'transparent', border: 'none', padding: '0.4rem', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '50%' }}
                        title="Rename"
                      >
                        <Pen size={16} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDoc(doc.id, e)}
                        style={{ background: 'transparent', border: 'none', padding: '0.4rem', color: '#E29578', cursor: 'pointer', borderRadius: '50%' }}
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {new Date(doc.lastModified).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Workspace Area */}
      {activeDocumentId && (
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'auto',
            backgroundColor: pdfFile ? 'transparent' : 'white',
            cursor: (toolMode === 'scroll' && !pdfFile) ? (isPanning ? 'grabbing' : 'grab') : 'default',
            touchAction: (toolMode === 'pen' || toolMode === 'eraser' || toolMode === 'text' || (toolMode === 'scroll' && !pdfFile)) ? 'none' : 'auto',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
          ref={contentRef}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          onPointerDown={handleWorkspacePointerDown}
          onPointerMove={handleWorkspacePointerMove}
          onPointerUp={handleWorkspacePointerUp}
          onPointerCancel={handleWorkspacePointerUp}
        >
          <div style={{ position: 'relative', minHeight: '100%' }}>
            {/* The PDF Document */}
            {pdfFile && (
              <div style={{ paddingTop: '2rem' }}>
                <PdfViewer file={pdfFile} />
              </div>
            )}

            {/* The Annotation Layer */}
            <AnnotationCanvas
              toolMode={toolMode}
              containerRef={contentRef}
              paths={annotations}
              onPathsChange={handlePathsChange}
              penColor={penColor}
              penThickness={penThickness}
              fontSize={fontSize}
              cameraOffset={cameraOffset}
            />
          </div>
        </div>
      )}

      {/* Floating Toolbar */}
      {activeDocumentId && (
        <div id="floating-toolbar" className="toolbar-container">
          {/* Left Side: 4 buttons, 2 separators */}
          <ToolbarButton icon={<Home size={28} />} active={false} onClick={closeDoc} title="Home" />
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />
          
          <ToolbarButton icon={<Undo2 size={24} />} active={false} onClick={handleUndo} title="Undo (Ctrl+Z)" disabled={annotations.length === 0} />
          <ToolbarButton icon={<Redo2 size={24} />} active={false} onClick={handleRedo} title="Redo (Ctrl+Y)" disabled={redoStack.length === 0} />
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />
          
          <ToolbarButton icon={<MousePointer2 size={28} />} active={toolMode === 'scroll'} onClick={() => handleSetToolMode('scroll')} title="Scroll/Pan" />

          {/* Center: 2 buttons */}
          <div style={{ position: 'relative', display: 'flex' }}>
            <ToolbarButton icon={<Pen size={28} />} active={toolMode === 'pen'} onClick={() => handleSetToolMode('pen')} title="Pen Tool" />
            <ToolbarButton icon={<Type size={28} />} active={toolMode === 'text'} onClick={() => handleSetToolMode('text')} title="Text Tool" />
          </div>

          {/* Right Side: 4 buttons, 2 separators */}
          <ToolbarButton icon={<Eraser size={28} />} active={toolMode === 'eraser'} onClick={() => handleSetToolMode('eraser')} title="Eraser Tool" />
          <ToolbarButton icon={<LassoSelect size={28} />} active={toolMode === 'lasso'} onClick={() => handleSetToolMode('lasso')} title="Lasso Tool" />
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />

          <ToolbarButton 
            icon={<Trash2 size={24} />} 
            active={false}
            onClick={() => { 
              if (window.confirm(language === 'ko' ? '모든 드로잉을 지우시겠습니까?' : 'Clear all drawings?')) {
                handlePathsChange([]); 
              }
            }} 
            title="Clear Canvas" 
            disabled={annotations.length === 0} 
          />
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />

          <ToolbarButton icon={<Download size={28} />} active={showExportMenu} onClick={() => setShowExportMenu(!showExportMenu)} title="Export" />
        </div>
      )}

      {/* Export Menu (Rendered outside to prevent clipping from overflow-x) */}
      {showExportMenu && activeDocumentId && (
        <div style={{ position: 'fixed', bottom: (toolMode === 'pen' || toolMode === 'text') ? '11.5rem' : '7rem', left: '50%', backgroundColor: 'var(--panel-bg)', padding: '1rem', borderRadius: '24px', display: 'flex', gap: '1rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-medium)', zIndex: 1001, backdropFilter: 'blur(16px)', transition: 'bottom 0.3s ease' }} className="chewy-in">
          <button onClick={() => handleExport('pdf')} className="primary-btn" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '16px' }}>Save as PDF</button>
          <button onClick={() => handleExport('png')} className="dark-btn" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '16px' }}>Save as PNG</button>
        </div>
      )}

      {/* Pen/Text Options Palette (Rendered outside toolbar to avoid overflow clipping) */}
      {(toolMode === 'pen' || toolMode === 'text') && activeDocumentId && (
        <div style={{ position: 'fixed', bottom: '7rem', left: '50%', backgroundColor: 'var(--panel-bg)', padding: '0.75rem', borderRadius: '24px', display: 'flex', gap: '0.75rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-medium)', zIndex: 1001, backdropFilter: 'blur(16px)' }} className="chewy-in">
          {['#4A3F35', '#E29578', '#A3B18A', '#E2C275', '#A98467'].map(c => (
            <button key={c} onClick={() => setPenColor(c)} style={{ width: '28px', height: '28px', borderRadius: '14px', backgroundColor: c, border: penColor === c ? '3px solid white' : '3px solid transparent', padding: 0, cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
          ))}
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }} />
          {toolMode === 'pen' ? (
            [2, 4, 8].map(t => (
              <button key={t} onClick={() => setPenThickness(t)} style={{ width: '28px', height: '28px', borderRadius: '14px', backgroundColor: 'white', border: penThickness === t ? '2px solid var(--primary)' : '2px solid transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <div style={{ width: '14px', height: `${t}px`, backgroundColor: 'var(--text-main)', borderRadius: '2px' }} />
              </button>
            ))
          ) : (
            [16, 24, 36].map(s => (
              <button key={s} onClick={() => setFontSize(s)} style={{ width: '28px', height: '28px', borderRadius: '14px', backgroundColor: 'white', border: fontSize === s ? '2px solid var(--primary)' : '2px solid transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: `${s * 0.45}px`, fontWeight: 700, color: 'var(--text-main)', fontFamily: 'Quicksand, sans-serif' }}>
                {s === 16 ? 'S' : s === 24 ? 'M' : 'L'}
              </button>
            ))
          )}
        </div>
      )}

      {/* Lasso Overlay */}
      {toolMode === 'lasso' && (
        <LassoCanvas
          onSelectionComplete={handleLassoComplete}
          onCancel={() => handleSetToolMode(previousToolRef.current)}
        />
      )}

      {/* AI Dialog */}
      {selectedArea && imageBase64 && (
        <AiDialog
          imageBase64={imageBase64}
          rect={selectedArea}
          onClose={handleCloseDialog}
          language={language}
        />
      )}

      {/* Loading Overlay */}
      {isExporting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', backdropFilter: 'blur(4px)' }}>
          <Loader2 size={48} className="animate-spin" style={{ marginBottom: '1rem' }} />
          <h2>Exporting Document...</h2>
          <p style={{ color: '#94a3b8' }}>This might take a few seconds for large files.</p>
        </div>
      )}

      {/* Rename Modal */}
      <RenameModal
        isOpen={renameModal.isOpen}
        currentName={renameModal.currentName}
        label={renameModal.label}
        onConfirm={renameModal.onConfirm}
        onCancel={closeRenameModal}
      />
    </div>
  );
}

function ToolbarButton({ icon, active, onClick, title, disabled }) {
  return (
    <button
      onClick={disabled ? null : onClick}
      title={title}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '56px',
        height: '56px',
        borderRadius: '20px',
        border: 'none',
        backgroundColor: active ? 'var(--primary)' : 'transparent',
        color: disabled ? 'rgba(74, 63, 53, 0.3)' : (active ? 'white' : 'var(--text-muted)'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.5)';
      }}
      onMouseLeave={(e) => {
        if (!disabled && !active) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {icon}
    </button>
  );
}

export default App;
