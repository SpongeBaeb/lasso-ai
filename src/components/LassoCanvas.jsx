import { useRef, useState, useEffect } from 'react';

export function LassoCanvas({ onSelectionComplete, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [path, setPath] = useState([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const ctx = canvas.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3b82f6';
    ctx.setLineDash([5, 5]); // Dashed line for lasso look
  }, []);

  const handlePointerDown = (e) => {
    setIsDrawing(true);
    const { clientX, clientY } = e;
    setPath([{ x: clientX, y: clientY }]);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    const { clientX, clientY } = e;
    const newPoint = { x: clientX, y: clientY };
    
    setPath((prev) => {
      const newPath = [...prev, newPoint];
      drawPath(newPath);
      return newPath;
    });
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (path.length > 5) { // Ensure it's a deliberate shape
      // Calculate bounding box
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;

      for (const p of path) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }

      // Add a slight padding to the bounding box
      const padding = 10;
      const x = Math.max(0, minX - padding);
      const y = Math.max(0, minY - padding);
      const width = Math.min(window.innerWidth - x, maxX + padding - x);
      const height = Math.min(window.innerHeight - y, maxY + padding - y);

      const rect = { x, y, width, height };

      onSelectionComplete(rect);
    } else {
      onCancel();
    }
    
    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setPath([]);
  };

  const drawPath = (currentPath) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    
    // Draw a subtle overlay over the whole screen
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentPath.length > 0) {
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }
      ctx.stroke();
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999, // very high but below modals
        cursor: 'crosshair',
        touchAction: 'none'
      }}
    />
  );
}
