// PulseCISC-32 Top Navigation & Execution Controls
import React from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Cpu,
  Zap,
} from 'lucide-react';
import type { CPUPhase } from '../core/types';
import { THEME } from '../visualizer/theme';
import { PRESETS } from '../samples/presets';

interface NavbarProps {
  isRunning: boolean;
  onToggleRun: () => void;
  onStepMicro: () => void;
  onStepInstruction: () => void;
  onReset: () => void;
  clockSpeed: number;
  onClockSpeedChange: (speed: number) => void;
  currentPhase: CPUPhase;
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isRunning,
  onToggleRun,
  onStepMicro,
  onStepInstruction,
  onReset,
  clockSpeed,
  onClockSpeedChange,
  currentPhase,
  selectedPresetId,
  onSelectPreset,
}) => {
  const phaseInfo = THEME.phases[currentPhase] || THEME.phases.FETCH;

  return (
    <header className="flex flex-wrap items-center justify-between px-5 py-3 bg-[#0d121d] border-b border-slate-800 text-slate-100 select-none gap-4">
      {/* Brand & Architecture Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 p-[1px] shadow-lg shadow-sky-500/20">
          <div className="flex items-center justify-center w-full h-full bg-[#090d16] rounded-[11px]">
            <Cpu className="w-5 h-5 text-sky-400" />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight text-white font-mono">
              Pulse<span className="text-sky-400">CISC</span>-32
            </span>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-sky-950/80 text-sky-300 border border-sky-800/60">
              x86 IA-32
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            Visual 32-Bit Multi-Cycle CPU & Memory Simulator
          </p>
        </div>
      </div>

      {/* Preset Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 font-medium">Preset:</span>
        <select
          value={selectedPresetId}
          onChange={(e) => onSelectPreset(e.target.value)}
          disabled={isRunning}
          className="text-xs bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Execution Controls */}
      <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-inner">
        {/* Run / Pause Toggle */}
        <button
          onClick={onToggleRun}
          title={isRunning ? 'Pause execution (Space)' : 'Run continuously (Space)'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isRunning
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
          }`}
        >
          {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{isRunning ? 'Pause' : 'Run'}</span>
        </button>

        {/* Step Micro (1 Phase) */}
        <button
          onClick={onStepMicro}
          disabled={isRunning}
          title="Step 1 Micro-Operation (FSM Phase)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition-colors"
        >
          <Zap className="w-3.5 h-3.5 text-sky-400" />
          <span>Step Micro</span>
        </button>

        {/* Step Instruction */}
        <button
          onClick={onStepInstruction}
          disabled={isRunning}
          title="Step 1 Full Instruction (All Micro-Steps)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition-colors"
        >
          <SkipForward className="w-3.5 h-3.5 text-emerald-400" />
          <span>Step Inst</span>
        </button>

        {/* Reset */}
        <button
          onClick={onReset}
          title="Reset Registers & RAM (EIP <- 0x0000)"
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-rose-400 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Clock Speed Slider */}
      <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800/80 rounded-xl px-3 py-1.5">
        <span className="text-xs text-slate-400">Clock:</span>
        <input
          type="range"
          min="0.1"
          max="30"
          step="0.1"
          value={clockSpeed}
          onChange={(e) => onClockSpeedChange(parseFloat(e.target.value))}
          className="w-24 accent-sky-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
        />
        <span className="text-xs font-mono font-semibold text-sky-400 min-w-[45px]">
          {clockSpeed.toFixed(1)} Hz
        </span>
      </div>

      {/* Active Phase Pill */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold tracking-wide uppercase transition-all shadow-sm"
          style={{
            borderColor: phaseInfo.primary,
            backgroundColor: `${phaseInfo.primary}15`,
            color: phaseInfo.primary,
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: phaseInfo.primary }}
          />
          <span>{phaseInfo.name}</span>
        </div>
      </div>
    </header>
  );
};
