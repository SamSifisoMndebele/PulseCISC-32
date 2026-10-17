// PulseCISC-32 Visual Canvas Container, Interactive Hover Tooltips & Legend
import React, { useRef, useEffect, useState } from 'react';
import type { CPUMicroState } from '../core/types';
import { DatapathRenderer } from '../visualizer/datapath';
import type { DatapathComponentInfo } from '../visualizer/datapath';
import { THEME } from '../visualizer/theme';
import { HelpCircle, Lightbulb, Cpu } from 'lucide-react';

interface CanvasViewProps {
  cpuState: CPUMicroState;
  speedScale: number;
  enableParticles?: boolean;
  particleSpeed?: 'slow' | 'normal' | 'fast';
}

export const CanvasView: React.FC<CanvasViewProps> = ({
  cpuState,
  speedScale,
  enableParticles = true,
  particleSpeed = 'normal',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<DatapathRenderer | null>(null);

  // Hover Tooltip State
  const [hoveredComponent, setHoveredComponent] = useState<DatapathComponentInfo | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize renderer
    const renderer = new DatapathRenderer(canvas);
    renderer.enableParticles = enableParticles;
    renderer.particleSpeedMultiplier = particleSpeed === 'fast' ? 1.8 : particleSpeed === 'slow' ? 0.5 : 1.0;
    rendererRef.current = renderer;

    let animId: number;

    const loop = () => {
      // Dynamic resize check
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(rect.width * dpr);
      const displayHeight = Math.floor(rect.height * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }

      renderer.enableParticles = enableParticles;
      renderer.particleSpeedMultiplier = particleSpeed === 'fast' ? 1.8 : particleSpeed === 'slow' ? 0.5 : 1.0;
      renderer.render(cpuState, speedScale);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [cpuState, speedScale, enableParticles, particleSpeed]);

  // Mouse move handler for interactive hit-testing and contextual tooltips
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !container || !renderer) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse coordinates to canvas internal pixel dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screenX = mouseX * scaleX;
    const screenY = mouseY * scaleY;

    const comp = renderer.getComponentAt(screenX, screenY);
    if (comp) {
      setHoveredComponent(comp);

      // Clamp tooltip position within container bounds
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

      setTooltipPos({ x: Math.max(10, posX), y: Math.max(10, posY) });
    } else {
      setHoveredComponent(null);
      setTooltipPos(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredComponent(null);
    setTooltipPos(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col h-full bg-[#0a0d14] overflow-hidden select-none"
    >
      {/* Canvas */}
      <div className="relative flex-1 w-full h-full">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full block cursor-crosshair"
        />

        {/* Interactive Floating Hover Tooltip Card */}
        {hoveredComponent && tooltipPos && (
          <div
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              pointerEvents: 'none',
            }}
            className="absolute z-30 w-80 max-w-[340px] bg-slate-950/95 border border-sky-500/60 rounded-xl p-3 shadow-2xl shadow-sky-950/80 backdrop-blur-md text-slate-100 font-sans transition-opacity duration-150 animate-in fade-in"
          >
            {/* Header: Title & Category Pill */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Cpu className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="font-semibold text-xs text-sky-300 truncate">
                  {hoveredComponent.title}
                </span>
              </div>
              <span className="bg-sky-950 text-sky-400 border border-sky-800 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold flex-shrink-0">
                {hoveredComponent.category}
              </span>
            </div>

            {/* Role & Summary */}
            <p className="text-[11px] text-slate-300 leading-snug mb-2 font-normal">
              {hoveredComponent.summary}
            </p>

            {/* Pedagogical Insight / Why it works Callout */}
            {hoveredComponent.pedagogicalInsight && (
              <div className="bg-slate-900/90 border border-amber-500/40 rounded-lg p-2.5 mb-2 space-y-1 text-[10.5px]">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                  <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{hoveredComponent.pedagogicalInsight}</span>
                </div>

                {hoveredComponent.whyExplanation && (
                  <div className="text-slate-300 space-y-1 pt-1 text-[10px] leading-relaxed">
                    {hoveredComponent.whyExplanation.split('\n').map((line, idx) => (
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
            {hoveredComponent.mnemonic && (
              <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/50 rounded-md px-2 py-1 text-[10px] text-emerald-300 font-mono">
                <Lightbulb className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="italic">{hoveredComponent.mnemonic}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phase Color Legend Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#090d16]/90 border-t border-slate-800 text-xs font-mono text-slate-300 gap-2">
        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <span className="font-semibold text-slate-300">FSM Phases:</span>
          <span className="text-[10px] text-slate-500 hidden lg:inline">
            (Hover over any datapath block for architectural tooltips)
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
