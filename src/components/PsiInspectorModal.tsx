// IntelliJ-Style PSI Symbol Tree, Static Code Inspector & Native Rust Benchmark Modal
import React, { useState } from 'react';
import {
  X,
  Cpu,
  Gauge,
  Sparkles,
  AlertTriangle,
  Tag,
  Activity,
  CheckCircle2,
  Play,
} from 'lucide-react';
import type {
  EngineInfo,
  PsiAnalysisReport,
  NativeTurboResult,
} from '../core/tauriBridge';

interface PsiInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  engineInfo: EngineInfo | null;
  psiReport: PsiAnalysisReport | null;
  onRunBenchmark: (iterations: number) => Promise<void>;
  lastBenchmark: NativeTurboResult | null;
  isBenchmarking: boolean;
}

export const PsiInspectorModal: React.FC<PsiInspectorModalProps> = ({
  isOpen,
  onClose,
  engineInfo,
  psiReport,
  onRunBenchmark,
  lastBenchmark,
  isBenchmarking,
}) => {
  const [iterations, setIterations] = useState<number>(5_000_000);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-4xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col rounded-2xl bg-[#0b101b] border border-slate-700/80 shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-orange-500/15 border border-orange-500/40 text-orange-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-bold tracking-wide text-white font-mono truncate">
                  Rust Core &amp; PSI Inspector
                </h2>
                <span
                  className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold border ${
                    engineInfo?.isNativeTauri
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                      : 'bg-sky-950/80 text-sky-300 border-sky-700/60'
                  }`}
                >
                  {engineInfo?.isNativeTauri ? 'NATIVE RUST TAURI v2' : 'HYBRID ENGINE READY'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Program Structure Interface (PSI) AST Symbol Indexer • Static Hazard Analyzer • Native 32-Bit ALU Stress Runner
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 sm:space-y-5">
          {/* Top Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                PSI Parse Time
              </div>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                {psiReport ? `${psiReport.parse_time_us} µs` : '—'}
              </div>
              <div className="text-[10px] text-slate-500">Sub-millisecond AST index</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Indexed Symbols
              </div>
              <div className="text-lg font-bold font-mono text-sky-400 mt-0.5">
                {psiReport ? psiReport.symbols.length : 0}
              </div>
              <div className="text-[10px] text-slate-500">
                {psiReport ? `${psiReport.instruction_count} instructions` : 'Labels & Data'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Static Inspections
              </div>
              <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                {psiReport ? psiReport.diagnostics.length : 0}
              </div>
              <div className="text-[10px] text-slate-500">Control-flow &amp; hazard checks</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Host Architecture
              </div>
              <div className="text-sm font-bold font-mono text-purple-300 mt-1 truncate">
                {engineInfo ? `${engineInfo.os}/${engineInfo.arch} (${engineInfo.threads}T)` : 'x86_64'}
              </div>
              <div className="text-[10px] text-slate-500">Hardware threads available</div>
            </div>
          </div>

          {/* Native Rust Turbo ALU Stress Benchmark */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-orange-950/30 via-slate-900/90 to-sky-950/30 border border-orange-500/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-orange-300 font-mono">
                  <Gauge className="w-4 h-4 text-orange-400" />
                  <span>NATIVE RUST 32-BIT ALU TURBO BENCHMARK</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Executes millions of 32-bit register ALU operations (`ADD`, `XOR`, `ROL`, `SUB`, `IMUL`) on the Rust Core and syncs results back to registers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={iterations}
                  onChange={(e) => setIterations(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
                >
                  <option value={1_000_000}>4M Instructions (1M loops)</option>
                  <option value={5_000_000}>20M Instructions (5M loops)</option>
                  <option value={25_000_000}>100M Instructions (25M loops)</option>
                </select>

                <button
                  onClick={() => onRunBenchmark(iterations)}
                  disabled={isBenchmarking}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-orange-600/20"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isBenchmarking ? 'Running...' : 'Run Native Turbo'}</span>
                </button>
              </div>
            </div>

            {lastBenchmark && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-xs font-mono">
                <div>
                  <span className="text-slate-400">Instructions Executed: </span>
                  <span className="text-white font-bold">
                    {lastBenchmark.instructions_executed.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Elapsed Time: </span>
                  <span className="text-emerald-400 font-bold">
                    {(lastBenchmark.elapsed_us / 1000).toFixed(2)} ms ({lastBenchmark.elapsed_us} µs)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Throughput: </span>
                  <span className="text-orange-400 font-bold">
                    {lastBenchmark.effective_mips.toFixed(1)} MIPS (MHz)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Two-Column PSI Details: Symbol Table & Register Heatmap */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PSI Symbol Table */}
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 font-mono mb-2.5">
                <Tag className="w-3.5 h-3.5" />
                <span>PSI Symbol Index (Labels, Data &amp; Constants)</span>
              </div>
              {psiReport && psiReport.symbols.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 font-mono text-xs">
                  {psiReport.symbols.map((sym, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-sky-950 text-sky-300 border border-sky-800/60">
                          {sym.kind}
                        </span>
                        <span className="text-white font-semibold">{sym.name}</span>
                        <span className="text-slate-500 text-[11px]">Line {sym.line}</span>
                      </div>
                      <span className="text-[11px] text-emerald-400">
                        {sym.references} ref{sym.references === 1 ? '' : 's'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-6 text-center">
                  No labels or data symbols declared in current source.
                </div>
              )}
            </div>

            {/* Register Liveness Heatmap */}
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 font-mono mb-2.5">
                <Activity className="w-3.5 h-3.5" />
                <span>Static Register Read/Write Liveness</span>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                {psiReport?.register_usage.map((reg) => (
                  <div
                    key={reg.name}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80"
                  >
                    <span className="font-bold text-slate-200">{reg.name}</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-sky-400" title="Static Reads">
                        R:{reg.reads}
                      </span>
                      <span className="text-amber-400" title="Static Writes">
                        W:{reg.writes}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Static Hazard & Inspection Diagnostics */}
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 font-mono">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>IntelliJ-Style Static Code Inspections</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Dead code • EDX/DIV safety • Unused labels • Stack balance
              </span>
            </div>

            {psiReport && psiReport.diagnostics.length > 0 ? (
              <div className="space-y-1.5 font-mono text-xs">
                {psiReport.diagnostics.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                          d.severity === 'warning'
                            ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                            : 'bg-sky-950 text-sky-300 border border-sky-700/60'
                        }`}
                      >
                        {d.code}
                      </span>
                      <span className="text-slate-200">{d.message}</span>
                    </div>
                    <span className="text-slate-400 whitespace-nowrap">Line {d.line}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/50 rounded-lg px-3 py-2 font-mono">
                <CheckCircle2 className="w-4 h-4" />
                <span>No static control-flow or register hazards detected in assembly source.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono">
            <Cpu className="w-3.5 h-3.5 text-orange-400" />
            <span>Engine: {engineInfo?.backend}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
