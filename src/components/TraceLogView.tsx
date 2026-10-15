// PulseCISC-32 Real-Time Micro-Operation Trace Log
import React, { useRef, useEffect } from 'react';
import type { TraceRecord } from '../core/types';
import { THEME } from '../visualizer/theme';
import { Trash2, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { toHex32 } from '../core/isa';

interface TraceLogViewProps {
  logs: TraceRecord[];
  onClear: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const TraceLogView: React.FC<TraceLogViewProps> = ({
  logs,
  onClear,
  isOpen,
  onToggleOpen,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new trace record
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, isOpen]);

  return (
    <div className="flex flex-col bg-[#080c14] border-t border-slate-800 text-slate-200 font-mono text-xs select-none">
      {/* Drawer Toggle Bar */}
      <div
        onClick={onToggleOpen}
        className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 cursor-pointer hover:bg-slate-800/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-xs text-slate-200">
            Micro-Operation RTL Execution Trace
          </span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
            {logs.length} entries
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            title="Clear Trace Log"
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 px-2 py-0.5 rounded hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>

          <span className="text-slate-400">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </span>
        </div>
      </div>

      {/* Drawer Body */}
      {isOpen && (
        <div
          ref={scrollRef}
          className="h-44 overflow-y-auto p-2 font-mono text-[11px] space-y-1 bg-[#090d16]"
        >
          {logs.length === 0 ? (
            <div className="text-slate-500 p-4 text-center">
              No micro-operations recorded yet. Click Step Micro, Step Inst, or Run to execute.
            </div>
          ) : (
            logs.map((record) => {
              const phaseInfo = THEME.phases[record.phase] || THEME.phases.FETCH;
              return (
                <div
                  key={record.id}
                  className="flex items-center gap-2.5 px-2 py-1 rounded bg-slate-900/40 border border-slate-800/60 hover:bg-slate-900/80 transition-colors"
                >
                  <span className="text-slate-500 min-w-[55px]">
                    #{record.cycle}
                  </span>

                  <span className="text-slate-400 font-mono min-w-[65px]">
                    {toHex32(record.eip)}
                  </span>

                  {/* Phase Badge */}
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase min-w-[70px] text-center"
                    style={{
                      backgroundColor: `${phaseInfo.primary}20`,
                      color: phaseInfo.primary,
                      border: `1px solid ${phaseInfo.primary}40`,
                    }}
                  >
                    {record.phase}
                  </span>

                  {/* Micro-Op RTL */}
                  <span className="text-sky-300 font-medium flex-1">
                    {record.microOp}
                  </span>

                  {/* Details */}
                  <span className="text-slate-400 text-[10px] hidden md:block">
                    {record.details}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
