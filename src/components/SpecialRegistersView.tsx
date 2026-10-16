// PulseCISC-32 Special Registers & EFLAGS Display
import React from 'react';
import type { EFLAGS } from '../core/types';
import { toHex32 } from '../core/isa';

interface SpecialRegistersViewProps {
  eip: number;
  ir: number;
  mar: number;
  mdr: number;
  aluOut: number;
  flags: EFLAGS;
  decodedString?: string;
  latchA?: number;
  latchB?: number;
  latchASource?: string;
  latchBSource?: string;
  latchBIsImmediate?: boolean;
}

export const SpecialRegistersView: React.FC<SpecialRegistersViewProps> = ({
  eip,
  ir,
  mar,
  mdr,
  aluOut,
  flags,
  decodedString,
  latchA = 0,
  latchB = 0,
  latchASource = 'NONE',
  latchBSource = 'NONE',
  latchBIsImmediate = false,
}) => {
  return (
    <div className="flex flex-col bg-[#0b0f19] border-t border-slate-800 text-slate-100 font-mono text-xs p-3 space-y-3">
      {/* EFLAGS Section */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
          <span>EFLAGS</span>
          <span className="text-[10px] text-slate-500 font-normal">Condition Codes</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {/* ZF */}
          <div
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${
              flags.zf
                ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-300 shadow-sm shadow-emerald-500/10'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
          >
            <span className="font-bold">ZF</span>
            <span className="font-mono text-xs">{flags.zf ? '1 (Zero)' : '0'}</span>
          </div>

          {/* SF */}
          <div
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${
              flags.sf
                ? 'bg-rose-950/40 border-rose-500/80 text-rose-300 shadow-sm shadow-rose-500/10'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
          >
            <span className="font-bold">SF</span>
            <span className="font-mono text-xs">{flags.sf ? '1 (Neg)' : '0'}</span>
          </div>

          {/* OF */}
          <div
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${
              flags.of
                ? 'bg-amber-950/40 border-amber-500/80 text-amber-300 shadow-sm shadow-amber-500/10'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
          >
            <span className="font-bold">OF</span>
            <span className="font-mono text-xs">{flags.of ? '1 (Ovf)' : '0'}</span>
          </div>
        </div>
      </div>

      {/* Special Registers Grid */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
          Special Microarchitectural Latches
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {/* EIP */}
          <div className="p-2 bg-slate-900/70 border border-slate-800 rounded-lg">
            <span className="text-slate-400 block text-[10px]">EIP (Program Counter)</span>
            <span className="text-emerald-400 font-bold">{toHex32(eip)}</span>
          </div>

          {/* IR */}
          <div className="p-2 bg-slate-900/70 border border-slate-800 rounded-lg">
            <span className="text-slate-400 block text-[10px]">IR (Instruction)</span>
            <span className="text-sky-400 font-bold">{toHex32(ir)}</span>
            {decodedString && (
              <span className="block text-[10px] text-slate-300 truncate mt-0.5">
                {decodedString}
              </span>
            )}
          </div>

          {/* Latch A */}
          <div className="p-2 bg-slate-900/70 border border-slate-800 rounded-lg">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Latch A</span>
              {latchASource !== 'NONE' && (
                <span className="text-[9px] bg-sky-950 text-sky-400 px-1 rounded border border-sky-800">
                  {latchASource}
                </span>
              )}
            </div>
            <span className="text-sky-300 font-bold">{toHex32(latchA)}</span>
          </div>

          {/* Latch B */}
          <div className="p-2 bg-slate-900/70 border border-slate-800 rounded-lg">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Latch B</span>
              {latchBSource !== 'NONE' && (
                <span className={`text-[9px] px-1 rounded border ${
                  latchBIsImmediate
                    ? 'bg-amber-950 text-amber-300 border-amber-800'
                    : 'bg-sky-950 text-sky-400 border-sky-800'
                }`}>
                  {latchBSource}
                </span>
              )}
            </div>
            <span className={latchBIsImmediate ? 'text-amber-300 font-bold' : 'text-sky-300 font-bold'}>
              {toHex32(latchB)}
            </span>
          </div>

          {/* MAR */}
          <div className="p-2 bg-slate-900/70 border border-slate-800 rounded-lg">
            <span className="text-slate-400 block text-[10px]">MAR (Memory Address)</span>
            <span className="text-purple-400 font-bold">{toHex32(mar)}</span>
          </div>

          {/* MDR */}
          <div className="p-2 bg-slate-900/70 border border-slate-800 rounded-lg">
            <span className="text-slate-400 block text-[10px]">MDR (Memory Data)</span>
            <span className="text-purple-300 font-bold">{toHex32(mdr)}</span>
          </div>

          {/* ALU_Out */}
          <div className="p-2 bg-slate-900/70 border border-slate-800 rounded-lg col-span-2">
            <span className="text-slate-400 block text-[10px]">ALU_Out Result Latch</span>
            <span className="text-rose-400 font-bold">{toHex32(aluOut)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
