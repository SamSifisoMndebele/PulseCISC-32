// PulseCISC-32 Visual Canvas Container & Legend
import React, { useRef, useEffect } from 'react';
import type { CPUMicroState } from '../core/types';
import { DatapathRenderer } from '../visualizer/datapath';
import { THEME } from '../visualizer/theme';

interface CanvasViewProps {
  cpuState: CPUMicroState;
  speedScale: number;
}

export const CanvasView: React.FC<CanvasViewProps> = ({ cpuState, speedScale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DatapathRenderer | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize renderer
    const renderer = new DatapathRenderer(canvas);
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

      renderer.render(cpuState, speedScale);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [cpuState, speedScale]);

  return (
    <div className="relative flex flex-col h-full bg-[#0a0d14] overflow-hidden select-none">
      {/* Canvas */}
      <div className="relative flex-1 w-full h-full">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      </div>

      {/* Phase Color Legend Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-[#090d16]/90 border-t border-slate-800 text-xs font-mono text-slate-300 gap-2">
        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <span>FSM Phases:</span>
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
