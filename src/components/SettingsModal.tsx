// PulseCISC-32 System Configuration & Preferences Modal
import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Database,
  Cpu,
  Eye,
  RotateCcw,
  Check,
  AlertCircle,
  Zap,
} from 'lucide-react';
import type { SystemConfig } from '../core/config';
import { DEFAULT_SYSTEM_CONFIG } from '../core/config';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SystemConfig;
  onSaveConfig: (newConfig: SystemConfig) => void;
}

const MEMORY_PRESETS = [
  { size: 65536, label: '64 KB', subtitle: 'Standard (Recommended)', isDefault: true },
  { size: 32768, label: '32 KB', subtitle: 'Medium Space' },
  { size: 16384, label: '16 KB', subtitle: 'Compact' },
  { size: 8192, label: '8 KB', subtitle: 'Minimal' },
  { size: 4096, label: '4 KB', subtitle: 'Legacy Retro' },
];

const DATA_START_PRESETS = [
  { addr: 0x2000, label: '0x2000 (8 KB Code)', desc: '8 KB Code (up to 2,048 insts), rest Data RAM (Default)', isDefault: true },
  { addr: 0x1000, label: '0x1000 (4 KB Code)', desc: '4 KB Code (up to 1,024 insts), rest Data RAM' },
  { addr: 0x0800, label: '0x0800 (2 KB Code)', desc: '2 KB Code (up to 512 insts), rest Data RAM (Legacy)' },
  { addr: 0x4000, label: '0x4000 (16 KB Code)', desc: '16 KB Code, rest Data RAM' },
  { addr: 0x8000, label: '0x8000 (32 KB Split)', desc: '32 KB Code, 32 KB Data RAM (for 64 KB)' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'memory' | 'simulation' | 'visualizer'>('memory');
  const [draft, setDraft] = useState<SystemConfig>({ ...config });
  const [customDataStart, setCustomDataStart] = useState<string>(
    `0x${config.dataStart.toString(16).toUpperCase()}`
  );
  const [customEsp, setCustomEsp] = useState<string>(
    config.initialEsp === 'auto' ? 'auto' : `0x${config.initialEsp.toString(16).toUpperCase()}`
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraft({ ...config });
      setCustomDataStart(`0x${config.dataStart.toString(16).toUpperCase()}`);
      setCustomEsp(
        config.initialEsp === 'auto' ? 'auto' : `0x${config.initialEsp.toString(16).toUpperCase()}`
      );
      setStatusMessage(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleSelectMemSize = (size: number) => {
    let nextDataStart = draft.dataStart;
    if (nextDataStart >= size) {
      nextDataStart = 0x0800 < size ? 0x0800 : 0x0400;
      setCustomDataStart(`0x${nextDataStart.toString(16).toUpperCase()}`);
    }
    setDraft((prev) => ({
      ...prev,
      memorySize: size,
      dataStart: nextDataStart,
    }));
  };

  const handleSelectDataStart = (addr: number) => {
    if (addr >= draft.memorySize) {
      setStatusMessage(`Data start (0x${addr.toString(16).toUpperCase()}) must be less than memory size (${draft.memorySize / 1024} KB).`);
      return;
    }
    setDraft((prev) => ({ ...prev, dataStart: addr }));
    setCustomDataStart(`0x${addr.toString(16).toUpperCase()}`);
    setStatusMessage(null);
  };

  const handleResetDefaults = () => {
    setDraft({ ...DEFAULT_SYSTEM_CONFIG });
    setCustomDataStart(`0x${DEFAULT_SYSTEM_CONFIG.dataStart.toString(16).toUpperCase()}`);
    setCustomEsp('auto');
    setStatusMessage('Configuration restored to defaults (64 KB). Click Save to apply.');
  };

  const handleSave = () => {
    // Validate custom data start
    let parsedDataStart = draft.dataStart;
    const cleanDS = customDataStart.trim();
    if (cleanDS.startsWith('0x') || cleanDS.startsWith('0X')) {
      parsedDataStart = parseInt(cleanDS, 16);
    } else {
      parsedDataStart = parseInt(cleanDS, 10);
    }

    if (isNaN(parsedDataStart) || parsedDataStart < 0 || parsedDataStart >= draft.memorySize - 4) {
      setStatusMessage(`Invalid Data Start address: must be between 0x0000 and 0x${(draft.memorySize - 8).toString(16).toUpperCase()}`);
      return;
    }

    // Validate custom ESP
    let parsedEsp: number | 'auto' = 'auto';
    const cleanEsp = customEsp.trim().toLowerCase();
    if (cleanEsp !== 'auto') {
      let num = 0;
      if (cleanEsp.startsWith('0x')) {
        num = parseInt(cleanEsp, 16);
      } else {
        num = parseInt(cleanEsp, 10);
      }
      if (isNaN(num) || num < 0 || num >= draft.memorySize) {
        setStatusMessage(`Invalid initial ESP: must be 'auto' or valid address within 0x0000 - 0x${(draft.memorySize - 1).toString(16).toUpperCase()}`);
        return;
      }
      parsedEsp = num & ~0x3;
    }

    const finalConfig: SystemConfig = {
      ...draft,
      dataStart: parsedDataStart & ~0x3,
      initialEsp: parsedEsp,
    };

    onSaveConfig(finalConfig);
    onClose();
  };

  const codeEndAddr = Math.max(0, draft.dataStart - 1);
  const dataEndAddr = draft.memorySize - 1;
  const autoStackTop = dataEndAddr & ~0x3;
  const codePercent = Math.max(5, Math.min(95, (draft.dataStart / draft.memorySize) * 100));
  const dataPercent = 100 - codePercent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] bg-[#0c101d] border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-mono tracking-tight text-white">
                System & Architecture Settings
              </h2>
              <p className="text-[11px] text-slate-400">
                Configure RAM capacity, memory segmentation, execution engine & visualizer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/70 px-4 text-xs font-mono">
          <button
            onClick={() => setActiveTab('memory')}
            className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'memory'
                ? 'border-sky-500 text-sky-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Memory Architecture</span>
          </button>
          <button
            onClick={() => setActiveTab('simulation')}
            className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'simulation'
                ? 'border-sky-500 text-sky-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Execution & Engine</span>
          </button>
          <button
            onClick={() => setActiveTab('visualizer')}
            className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium transition-colors ${
              activeTab === 'visualizer'
                ? 'border-sky-500 text-sky-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Visualizer & UI</span>
          </button>
        </div>

        {/* Status / Alert Banner */}
        {statusMessage && (
          <div className="flex items-center gap-2 px-5 py-2 bg-amber-950/50 border-b border-amber-800/60 text-amber-300 text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs font-mono">
          {/* TAB 1: MEMORY ARCHITECTURE */}
          {activeTab === 'memory' && (
            <div className="space-y-5">
              {/* Memory Size Selection */}
              <div>
                <label className="text-xs font-bold text-sky-400 uppercase tracking-wider block mb-2">
                  Total Memory Capacity
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MEMORY_PRESETS.map((p) => {
                    const isSelected = draft.memorySize === p.size;
                    return (
                      <button
                        key={p.size}
                        type="button"
                        onClick={() => handleSelectMemSize(p.size)}
                        className={`flex flex-col text-left p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-sky-950/60 border-sky-500 shadow-md shadow-sky-500/20 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-sky-300">{p.label}</span>
                          {p.isDefault && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-900/80 text-sky-300 border border-sky-700/60">
                              Default
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1">{p.subtitle}</span>
                        <span className="text-[9px] text-slate-500">
                          0x0000 - 0x{(p.size - 1).toString(16).toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Memory Map Visualizer Bar */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-300">Segment Layout Visualization</span>
                  <span className="text-slate-400">Total: {draft.memorySize / 1024} KB</span>
                </div>

                <div className="w-full h-7 rounded-lg overflow-hidden flex border border-slate-700/80 text-[10px] font-bold">
                  <div
                    style={{ width: `${codePercent}%` }}
                    className="bg-indigo-900/80 border-r border-indigo-500 flex items-center justify-center text-indigo-200 truncate px-1"
                    title={`Code Segment: 0x0000 - 0x${codeEndAddr.toString(16).toUpperCase()} (${(draft.dataStart / 1024).toFixed(1)} KB)`}
                  >
                    Code ({(draft.dataStart / 1024).toFixed(1)} KB)
                  </div>
                  <div
                    style={{ width: `${dataPercent}%` }}
                    className="bg-purple-900/80 flex items-center justify-center text-purple-200 truncate px-1"
                    title={`Data RAM Segment: 0x${draft.dataStart.toString(16).toUpperCase()} - 0x${dataEndAddr.toString(16).toUpperCase()} (${((draft.memorySize - draft.dataStart) / 1024).toFixed(1)} KB)`}
                  >
                    Data RAM ({((draft.memorySize - draft.dataStart) / 1024).toFixed(1)} KB)
                  </div>
                </div>

                <div className="grid grid-cols-2 text-[10px] gap-2 pt-1 text-slate-400">
                  <div>
                    <span className="text-indigo-400 font-semibold">• Code Segment:</span> 0x0000 - 0x
                    {codeEndAddr.toString(16).toUpperCase().padStart(4, '0')} (up to{' '}
                    {Math.floor(draft.dataStart / 4)} instructions)
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold">• Data Segment:</span> 0x
                    {draft.dataStart.toString(16).toUpperCase().padStart(4, '0')} - 0x
                    {dataEndAddr.toString(16).toUpperCase().padStart(4, '0')}
                  </div>
                </div>
              </div>

              {/* Data RAM Start Address Partition */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-purple-400 uppercase tracking-wider block">
                  Data RAM Start Offset (Segmentation Boundary)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DATA_START_PRESETS.map((ds) => {
                    const isSelected = draft.dataStart === ds.addr;
                    const isDisabled = ds.addr >= draft.memorySize;
                    return (
                      <button
                        key={ds.addr}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelectDataStart(ds.addr)}
                        className={`text-left p-2 rounded-lg border text-[11px] transition-all ${
                          isSelected
                            ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-sm shadow-purple-500/20'
                            : isDisabled
                            ? 'opacity-40 bg-slate-950 border-slate-900 cursor-not-allowed text-slate-600'
                            : 'bg-slate-900/40 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-bold text-slate-200">{ds.label}</div>
                        <div className="text-[10px] text-slate-400">{ds.desc}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-slate-400 text-[11px]">Custom Hex Offset:</span>
                  <input
                    type="text"
                    value={customDataStart}
                    onChange={(e) => setCustomDataStart(e.target.value)}
                    className="w-28 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-sky-500"
                    placeholder="0x0800"
                  />
                  <button
                    onClick={() => {
                      let num = 0;
                      const c = customDataStart.trim();
                      if (c.startsWith('0x') || c.startsWith('0X')) num = parseInt(c, 16);
                      else num = parseInt(c, 10);
                      if (!isNaN(num)) handleSelectDataStart(num);
                    }}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Initial Stack Pointer */}
              <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  Initial Stack Pointer (ESP)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="espMode"
                      checked={customEsp === 'auto'}
                      onChange={() => setCustomEsp('auto')}
                      className="accent-sky-500"
                    />
                    <span className="text-slate-300 text-[11px]">
                      Auto (Top of RAM: 0x{autoStackTop.toString(16).toUpperCase()})
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="espMode"
                      checked={customEsp !== 'auto'}
                      onChange={() => setCustomEsp(`0x${autoStackTop.toString(16).toUpperCase()}`)}
                      className="accent-sky-500"
                    />
                    <span className="text-slate-300 text-[11px]">Custom Value</span>
                  </label>
                  {customEsp !== 'auto' && (
                    <input
                      type="text"
                      value={customEsp}
                      onChange={(e) => setCustomEsp(e.target.value)}
                      className="w-24 px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs font-mono"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXECUTION & ENGINE */}
          {activeTab === 'simulation' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                  Default Clock Speed: {draft.defaultClockSpeed.toFixed(1)} Hz
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.1"
                    max="30"
                    step="0.1"
                    value={draft.defaultClockSpeed}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        defaultClockSpeed: parseFloat(e.target.value),
                      }))
                    }
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <div className="flex gap-1">
                    {[0.5, 1.0, 2.0, 5.0, 10.0].map((hz) => (
                      <button
                        key={hz}
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, defaultClockSpeed: hz }))}
                        className={`px-1.5 py-0.5 rounded text-[10px] border ${
                          draft.defaultClockSpeed === hz
                            ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {hz} Hz
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-sky-400 uppercase tracking-wider block mb-1">
                  Continuous Run Step Safety Limit
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Stops continuous execution if cycle limit is exceeded to prevent accidental infinite loops.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[1000, 2000, 5000, 10000].map((steps) => (
                    <button
                      key={steps}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, maxExecutionSteps: steps }))}
                      className={`p-2 rounded-lg border text-center text-xs ${
                        draft.maxExecutionSteps === steps
                          ? 'bg-sky-950 border-sky-500 text-sky-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {steps.toLocaleString()} steps
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <div className="font-bold text-slate-200 text-xs">Auto-scroll Trace Log</div>
                  <div className="text-[10px] text-slate-400">Keep latest micro-operations in view</div>
                </div>
                <input
                  type="checkbox"
                  checked={draft.autoScrollTrace}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, autoScrollTrace: e.target.checked }))
                  }
                  className="w-4 h-4 accent-sky-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 3: VISUALIZER & UI */}
          {activeTab === 'visualizer' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-slate-200 text-xs">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Datapath Particle Packet Flow Animations</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Render flowing animated data packets on active CPU buses
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={draft.enableParticleAnimations}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, enableParticleAnimations: e.target.checked }))
                  }
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
              </div>

              {draft.enableParticleAnimations && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                    Particle Flow Speed
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['slow', 'normal', 'fast'] as const).map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setDraft((prev) => ({ ...prev, particleSpeed: spd }))}
                        className={`p-2 rounded-lg border text-center text-xs capitalize ${
                          draft.particleSpeed === spd
                            ? 'bg-amber-950/70 border-amber-500 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {spd}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-sky-400 uppercase tracking-wider block">
                  Memory Grid Viewer Page Size
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { count: 16, label: '16 Words (64 B)' },
                    { count: 32, label: '32 Words (128 B)' },
                    { count: 64, label: '64 Words (256 B)' },
                  ].map((p) => (
                    <button
                      key={p.count}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, memoryPageSize: p.count }))}
                      className={`p-2 rounded-lg border text-center text-xs ${
                        draft.memoryPageSize === p.count
                          ? 'bg-sky-950 border-sky-500 text-sky-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-t border-slate-800">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore 64 KB Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-md shadow-sky-600/30 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Apply Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
