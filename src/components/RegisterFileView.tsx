// PulseCISC-32 Register File Inspection Panel
import React, { useState } from 'react';
import type { RegisterId } from '../core/types';
import { toHex32, toHex16, REGISTER_NAMES, SUB_REGISTER_NAMES, toInt32 } from '../core/isa';
import { Edit2, Check, X } from 'lucide-react';

interface RegisterFileViewProps {
  registers: Uint32Array;
  lastModifiedReg: RegisterId | null;
  onUpdateRegister: (regId: RegisterId, value: number) => void;
  isPaused: boolean;
}

export const RegisterFileView: React.FC<RegisterFileViewProps> = ({
  registers,
  lastModifiedReg,
  onUpdateRegister,
  isPaused,
}) => {
  const [format, setFormat] = useState<'hex' | 'dec' | 'bin'>('hex');
  const [editingReg, setEditingReg] = useState<RegisterId | null>(null);
  const [editValStr, setEditValStr] = useState<string>('');

  const formatValue = (val: number): string => {
    if (format === 'hex') return toHex32(val);
    if (format === 'dec') return `${toInt32(val)} (${val >>> 0})`;
    if (format === 'bin') return (val >>> 0).toString(2).padStart(32, '0');
    return toHex32(val);
  };

  const handleStartEdit = (regId: RegisterId) => {
    if (!isPaused) return;
    setEditingReg(regId);
    setEditValStr(toHex32(registers[regId]));
  };

  const handleSaveEdit = (regId: RegisterId) => {
    let num = 0;
    const clean = editValStr.trim();
    if (clean.startsWith('0x') || clean.startsWith('0X')) {
      num = parseInt(clean, 16);
    } else {
      num = parseInt(clean, 10);
    }
    if (!isNaN(num)) {
      onUpdateRegister(regId, num);
    }
    setEditingReg(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] border-slate-800 text-slate-100 font-mono text-xs">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-800">
        <span className="font-semibold text-xs text-slate-200">
          Registers (8 x 32-bit)
        </span>

        {/* Format Selector */}
        <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px]">
          <button
            onClick={() => setFormat('hex')}
            className={`px-2 py-0.5 rounded ${
              format === 'hex' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            HEX
          </button>
          <button
            onClick={() => setFormat('dec')}
            className={`px-2 py-0.5 rounded ${
              format === 'dec' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            DEC
          </button>
          <button
            onClick={() => setFormat('bin')}
            className={`px-2 py-0.5 rounded ${
              format === 'bin' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            BIN
          </button>
        </div>
      </div>

      {/* Register List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {Array.from({ length: 8 }).map((_, idx) => {
          const regId = idx as RegisterId;
          const regName = REGISTER_NAMES[regId];
          const subName = SUB_REGISTER_NAMES[regId];
          const val = registers[regId];
          const isModified = lastModifiedReg === regId;
          const isEditing = editingReg === regId;

          return (
            <div
              key={regId}
              className={`group flex items-center justify-between p-2 rounded-lg border transition-all ${
                isModified
                  ? 'bg-amber-950/40 border-amber-500/60 shadow-md shadow-amber-500/10'
                  : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-bold text-xs ${
                    isModified ? 'text-amber-400' : 'text-sky-400'
                  }`}
                >
                  {regName}
                </span>
                <span className="text-[10px] text-slate-500 bg-slate-800/80 px-1 py-0.5 rounded border border-slate-700/50">
                  {subName}: {toHex16(val & 0xffff)}
                </span>
              </div>

              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editValStr}
                    onChange={(e) => setEditValStr(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(regId);
                      if (e.key === 'Escape') setEditingReg(null);
                    }}
                    autoFocus
                    className="w-24 px-1.5 py-0.5 bg-slate-950 border border-sky-500 rounded text-sky-200 text-xs font-mono focus:outline-none"
                  />
                  <button
                    onClick={() => handleSaveEdit(regId)}
                    className="p-1 text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingReg(null)}
                    className="p-1 text-slate-400 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span
                    onClick={() => isPaused && handleStartEdit(regId)}
                    className={`font-mono select-all truncate ${
                      format === 'bin' ? 'text-[10px] sm:text-xs tracking-tighter' : 'text-xs'
                    } ${isPaused ? 'cursor-pointer' : ''} ${
                      isModified ? 'text-amber-200 font-bold' : 'text-slate-200'
                    }`}
                  >
                    {formatValue(val)}
                  </span>
                  {isPaused && (
                    <button
                      onClick={() => handleStartEdit(regId)}
                      title="Edit Register Value"
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-sky-400 active:text-sky-300 transition-opacity shrink-0"
                    >
                      <Edit2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
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
