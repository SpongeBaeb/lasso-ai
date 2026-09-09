import { useRef, useState, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';

function getSvgPathFromStroke(stroke) {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )
  d.push('Z')
  return d.join(' ')
}

export function AnnotationCanvas({ toolMode, containerRef, paths = [], onPathsChange, penColor = '#ef4444', penThickness = 4, fontSize = 24, cameraOffset = {x: 0, y: 0} }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTextBox, setActiveTextBox] = useState(null);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [dragging, setDragging] = useState(null);
  const pathsRef = useRef(paths);
  const currentPathRef = useRef(null);

  const isActive = toolMode === 'pen';
  const isErasing = toolMode === 'eraser';
  const isText = toolMode === 'text';

  useEffect(() => {
    pathsRef.current = paths;
    drawAllPaths(paths);
  }, [paths, cameraOffset]);

  const drawAllPaths = (allPaths) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(cameraOffset.x, cameraOffset.y);

    allPaths.forEach(path => {
      if (path.type === 'text') return; // Text handled by HTML overlay
      if (path.points.length === 0) return;
      // Support legacy data structure
      const rawPoints = path.points.map(p => Array.isArray(p) ? p : [p.x, p.y]);
      const stroke = getStroke(rawPoints, {
        size: path.thickness || 4,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: rawPoints[0].length < 3
      });
      
      if (stroke.length === 0) return;
      
      const pathData = getSvgPathFromStroke(stroke);
      const path2d = new Path2D(pathData);
      ctx.fillStyle = path.color || '#ef4444';
      ctx.fill(path2d);
    });

    ctx.restore();
  };

  useEffect(() => {
    const resizeCanvas = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const { clientWidth, clientHeight, scrollWidth, scrollHeight } = containerRef.current;
      canvasRef.current.width = Math.max(clientWidth, scrollWidth);
      canvasRef.current.height = Math.max(clientHeight, scrollHeight);
      drawAllPaths(pathsRef.current);
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [containerRef]);

  const getCoordinates = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [
      e.clientX - rect.left - cameraOffset.x,
      e.clientY - rect.top - cameraOffset.y,
      e.pressure !== undefined ? e.pressure : 0.5
    ];
  };

  const erasePaths = (coords) => {
    const ERASER_RADIUS = 20;
    let pathsChanged = false;
    const newPaths = pathsRef.current.filter(path => {
      if (path.type === 'text') {
        const hit = Math.hypot(path.x - coords[0], path.y - coords[1]) < ERASER_RADIUS + 30;
        if (hit) pathsChanged = true;
        return !hit;
      }
      
      const hit = path.points.some(p => {
        const px = Array.isArray(p) ? p[0] : p.x;
        const py = Array.isArray(p) ? p[1] : p.y;
        return Math.hypot(px - coords[0], py - coords[1]) < ERASER_RADIUS;
      });
      if (hit) pathsChanged = true;
      return !hit;
    });

    if (pathsChanged) {
      pathsRef.current = newPaths;
      drawAllPaths(newPaths);
      if (onPathsChange) onPathsChange(newPaths);
    }
  };

  const commitActiveTextBox = () => {
    if (activeTextBox && activeTextBox.text.trim()) {
      const newPaths = [...pathsRef.current, {
        type: 'text',
        text: activeTextBox.text,
        x: activeTextBox.x,
        y: activeTextBox.y,
        color: penColor,
        fontSize: fontSize,
        id: activeTextBox.editingId || Date.now().toString()
      }];
      pathsRef.current = newPaths;
      if (onPathsChange) onPathsChange(newPaths);
    }
    setActiveTextBox(null);
    setSelectedTextId(null);
  };

  const handleEditTextBox = (path) => {
    if (!isText) return;
    setActiveTextBox({ x: path.x, y: path.y, text: path.text, editingId: path.id });
    const newPaths = pathsRef.current.filter(p => p !== path);
    pathsRef.current = newPaths;
    if (onPathsChange) onPathsChange(newPaths);
  };

  const textAreaRef = useRef(null);

  useEffect(() => {
    if (activeTextBox && textAreaRef.current) {
      // Small timeout ensures the DOM has updated before focusing
      setTimeout(() => {
        if (textAreaRef.current) textAreaRef.current.focus();
      }, 10);
    }
  }, [activeTextBox]);

  const handlePointerDown = (e) => {
    if (!isActive && !isErasing && !isText) return;
    
    if (isText) {
      e.stopPropagation();
      const coords = getCoordinates(e);
      if (activeTextBox) {
        commitActiveTextBox();
      } else {
        setActiveTextBox({ x: coords[0], y: coords[1], text: '' });
      }
      return;
    }

    const coords = getCoordinates(e);

    e.preventDefault(); // Prevent Safari/iPad default drag behaviors
    e.target.setPointerCapture(e.pointerId);
    setIsDrawing(true);

    if (isErasing) {
      erasePaths(coords);
    } else {
      currentPathRef.current = { color: penColor, thickness: penThickness, points: [coords] };
      drawAllPaths([...pathsRef.current, currentPathRef.current]);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    
    if (isErasing) {
      erasePaths(coords);
    } else if (isActive && currentPathRef.current) {
      currentPathRef.current.points.push(coords);
      drawAllPaths([...pathsRef.current, currentPathRef.current]);
    }
  };

  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    e.target.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
    
    if (!isErasing && currentPathRef.current && currentPathRef.current.points.length > 0) {
      const newPaths = [...pathsRef.current, currentPathRef.current];
      if (onPathsChange) onPathsChange(newPaths);
    }
    currentPathRef.current = null;
  };

  return (
    <div 
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: activeTextBox ? 'auto' : 'none', zIndex: 50, overflow: 'hidden', touchAction: 'none' }}
      onPointerDown={(e) => {
        // If there's an active text box and user clicked outside the textarea, commit it
        if (activeTextBox && e.target !== textAreaRef.current) {
          e.stopPropagation();
          commitActiveTextBox();
          return;
        }
        // If user clicked on the wrapper background (not on a text div), deselect
        if (isText && !activeTextBox && selectedTextId) {
          setSelectedTextId(null);
        }
      }}
      onPointerMove={(e) => {
        if (dragging) {
          e.stopPropagation();
          const dx = e.clientX - dragging.startX;
          const dy = e.clientY - dragging.startY;
          const newPaths = pathsRef.current.map(p =>
            p.id === dragging.id ? { ...p, x: dragging.origX + dx, y: dragging.origY + dy } : p
          );
          pathsRef.current = newPaths;
          if (onPathsChange) onPathsChange(newPaths);
        }
      }}
      onPointerUp={() => {
        if (dragging) {
          setDragging(null);
        }
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: (isActive || isErasing || (isText && !activeTextBox)) ? 'auto' : 'none',
          touchAction: 'none',
          cursor: isErasing ? 'crosshair' : (isText ? 'text' : 'default'),
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      />
      
      {paths.filter(p => p.type === 'text').map((path, i) => (
        <div
          key={path.id || i}
          onDoubleClick={() => handleEditTextBox(path)}
          onPointerDown={(e) => {
            if (!isText) return;
            e.stopPropagation();
            setSelectedTextId(path.id);
            setDragging({
              id: path.id,
              startX: e.clientX,
              startY: e.clientY,
              origX: path.x,
              origY: path.y
            });
          }}
          style={{
            position: 'absolute',
            left: path.x + cameraOffset.x,
            top: path.y + cameraOffset.y,
            color: path.color,
            fontSize: `${path.fontSize}px`,
            fontFamily: 'Quicksand, sans-serif',
            fontWeight: 600,
            pointerEvents: isText ? 'auto' : 'none',
            cursor: isText ? (dragging ? 'grabbing' : 'grab') : 'default',
            whiteSpace: 'pre-wrap',
            userSelect: 'none',
            padding: '4px 6px',
            lineHeight: 1.2,
            border: selectedTextId === path.id ? '2px dashed var(--primary)' : '2px dashed transparent',
            borderRadius: '4px',
            transition: 'border-color 0.15s ease'
          }}
        >
          {path.text}
        </div>
      ))}

      {activeTextBox && (
        <textarea
          ref={textAreaRef}
          autoFocus
          value={activeTextBox.text}
          onChange={(e) => setActiveTextBox({ ...activeTextBox, text: e.target.value })}
          style={{
            position: 'absolute',
            left: activeTextBox.x + cameraOffset.x,
            top: activeTextBox.y + cameraOffset.y,
            color: penColor,
            fontSize: `${fontSize}px`,
            fontFamily: 'Quicksand, sans-serif',
            fontWeight: 600,
            background: 'transparent',
            border: '2px dashed var(--primary)',
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            pointerEvents: 'auto',
            minWidth: '200px',
            minHeight: '60px',
            padding: '2px',
            lineHeight: 1.2
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') commitActiveTextBox();
          }}
        />
      )}
    </div>
  );
}
