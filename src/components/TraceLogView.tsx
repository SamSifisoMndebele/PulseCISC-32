// PulseCISC-32 Split Drawer: Micro-Op RTL Trace (Left) & System Console (Right)
import React, { useRef, useEffect } from 'react';
import type { TraceRecord, ConsoleOutputEntry } from '../core/types';
import { THEME } from '../visualizer/theme';
import { Trash2, ChevronDown, ChevronUp, Terminal, Monitor } from 'lucide-react';
import { toHex32 } from '../core/isa';

interface TraceLogViewProps {
  logs: TraceRecord[];
  onClearLogs: () => void;
  consoleOutput: ConsoleOutputEntry[];
  onClearConsole: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const TraceLogView: React.FC<TraceLogViewProps> = ({
  logs,
  onClearLogs,
  consoleOutput,
  onClearConsole,
  isOpen,
  onToggleOpen,
}) => {
  const traceScrollRef = useRef<HTMLDivElement>(null);
  const consoleScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll trace log to bottom
  useEffect(() => {
    if (traceScrollRef.current && isOpen) {
      traceScrollRef.current.scrollTop = traceScrollRef.current.scrollHeight;
    }
  }, [logs.length, isOpen]);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (consoleScrollRef.current && isOpen) {
      consoleScrollRef.current.scrollTop = consoleScrollRef.current.scrollHeight;
    }
  }, [consoleOutput.length, isOpen]);

  return (
    <div className="flex flex-col bg-[#070a12] border-t border-slate-800 text-slate-200 font-mono text-xs select-none">
      {/* Drawer Toggle Header Bar */}
      <div
        onClick={onToggleOpen}
        className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 cursor-pointer hover:bg-slate-800/80 transition-colors"
      >
        <div className="flex items-center gap-6">
          {/* Trace Title Badge */}
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-xs text-slate-200">
              Micro-Operation RTL Execution Trace
            </span>
            <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
              {logs.length} entries
            </span>
          </div>

          {/* Console Title Badge */}
          <div className="hidden sm:flex items-center gap-2 border-l border-slate-700/60 pl-6">
            <Monitor className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-xs text-emerald-300">
              System Console / Terminal Output
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
              {consoleOutput.length} lines
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </span>
        </div>
      </div>

      {/* Drawer Body (Divided into 2 Side-by-Side Panes) */}
      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 h-52 bg-[#060910]">
          {/* PANE 1: Micro-Operation RTL Execution Trace (Left) */}
          <div className="flex flex-col h-full overflow-hidden">
            {/* Pane Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/70 border-b border-slate-800/80 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                <span>Micro-Op Log (Datapath States)</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearLogs();
                }}
                title="Clear Trace Log"
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>

            {/* Trace List */}
            <div
              ref={traceScrollRef}
              className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1 bg-[#070b14]"
            >
              {logs.length === 0 ? (
                <div className="text-slate-500 p-4 text-center">
                  No micro-operations recorded. Click Step Micro, Step Inst, or Run.
                </div>
              ) : (
                logs.map((record) => {
                  const phaseInfo = THEME.phases[record.phase] || THEME.phases.FETCH;
                  return (
                    <div
                      key={record.id}
                      className="flex items-center gap-2 px-2 py-1 rounded bg-slate-900/40 border border-slate-800/60 hover:bg-slate-900/80 transition-colors"
                    >
                      <span className="text-slate-500 text-[10px] min-w-[45px]">
                        #{record.cycle}
                      </span>

                      <span className="text-slate-400 font-mono text-[10px] min-w-[55px]">
                        {toHex32(record.eip)}
                      </span>

                      {/* Phase Badge */}
                      <span
                        className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase min-w-[60px] text-center"
                        style={{
                          backgroundColor: `${phaseInfo.primary}20`,
                          color: phaseInfo.primary,
                          border: `1px solid ${phaseInfo.primary}40`,
                        }}
                      >
                        {record.phase}
                      </span>

                      {/* Micro-Op RTL */}
                      <span className="text-sky-300 text-[11px] truncate flex-1" title={record.microOp}>
                        {record.microOp}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PANE 2: System Console / Output Terminal (Right) */}
          <div className="flex flex-col h-full overflow-hidden bg-[#050811]">
            {/* Pane Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/70 border-b border-slate-800/80 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                <span>Console Output (PRINT / MMIO)</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClearConsole();
                }}
                title="Clear Console Output"
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>

            {/* Console Screen */}
            <div
              ref={consoleScrollRef}
              className="flex-1 overflow-y-auto p-2.5 font-mono text-[11px] space-y-1 bg-[#04060d] text-emerald-300"
            >
              {consoleOutput.length === 0 ? (
                <div className="text-slate-600 p-4 text-center">
                  Console is empty. Use <code className="text-emerald-400">PRINT EAX</code> in assembly to print results!
                </div>
              ) : (
                consoleOutput.map((entry) => {
                  const isSystem = entry.type === 'system';
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-start gap-2 leading-relaxed ${
                        isSystem ? 'text-sky-400 font-semibold italic' : 'text-emerald-300'
                      }`}
                    >
                      <span className="text-slate-600 select-none">&gt;</span>
                      <span className="flex-1 break-all">{entry.text}</span>
                    </div>
                  );
                })
              )}
              {/* Blinking Terminal Cursor */}
              <div className="flex items-center gap-2 text-emerald-400 select-none pt-1">
                <span className="text-slate-600">&gt;</span>
                <span className="w-2 h-3.5 bg-emerald-400 animate-pulse inline-block" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
