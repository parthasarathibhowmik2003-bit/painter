/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { 
  Pencil, 
  Paintbrush, 
  Eraser, 
  Square, 
  Circle as CircleIcon, 
  Minus, 
  Undo2, 
  Redo2, 
  Trash2, 
  Download,
  SquareDashedIcon,
  ChevronDown,
  Palette,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Tool, DrawingState, COLORS } from '../types';

export default function PaintApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [state, setState] = useState<DrawingState>({
    tool: 'pencil',
    color: '#000000',
    size: 5,
  });

  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !overlay || !container) return;

    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    // Save content
    const ctx = canvas.getContext('2d');
    let temp: ImageData | undefined;
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        temp = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      } catch (e) {
        console.warn('Could not save canvas content during resize', e);
      }
    }

    canvas.width = width;
    canvas.height = height;
    overlay.width = width;
    overlay.height = height;

    // Restore content
    if (temp && ctx) {
      ctx.putImageData(temp, 0, 0);
    } else {
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) ctx.putImageData(history[idx], 0, 0);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      setHistoryIndex(idx);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) ctx.putImageData(history[idx], 0, 0);
    }
  }, [history, historyIndex]);

  const undoRef = useRef(undo);
  const redoRef = useRef(redo);

  useEffect(() => {
    undoRef.current = undo;
    redoRef.current = redo;
  }, [undo, redo]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Set initial size
    resizeCanvas();

    // Fill with white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Initial history
    if (canvas.width > 0 && canvas.height > 0) {
      try {
        const initialImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setHistory([initialImageData]);
        setHistoryIndex(0);
      } catch (e) {
        console.error('Failed to initialize canvas history', e);
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          undoRef.current();
        } else if (e.key === 'y') {
          e.preventDefault();
          redoRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []); // Only once

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx || canvas.width <= 0 || canvas.height <= 0) return;

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(imageData);
      
      // Limit history
      if (newHistory.length > 50) newHistory.shift();
      
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    } catch (e) {
      console.error('Failed to save state to history', e);
    }
  };

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getPointerPos(e);
    setIsDrawing(true);
    setStartPoint(pos);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = state.tool === 'eraser' ? '#ffffff' : state.color;
      ctx.lineWidth = state.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !startPoint) return;
    const pos = getPointerPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    const overlayCtx = overlayCanvasRef.current?.getContext('2d');

    if (!ctx || !overlayCtx) return;

    if (['pencil', 'brush', 'eraser'].includes(state.tool)) {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      // Preview on overlay
      overlayCtx.clearRect(0, 0, overlayCtx.canvas.width, overlayCtx.canvas.height);
      overlayCtx.strokeStyle = state.color;
      overlayCtx.lineWidth = state.size;
      overlayCtx.beginPath();

      if (state.tool === 'rect') {
        overlayCtx.strokeRect(startPoint.x, startPoint.y, pos.x - startPoint.x, pos.y - startPoint.y);
      } else if (state.tool === 'circle') {
        const radius = Math.sqrt(Math.pow(pos.x - startPoint.x, 2) + Math.pow(pos.y - startPoint.y, 2));
        overlayCtx.arc(startPoint.x, startPoint.y, radius, 0, Math.PI * 2);
        overlayCtx.stroke();
      } else if (state.tool === 'line') {
        overlayCtx.moveTo(startPoint.x, startPoint.y);
        overlayCtx.lineTo(pos.x, pos.y);
        overlayCtx.stroke();
      }
    }
  };

  const stopDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !startPoint) return;
    const pos = getPointerPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    const overlayCtx = overlayCanvasRef.current?.getContext('2d');
    
    if (ctx && overlayCtx) {
      if (['rect', 'circle', 'line'].includes(state.tool)) {
        overlayCtx.clearRect(0, 0, overlayCtx.canvas.width, overlayCtx.canvas.height);
        ctx.strokeStyle = state.color;
        ctx.lineWidth = state.size;
        ctx.beginPath();
        if (state.tool === 'rect') {
          ctx.strokeRect(startPoint.x, startPoint.y, pos.x - startPoint.x, pos.y - startPoint.y);
        } else if (state.tool === 'circle') {
          const radius = Math.sqrt(Math.pow(pos.x - startPoint.x, 2) + Math.pow(pos.y - startPoint.y, 2));
          ctx.arc(startPoint.x, startPoint.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        } else if (state.tool === 'line') {
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
      }
      ctx.closePath();
      saveToHistory();
    }

    setIsDrawing(false);
    setStartPoint(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveToHistory();
    }
  };

  const exportPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save('my-drawing.pdf');
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const uploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          saveToHistory();
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-screen select-none bg-win-bg">
      {/* Windows 11 Title Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#202020] text-[11px] border-b border-white/10 text-white/70">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 bg-gradient-to-br from-blue-500 to-teal-400 rounded-sm"></div>
          <span className="font-medium opacity-80">Untitled - Paint</span>
        </div>
        <div className="flex gap-6">
          <span className="cursor-pointer hover:text-white transition-colors">_</span>
          <span className="cursor-pointer hover:text-white transition-colors">▢</span>
          <span className="cursor-pointer hover:text-red-500 transition-colors text-lg leading-none">×</span>
        </div>
      </div>

      {/* Command Bar / Ribbon */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#202020] z-50 shadow-lg text-white/90">
        <div className="flex items-center gap-1">
          <button className="px-3 py-1.5 hover:bg-white/5 rounded-md flex items-center gap-2 text-sm font-medium transition-colors">
            File
          </button>
          <div className="h-6 w-[1.5px] bg-white/10 mx-1"></div>
          
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
            <ToolButton active={state.tool === 'pencil'} onClick={() => setState({...state, tool: 'pencil'})} icon={<Pencil size={18} />} label="Pencil" />
            <ToolButton active={state.tool === 'brush'} onClick={() => setState({...state, tool: 'brush'})} icon={<Paintbrush size={18} />} label="Brush" />
            <ToolButton active={state.tool === 'eraser'} onClick={() => setState({...state, tool: 'eraser'})} icon={<Eraser size={18} />} label="Eraser" />
          </div>

          <div className="h-6 w-[1px] bg-white/10 mx-1"></div>
          
          <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
            <ToolButton active={state.tool === 'rect'} onClick={() => setState({...state, tool: 'rect'})} icon={<Square size={18} />} label="Rectangle" />
            <ToolButton active={state.tool === 'circle'} onClick={() => setState({...state, tool: 'circle'})} icon={<CircleIcon size={18} />} label="Circle" />
            <ToolButton active={state.tool === 'line'} onClick={() => setState({...state, tool: 'line'})} icon={<Minus size={18} />} label="Line" />
          </div>

          <div className="h-6 w-[1px] bg-white/10 mx-1"></div>

          <div className="flex gap-4 items-center px-4">
            <div className="flex flex-col w-32">
              <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                <span>Size</span>
                <span className="text-white/60">{state.size}px</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={state.size} 
                onChange={(e) => setState({...state, size: parseInt(e.target.value)})}
                className="w-full mt-1 appearance-none bg-white/10 h-1 rounded-full accent-win-accent cursor-pointer"
              />
            </div>
            <div className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
               <div 
                  className="rounded-full shadow-sm"
                  style={{ 
                      width: `${Math.min(state.size, 32)}px`, 
                      height: `${Math.min(state.size, 32)}px`,
                      backgroundColor: state.color
                  }}
               />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={undo} disabled={historyIndex <= 0} className="win-button-ghost hover:bg-white/5 text-white/70 disabled:opacity-30">
              <Undo2 size={16} />
            </button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1} className="win-button-ghost hover:bg-white/5 text-white/70 disabled:opacity-30">
              <Redo2 size={16} />
            </button>
          </div>
          <button onClick={exportPDF} className="win-button-primary">
            <Download size={14} />
            <span>Export as PDF</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Side Tools Panel */}
        <div className="win-sidebar">
          {/* Color Section */}
          <div>
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase mb-3 tracking-widest">Color Palette</h3>
            <div className="grid grid-cols-5 gap-2">
              {COLORS.slice(0, 10).map(c => (
                <button
                  key={c}
                  onClick={() => setState({...state, color: c})}
                  className={`w-8 h-8 rounded transition-all active:scale-90 ${state.color === c ? 'ring-2 ring-offset-2 ring-win-accent shadow-md scale-105' : 'hover:scale-105 border border-white/5'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10">
              <span className="text-xs font-medium">Custom</span>
              <label className="cursor-pointer flex items-center">
                <div 
                    className="w-12 h-5 rounded border border-white/20 shadow-sm"
                    style={{ backgroundColor: state.color }}
                />
                <input 
                    type="color" 
                    className="hidden" 
                    value={state.color}
                    onChange={(e) => setState({...state, color: e.target.value})}
                />
                <Palette size={14} className="ml-2 text-white/50" />
              </label>
            </div>
          </div>

          {/* Layers/Stack Section */}
          <div className="flex-1 flex flex-col">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase mb-3 tracking-widest">Workspace</h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between p-2 bg-white/10 border border-white/5 rounded-md">
                <div className="flex items-center gap-2">
                  <ImageIcon size={14} className="text-blue-400" />
                  <span className="text-xs font-medium">Main Layer</span>
                </div>
                <CircleIcon size={8} fill="currentColor" className="text-blue-500" />
              </div>
              <label className="flex items-center justify-between p-2 hover:bg-white/5 rounded-md transition-colors cursor-pointer text-white/60">
                <div className="flex items-center gap-2">
                  <ImageIcon size={14} />
                  <span className="text-xs">Import Background</span>
                </div>
                <input type="file" hidden accept="image/*" onChange={uploadImage} />
              </label>
            </div>
          </div>

          <button 
            onClick={clearCanvas}
            className="w-full py-2 border-2 border-dashed border-white/10 rounded-lg text-[10px] font-bold text-white/30 hover:border-red-500/50 hover:text-red-500 transition-all uppercase tracking-widest"
          >
            Clear Drawing
          </button>
        </div>

        {/* Workspace */}
        <div ref={containerRef} className="flex-1 p-8 bg-win-workspace flex items-center justify-center relative shadow-inner overflow-auto custom-scrollbar">
          <div className="shadow-2xl border border-win-border/40 relative cursor-crosshair bg-white win-card">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="block"
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 pointer-events-none"
            />
            {/* Resize Handle Mock */}
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-gray-400 cursor-nwse-resize z-10" />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <footer className="h-8 bg-[#202020] border-t border-white/10 px-4 flex items-center justify-between text-[11px] text-white/50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <ChevronDown size={14} className="rotate-45" />
            {canvasRef.current && (
              <span>{canvasRef.current.width}, {canvasRef.current.height}px</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ImageIcon size={14} />
            <span>Fluid Canvas</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <button className="hover:text-white transition-colors">-</button>
            <span className="font-medium text-white/90">100%</span>
            <button className="hover:text-white transition-colors">+</button>
          </div>
          <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-white/30 rounded-full"></div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ToolButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-2 rounded-md transition-all flex items-center justify-center ${active ? 'bg-white/10 text-win-accent shadow-sm' : 'hover:bg-white/5 text-white/50 hover:text-white/80'}`}
    >
      {icon}
    </button>
  );
}
