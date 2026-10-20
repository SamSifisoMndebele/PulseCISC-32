// PulseCISC-32 Main Application (Responsive Mobile, Tablet & Desktop Studio with Rust Core & PSI)
import { useState, useRef, useEffect, useCallback } from 'react';
import { CPU } from './core/cpu';
import { Memory } from './core/memory';
import { Assembler } from './core/assembler';
import type { CPUMicroState, RegisterId, AssembledProgram } from './core/types';
import { PRESETS } from './samples/presets';
import { Navbar, type ThemePreference } from './components/Navbar';
import { CodeEditor } from './components/CodeEditor';
import { MachineCodeView } from './components/MachineCodeView';
import { CanvasView } from './components/CanvasView';
import { RegisterFileView } from './components/RegisterFileView';
import { SpecialRegistersView } from './components/SpecialRegistersView';
import { MemoryGridView } from './components/MemoryGridView';
import { TraceLogView } from './components/TraceLogView';
import { CheatsheetModal } from './components/CheatsheetModal';
import { SettingsModal } from './components/SettingsModal';
import { ScreenSizeGuard } from './components/ScreenSizeGuard';
import { PsiInspectorModal } from './components/PsiInspectorModal';
import { setVisualizerTheme } from './visualizer/theme';
import {
  getRustEngineInfo,
  analyzeAssemblyPsi,
  runNativeTurboBenchmark,
  saveAsmFileNative,
  type EngineInfo,
  type PsiAnalysisReport,
  type NativeTurboResult,
} from './core/tauriBridge';
import {
  type SystemConfig,
  loadSystemConfig,
  saveSystemConfig,
  getMemoryCapacityLabel,
} from './core/config';
import {
  Code2,
  Binary,
  Database,
  Cpu as CpuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Activity,
  Terminal,
  CheckCircle2,
} from 'lucide-react';

const DEFAULT_LEFT_WIDTH = 340;
const DEFAULT_RIGHT_WIDTH = 320;
const DEFAULT_BOTTOM_HEIGHT = 240;

export type MobileWorkspaceTab = 'datapath' | 'code' | 'registers' | 'ram' | 'trace';

