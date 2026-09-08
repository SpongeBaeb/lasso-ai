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

export function AnnotationCanvas({ isActive, isErasing, containerRef, paths = [], onPathsChange, penColor = '#ef4444', penThickness = 4, cameraOffset = {x: 0, y: 0} }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const pathsRef = useRef(paths);
  const currentPathRef = useRef(null);

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

  const handlePointerDown = (e) => {
    if (!isActive && !isErasing) return;
    e.target.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const coords = getCoordinates(e);

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
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: (isActive || isErasing) ? 'auto' : 'none',
        touchAction: 'none',
        cursor: isErasing ? 'crosshair' : 'default',
        zIndex: 50
      }}
    />
  );
}
