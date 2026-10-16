// PulseCISC-32 Split Drawer: Micro-Op RTL Trace (Left) & System Console (Right)
import React, { useRef, useEffect, useState } from 'react';
import type { TraceRecord, ConsoleOutputEntry } from '../core/types';
import { THEME } from '../visualizer/theme';
import { Trash2, ChevronDown, ChevronUp, Terminal, Monitor, BookOpen, Code2, Layers, Filter, Info } from 'lucide-react';
import { toHex32 } from '../core/isa';

export type TraceViewMode = 'student' | 'synced' | 'standard';

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

  // Dual-view mode: 'student' (plain English) vs 'synced' (both) vs 'standard' (formal RTL)
  const [viewMode, setViewMode] = useState<TraceViewMode>('student');
  const [selectedPhase, setSelectedPhase] = useState<string>('ALL');
  const [expandedRecordId, setExpandedRecordId] = useState<number | null>(null);

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

  // Filter logs by selected phase
  const filteredLogs = logs.filter((record) => {
    if (selectedPhase === 'ALL') return true;
    return record.phase === selectedPhase;
  });

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
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 h-64 bg-[#060910]">
          {/* PANE 1: Micro-Operation Execution Trace (Left) */}
          <div className="flex flex-col h-full overflow-hidden">
            {/* Pane Sub-Header / Tool Controls */}
            <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-slate-950/80 border-b border-slate-800/80 text-[11px] gap-2">
              {/* Segmented View Mode Controller */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('student')}
                  title="Plain-English operational explanation for introductory students"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    viewMode === 'student'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Student Mode</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('synced')}
                  title="Side-by-side view showing both plain-English narrative and formal RTL"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    viewMode === 'synced'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Dual Synced</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('standard')}
                  title="Formal mathematical Register-Transfer Level (RTL) hardware notation"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    viewMode === 'standard'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code2 className="w-3 h-3" />
                  <span>Standard RTL</span>
                </button>
              </div>

              {/* Phase Filter & Clear Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                  <Filter className="w-3 h-3 text-slate-500" />
                  <select
                    value={selectedPhase}
                    onChange={(e) => setSelectedPhase(e.target.value)}
                    className="bg-slate-900 border border-slate-800 text-slate-300 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:border-sky-500"
                  >
                    <option value="ALL">All Phases</option>
                    <option value="FETCH">Fetch</option>
                    <option value="DECODE">Decode</option>
                    <option value="EXECUTE">Execute</option>
                    <option value="MEMORY">Memory</option>
                    <option value="WRITEBACK">Writeback</option>
                  </select>
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
            </div>

            {/* Trace List */}
            <div
              ref={traceScrollRef}
              className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1 bg-[#070b14]"
            >
              {filteredLogs.length === 0 ? (
                <div className="text-slate-500 p-4 text-center">
                  {logs.length === 0
                    ? 'No micro-operations recorded. Click Step Micro, Step Inst, or Run.'
                    : `No log entries found for phase "${selectedPhase}".`}
                </div>
              ) : (
                filteredLogs.map((record) => {
                  const phaseInfo = THEME.phases[record.phase] || THEME.phases.FETCH;
                  const isExpanded = expandedRecordId === record.id;
                  const hasImmProvenance = record.latchBProvenance?.type === 'IMM';

                  return (
                    <div
                      key={record.id}
                      onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                      className={`flex flex-col p-1.5 rounded border transition-colors cursor-pointer ${
                        isExpanded
                          ? 'bg-slate-900 border-sky-500/50 shadow-sm shadow-sky-500/10'
                          : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-900/80'
                      }`}
                    >
                      {/* Main Row Summary */}
                      <div className="flex items-start gap-2">
                        {/* Cycle Count */}
                        <span className="text-slate-500 text-[10px] min-w-[38px] pt-0.5">
                          #{record.cycle}
                        </span>

                        {/* Program Counter */}
                        <span className="text-slate-400 font-mono text-[10px] min-w-[50px] pt-0.5">
                          {toHex32(record.eip)}
                        </span>

                        {/* Phase Badge */}
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase min-w-[55px] text-center"
                          style={{
                            backgroundColor: `${phaseInfo.primary}20`,
                            color: phaseInfo.primary,
                            border: `1px solid ${phaseInfo.primary}40`,
                          }}
                        >
                          {record.phase}
                        </span>

                        {/* Provenance Badge (if immediate operand) */}
                        {hasImmProvenance && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded text-[8.5px] font-bold">
                            IMM({record.latchBProvenance?.value})
                          </span>
                        )}

                        {/* Text Content based on Selected View Mode */}
                        <div className="flex-1 min-w-0">
                          {viewMode === 'student' && (
                            <span className="text-slate-200 text-[11px] leading-relaxed block break-words">
                              {record.studentExplanation || record.microOp}
                            </span>
                          )}

                          {viewMode === 'standard' && (
                            <span className="text-sky-300 font-mono text-[11px] leading-relaxed block break-words">
                              {record.microOp}
                            </span>
                          )}

                          {viewMode === 'synced' && (
                            <div className="space-y-0.5">
                              <span className="text-slate-200 text-[11px] font-sans leading-tight block break-words">
                                {record.studentExplanation || record.details}
                              </span>
                              <span className="text-sky-400/90 font-mono text-[10px] block truncate">
                                &gt; RTL: {record.microOp}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Expand Indicator */}
                        <span className="text-slate-500 hover:text-slate-300 pt-0.5">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </span>
                      </div>

                      {/* Expandable Architectural Details Box */}
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-300 space-y-1 bg-slate-950/60 p-2 rounded">
                          <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
                            <Info className="w-3 h-3" />
                            <span>Microarchitecture State &amp; Bus Routes</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Formal RTL: </span>
                            <span className="text-emerald-300 font-mono">{record.microOp}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Student Translation: </span>
                            <span className="text-slate-200 font-sans">{record.studentExplanation}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Active Bus Lines: </span>
                            <span className="text-amber-300 font-mono">
                              {record.activeBuses.join(', ') || 'Internal latch stabilization'}
                            </span>
                          </div>
                          {record.latchAProvenance && (
                            <div>
                              <span className="text-slate-500">Latch A: </span>
                              <span className="text-sky-300 font-mono">
                                {record.latchAProvenance.name} = {toHex32(record.latchAProvenance.value)}
                              </span>
                            </div>
                          )}
                          {record.latchBProvenance && (
                            <div>
                              <span className="text-slate-500">Latch B: </span>
                              <span className={hasImmProvenance ? 'text-amber-300 font-mono' : 'text-sky-300 font-mono'}>
                                {record.latchBProvenance.name} = {toHex32(record.latchBProvenance.value)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
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