export function App() {
  // System Configuration (defaults to 64KB, persisted in localStorage)
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(() => loadSystemConfig());

  // Device Night / Light Mode Detection & Theme Preference ('system' by default)
  const [themePref, setThemePref] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('pulsecisc_theme_pref');
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    themePref === 'system' ? (systemIsDark ? 'dark' : 'light') : themePref;

  useEffect(() => {
    const isLight = resolvedTheme === 'light';
    document.documentElement.classList.toggle('theme-light', isLight);
    setVisualizerTheme(isLight);
    localStorage.setItem('pulsecisc_theme_pref', themePref);
  }, [resolvedTheme, themePref]);

  const handleCycleTheme = useCallback(() => {
    setThemePref((prev) => {
      if (prev === 'system') return 'light';
      if (prev === 'light') return 'dark';
      return 'system';
    });
  }, []);

  // CPU Instance with configured memory capacity
  const cpuRef = useRef<CPU | null>(null);
  if (!cpuRef.current) {
    const mem = new Memory(systemConfig.memorySize, systemConfig.dataStart);
    const c = new CPU(mem);
    if (systemConfig.initialEsp !== 'auto') {
      c.defaultEsp = systemConfig.initialEsp;
      c.reset();
    }
    cpuRef.current = c;
  }
  const cpu = cpuRef.current;

  // Preset & Editor State
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESETS[0].id);
  const [code, setCode] = useState<string>(PRESETS[0].code);
  const [assembled, setAssembled] = useState<AssembledProgram>(() =>
    Assembler.assemble(PRESETS[0].code, {
      codeStart: systemConfig.codeStart,
      codeEnd: Math.max(0, systemConfig.dataStart - 1),
      dataStart: systemConfig.dataStart,
      dataEnd: systemConfig.memorySize - 1,
    })
  );

  // CPU Snapshot State
  const [cpuState, setCpuState] = useState<CPUMicroState>(() => {
    const initAsm = Assembler.assemble(PRESETS[0].code, {
      codeStart: systemConfig.codeStart,
      codeEnd: Math.max(0, systemConfig.dataStart - 1),
      dataStart: systemConfig.dataStart,
      dataEnd: systemConfig.memorySize - 1,
    });
    cpu.memory.loadCode(initAsm.codeBytes);
    if (initAsm.dataBytes && initAsm.dataBytes.length > 0) {
      cpu.memory.loadData(initAsm.dataBytes);
    }
    return cpu.getSnapshot();
  });

  // Execution Controls & Modals
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [clockSpeed, setClockSpeed] = useState<number>(systemConfig.defaultClockSpeed);
  const [isCheatsheetOpen, setIsCheatsheetOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPsiInspectorOpen, setIsPsiInspectorOpen] = useState<boolean>(false);
  const [assembleToast, setAssembleToast] = useState<boolean>(false);

  // Mobile Workspace Tab State (< 1024px)
  const [mobileTab, setMobileTab] = useState<MobileWorkspaceTab>('datapath');

  // Rust Core & IntelliJ-Style PSI State
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const [psiReport, setPsiReport] = useState<PsiAnalysisReport | null>(null);
  const [lastBenchmark, setLastBenchmark] = useState<NativeTurboResult | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState<boolean>(false);

  useEffect(() => {
    getRustEngineInfo().then(setEngineInfo);
  }, []);

  useEffect(() => {
    let cancelled = false;
    analyzeAssemblyPsi(code).then((report) => {
      if (!cancelled) setPsiReport(report);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleRunNativeBenchmark = useCallback(
    async (iterations: number) => {
      setIsBenchmarking(true);
      try {
        const res = await runNativeTurboBenchmark(iterations, cpu.registers);
        setLastBenchmark(res);
        for (let i = 0; i < 8; i++) {
          cpu.registers[i] = res.registers[i] >>> 0;
        }
        cpu.flags = {
          zf: res.flags.zf,
          sf: res.flags.sf,
          of: res.flags.of,
          cf: res.flags.cf,
          df: res.flags.df,
        };
        cpu.cycles += res.cycles_executed;
        cpu.instructionCount += res.instructions_executed;
        cpu.consoleOutput.push({
          id: Date.now(),
          cycle: cpu.cycles,
          type: 'system',
          text: `[Rust Core Turbo] Executed ${res.instructions_executed.toLocaleString()} native 32-bit ALU instructions in ${(
            res.elapsed_us / 1000
          ).toFixed(2)} ms (${res.effective_mips.toFixed(1)} MIPS)`,
          timestamp: Date.now(),
        });
        setCpuState(cpu.getSnapshot());
      } finally {
        setIsBenchmarking(false);
      }
    },
    [cpu]
  );

  const handleSaveAsmFile = useCallback(async () => {
    try {
      const savedPath = await saveAsmFileNative(selectedPresetId || 'program', code);
      cpu.consoleOutput.push({
        id: Date.now(),
        cycle: cpu.cycles,
        type: 'info',
        text: `[File Saved] Assembly source saved to: ${savedPath}`,
        timestamp: Date.now(),
      });
      setCpuState(cpu.getSnapshot());
    } catch (err) {
      console.error('Failed to save .asm file:', err);
    }
  }, [selectedPresetId, code, cpu]);

  // Resizable & Collapsible Dock State (persisted in localStorage for Desktop)
  const [isLeftOpen, setIsLeftOpen] = useState<boolean>(() => {
    return localStorage.getItem('pulsecisc_left_open') !== 'false';
  });
  const [isRightOpen, setIsRightOpen] = useState<boolean>(() => {
    return localStorage.getItem('pulsecisc_right_open') !== 'false';
  });
  const [isTraceOpen, setIsTraceOpen] = useState<boolean>(() => {
    return localStorage.getItem('pulsecisc_bottom_open') !== 'false';
  });

  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem('pulsecisc_left_width') || '', 10);
    return !isNaN(saved) ? Math.min(650, Math.max(220, saved)) : DEFAULT_LEFT_WIDTH;
  });
  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem('pulsecisc_right_width') || '', 10);
    return !isNaN(saved) ? Math.min(600, Math.max(240, saved)) : DEFAULT_RIGHT_WIDTH;
  });
  const [bottomHeight, setBottomHeight] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem('pulsecisc_bottom_height') || '', 10);
    return !isNaN(saved) ? Math.min(540, Math.max(120, saved)) : DEFAULT_BOTTOM_HEIGHT;
  });

  const [activeResizer, setActiveResizer] = useState<'left' | 'right' | 'bottom' | null>(null);
  const appContainerRef = useRef<HTMLDivElement>(null);

  // Persist open/close dock state
  useEffect(() => {
    localStorage.setItem('pulsecisc_left_open', String(isLeftOpen));
  }, [isLeftOpen]);
  useEffect(() => {
    localStorage.setItem('pulsecisc_right_open', String(isRightOpen));
  }, [isRightOpen]);
  useEffect(() => {
    localStorage.setItem('pulsecisc_bottom_open', String(isTraceOpen));
  }, [isTraceOpen]);

  // Panel Tabs
  const [leftTab, setLeftTab] = useState<'editor' | 'machineCode'>('editor');
  const [rightTab, setRightTab] = useState<'registers' | 'ram'>('registers');

  // Compute active source line from current instruction
  const currentInstAddr =
    cpuState.phase === 'HALTED' && cpuState.cycles === 0
      ? cpuState.eip
      : (cpuState.oldEip ?? cpuState.eip);
  const activeLineIndex = assembled.addressToLine.get(currentInstAddr) ?? null;

  // Assemble and load program into Code Segment & Data Segment
  const handleAssemble = useCallback(() => {
    setIsRunning(false);
    const result = Assembler.assemble(code, {
      codeStart: systemConfig.codeStart,
      codeEnd: Math.max(0, systemConfig.dataStart - 1),
      dataStart: systemConfig.dataStart,
      dataEnd: systemConfig.memorySize - 1,
    });
    setAssembled(result);

    if (result.errors.length === 0) {
      cpu.reset(result.entryPoint);
      cpu.memory.loadCode(result.codeBytes);
      if (result.dataBytes && result.dataBytes.length > 0) {
        cpu.memory.loadData(result.dataBytes);
      }
      setCpuState(cpu.getSnapshot());
      setAssembleToast(true);
      setTimeout(() => setAssembleToast(false), 2200);
    }
  }, [code, cpu, systemConfig]);

  // Load preset program
  const handleSelectPreset = (presetId: string) => {
    setIsRunning(false);
    setSelectedPresetId(presetId);
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setCode(preset.code);
    const result = Assembler.assemble(preset.code, {
      codeStart: systemConfig.codeStart,
      codeEnd: Math.max(0, systemConfig.dataStart - 1),
      dataStart: systemConfig.dataStart,
      dataEnd: systemConfig.memorySize - 1,
    });
    setAssembled(result);

    cpu.reset(result.entryPoint);
    cpu.memory.loadCode(result.codeBytes);
    if (result.dataBytes && result.dataBytes.length > 0) {
      cpu.memory.loadData(result.dataBytes);
    }
    setCpuState(cpu.getSnapshot());
  };

  // Step 1 Micro-Operation (FSM phase)
  const handleStepMicro = useCallback(() => {
    if (cpu.halted) return;
    const nextState = cpu.stepMicro();
    setCpuState(nextState);
  }, [cpu]);

  // Step 1 Full Instruction (All micro-steps)
  const handleStepInstruction = useCallback(() => {
    if (cpu.halted) return;
    const nextState = cpu.stepInstruction();
    setCpuState(nextState);
  }, [cpu]);

  // Reset CPU
  const handleReset = useCallback(() => {
    setIsRunning(false);
    cpu.reset(assembled.entryPoint);
    cpu.memory.loadCode(assembled.codeBytes);
    if (assembled.dataBytes && assembled.dataBytes.length > 0) {
      cpu.memory.loadData(assembled.dataBytes);
    }
    setCpuState(cpu.getSnapshot());
  }, [cpu, assembled]);

  // Toggle Continuous Run
  const handleToggleRun = useCallback(() => {
    if (cpu.halted) {
      handleReset();
    }
    setIsRunning((prev) => !prev);
  }, [cpu.halted, handleReset]);

  // Apply User System Configuration from Settings Modal
  const handleApplyConfig = (newConfig: SystemConfig) => {
    setIsRunning(false);
    setSystemConfig(newConfig);
    saveSystemConfig(newConfig);

    // Resize Memory Buffer & Segment Boundaries
    cpu.memory.resize(newConfig.memorySize, newConfig.dataStart);
    cpu.defaultEsp = newConfig.initialEsp === 'auto' ? null : newConfig.initialEsp;

    // Reassemble code with new boundaries
    const result = Assembler.assemble(code, {
      codeStart: newConfig.codeStart,
      codeEnd: Math.max(0, newConfig.dataStart - 1),
      dataStart: newConfig.dataStart,
      dataEnd: newConfig.memorySize - 1,
    });
    setAssembled(result);

    cpu.reset(result.entryPoint);
    if (result.errors.length === 0) {
      cpu.memory.loadCode(result.codeBytes);
      if (result.dataBytes && result.dataBytes.length > 0) {
        cpu.memory.loadData(result.dataBytes);
      }
    }
    setClockSpeed(newConfig.defaultClockSpeed);
    setCpuState(cpu.getSnapshot());
  };

  // Manual Register Edit
  const handleUpdateRegister = (regId: RegisterId, value: number) => {
    cpu.writeRegister(regId, value, false);
    setCpuState(cpu.getSnapshot());
  };

  // Manual Memory Word Edit
  const handleUpdateWord = (addr: number, value: number) => {
    cpu.memory.writeWord(addr, value);
    setCpuState(cpu.getSnapshot());
  };

  // Clear Trace Log
  const handleClearTrace = () => {
    cpu.traceLog = [];
    setCpuState(cpu.getSnapshot());
  };

  // Clear Console Output
  const handleClearConsole = () => {
    cpu.consoleOutput = [];
    setCpuState(cpu.getSnapshot());
  };

  // Automated Execution Clock Loop
  useEffect(() => {
    if (!isRunning || cpuState.halted) {
      if (cpuState.halted && isRunning) {
        setIsRunning(false);
      }
      return;
    }

    const intervalMs = Math.max(16, 1000 / clockSpeed);
    const timer = setTimeout(() => {
      const nextState = cpu.stepMicro();

      if (
        systemConfig.maxExecutionSteps > 0 &&
        nextState.cycles >= systemConfig.maxExecutionSteps
      ) {
        setIsRunning(false);
        cpu.consoleOutput.push({
          id: Date.now(),
          cycle: nextState.cycles,
          type: 'system',
          text: `[Safety Limit] Execution paused: reached continuous cycle limit (${systemConfig.maxExecutionSteps.toLocaleString()} cycles). You can adjust this in Settings.`,
          timestamp: Date.now(),
        });
        setCpuState(cpu.getSnapshot());
        return;
      }

      setCpuState(nextState);
    }, intervalMs);

    return () => clearTimeout(timer);
  }, [
    isRunning,
    clockSpeed,
    cpuState.halted,
    cpuState.cycles,
    cpu,
    systemConfig.maxExecutionSteps,
  ]);

  // Keyboard Shortcuts (Space, F10, F11, Esc, Ctrl+B, Ctrl+J)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsLeftOpen((prev) => !prev);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsTraceOpen((prev) => !prev);
        return;
      }

      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'textarea' || targetTag === 'input') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleRun();
      } else if (e.code === 'F10') {
        e.preventDefault();
        handleStepInstruction();
      } else if (e.code === 'F11') {
        e.preventDefault();
        handleStepMicro();
      } else if (e.key === 'Escape') {
        setIsRunning(false);
        setIsCheatsheetOpen(false);
        setIsSettingsOpen(false);
        setIsPsiInspectorOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleRun, handleStepInstruction, handleStepMicro]);

  // Dock Resize Pointer Handlers
  const startResize = (
    which: 'left' | 'right' | 'bottom',
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveResizer(which);
  };

  const moveResize = (
    which: 'left' | 'right' | 'bottom',
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (activeResizer !== which || !appContainerRef.current) return;
    const rect = appContainerRef.current.getBoundingClientRect();

    if (which === 'left') {
      const rawW = e.clientX - rect.left;
      if (rawW < 110) {
        setIsLeftOpen(false);
      } else {
        if (!isLeftOpen) setIsLeftOpen(true);
        const clamped = Math.min(Math.max(220, rawW), Math.min(650, rect.width - 420));
        setLeftWidth(clamped);
      }
    } else if (which === 'right') {
      const rawW = rect.right - e.clientX;
      if (rawW < 110) {
        setIsRightOpen(false);
      } else {
        if (!isRightOpen) setIsRightOpen(true);
        const clamped = Math.min(Math.max(240, rawW), Math.min(600, rect.width - 420));
        setRightWidth(clamped);
      }
    } else if (which === 'bottom') {
      const rawH = rect.bottom - e.clientY - 34;
      if (rawH < 70) {
        setIsTraceOpen(false);
      } else {
        if (!isTraceOpen) setIsTraceOpen(true);
        const clamped = Math.min(Math.max(120, rawH), Math.min(540, rect.height - 240));
        setBottomHeight(clamped);
      }
    }
  };

  const endResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeResizer) return;
    localStorage.setItem('pulsecisc_left_width', String(Math.round(leftWidth)));
    localStorage.setItem('pulsecisc_right_width', String(Math.round(rightWidth)));
    localStorage.setItem('pulsecisc_bottom_height', String(Math.round(bottomHeight)));
    setActiveResizer(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  return (
    <ScreenSizeGuard>
      <div
        ref={appContainerRef}
        className={`flex flex-col h-full w-full overflow-hidden bg-[#070a10] text-slate-100 ${
          activeResizer === 'left' || activeResizer === 'right'
            ? 'cursor-col-resize select-none'
            : activeResizer === 'bottom'
            ? 'cursor-row-resize select-none'
            : ''
        }`}
      >
        {/* Top Navigation Bar */}
        <Navbar
          isRunning={isRunning}
          onToggleRun={handleToggleRun}
          onStepMicro={handleStepMicro}
          onStepInstruction={handleStepInstruction}
          onReset={handleReset}
          clockSpeed={clockSpeed}
          onClockSpeedChange={setClockSpeed}
          selectedPresetId={selectedPresetId}
          onSelectPreset={handleSelectPreset}
          memorySizeLabel={`${getMemoryCapacityLabel(systemConfig.memorySize)} RAM`}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenCheatsheet={() => setIsCheatsheetOpen(true)}
          onOpenPsiInspector={() => setIsPsiInspectorOpen(true)}
          onSaveAsmFile={handleSaveAsmFile}
          psiParseTimeUs={psiReport?.parse_time_us}
          psiWarningCount={psiReport?.diagnostics.length ?? 0}
          isNativeTauri={engineInfo?.isNativeTauri}
          isLeftOpen={isLeftOpen}
          onToggleLeft={() => setIsLeftOpen((prev) => !prev)}
          isBottomOpen={isTraceOpen}
          onToggleBottom={() => setIsTraceOpen((prev) => !prev)}
          isRightOpen={isRightOpen}
          onToggleRight={() => setIsRightOpen((prev) => !prev)}
          themePref={themePref}
          resolvedTheme={resolvedTheme}
          onCycleTheme={handleCycleTheme}
        />

        {/* =====================================================================
            MOBILE & TABLET WORKSPACE (< 1024px)
            Full-height active panel + Native-style Bottom Tab Navigation Bar
        ===================================================================== */}
        <div className="flex lg:hidden flex-1 flex-col overflow-hidden min-h-0 relative">
          {/* Assembled Confirmation Toast on Mobile */}
          {assembleToast && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-950/95 border border-emerald-500/60 text-emerald-200 text-xs font-mono shadow-xl backdrop-blur-md">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Assembled &amp; Loaded into CPU!</span>
              {mobileTab !== 'datapath' && (
                <button
                  type="button"
                  onClick={() => {
                    setAssembleToast(false);
                    setMobileTab('datapath');
                  }}
                  className="ml-1 px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/50 text-emerald-100 font-semibold"
                >
                  View Datapath
                </button>
              )}
            </div>
          )}

          {/* TAB 1: DATAPATH VISUALIZER */}
          {mobileTab === 'datapath' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#0a0d14]">
              <CanvasView
                cpuState={cpuState}
                speedScale={Math.max(0.6, Math.min(3.0, clockSpeed / 2))}
                enableParticles={systemConfig.enableParticleAnimations}
                particleSpeed={systemConfig.particleSpeed}
              />
            </div>
          )}

          {/* TAB 2: x86 ASSEMBLY EDITOR & DISASSEMBLY */}
          {mobileTab === 'code' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#090d16]">
              <div className="flex items-center bg-slate-950 border-b border-slate-800 text-xs select-none shrink-0">
                <button
                  onClick={() => setLeftTab('editor')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-medium transition-colors ${
                    leftTab === 'editor'
                      ? 'bg-slate-900 text-sky-400 border-b-2 border-sky-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>x86 Assembly Source</span>
                </button>
                <button
                  onClick={() => setLeftTab('machineCode')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 font-medium transition-colors ${
                    leftTab === 'machineCode'
                      ? 'bg-slate-900 text-sky-400 border-b-2 border-sky-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Binary className="w-3.5 h-3.5" />
                  <span>Machine Code ({assembled.codeBytes.length}B)</span>
                </button>
              </div>
              <div className="flex-1 overflow-hidden min-h-0">
                {leftTab === 'editor' ? (
                  <CodeEditor
                    code={code}
                    onChange={setCode}
                    onAssemble={handleAssemble}
                    activeLineIndex={activeLineIndex}
                    errors={assembled.errors}
                    onShowCheatsheet={() => setIsCheatsheetOpen(true)}
                  />
                ) : (
                  <MachineCodeView
                    codeBytes={assembled.codeBytes}
                    currentEIP={currentInstAddr}
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB 3: REGISTERS, EFLAGS & LATCHES */}
          {mobileTab === 'registers' && (
            <div className="flex-1 flex flex-col overflow-y-auto min-h-0 bg-[#0b0f19]">
              <div className="flex-1 min-h-[280px]">
                <RegisterFileView
                  registers={cpuState.registers}
                  lastModifiedReg={cpuState.lastModifiedReg}
                  onUpdateRegister={handleUpdateRegister}
                  isPaused={!isRunning}
                />
              </div>
              <SpecialRegistersView
                eip={cpuState.eip}
                ir={cpuState.ir}
                irBytes={cpuState.irBytes}
                mar={cpuState.mar}
                mdr={cpuState.mdr}
                aluOut={cpuState.aluOut}
                flags={cpuState.flags}
                segments={cpuState.segments}
                decodedString={cpuState.decoded?.assemblyString}
                latchA={cpuState.latchA}
                latchB={cpuState.latchB}
                latchASource={cpuState.latchASource}
                latchBSource={cpuState.latchBSource}
                latchBIsImmediate={cpuState.latchBIsImmediate}
              />
            </div>
          )}

          {/* TAB 4: DATA RAM INSPECTOR */}
          {mobileTab === 'ram' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#0b0f19]">
              <MemoryGridView
                memory={cpu.memory}
                activeMar={cpuState.mar}
                lastModifiedAddr={cpuState.lastModifiedMem}
                onUpdateWord={handleUpdateWord}
                isPaused={!isRunning}
                pageSize={systemConfig.memoryPageSize}
              />
            </div>
          )}

          {/* TAB 5: RTL EXECUTION TRACE & SYSTEM CONSOLE */}
          {mobileTab === 'trace' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-[#070a12]">
              <TraceLogView
                logs={cpu.traceLog}
                onClearLogs={handleClearTrace}
                consoleOutput={cpuState.consoleOutput}
                onClearConsole={handleClearConsole}
                isOpen={true}
                onToggleOpen={() => {}}
                fullHeight={true}
              />
            </div>
          )}

          {/* Mobile Bottom Navigation Bar */}
          <nav
            aria-label="Mobile Workspace Navigation"
            className="flex items-center justify-around bg-[#0b101b] border-t border-slate-800 px-1 py-1 pb-safe select-none shrink-0 z-30"
          >
            <button
              type="button"
              onClick={() => setMobileTab('datapath')}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors relative ${
                mobileTab === 'datapath'
                  ? 'text-sky-400 bg-sky-500/10 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] tracking-tight">Datapath</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('code')}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors relative ${
                mobileTab === 'code'
                  ? 'text-sky-400 bg-sky-500/10 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Code2 className="w-4 h-4 mb-0.5" />
                {assembled.errors.length > 0 && (
                  <span className="absolute -top-1 -right-2.5 px-1 min-w-[14px] h-[14px] rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {assembled.errors.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">Code</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('registers')}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors relative ${
                mobileTab === 'registers'
                  ? 'text-sky-400 bg-sky-500/10 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <CpuIcon className="w-4 h-4 mb-0.5" />
                {cpuState.lastModifiedReg !== null && mobileTab !== 'registers' && (
                  <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>
              <span className="text-[10px] tracking-tight">Registers</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('ram')}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors relative ${
                mobileTab === 'ram'
                  ? 'text-sky-400 bg-sky-500/10 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Database className="w-4 h-4 mb-0.5" />
                {cpuState.lastModifiedMem !== null && mobileTab !== 'ram' && (
                  <span className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                )}
              </div>
              <span className="text-[10px] tracking-tight">RAM</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab('trace')}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors relative ${
                mobileTab === 'trace'
                  ? 'text-sky-400 bg-sky-500/10 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Terminal className="w-4 h-4 mb-0.5" />
                {cpuState.consoleOutput.length > 0 && (
                  <span className="absolute -top-1 -right-3 px-1 min-w-[14px] h-[14px] rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">
                    {cpuState.consoleOutput.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">Trace / IO</span>
            </button>
          </nav>
        </div>

        {/* =====================================================================
            DESKTOP 3-COLUMN STUDIO WORKSPACE (>= 1024px)
        ===================================================================== */}
        <div className="hidden lg:flex flex-1 overflow-hidden min-h-0">
          {/* LEFT DOCK */}
          {isLeftOpen ? (
            <div
              style={{ width: `${leftWidth}px` }}
              className="flex-shrink-0 flex flex-col bg-[#090d16] overflow-hidden"
            >
              <div className="flex items-center bg-slate-950 border-b border-slate-800 text-xs select-none">
                <button
                  onClick={() => setLeftTab('editor')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-colors ${
                    leftTab === 'editor'
                      ? 'bg-slate-900 text-sky-400 border-b-2 border-sky-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span className="truncate">x86 Assembly</span>
                </button>
                <button
                  onClick={() => setLeftTab('machineCode')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-colors ${
                    leftTab === 'machineCode'
                      ? 'bg-slate-900 text-sky-400 border-b-2 border-sky-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Binary className="w-3.5 h-3.5" />
                  <span className="truncate">Machine Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLeftOpen(false)}
                  title="Collapse Left Dock (Ctrl+B)"
                  className="px-2 py-2 text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition-colors border-l border-slate-800/80"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden">
                {leftTab === 'editor' ? (
                  <CodeEditor
                    code={code}
                    onChange={setCode}
                    onAssemble={handleAssemble}
                    activeLineIndex={activeLineIndex}
                    errors={assembled.errors}
                    onShowCheatsheet={() => setIsCheatsheetOpen(true)}
                  />
                ) : (
                  <MachineCodeView
                    codeBytes={assembled.codeBytes}
                    currentEIP={currentInstAddr}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="w-7 flex-shrink-0 flex flex-col items-center py-2 gap-3 bg-[#090d16] border-r border-slate-800/80 select-none">
              <button
                type="button"
                onClick={() => setIsLeftOpen(true)}
                title="Expand Left Dock (Ctrl+B)"
                className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
              >
                <PanelLeftOpen className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeftTab('editor');
                  setIsLeftOpen(true);
                }}
                title="Open x86 Assembly Editor"
                className="p-1 rounded text-slate-500 hover:text-sky-400 hover:bg-slate-800 transition-colors"
              >
                <Code2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeftTab('machineCode');
                  setIsLeftOpen(true);
                }}
                title="Open Machine Code Disassembly"
                className="p-1 rounded text-slate-500 hover:text-sky-400 hover:bg-slate-800 transition-colors"
              >
                <Binary className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* LEFT RESIZE SASH */}
          <div
            onPointerDown={(e) => startResize('left', e)}
            onPointerMove={(e) => moveResize('left', e)}
            onPointerUp={endResize}
            onDoubleClick={() => {
              setIsLeftOpen(true);
              setLeftWidth(DEFAULT_LEFT_WIDTH);
              localStorage.setItem('pulsecisc_left_width', String(DEFAULT_LEFT_WIDTH));
            }}
            title="Drag to resize Left Dock • Double-click to reset width"
            className={`w-1.5 flex-shrink-0 flex items-center justify-center cursor-col-resize select-none transition-colors group z-10 ${
              activeResizer === 'left'
                ? 'bg-sky-500'
                : 'bg-slate-800/80 hover:bg-sky-500/80'
            }`}
          >
            <div className="w-0.5 h-8 rounded-full bg-slate-600 group-hover:bg-white transition-colors" />
          </div>

          {/* CENTER DOCK */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0d14] min-w-[260px]">
            <CanvasView
              cpuState={cpuState}
              speedScale={Math.max(0.6, Math.min(3.0, clockSpeed / 2))}
              enableParticles={systemConfig.enableParticleAnimations}
              particleSpeed={systemConfig.particleSpeed}
            />
          </div>

          {/* RIGHT RESIZE SASH */}
          <div
            onPointerDown={(e) => startResize('right', e)}
            onPointerMove={(e) => moveResize('right', e)}
            onPointerUp={endResize}
            onDoubleClick={() => {
              setIsRightOpen(true);
              setRightWidth(DEFAULT_RIGHT_WIDTH);
              localStorage.setItem('pulsecisc_right_width', String(DEFAULT_RIGHT_WIDTH));
            }}
            title="Drag to resize Right Dock • Double-click to reset width"
            className={`w-1.5 flex-shrink-0 flex items-center justify-center cursor-col-resize select-none transition-colors group z-10 ${
              activeResizer === 'right'
                ? 'bg-sky-500'
                : 'bg-slate-800/80 hover:bg-sky-500/80'
            }`}
          >
            <div className="w-0.5 h-8 rounded-full bg-slate-600 group-hover:bg-white transition-colors" />
          </div>

          {/* RIGHT DOCK */}
          {isRightOpen ? (
            <div
              style={{ width: `${rightWidth}px` }}
              className="flex-shrink-0 flex flex-col bg-[#090d16] overflow-hidden"
            >
              <div className="flex items-center bg-slate-950 border-b border-slate-800 text-xs select-none">
                <button
                  type="button"
                  onClick={() => setIsRightOpen(false)}
                  title="Collapse Right Dock"
                  className="px-2 py-2 text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition-colors border-r border-slate-800/80"
                >
                  <PanelRightClose className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setRightTab('registers')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-colors ${
                    rightTab === 'registers'
                      ? 'bg-slate-900 text-sky-400 border-b-2 border-sky-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CpuIcon className="w-3.5 h-3.5" />
                  <span className="truncate">Registers &amp; Flags</span>
                </button>
                <button
                  onClick={() => setRightTab('ram')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-colors ${
                    rightTab === 'ram'
                      ? 'bg-slate-900 text-sky-400 border-b-2 border-sky-500'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span className="truncate">Data RAM</span>
                </button>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                {rightTab === 'registers' ? (
                  <>
                    <div className="flex-1 overflow-y-auto">
                      <RegisterFileView
                        registers={cpuState.registers}
                        lastModifiedReg={cpuState.lastModifiedReg}
                        onUpdateRegister={handleUpdateRegister}
                        isPaused={!isRunning}
                      />
                    </div>
                    <SpecialRegistersView
                      eip={cpuState.eip}
                      ir={cpuState.ir}
                      irBytes={cpuState.irBytes}
                      mar={cpuState.mar}
                      mdr={cpuState.mdr}
                      aluOut={cpuState.aluOut}
                      flags={cpuState.flags}
                      segments={cpuState.segments}
                      decodedString={cpuState.decoded?.assemblyString}
                      latchA={cpuState.latchA}
                      latchB={cpuState.latchB}
                      latchASource={cpuState.latchASource}
                      latchBSource={cpuState.latchBSource}
                      latchBIsImmediate={cpuState.latchBIsImmediate}
                    />
                  </>
                ) : (
                  <MemoryGridView
                    memory={cpu.memory}
                    activeMar={cpuState.mar}
                    lastModifiedAddr={cpuState.lastModifiedMem}
                    onUpdateWord={handleUpdateWord}
                    isPaused={!isRunning}
                    pageSize={systemConfig.memoryPageSize}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="w-7 flex-shrink-0 flex flex-col items-center py-2 gap-3 bg-[#090d16] border-l border-slate-800/80 select-none">
              <button
                type="button"
                onClick={() => setIsRightOpen(true)}
                title="Expand Right Dock"
                className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors"
              >
                <PanelRightOpen className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRightTab('registers');
                  setIsRightOpen(true);
                }}
                title="Open Registers & Flags"
                className="p-1 rounded text-slate-500 hover:text-sky-400 hover:bg-slate-800 transition-colors"
              >
                <CpuIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRightTab('ram');
                  setIsRightOpen(true);
                }}
                title="Open Data RAM Inspector"
                className="p-1 rounded text-slate-500 hover:text-sky-400 hover:bg-slate-800 transition-colors"
              >
                <Database className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* DESKTOP BOTTOM RESIZE SASH */}
        <div
          onPointerDown={(e) => startResize('bottom', e)}
          onPointerMove={(e) => moveResize('bottom', e)}
          onPointerUp={endResize}
          onDoubleClick={() => {
            setIsTraceOpen(true);
            setBottomHeight(DEFAULT_BOTTOM_HEIGHT);
            localStorage.setItem('pulsecisc_bottom_height', String(DEFAULT_BOTTOM_HEIGHT));
          }}
          title="Drag up/down to resize Bottom Drawer • Double-click to reset height"
          className={`hidden lg:flex h-1.5 flex-shrink-0 items-center justify-center cursor-row-resize select-none transition-colors group z-10 ${
            activeResizer === 'bottom'
              ? 'bg-sky-500'
              : 'bg-slate-800/80 hover:bg-sky-500/80'
          }`}
        >
          <div className="w-8 h-0.5 rounded-full bg-slate-600 group-hover:bg-white transition-colors" />
        </div>

        {/* Desktop Bottom Collapsible & Resizable Micro-Operation RTL Trace & System Console Drawer */}
        <div className="hidden lg:block flex-shrink-0">
          <TraceLogView
            logs={cpu.traceLog}
            onClearLogs={handleClearTrace}
            consoleOutput={cpuState.consoleOutput}
            onClearConsole={handleClearConsole}
            isOpen={isTraceOpen}
            onToggleOpen={() => setIsTraceOpen((prev) => !prev)}
            height={bottomHeight}
          />
        </div>

        {/* Cheatsheet Reference Modal */}
        <CheatsheetModal
          isOpen={isCheatsheetOpen}
          onClose={() => setIsCheatsheetOpen(false)}
        />

        {/* System Architecture Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          config={systemConfig}
          onSaveConfig={handleApplyConfig}
        />

        {/* Rust Core & IntelliJ-Style PSI Inspector Modal */}
        <PsiInspectorModal
          isOpen={isPsiInspectorOpen}
          onClose={() => setIsPsiInspectorOpen(false)}
          engineInfo={engineInfo}
          psiReport={psiReport}
          onRunBenchmark={handleRunNativeBenchmark}
          lastBenchmark={lastBenchmark}
          isBenchmarking={isBenchmarking}
        />
      </div>
    </ScreenSizeGuard>
  );
}

export default App;
