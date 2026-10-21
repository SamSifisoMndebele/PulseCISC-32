// PulseCISC-32 Split Drawer: Micro-Op RTL Trace (Left) & System Console (Right)
import React, { useRef, useEffect, useState } from 'react';
import type { TraceRecord, ConsoleOutputEntry } from '../core/types';
import { THEME } from '../visualizer/theme';
import {
  Trash2,
  ChevronDown,
  ChevronUp,
  Terminal,
  Monitor,
  BookOpen,
  Code2,
  Layers,
  Filter,
  Info,
  Copy,
  Check,
} from 'lucide-react';
import { toHex32 } from '../core/isa';

export type TraceViewMode = 'student' | 'synced' | 'standard';

interface TraceLogViewProps {
  logs: TraceRecord[];
  onClearLogs: () => void;
  consoleOutput: ConsoleOutputEntry[];
  onClearConsole: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  height?: number;
  fullHeight?: boolean;
}

export const TraceLogView: React.FC<TraceLogViewProps> = ({
  logs,
  onClearLogs,
  consoleOutput,
  onClearConsole,
  isOpen,
  onToggleOpen,
  height = 240,
  fullHeight = false,
}) => {
  const traceScrollRef = useRef<HTMLDivElement>(null);
  const consoleScrollRef = useRef<HTMLDivElement>(null);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Dual-view mode: 'student' (plain English) vs 'synced' (both) vs 'standard' (formal RTL)
  const [viewMode, setViewMode] = useState<TraceViewMode>('student');
  const [selectedPhase, setSelectedPhase] = useState<string>('ALL');
  const [expandedRecordId, setExpandedRecordId] = useState<number | null>(null);

  // Mobile sub-pane toggle ('trace' | 'console') for screens < md
  const [mobilePane, setMobilePane] = useState<'trace' | 'console'>('trace');

  // Internal split ratio (percentage width of left trace pane, default 55%)
  const [leftPaneRatio, setLeftPaneRatio] = useState<number>(() => {
    const saved = localStorage.getItem('pulsecisc_bottom_split_ratio');
    const parsed = saved ? parseFloat(saved) : 55;
    return !isNaN(parsed) ? Math.min(80, Math.max(20, parsed)) : 55;
  });
  const [isDraggingSplit, setIsDraggingSplit] = useState<boolean>(false);

  // Copy feedback states
  const [copiedTrace, setCopiedTrace] = useState<boolean>(false);
  const [copiedConsole, setCopiedConsole] = useState<boolean>(false);

  // Auto-scroll trace log to bottom
  useEffect(() => {
    if (traceScrollRef.current && (isOpen || fullHeight)) {
      traceScrollRef.current.scrollTop = traceScrollRef.current.scrollHeight;
    }
  }, [logs.length, isOpen, fullHeight, mobilePane]);

  // Auto-scroll console to bottom
  useEffect(() => {
    if (consoleScrollRef.current && (isOpen || fullHeight)) {
      consoleScrollRef.current.scrollTop = consoleScrollRef.current.scrollHeight;
    }
  }, [consoleOutput.length, isOpen, fullHeight, mobilePane]);

  // Filter logs by selected phase
  const filteredLogs = logs.filter((record) => {
    if (selectedPhase === 'ALL') return true;
    return record.phase === selectedPhase;
  });

  // Handle internal horizontal splitter drag
  const handleSplitPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingSplit(true);
  };

  const handleSplitPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSplit || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const nextRatio = Math.min(82, Math.max(18, (relX / rect.width) * 100));
    setLeftPaneRatio(nextRatio);
  };

  const handleSplitPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSplit) return;
    setIsDraggingSplit(false);
    localStorage.setItem('pulsecisc_bottom_split_ratio', leftPaneRatio.toFixed(1));
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  const handleCopyTrace = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = filteredLogs
      .map(
        (r) =>
          `#${r.cycle} [${toHex32(r.eip)}] ${r.phase}: ${
            viewMode === 'standard' ? r.microOp : r.studentExplanation || r.microOp
          }`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedTrace(true);
    setTimeout(() => setCopiedTrace(false), 1500);
  };

  const handleCopyConsole = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = consoleOutput.map((c) => c.text).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedConsole(true);
    setTimeout(() => setCopiedConsole(false), 1500);
  };

  return (
    <div
      className={`flex flex-col bg-[#070a12] border-t border-slate-800 text-slate-200 font-mono text-xs ${
        fullHeight ? 'h-full flex-1 overflow-hidden' : 'flex-shrink-0'
      }`}
    >
      {/* Desktop Drawer Toggle Header Bar (Hidden when rendered as fullHeight mobile tab) */}
      {!fullHeight && (
        <div
          onClick={onToggleOpen}
          className="flex items-center justify-between px-4 py-1.5 bg-slate-900/90 border-b border-slate-800 cursor-pointer hover:bg-slate-800/80 transition-colors select-none"
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

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="hidden md:inline text-[10px] text-slate-500">
              {isOpen ? 'Click to collapse' : 'Click to expand'}
            </span>
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </div>
      )}

      {/* Mobile Sub-Tab Switcher (< md) so RTL Trace and Console each get full space on phones */}
      {(isOpen || fullHeight) && (
        <div className="flex md:hidden items-center bg-slate-950 border-b border-slate-800 text-xs select-none shrink-0">
          <button
            type="button"
            onClick={() => setMobilePane('trace')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-medium transition-colors ${
              mobilePane === 'trace'
                ? 'bg-slate-900 text-sky-400 border-b-2 border-sky-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>RTL Trace</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
              {logs.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('console')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-medium transition-colors ${
              mobilePane === 'console'
                ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Console Output</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
              {consoleOutput.length}
            </span>
          </button>
        </div>
      )}

      {/* Drawer Body (Divided into 2 Side-by-Side Resizable Panes on >= md, Tabbed on < md) */}
      {(isOpen || fullHeight) && (
        <div
          ref={splitContainerRef}
          style={fullHeight ? undefined : { height: `${height}px` }}
          className={`flex flex-col md:flex-row bg-[#060910] overflow-hidden ${
            fullHeight ? 'flex-1 min-h-0' : ''
          }`}
        >
          {/* PANE 1: Micro-Operation Execution Trace (Left) */}
          <div
            style={{ width: `${leftPaneRatio}%` }}
            className={`flex flex-col h-full overflow-hidden max-md:!w-full flex-shrink-0 ${
              mobilePane === 'console' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Pane Sub-Header / Tool Controls */}
            <div className="flex flex-wrap items-center justify-between px-2.5 sm:px-3 py-1.5 bg-slate-950/80 border-b border-slate-800/80 text-[11px] gap-1.5 select-none">
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
                  <span>Student</span>
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
                  <span>Synced</span>
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
                  <span>RTL</span>
                </button>
              </div>

              {/* Phase Filter, Copy & Clear Controls */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                  <Filter className="w-3 h-3 text-slate-500 hidden xs:inline" />
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

                {filteredLogs.length > 0 && (
                  <button
                    onClick={handleCopyTrace}
                    title="Copy Trace Log to Clipboard"
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-sky-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
                  >
                    {copiedTrace ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span className="hidden xs:inline">Copy</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearLogs();
                  }}
                  title="Clear Trace Log"
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden xs:inline">Clear</span>
                </button>
              </div>
            </div>

            {/* Trace List */}
            <div
              ref={traceScrollRef}
              className="flex-1 overflow-y-auto p-2 font-mono text-[11px] space-y-1 bg-[#070b14] select-text"
            >
              {filteredLogs.length === 0 ? (
                <div className="text-slate-500 p-4 text-center select-none">
                  {logs.length === 0
                    ? 'No micro-operations recorded. Tap Step Micro, Step Inst, or Run.'
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
                      onClick={() => {
                        const sel = window.getSelection();
                        if (sel && sel.toString().length > 0) return;
                        setExpandedRecordId(isExpanded ? null : record.id);
                      }}
                      className={`flex flex-col p-1.5 rounded border transition-colors cursor-pointer ${
                        isExpanded
                          ? 'bg-slate-900 border-sky-500/50 shadow-sm shadow-sky-500/10'
                          : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-900/80'
                      }`}
                    >
                      {/* Main Row Summary */}
                      <div className="flex items-start gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                        {/* Cycle Count */}
                        <span className="text-slate-500 text-[10px] min-w-[32px] sm:min-w-[38px] pt-0.5">
                          #{record.cycle}
                        </span>

                        {/* Program Counter */}
                        <span className="text-slate-400 font-mono text-[10px] min-w-[46px] sm:min-w-[50px] pt-0.5">
                          {toHex32(record.eip)}
                        </span>

                        {/* Phase Badge */}
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase min-w-[52px] text-center select-none"
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
                            IMM
                          </span>
                        )}

                        {/* Text Content based on Selected View Mode */}
                        <div className="flex-1 min-w-[160px] select-text cursor-text">
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
                              <span className="text-sky-400/90 font-mono text-[10px] block break-words">
                                &gt; RTL: {record.microOp}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Expand Indicator */}
                        <span className="text-slate-500 hover:text-slate-300 pt-0.5 select-none ml-auto">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </span>
                      </div>

                      {/* Expandable Architectural Details Box */}
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-300 space-y-1 bg-slate-950/60 p-2 rounded select-text cursor-text">
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

          {/* Internal Resizable Splitter Handle between Trace & Console */}
          <div
            onPointerDown={handleSplitPointerDown}
            onPointerMove={handleSplitPointerMove}
            onPointerUp={handleSplitPointerUp}
            onDoubleClick={() => {
              setLeftPaneRatio(55);
              localStorage.setItem('pulsecisc_bottom_split_ratio', '55');
            }}
            title="Drag to resize Trace vs Console • Double-click to reset"
            className={`hidden md:flex w-1.5 flex-shrink-0 items-center justify-center cursor-col-resize select-none transition-colors group ${
              isDraggingSplit ? 'bg-sky-500' : 'bg-slate-800/80 hover:bg-sky-500/70'
            }`}
          >
            <div className="w-0.5 h-6 rounded-full bg-slate-600 group-hover:bg-white transition-colors" />
          </div>

          {/* PANE 2: System Console / Output Terminal (Right) */}
          <div
            className={`flex-1 flex flex-col h-full overflow-hidden bg-[#050811] min-w-0 ${
              mobilePane === 'trace' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Pane Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/70 border-b border-slate-800/80 text-[11px] select-none">
              <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                <span>Console Output (Irvine32 / Syscalls / MMIO)</span>
              </div>
              <div className="flex items-center gap-1.5">
                {consoleOutput.length > 0 && (
                  <button
                    onClick={handleCopyConsole}
                    title="Copy Console Output to Clipboard"
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
                  >
                    {copiedConsole ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}
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
            </div>

            {/* Console Screen */}
            <div
              ref={consoleScrollRef}
              className="flex-1 overflow-y-auto p-2.5 font-mono text-[11px] space-y-1 bg-[#04060d] text-emerald-300 select-text cursor-text"
            >
              {consoleOutput.length === 0 ? (
                <div className="text-slate-600 p-4 text-center select-none">
                  Console is empty. Use <code className="text-emerald-400 select-text">CALL WriteString</code> or <code className="text-emerald-400 select-text">CALL WriteInt</code> in assembly to print results!
                </div>
              ) : (
                consoleOutput.map((entry) => {
                  const isSystem = entry.type === 'system';
                  const displayText = entry.text.replace(/\r?\n$/, '') || (entry.text.includes('\n') ? '\u00A0' : '');
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-start gap-2 leading-relaxed whitespace-pre-wrap ${
                        isSystem ? 'text-sky-400 font-semibold italic' : 'text-emerald-300'
                      }`}
                    >
                      <span className="text-slate-600 select-none">&gt;</span>
                      <span className="flex-1 break-all select-text whitespace-pre-wrap">{displayText}</span>
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
