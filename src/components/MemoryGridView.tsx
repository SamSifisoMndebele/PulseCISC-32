// PulseCISC-32 Data RAM Memory Viewer (0x0800 - 0x0FFF)
import React, { useState } from 'react';
import { Memory } from '../core/memory';
import { toHex32 } from '../core/isa';
import { Search, Edit2, Check, X } from 'lucide-react';

interface MemoryGridViewProps {
  memory: Memory;
  activeMar: number;
  lastModifiedAddr: number | null;
  onUpdateWord: (addr: number, value: number) => void;
  isPaused: boolean;
}

export const MemoryGridView: React.FC<MemoryGridViewProps> = ({
  memory,
  activeMar,
  lastModifiedAddr,
  onUpdateWord,
  isPaused,
}) => {
  const [searchAddr, setSearchAddr] = useState<string>('0x0800');
  const [startOffset, setStartOffset] = useState<number>(0x0800);
  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [editValStr, setEditValStr] = useState<string>('');

  // Show 16 words (64 bytes) per page
  const rowsCount = 16;
  const addresses: number[] = [];
  for (let i = 0; i < rowsCount; i++) {
    const a = startOffset + i * 4;
    if (a <= 0x0ffc) {
      addresses.push(a);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    let addr = 0x0800;
    const clean = searchAddr.trim();
    if (clean.startsWith('0x') || clean.startsWith('0X')) {
      addr = parseInt(clean, 16);
    } else {
      addr = parseInt(clean, 10);
    }
    if (!isNaN(addr)) {
      // Clamp to Data Segment and align to 4
      const clamped = Math.max(0x0800, Math.min(0x0ffc, addr & ~0x3));
      setStartOffset(clamped);
    }
  };

  const handleStartEdit = (addr: number) => {
    if (!isPaused) return;
    setEditingAddr(addr);
    setEditValStr(toHex32(memory.readWord(addr)));
  };

  const handleSaveEdit = (addr: number) => {
    let num = 0;
    const clean = editValStr.trim();
    if (clean.startsWith('0x') || clean.startsWith('0X')) {
      num = parseInt(clean, 16);
    } else {
      num = parseInt(clean, 10);
    }
    if (!isNaN(num)) {
      onUpdateWord(addr, num);
    }
    setEditingAddr(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] border-t border-slate-800 text-slate-100 font-mono text-xs">
      {/* Header & Search */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-800 gap-2">
        <span className="font-semibold text-xs text-slate-200 truncate">
          Data RAM (0x0800 - 0x0FFF)
        </span>

        <form onSubmit={handleSearch} className="flex items-center gap-1">
          <input
            type="text"
            value={searchAddr}
            onChange={(e) => setSearchAddr(e.target.value)}
            placeholder="0x0800"
            className="w-20 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-[11px] text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
          />
          <button
            type="submit"
            className="p-1 text-slate-400 hover:text-sky-400 bg-slate-800 rounded"
            title="Jump to Address"
          >
            <Search className="w-3 h-3" />
          </button>
        </form>
      </div>

      {/* Quick Jump Buttons */}
      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950/50 border-b border-slate-800/60 text-[10px]">
        <span className="text-slate-500">Jump:</span>
        <button
          onClick={() => {
            setStartOffset(0x0800);
            setSearchAddr('0x0800');
          }}
          className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          0x0800 (Data Start)
        </button>
        <button
          onClick={() => {
            setStartOffset(0x0820);
            setSearchAddr('0x0820');
          }}
          className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          0x0820
        </button>
        <button
          onClick={() => {
            setStartOffset(0x0fc0);
            setSearchAddr('0x0FC0');
          }}
          className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
        >
          0x0FC0 (Stack)
        </button>
      </div>

      {/* Memory Table */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {addresses.map((addr) => {
          const wordVal = memory.readWord(addr);
          const isActive = (activeMar & ~0x3) === addr;
          const isModified = lastModifiedAddr !== null && (lastModifiedAddr & ~0x3) === addr;
          const isEditing = editingAddr === addr;

          return (
            <div
              key={addr}
              className={`group flex items-center justify-between p-1.5 rounded border transition-all text-[11px] ${
                isModified
                  ? 'bg-purple-950/50 border-purple-500/80 shadow-sm shadow-purple-500/20'
                  : isActive
                  ? 'bg-sky-950/40 border-sky-500/70'
                  : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-bold select-all">
                  0x{addr.toString(16).padStart(4, '0').toUpperCase()}
                </span>
                <span className="text-slate-500 text-[10px]">
                  (+{addr - 0x0800})
                </span>
              </div>

              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editValStr}
                    onChange={(e) => setEditValStr(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(addr);
                      if (e.key === 'Escape') setEditingAddr(null);
                    }}
                    autoFocus
                    className="w-24 px-1 py-0.5 bg-slate-950 border border-sky-500 rounded text-sky-200 text-xs font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => handleSaveEdit(addr)}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingAddr(null)}
                    className="p-1 text-slate-400 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono select-all ${
                      isModified
                        ? 'text-purple-200 font-bold'
                        : wordVal !== 0
                        ? 'text-slate-100 font-semibold'
                        : 'text-slate-500'
                    }`}
                  >
                    {toHex32(wordVal)}
                  </span>
                  <span
                    className="text-[10px] text-emerald-400/80 font-mono tracking-wider border border-slate-800/80 px-1 py-0.2 rounded bg-slate-950/70 select-all"
                    title="ASCII Representation (4 bytes Little-Endian)"
                  >
                    |{[0, 1, 2, 3].map((off) => {
                      const b = memory.readByte(addr + off);
                      return b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
                    }).join('')}|
                  </span>
                  {isPaused && (
                    <button
                      onClick={() => handleStartEdit(addr)}
                      title="Edit Word in Memory"
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-sky-400 transition-opacity"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
