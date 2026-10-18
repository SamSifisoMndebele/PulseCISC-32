// PulseCISC-32 Visual Canvas Container, Zoom/Pan Viewport, Interactive Hover/Pin Tooltips & Legend
import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { CPUMicroState } from '../core/types';
import { DatapathRenderer } from '../visualizer/datapath';
import type { DatapathComponentInfo } from '../visualizer/datapath';
import { THEME } from '../visualizer/theme';
import {
  HelpCircle,
  Lightbulb,
  Cpu,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Move,
  Pin,
  X,
} from 'lucide-react';

interface CanvasViewProps {
  cpuState: CPUMicroState;
  speedScale: number;
  enableParticles?: boolean;
  particleSpeed?: 'slow' | 'normal' | 'fast';
}

const MIN_ZOOM = 0.45;
const MAX_ZOOM = 3.0;

export const CanvasView: React.FC<CanvasViewProps> = ({
  cpuState,
  speedScale,
  enableParticles = true,
  particleSpeed = 'normal',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DatapathRenderer | null>(null);

  // Viewport Zoom & Pan State
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
    moved: false,
  });

  // Hover & Pinned Tooltip State (clicking a component pins its tooltip so text can be selected/copied)
  const [hoveredComponent, setHoveredComponent] = useState<DatapathComponentInfo | null>(null);
  const [pinnedComponent, setPinnedComponent] = useState<DatapathComponentInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Keep latest render inputs in a ref so the RAF loop doesn't recreate DatapathRenderer
  const renderParamsRef = useRef({
    cpuState,
    speedScale,
    enableParticles,
    particleSpeed,
    zoom,
    pan,
  });

  useEffect(() => {
    renderParamsRef.current = {
      cpuState,
      speedScale,
      enableParticles,
      particleSpeed,
      zoom,
      pan,
    };
  }, [cpuState, speedScale, enableParticles, particleSpeed, zoom, pan]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new DatapathRenderer(canvas);
    rendererRef.current = renderer;

    let animId: number;

    const loop = () => {
      const {
        cpuState: st,
        speedScale: spd,
        enableParticles: ep,
        particleSpeed: ps,
        zoom: z,
        pan: p,
      } = renderParamsRef.current;

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.max(1, Math.floor(rect.width * dpr));
      const displayHeight = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      renderer.enableParticles = ep;
      renderer.particleSpeedMultiplier = ps === 'fast' ? 1.8 : ps === 'slow' ? 0.5 : 1.0;
      renderer.setViewport(z, p.x, p.y);
      renderer.render(st, spd);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // Native wheel listener (passive: false) to zoom smoothly toward cursor position
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;

      setZoom((prevZoom) => {
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(prevZoom * zoomFactor).toFixed(3)));
        const ratio = nextZoom / prevZoom;

        // Adjust pan so the point under the cursor stays stationary
        setPan((prevPan) => ({
          x: (mouseX - centerX) * (1 - ratio) + prevPan.x * ratio,
          y: (mouseY - centerY) * (1 - ratio) + prevPan.y * ratio,
        }));

        return nextZoom;
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, +(z * 1.2).toFixed(2)));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, +(z / 1.2).toFixed(2)));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);

  const computeClampedTooltipPos = (mouseX: number, mouseY: number, rect: DOMRect) => {
    const tooltipW = 340;
    const tooltipH = 260;
    let posX = mouseX + 16;
    let posY = mouseY + 16;

    if (posX + tooltipW > rect.width) {
      posX = mouseX - tooltipW - 12;
    }
    if (posY + tooltipH > rect.height) {
      posY = Math.max(10, rect.height - tooltipH - 10);
    }

    return { x: Math.max(10, posX), y: Math.max(10, posY) };
  };

  // Pointer Down for Panning or Component Pinning
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
  };

  // Pointer Move for Panning or Hover Hit-Testing
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !container || !renderer) return;

    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragStartRef.current.moved = true;
      }
      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
      return;
    }

    // If a component is pinned, keep its card steady until unpinned
    if (pinnedComponent) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screenX = mouseX * scaleX;
    const screenY = mouseY * scaleY;

    const comp = renderer.getComponentAt(screenX, screenY);
    if (comp) {
      setHoveredComponent(comp);
      setTooltipPos(computeClampedTooltipPos(mouseX, mouseY, rect));
    } else {
      setHoveredComponent(null);
      setTooltipPos(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released
    }

    // If it was a clean click (didn't drag), toggle pin on the clicked component
    if (!dragStartRef.current.moved) {
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;
      if (!canvas || !renderer) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const screenX = mouseX * (canvas.width / rect.width);
      const screenY = mouseY * (canvas.height / rect.height);

      const comp = renderer.getComponentAt(screenX, screenY);
      if (comp) {
        if (pinnedComponent?.id === comp.id) {
          setPinnedComponent(null);
        } else {
          setPinnedComponent(comp);
          setHoveredComponent(comp);
          setTooltipPos(computeClampedTooltipPos(mouseX, mouseY, rect));
        }
      } else {
        setPinnedComponent(null);
      }
    }
  };

  const handleMouseLeave = () => {
    if (!pinnedComponent) {
      setHoveredComponent(null);
      setTooltipPos(null);
    }
  };

  const activeComponent = pinnedComponent || hoveredComponent;
  const isDefaultViewport = Math.abs(zoom - 1.0) < 0.01 && Math.abs(pan.x) < 2 && Math.abs(pan.y) < 2;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col h-full bg-[#0a0d14] overflow-hidden"
    >
      {/* Canvas Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleResetView}
          className={`w-full h-full block touch-none select-none ${
            isDragging ? 'cursor-grabbing' : hoveredComponent ? 'cursor-pointer' : 'cursor-grab'
          }`}
        />

        {/* Floating Zoom & Pan HUD Controls */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 bg-slate-950/90 border border-slate-800/90 rounded-xl p-1 shadow-xl backdrop-blur-md select-none">
          <div
            className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 border-r border-slate-800 mr-0.5"
            title="Drag canvas to pan • Scroll wheel to zoom • Click block to pin details"
          >
            <Move className="w-3 h-3 text-slate-500" />
            <span>Scroll / Drag</span>
          </div>

          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out (Scroll Down)"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleResetView}
            title="Click to reset zoom to 100%"
            className="px-2 py-1 rounded-lg text-[11px] font-mono font-semibold text-sky-400 hover:bg-slate-800 transition-colors min-w-[48px] text-center"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In (Scroll Up)"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {!isDefaultViewport && (
            <button
              type="button"
              onClick={handleResetView}
              title="Fit & Center Datapath (Double-click canvas)"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 transition-colors ml-0.5"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fit</span>
            </button>
          )}
        </div>

        {/* Interactive Floating Hover / Pinned Tooltip Card (Selectable text when pinned!) */}
        {activeComponent && tooltipPos && (
          <div
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              pointerEvents: pinnedComponent ? 'auto' : 'none',
            }}
            className={`absolute z-30 w-80 max-w-[340px] bg-slate-950/95 border rounded-xl p-3 shadow-2xl backdrop-blur-md text-slate-100 font-sans transition-opacity duration-150 animate-in fade-in ${
              pinnedComponent
                ? 'border-amber-400/80 shadow-amber-950/60 select-text'
                : 'border-sky-500/60 shadow-sky-950/80 select-none'
            }`}
          >
            {/* Header: Title, Pin Status & Category Pill */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Cpu className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="font-semibold text-xs text-sky-300 truncate">
                  {activeComponent.title}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="bg-sky-950 text-sky-400 border border-sky-800 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold">
                  {activeComponent.category}
                </span>
                {pinnedComponent && (
                  <button
                    type="button"
                    onClick={() => setPinnedComponent(null)}
                    title="Unpin tooltip"
                    className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Role & Summary */}
            <p className="text-[11px] text-slate-300 leading-snug mb-2 font-normal">
              {activeComponent.summary}
            </p>

            {/* Pedagogical Insight / Why it works Callout */}
            {activeComponent.pedagogicalInsight && (
              <div className="bg-slate-900/90 border border-amber-500/40 rounded-lg p-2.5 mb-2 space-y-1 text-[10.5px]">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                  <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{activeComponent.pedagogicalInsight}</span>
                </div>

                {activeComponent.whyExplanation && (
                  <div className="text-slate-300 space-y-1 pt-1 text-[10px] leading-relaxed">
                    {activeComponent.whyExplanation.split('\n').map((line, idx) => (
                      <p key={idx} className="flex items-start gap-1">
                        <span className="text-amber-500 select-none">•</span>
                        <span>{line}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Educational Mnemonic / Quick Rule */}
            {activeComponent.mnemonic && (
              <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/50 rounded-md px-2 py-1 text-[10px] text-emerald-300 font-mono mb-1.5">
                <Lightbulb className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="italic">{activeComponent.mnemonic}</span>
              </div>
            )}

            {/* Pin Hint Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[9.5px] text-slate-500 select-none">
              <span className="flex items-center gap-1">
                <Pin className="w-2.5 h-2.5 text-amber-400/80" />
                {pinnedComponent
                  ? 'Pinned — you can select & copy text above'
                  : 'Click component to pin & copy text'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Phase Color Legend Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#090d16]/90 border-t border-slate-800 text-xs font-mono text-slate-300 gap-2 select-none">
        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <span className="font-semibold text-slate-300">FSM Phases:</span>
          <span className="text-[10px] text-slate-500 hidden xl:inline">
            (Scroll to zoom • Drag to pan • Click any block to pin tooltip)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          {/* Fetch */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: THEME.phases.FETCH.primary }}
            />
            <span className="text-slate-300">Fetch (Green)</span>
          </div>

          {/* Decode */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: THEME.phases.DECODE.primary }}
            />
            <span className="text-slate-300">Decode (Blue)</span>
          </div>

          {/* Execute */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: THEME.phases.EXECUTE.primary }}
            />
            <span className="text-slate-300">Execute (Red)</span>
          </div>

          {/* Memory */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: THEME.phases.MEMORY.primary }}
            />
            <span className="text-slate-300">Memory (Violet)</span>
          </div>

          {/* Writeback */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: THEME.phases.WRITEBACK.primary }}
            />
            <span className="text-slate-300">Writeback (Amber)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

