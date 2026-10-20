// PulseCISC-32 Visual Canvas Container, Multi-Touch Pinch/Pan Viewport, Interactive Tooltips & Legend
import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { CPUMicroState } from '../core/types';
import { DatapathRenderer } from '../visualizer/datapath';
import type { DatapathComponentInfo } from '../visualizer/datapath';
import { THEME } from '../visualizer/theme';
import { toHex32 } from '../core/isa';
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

  // Single-pointer drag tracking
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
    moved: false,
  });

  // Multi-touch pinch-to-zoom tracking
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{
    initialDist: number;
    initialZoom: number;
    initialPanX: number;
    initialPanY: number;
    midX: number;
    midY: number;
  } | null>(null);

  // Hover & Pinned Tooltip State (clicking/tapping a component pins its tooltip)
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
    const tooltipW = Math.min(340, rect.width - 20);
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

  // Pointer Down for Panning, Pinch-to-Zoom, or Component Pinning
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 1 && e.pointerType === 'mouse') return;
    e.currentTarget.setPointerCapture(e.pointerId);

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 2) {
      // Switch to 2-finger pinch-to-zoom mode
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      pinchStateRef.current = {
        initialDist: Math.max(10, dist),
        initialZoom: zoom,
        initialPanX: pan.x,
        initialPanY: pan.y,
        midX,
        midY,
      };
      dragStartRef.current.moved = true;
      setIsDragging(true);
      return;
    }

    if (activePointersRef.current.size === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
        moved: false,
      };
    }
  };

  // Pointer Move for Pinch-to-Zoom, Panning, or Hover Hit-Testing
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !container || !renderer) return;

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Handle 2-finger pinch-to-zoom + pan
    if (activePointersRef.current.size === 2 && pinchStateRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      const { initialDist, initialZoom, initialPanX, initialPanY, midX: startMidX, midY: startMidY } =
        pinchStateRef.current;

      const scaleFactor = dist / initialDist;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(initialZoom * scaleFactor).toFixed(3)));
      const ratio = nextZoom / initialZoom;

      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const localMidX = startMidX - rect.left;
      const localMidY = startMidY - rect.top;

      const dx = midX - startMidX;
      const dy = midY - startMidY;

      setZoom(nextZoom);
      setPan({
        x: (localMidX - centerX) * (1 - ratio) + initialPanX * ratio + dx,
        y: (localMidY - centerY) * (1 - ratio) + initialPanY * ratio + dy,
      });
      return;
    }

    // Handle 1-finger or mouse drag pan
    if (isDragging && activePointersRef.current.size === 1) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const moveThreshold = e.pointerType === 'touch' ? 7 : 3;
      if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
        dragStartRef.current.moved = true;
      }
      if (dragStartRef.current.moved) {
        setPan({
          x: dragStartRef.current.panX + dx,
          y: dragStartRef.current.panY + dy,
        });
      }
      return;
    }

    // Ignore hover hit-testing on touch devices or when a component is already pinned
    if (e.pointerType === 'touch' || pinnedComponent) return;

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

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }
    if (activePointersRef.current.size === 1) {
      // Remaining finger becomes the new single-drag anchor so pan doesn't jump
      const remaining = Array.from(activePointersRef.current.values())[0];
      dragStartRef.current = {
        x: remaining.x,
        y: remaining.y,
        panX: pan.x,
        panY: pan.y,
        moved: true,
      };
      return;
    }

    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released
    }

    // If it was a clean tap/click (didn't drag), toggle pin on the tapped component
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
          setHoveredComponent(null);
        } else {
          setPinnedComponent(comp);
          setHoveredComponent(comp);
          setTooltipPos(computeClampedTooltipPos(mouseX, mouseY, rect));
        }
      } else {
        setPinnedComponent(null);
        setHoveredComponent(null);
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
  const phaseColor = THEME.phases[cpuState.phase]?.primary || '#38bdf8';

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
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleResetView}
          className={`w-full h-full block touch-none select-none ${
            isDragging ? 'cursor-grabbing' : hoveredComponent ? 'cursor-pointer' : 'cursor-grab'
          }`}
        />

        {/* Compact Live CPU Telemetry Overlay Pill (Top-Left, especially helpful on mobile/tablet) */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-2 bg-slate-950/85 border border-slate-800/90 rounded-xl px-2.5 py-1.5 shadow-lg backdrop-blur-md text-[11px] font-mono select-none pointer-events-none max-w-[calc(100%-20px)]">
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0"
            style={{
              backgroundColor: `${phaseColor}22`,
              color: phaseColor,
              border: `1px solid ${phaseColor}55`,
            }}
          >
            {cpuState.phase}
          </span>
          <span className="text-slate-400 shrink-0">
            EIP:<strong className="text-emerald-400 ml-0.5">{toHex32(cpuState.eip)}</strong>
          </span>
          <span className="text-slate-500 hidden xs:inline shrink-0">•</span>
          <span className="text-slate-400 hidden xs:inline shrink-0">
            Cyc:<strong className="text-sky-400 ml-0.5">#{cpuState.cycles}</strong>
          </span>
          {cpuState.decoded?.assemblyString && (
            <>
              <span className="text-slate-600 shrink-0">|</span>
              <span className="text-amber-300 font-semibold truncate">
                {cpuState.decoded.assemblyString}
              </span>
            </>
          )}
        </div>

        {/* Floating Zoom & Pan HUD Controls */}
        <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 bg-slate-950/90 border border-slate-800/90 rounded-xl p-1 shadow-xl backdrop-blur-md select-none">
          <div
            className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 border-r border-slate-800 mr-0.5"
            title="Drag to pan • Pinch or scroll to zoom • Tap block for details"
          >
            <Move className="w-3 h-3 text-slate-500" />
            <span>Pinch / Drag</span>
          </div>

          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors"
          >
            <ZoomOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleResetView}
            title="Reset zoom to 100%"
            className="px-2 py-1 rounded-lg text-[11px] font-mono font-semibold text-sky-400 hover:bg-slate-800 transition-colors min-w-[46px] text-center"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:bg-slate-700 transition-colors"
          >
            <ZoomIn className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>

          {!isDefaultViewport && (
            <button
              type="button"
              onClick={handleResetView}
              title="Fit & Center Datapath"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 transition-colors ml-0.5"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fit</span>
            </button>
          )}
        </div>

        {/* Interactive Component Inspector Card (Bottom Sheet on Mobile, Floating Card on Desktop) */}
        {activeComponent && tooltipPos && (
          <div
            style={
              typeof window !== 'undefined' && window.innerWidth < 640
                ? { pointerEvents: 'auto' }
                : {
                    left: `${tooltipPos.x}px`,
                    top: `${tooltipPos.y}px`,
                    pointerEvents: pinnedComponent ? 'auto' : 'none',
                  }
            }
            className={`absolute z-30 bg-slate-950/95 border rounded-xl p-3 shadow-2xl backdrop-blur-md text-slate-100 font-sans transition-opacity duration-150 max-sm:left-2.5 max-sm:right-2.5 max-sm:bottom-14 max-sm:w-auto max-sm:max-h-[55%] max-sm:overflow-y-auto sm:w-80 sm:max-w-[340px] ${
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
                {(pinnedComponent || (typeof window !== 'undefined' && window.innerWidth < 640)) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPinnedComponent(null);
                      setHoveredComponent(null);
                    }}
                    title="Close details"
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
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
                  ? 'Pinned — tap X or empty canvas to dismiss'
                  : 'Tap or click component to pin details'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Phase Color Legend Bar (horizontally scrollable on mobile) */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 bg-[#090d16]/90 border-t border-slate-800 text-xs font-mono text-slate-300 gap-3 select-none overflow-x-auto no-scrollbar whitespace-nowrap">
        <div className="flex items-center gap-2 text-slate-400 text-[11px] shrink-0">
          <span className="font-semibold text-slate-300">FSM Phases:</span>
          <span className="text-[10px] text-slate-500 hidden xl:inline">
            (Pinch/Scroll to zoom • Drag to pan • Tap any block for details)
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] sm:text-[11px] shrink-0">
          {/* Fetch */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: THEME.phases.FETCH.primary }}
            />
            <span className="text-slate-300">Fetch</span>
          </div>

          {/* Decode */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: THEME.phases.DECODE.primary }}
            />
            <span className="text-slate-300">Decode</span>
          </div>

          {/* Execute */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: THEME.phases.EXECUTE.primary }}
            />
            <span className="text-slate-300">Execute</span>
          </div>

          {/* Memory */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: THEME.phases.MEMORY.primary }}
            />
            <span className="text-slate-300">Memory</span>
          </div>

          {/* Writeback */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: THEME.phases.WRITEBACK.primary }}
            />
            <span className="text-slate-300">Writeback</span>
          </div>
        </div>
      </div>
    </div>
  );
};
