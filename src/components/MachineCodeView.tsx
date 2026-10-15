// PulseCISC-32 Assembled Machine Code Inspector
import React from 'react';
import { Disassembler } from '../core/disassembler';
import type { DisassembledLine } from '../core/disassembler';

interface MachineCodeViewProps {
  codeBytes: Uint8Array;
  currentEIP: number;
}

export const MachineCodeView: React.FC<MachineCodeViewProps> = ({
  codeBytes,
  currentEIP,
}) => {
  const lines: DisassembledLine[] = Disassembler.disassembleBuffer(codeBytes, 0x0000);

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] border-r border-slate-800 text-slate-100 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-800">
        <span className="font-semibold text-xs text-slate-200">
          Machine Code & Disassembly
        </span>
        <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
          {lines.length} instructions ({codeBytes.length} bytes)
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {lines.length === 0 ? (
          <div className="text-slate-500 p-6 text-center">
            No machine code loaded. Write assembly and click Assemble & Load.
          </div>
        ) : (
          lines.map((line) => {
            const isActive = line.address === (currentEIP & ~0x3);

            return (
              <div
                key={line.address}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded border transition-all ${
                  isActive
                    ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 text-slate-300'
                }`}
              >
                {/* Pointer & Address */}
                <div className="flex items-center gap-2">
                  <span className={`w-3 text-emerald-400 font-bold ${isActive ? 'animate-pulse' : 'opacity-0'}`}>
                    ▶
                  </span>
                  <span className="text-sky-400 font-mono">
                    0x{line.address.toString(16).padStart(4, '0').toUpperCase()}
                  </span>
                </div>

                {/* Hex Word */}
                <span className="text-slate-400 font-mono text-[11px]">
                  {line.hex}
                </span>

                {/* Disassembled Assembly String */}
                <span className={`font-semibold font-mono ${isActive ? 'text-emerald-300' : 'text-slate-200'}`}>
                  {line.assembly}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
