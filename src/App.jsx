import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { MousePointer2, Pen, Crop, Upload, Home, Trash2, FileText, Undo2, Redo2, Download, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { LassoCanvas } from './components/LassoCanvas';
import { AiDialog } from './components/AiDialog';
import { ApiKeyModal } from './components/ApiKeyModal';
import { PdfViewer } from './components/PdfViewer';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { initGemini } from './lib/gemini';
import { saveDocumentMetadata, saveAnnotations, getDocument, getAllDocuments, deleteDocument, renameDocument } from './lib/storage';

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  
  // Storage state
  const [savedDocs, setSavedDocs] = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [pdfFile, setPdfFile] = useState(null); // Object URL
  const [annotations, setAnnotations] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [documentName, setDocumentName] = useState('');

  // Tool state
  const [toolMode, setToolMode] = useState('scroll'); // 'scroll', 'pen', 'lasso'
  const [penColor, setPenColor] = useState('#ef4444');
  const [penThickness, setPenThickness] = useState(4);
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
    }
  };

  const closeDoc = () => {
    if (pdfFile) URL.revokeObjectURL(pdfFile);
    setPdfFile(null);
    setAnnotations([]);
    setRedoStack([]);
    setActiveDocumentId(null);
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
    const newName = prompt('Enter new document name:', currentName);
    if (newName && newName.trim() !== '' && newName !== currentName) {
      await renameDocument(id, newName.trim());
      refreshDocList();
    }
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
    setToolMode('scroll'); // Revert tool
    
    // Wait for React to flush the DOM update and remove LassoCanvas
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Hide toolbar to prevent it from being captured if it overlaps
      const toolbar = document.getElementById('floating-toolbar');
      if (toolbar) toolbar.style.display = 'none';

      const canvas = await html2canvas(document.body, {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        backgroundColor: '#e2e8f0', // Match background
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#e2e8f0', color: '#0f172a' }}>
      {!apiKey && <ApiKeyModal onSave={handleSaveApiKey} />}
      
      {/* Home Screen */}
      {!activeDocumentId && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '3rem', maxWidth: '1000px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <h1 style={{ color: '#1e293b', marginBottom: '2rem' }}>밥사주재홍 Workspace</h1>
          
          <div className="home-grid">
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{ 
                backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.1)' : 'white', 
                padding: '3rem', 
                borderRadius: '16px', 
                textAlign: 'center', 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                border: isDragging ? '2px dashed #3b82f6' : '2px dashed transparent',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <h2 style={{ marginTop: 0, color: '#334155' }}>Upload a PDF</h2>
              <p style={{ color: '#64748b', marginBottom: '2rem' }}>Drag and drop a PDF file here.</p>
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                backgroundColor: '#3b82f6', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500
              }}>
                <Upload size={20} />
                Choose PDF
                <input type="file" accept="application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
            </div>

            <div 
              onClick={handleCreateBlankNote}
              style={{ 
                backgroundColor: 'white', 
                padding: '3rem', 
                borderRadius: '16px', 
                textAlign: 'center', 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                border: '2px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            >
              <h2 style={{ marginTop: 0, color: '#334155' }}>Blank Note</h2>
              <p style={{ color: '#64748b', marginBottom: '2rem' }}>Start scribbling on a blank whiteboard.</p>
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                backgroundColor: '#1e293b', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, border: 'none'
              }}>
                <Pen size={20} />
                Create Note
              </button>
            </div>
          </div>

          <h2 style={{ color: '#334155', marginBottom: '1rem' }}>Saved Documents</h2>
          {savedDocs.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No saved documents yet.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {savedDocs.map(doc => (
                <div 
                  key={doc.id}
                  onClick={() => loadDoc(doc.id)}
                  className="glass"
                  style={{
                    backgroundColor: 'white',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    transition: 'transform 0.2s',
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <FileText size={32} color="#3b82f6" />
                    <div>
                      <button 
                        onClick={(e) => handleRenameDoc(doc.id, doc.name, e)}
                        style={{ background: 'transparent', border: 'none', padding: '0.25rem', color: '#64748b', cursor: 'pointer' }}
                        title="Rename"
                      >
                        <Pen size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDeleteDoc(doc.id, e)}
                        style={{ background: 'transparent', border: 'none', padding: '0.25rem', color: '#ef4444', cursor: 'pointer' }}
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
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
            touchAction: toolMode === 'scroll' && !pdfFile ? 'none' : 'auto'
          }}
          ref={contentRef}
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
              isActive={toolMode === 'pen'} 
              containerRef={contentRef} 
              paths={annotations}
              onPathsChange={handlePathsChange}
              penColor={penColor}
              penThickness={penThickness}
              cameraOffset={cameraOffset}
            />
          </div>
        </div>
      )}

      {/* Floating Toolbar */}
      {activeDocumentId && (
        <div id="floating-toolbar" className="toolbar-container">
          <ToolbarButton 
            icon={<Home size={28} />} 
            active={false} 
            onClick={closeDoc} 
            title="Home"
          />
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />
          <ToolbarButton 
            icon={<Undo2 size={24} />} 
            active={false} 
            onClick={handleUndo} 
            title="Undo (Ctrl+Z)"
            disabled={annotations.length === 0}
          />
          <ToolbarButton 
            icon={<Redo2 size={24} />} 
            active={false} 
            onClick={handleRedo} 
            title="Redo (Ctrl+Y)"
            disabled={redoStack.length === 0}
          />
          <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />
          <ToolbarButton 
            icon={<MousePointer2 size={28} />} 
            active={toolMode === 'scroll'} 
            onClick={() => setToolMode('scroll')} 
            title="Scroll/Pan"
          />
          <div style={{ position: 'relative' }}>
            <ToolbarButton 
              icon={<Pen size={28} />} 
              active={toolMode === 'pen'} 
              onClick={() => setToolMode('pen')} 
              title="Pen Tool"
            />
            {toolMode === 'pen' && (
              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '0.5rem', backgroundColor: 'var(--panel-bg)', padding: '0.5rem', borderRadius: '12px', display: 'flex', gap: '0.5rem', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#1e293b'].map(c => (
                  <button key={c} onClick={() => setPenColor(c)} style={{ width: '24px', height: '24px', borderRadius: '12px', backgroundColor: c, border: penColor === c ? '2px solid white' : '2px solid transparent', padding: 0, cursor: 'pointer' }} />
                ))}
                <div style={{ width: '1px', backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }} />
                {[2, 4, 8].map(t => (
                  <button key={t} onClick={() => setPenThickness(t)} style={{ width: '24px', height: '24px', borderRadius: '4px', backgroundColor: 'transparent', border: penThickness === t ? '1px solid white' : '1px solid transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <div style={{ width: '12px', height: `${t}px`, backgroundColor: 'white', borderRadius: '2px' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <ToolbarButton 
            icon={<Crop size={28} />} 
            active={toolMode === 'lasso'} 
            onClick={() => setToolMode('lasso')} 
            title="Lasso Tool"
          />
          <ToolbarButton 
            icon={<Download size={28} />} 
            active={showExportMenu} 
            onClick={() => setShowExportMenu(!showExportMenu)} 
            title="Export"
          />
        </div>
      )}

      {/* Export Menu (Rendered outside to prevent clipping from overflow-x) */}
      {activeDocumentId && showExportMenu && (
        <div style={{ position: 'fixed', bottom: '6.5rem', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--panel-bg)', padding: '0.5rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 1001, backdropFilter: 'blur(12px)' }}>
          <button 
            onClick={() => handleExport('png')}
            style={{ background: 'transparent', border: 'none', color: 'white', padding: '0.5rem 1rem', cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: '6px' }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Export as PNG
          </button>
          <button 
            onClick={() => handleExport('pdf')}
            style={{ background: 'transparent', border: 'none', color: 'white', padding: '0.5rem 1rem', cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: '6px' }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            Export as PDF
          </button>
        </div>
      )}

      {/* Lasso Overlay */}
      {toolMode === 'lasso' && (
        <LassoCanvas 
          onSelectionComplete={handleLassoComplete} 
          onCancel={() => setToolMode('scroll')} 
        />
      )}

      {/* AI Dialog */}
      {selectedArea && imageBase64 && (
        <AiDialog 
          imageBase64={imageBase64} 
          rect={selectedArea} 
          onClose={handleCloseDialog} 
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
        borderRadius: '12px',
        border: 'none',
        backgroundColor: active ? '#3b82f6' : 'transparent',
        color: disabled ? '#475569' : (active ? 'white' : '#cbd5e1'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1
      }}
    >
      {icon}
    </button>
  );
}

export default App;
