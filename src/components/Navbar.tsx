// PulseCISC-32 Top Navigation & Execution Controls (Responsive Mobile + Desktop Studio Edition)
import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Zap,
  Settings,
  Database,
  BookOpen,
  PanelLeft,
  PanelBottom,
  PanelRight,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  MoreVertical,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { PulseLogo } from './PulseLogo';
import { PRESETS, getShortProgramName, type ProgramPreset } from '../samples/presets';

export type ThemePreference = 'system' | 'light' | 'dark';

interface NavbarProps {
  isRunning: boolean;
  onToggleRun: () => void;
  onStepMicro: () => void;
  onStepInstruction: () => void;
  onReset: () => void;
  clockSpeed: number;
  onClockSpeedChange: (speed: number) => void;
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  userPrograms?: ProgramPreset[];
  onCreateCustomProgram?: () => void;
  memorySizeLabel?: string;
  onOpenSettings: () => void;
  onOpenCheatsheet: () => void;
  onOpenPsiInspector?: () => void;
  psiParseTimeUs?: number;
  psiWarningCount?: number;
  isNativeTauri?: boolean;
  isLeftOpen?: boolean;
  onToggleLeft?: () => void;
  isBottomOpen?: boolean;
  onToggleBottom?: () => void;
  isRightOpen?: boolean;
  onToggleRight?: () => void;
  themePref?: ThemePreference;
  resolvedTheme?: 'light' | 'dark';
  onCycleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isRunning,
  onToggleRun,
  onStepMicro,
  onStepInstruction,
  onReset,
  clockSpeed,
  onClockSpeedChange,
  selectedPresetId,
  onSelectPreset,
  userPrograms = [],
  onCreateCustomProgram,
  memorySizeLabel = '64 KB RAM',
  onOpenSettings,
  onOpenCheatsheet,
  onOpenPsiInspector,
  psiParseTimeUs,
  psiWarningCount = 0,
  isNativeTauri = false,
  isLeftOpen = true,
  onToggleLeft,
  isBottomOpen = true,
  onToggleBottom,
  isRightOpen = true,
  onToggleRight,
  themePref = 'system',
  resolvedTheme = 'dark',
  onCycleTheme,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const themeLabel =
    themePref === 'system'
      ? `Auto (${resolvedTheme === 'light' ? 'Light' : 'Night'})`
      : themePref === 'light'
      ? 'Light Mode'
      : 'Night Mode';

  const themeTitle = `Theme: ${themeLabel} — Tap to switch`;

  const selectedCustom = userPrograms.find((p) => p.id === selectedPresetId);
  const selectedBuiltIn = PRESETS.find((p) => p.id === selectedPresetId);
  const selectedDisplayLabel = selectedCustom
    ? `★ ${selectedCustom.name}`
    : selectedBuiltIn
    ? getShortProgramName(selectedBuiltIn.name)
    : 'Select Program';

