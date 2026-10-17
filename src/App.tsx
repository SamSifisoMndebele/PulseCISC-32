// PulseCISC-32 Main Application
import { useState, useRef, useEffect, useCallback } from 'react';
import { CPU } from './core/cpu';
import { Memory } from './core/memory';
import { Assembler } from './core/assembler';
import type { CPUMicroState, RegisterId, AssembledProgram } from './core/types';
import { PRESETS } from './samples/presets';
import { Navbar } from './components/Navbar';
import { CodeEditor } from './components/CodeEditor';
import { MachineCodeView } from './components/MachineCodeView';
import { CanvasView } from './components/CanvasView';
import { RegisterFileView } from './components/RegisterFileView';
import { SpecialRegistersView } from './components/SpecialRegistersView';
import { MemoryGridView } from './components/MemoryGridView';
import { TraceLogView } from './components/TraceLogView';
import { CheatsheetModal } from './components/CheatsheetModal';
import { SettingsModal } from './components/SettingsModal';
import {
  type SystemConfig,
  loadSystemConfig,
  saveSystemConfig,
  getMemoryCapacityLabel,
} from './core/config';
import { Code2, Binary, Database, Cpu as CpuIcon } from 'lucide-react';

export function App() {
  // System Configuration (defaults to 64KB, persisted in localStorage)
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(() => loadSystemConfig());

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

  // Execution Controls
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [clockSpeed, setClockSpeed] = useState<number>(systemConfig.defaultClockSpeed);
  const [isTraceOpen, setIsTraceOpen] = useState<boolean>(true);
  const [isCheatsheetOpen, setIsCheatsheetOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Panel Tabs
  const [leftTab, setLeftTab] = useState<'editor' | 'machineCode'>('editor');
  const [rightTab, setRightTab] = useState<'registers' | 'ram'>('registers');

  // Compute active source line from current instruction
  const currentInstAddr =
    cpuState.phase === 'HALTED' && cpuState.cycles === 0
      ? cpuState.eip
      : (cpuState.oldEip ?? cpuState.eip);
  const activeLineIndex = assembled.addressToLine.get(currentInstAddr & ~0x3) ?? null;

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
      cpu.reset();
      cpu.memory.loadCode(result.codeBytes);
      if (result.dataBytes && result.dataBytes.length > 0) {
        cpu.memory.loadData(result.dataBytes);
      }
      setCpuState(cpu.getSnapshot());
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

    cpu.reset();
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
    cpu.reset();
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

    cpu.reset();
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
      // Step micro-step for smooth visual flow
      const nextState = cpu.stepMicro();

      // Check safety cycle limit
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

  // Keyboard Shortcuts (Space, F10, F11, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in textarea or input
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleRun, handleStepInstruction, handleStepMicro]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#070a10] text-slate-100 select-none">
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
      />

      {/* Main 3-Column Studio Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Code Editor & Machine Code Disassembly */}
        <div className="w-[340px] flex-shrink-0 flex flex-col border-r border-slate-800 bg-[#090d16]">
          {/* Tabs */}
          <div className="flex items-center bg-slate-950 border-b border-slate-800 text-xs">
            <button
              onClick={() => setLeftTab('editor')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-colors ${
                leftTab === 'editor'
                  ? 'bg-slate-900 text-sky-400 border-b-2 border-sky-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>x86 Assembly</span>
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
              <span>Machine Code</span>
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

        {/* Center Column: Animated HTML5 Canvas Datapath */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0d14]">
          <CanvasView
            cpuState={cpuState}
            speedScale={Math.max(0.6, Math.min(3.0, clockSpeed / 2))}
            enableParticles={systemConfig.enableParticleAnimations}
            particleSpeed={systemConfig.particleSpeed}
          />
        </div>

        {/* Right Column: Registers, EFLAGS, and Data RAM */}
        <div className="w-[320px] flex-shrink-0 flex flex-col border-l border-slate-800 bg-[#090d16]">
          {/* Tabs */}
          <div className="flex items-center bg-slate-950 border-b border-slate-800 text-xs">
            <button
              onClick={() => setRightTab('registers')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-colors ${
                rightTab === 'registers'
                  ? 'bg-slate-900 text-sky-400 border-b-2 border-sky-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CpuIcon className="w-3.5 h-3.5" />
              <span>Registers & Flags</span>
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
              <span>Data RAM</span>
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
                  mar={cpuState.mar}
                  mdr={cpuState.mdr}
                  aluOut={cpuState.aluOut}
                  flags={cpuState.flags}
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
      </div>

      {/* Bottom Collapsible Micro-Operation RTL Trace & System Console Drawer */}
      <TraceLogView
        logs={cpu.traceLog}
        onClearLogs={handleClearTrace}
        consoleOutput={cpuState.consoleOutput}
        onClearConsole={handleClearConsole}
        isOpen={isTraceOpen}
        onToggleOpen={() => setIsTraceOpen((prev) => !prev)}
      />

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
    </div>
  );
}

export default App;