  return (
    <header className="flex flex-col lg:flex-row lg:flex-nowrap lg:items-center lg:justify-between px-3 sm:px-4 pb-2 pt-safe-offset-2 bg-[#0d121d] border-b border-slate-800 text-slate-100 select-none gap-2 lg:gap-3 shrink-0">
      {/* Top Row on Mobile / Left Section on Desktop: Brand + Mobile Quick Actions */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <PulseLogo
            size={32}
            className="transition-transform duration-200 hover:scale-105 cursor-pointer shrink-0"
          />
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="font-bold text-sm sm:text-base tracking-tight text-white font-mono whitespace-nowrap">
              Pulse<span className="text-sky-400">CISC</span>-32
            </span>
            <span className="hidden 2xl:inline-block text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded-full bg-sky-950/80 text-sky-300 border border-sky-800/60">
              x86
            </span>

            {/* Clickable Memory Capacity Badge */}
            <button
              onClick={onOpenSettings}
              title="Configure System & Memory Architecture"
              className="hidden xl:flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950/70 border border-purple-700/60 text-purple-300 hover:bg-purple-900/60 hover:text-white transition-all text-[10px] font-mono font-bold cursor-pointer whitespace-nowrap"
            >
              <Database className="w-3 h-3 text-purple-400 shrink-0" />
              <span>{memorySizeLabel}</span>
            </button>

            {/* Code Analyzer & Benchmark Badge (Inline on >= sm, in 3-dots menu on xs) */}
            {onOpenPsiInspector && (
              <button
                onClick={onOpenPsiInspector}
                title="Open Code Analyzer, Symbol Table & ALU Benchmark"
                className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-950/70 border border-orange-600/60 text-orange-300 hover:bg-orange-900/60 hover:text-white transition-all text-[10px] font-mono font-bold cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3 h-3 text-orange-400 shrink-0" />
                <span>{isNativeTauri ? 'Rust' : 'Analyzer'}</span>
                {psiParseTimeUs !== undefined && (
                  <span className="text-emerald-400 hidden md:inline">({psiParseTimeUs}µs)</span>
                )}
                {psiWarningCount > 0 && (
                  <span className="px-1 rounded bg-amber-500/30 text-amber-200">
                    {psiWarningCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile/Tablet Right Controls: Preset Selector + 3-Dots Context Menu (Shown on < lg) */}
        <div className="flex lg:hidden items-center justify-end gap-1.5 min-w-0 flex-1">
          <div className="relative min-w-0 flex-1 max-w-[175px] sm:max-w-[240px]">
            <div
              className={`flex items-center justify-between gap-1.5 text-[11px] bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1.5 text-slate-200 transition-colors ${
                isRunning ? 'opacity-50' : ''
              }`}
            >
              <span className="truncate">{selectedDisplayLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </div>
            <select
              value={selectedPresetId}
              onChange={(e) => {
                if (e.target.value === '__new_custom__') {
                  onCreateCustomProgram?.();
                } else {
                  onSelectPreset(e.target.value);
                }
              }}
              disabled={isRunning}
              aria-label="Select Sample Program Preset"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed text-[11px] bg-slate-900 text-slate-200"
            >
              {userPrograms.length > 0 && (
                <optgroup label="My Saved Programs (Local)">
                  {userPrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      ★ {p.name} - Custom
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Built-in Samples">
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
              {onCreateCustomProgram && (
                <optgroup label="Custom Code">
                  <option value="__new_custom__">+ Create New Custom Program...</option>
                </optgroup>
              )}
            </select>
          </div>

          {/* 3-Dots Context Menu on Mobile */}
          <div className="relative shrink-0" ref={mobileMenuRef}>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              title="More options"
              aria-label="Open menu"
              aria-expanded={isMobileMenuOpen}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isMobileMenuOpen
                  ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white active:bg-slate-800'
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {isMobileMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl bg-[#0d121d] border border-slate-700/90 shadow-2xl py-1.5 z-50 divide-y divide-slate-800/80">
                <div className="py-1">
                  {onCreateCustomProgram && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onCreateCustomProgram();
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-emerald-300 hover:bg-slate-800/80 active:bg-slate-800 transition-colors text-left font-medium"
                    >
                      <Plus className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>New Custom Program</span>
                    </button>
                  )}

                  {onOpenPsiInspector && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        onOpenPsiInspector();
                      }}
                      className="w-full flex items-center justify-between gap-2.5 px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-800/80 active:bg-slate-800 transition-colors text-left"
                    >
                      <span className="flex items-center gap-2.5">
                        <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
                        <span>Code Analyzer &amp; Benchmark</span>
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-mono">
                        {psiParseTimeUs !== undefined && (
                          <span className="text-emerald-400">{psiParseTimeUs}µs</span>
                        )}
                        {psiWarningCount > 0 && (
                          <span className="px-1 rounded bg-amber-500/30 text-amber-300 font-bold">
                            {psiWarningCount}
                          </span>
                        )}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onCycleTheme?.();
                    }}
                    className="w-full flex items-center justify-between gap-2.5 px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-800/80 active:bg-slate-800 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      {themePref === 'system' ? (
                        <Monitor className="w-4 h-4 text-sky-400 shrink-0" />
                      ) : resolvedTheme === 'light' ? (
                        <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
                      )}
                      <span>Theme</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{themeLabel}</span>
                  </button>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenCheatsheet();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-800/80 active:bg-slate-800 transition-colors text-left"
                  >
                    <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>x86 ISA Manual</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center justify-between gap-2.5 px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-800/80 active:bg-slate-800 transition-colors text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <Settings className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>System Settings</span>
                    </span>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-950/70 border border-purple-700/50 px-1.5 py-0.5 rounded">
                      {memorySizeLabel}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Center Section: Preset Selector, + New Custom Program & Save .ASM (Shown on >= lg) */}
      <div className="hidden lg:flex items-center gap-1.5 min-w-0 shrink">
        <span className="text-xs text-slate-400 font-medium hidden 2xl:inline shrink-0">
          Program:
        </span>
        <div className="relative min-w-0 max-w-[190px] xl:max-w-[230px] 2xl:max-w-[260px]">
          <div
            className={`flex items-center justify-between gap-2 text-xs bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 transition-colors ${
              isRunning ? 'opacity-50' : ''
            }`}
          >
            <span className="truncate">{selectedDisplayLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </div>
          <select
            value={selectedPresetId}
            onChange={(e) => {
              if (e.target.value === '__new_custom__') {
                onCreateCustomProgram?.();
              } else {
                onSelectPreset(e.target.value);
              }
            }}
            disabled={isRunning}
            aria-label="Select Sample Program Preset"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed text-xs bg-slate-900 text-slate-200"
          >
            {userPrograms.length > 0 && (
              <optgroup label="My Saved Programs (Local)">
                {userPrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    ★ {p.name} - Custom
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Built-in Samples">
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            {onCreateCustomProgram && (
              <optgroup label="Custom Code">
                <option value="__new_custom__">+ Create New Custom Program...</option>
              </optgroup>
            )}
          </select>
        </div>

        {onCreateCustomProgram && (
          <button
            type="button"
            onClick={onCreateCustomProgram}
            disabled={isRunning}
            title="Create a new custom assembly program (persisted locally)"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 text-emerald-300 hover:text-emerald-200 hover:border-emerald-500/60 transition-colors text-xs font-medium cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden xl:inline">New</span>
          </button>
        )}
      </div>

      {/* Row 2 on Mobile / Right Section on Desktop: Execution Transport Controls, Clock Speed & Desktop Tools */}
      <div className="flex items-center justify-between lg:justify-end gap-1.5 xl:gap-2 shrink-0">
        {/* Execution Controls */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-1 shadow-inner flex-1 sm:flex-initial justify-between sm:justify-start whitespace-nowrap">
          {/* Run / Pause Toggle */}
          <button
            onClick={onToggleRun}
            title={isRunning ? 'Pause execution (Space)' : 'Run continuously (Space)'}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 active:bg-emerald-500/40'
            }`}
          >
            {isRunning ? (
              <Pause className="w-3.5 h-3.5 fill-current shrink-0" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
            )}
            <span>{isRunning ? 'Pause' : 'Run'}</span>
          </button>

          {/* Step Micro (1 Phase) */}
          <button
            onClick={onStepMicro}
            disabled={isRunning}
            title="Step 1 Micro-Operation (FSM Phase - F11)"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 active:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="hidden xl:inline">Step Micro</span>
            <span className="xl:hidden">Micro</span>
          </button>

          {/* Step Instruction */}
          <button
            onClick={onStepInstruction}
            disabled={isRunning}
            title="Step 1 Full Instruction (All Micro-Steps - F10)"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 active:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden xl:inline">Step Inst</span>
            <span className="xl:hidden">Inst</span>
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            title="Reset Registers & RAM (EIP <- 0x0000)"
            className="flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 active:bg-slate-700 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden 2xl:inline">Reset</span>
          </button>
        </div>

        {/* Clock Speed Slider, Layout Dock Toggles & Desktop Buttons */}
        <div className="flex items-center gap-1.5 xl:gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/80 rounded-xl px-2 py-1.5">
            <span className="text-[11px] text-slate-400 hidden 2xl:inline">Clock:</span>
            <input
              type="range"
              min="0.1"
              max="30"
              step="0.1"
              value={clockSpeed}
              aria-label="Clock Speed Hz"
              onChange={(e) => onClockSpeedChange(parseFloat(e.target.value))}
              className="w-14 sm:w-16 xl:w-20 accent-sky-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            />
            <span className="text-[11px] font-mono font-semibold text-sky-400 min-w-[34px] text-right">
              {clockSpeed.toFixed(1)}Hz
            </span>
          </div>

          {/* Desktop 3-Column IDE Dock Toggles (Shown on >= lg) */}
          <div className="hidden lg:flex items-center gap-0.5 bg-slate-900/90 border border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={onToggleLeft}
              title={`${isLeftOpen ? 'Hide' : 'Show'} Left Code Dock (Ctrl+B)`}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLeftOpen
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleBottom}
              title={`${isBottomOpen ? 'Hide' : 'Show'} Bottom Trace & Console Drawer (Ctrl+J)`}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isBottomOpen
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <PanelBottom className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onToggleRight}
              title={`${isRightOpen ? 'Hide' : 'Show'} Right Registers & RAM Dock`}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isRightOpen
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <PanelRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Desktop Theme Mode Button */}
          <button
            type="button"
            onClick={onCycleTheme}
            title={themeTitle}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 hover:border-amber-500/50 transition-colors text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            {themePref === 'system' ? (
              <Monitor className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            ) : resolvedTheme === 'light' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            )}
            <span className="hidden 2xl:inline capitalize">{themeLabel}</span>
          </button>

          {/* Desktop ISA Manual Reference Button */}
          <button
            onClick={onOpenCheatsheet}
            title="Open x86 ISA Reference Manual & Cheatsheet"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-300 hover:border-emerald-600/50 transition-colors text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="hidden xl:inline">Manual</span>
          </button>

          {/* Desktop System Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Configure System Architecture, Memory & Visualizer"
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-sky-300 hover:border-sky-600/50 transition-colors text-xs font-medium shadow-sm cursor-pointer whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="hidden xl:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
