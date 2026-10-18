// PulseCISC-32 Special Registers, Segment Selectors & EFLAGS Display
import React from 'react';
import type { EFLAGS, SegmentRegisters } from '../core/types';
import { formatBytesHex, toHex16, toHex32 } from '../core/isa';

interface SpecialRegistersViewProps {
  eip: number;
  ir: number;
  irBytes?: number[];
  mar: number;
  mdr: number;
  aluOut: number;
  flags: EFLAGS;
  segments?: SegmentRegisters;
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
  irBytes,
  mar,
  mdr,
  aluOut,
  flags,
  segments = { cs: 0x001b, ds: 0x0023, ss: 0x0023, es: 0x0023, fs: 0x003b, gs: 0x0000 },
  decodedString,
  latchA = 0,
  latchB = 0,
  latchASource = 'NONE',
  latchBSource = 'NONE',
  latchBIsImmediate = false,
}) => {
  const irDisplay =
    irBytes && irBytes.length > 0 ? formatBytesHex(irBytes) : toHex32(ir);

  return (
    <div className="flex flex-col bg-[#0b0f19] border-t border-slate-800 text-slate-100 font-mono text-xs p-3 space-y-2.5">
      {/* EFLAGS Section */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
          <span>EFLAGS</span>
          <span className="text-[10px] text-slate-500 font-normal">Condition & Direction Codes</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {/* ZF */}
          <div
            className={`flex items-center justify-between px-1.5 py-1 rounded border text-[11px] ${
              flags.zf
                ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-300 shadow-sm shadow-emerald-500/10'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
            title="Zero Flag"
          >
            <span className="font-bold">ZF</span>
            <span>{flags.zf ? '1' : '0'}</span>
          </div>

          {/* SF */}
          <div
            className={`flex items-center justify-between px-1.5 py-1 rounded border text-[11px] ${
              flags.sf
                ? 'bg-rose-950/40 border-rose-500/80 text-rose-300 shadow-sm shadow-rose-500/10'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
            title="Sign Flag"
          >
            <span className="font-bold">SF</span>
            <span>{flags.sf ? '1' : '0'}</span>
          </div>

          {/* OF */}
          <div
            className={`flex items-center justify-between px-1.5 py-1 rounded border text-[11px] ${
              flags.of
                ? 'bg-amber-950/40 border-amber-500/80 text-amber-300 shadow-sm shadow-amber-500/10'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
            title="Signed Overflow Flag"
          >
            <span className="font-bold">OF</span>
            <span>{flags.of ? '1' : '0'}</span>
          </div>

          {/* CF */}
          <div
            className={`flex items-center justify-between px-1.5 py-1 rounded border text-[11px] ${
              flags.cf
                ? 'bg-purple-950/40 border-purple-500/80 text-purple-300 shadow-sm shadow-purple-500/10'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
            title="Carry / Borrow Flag"
          >
            <span className="font-bold">CF</span>
            <span>{flags.cf ? '1' : '0'}</span>
          </div>

          {/* DF */}
          <div
            className={`flex items-center justify-between px-1.5 py-1 rounded border text-[11px] ${
              flags.df
                ? 'bg-sky-950/40 border-sky-500/80 text-sky-300 shadow-sm shadow-sky-500/10'
                : 'bg-slate-900/60 border-slate-800 text-slate-500'
            }`}
            title="Direction Flag (0 = Forward, 1 = Backward)"
          >
            <span className="font-bold">DF</span>
            <span>{flags.df ? '1' : '0'}</span>
          </div>
        </div>
      </div>

      {/* Segment Registers (32-bit Protected Flat Mode) */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
          <span>Segment Selectors</span>
          <span className="text-[10px] text-sky-400/80 font-normal">.MODEL FLAT</span>
        </div>
        <div className="grid grid-cols-6 gap-1 text-[10px]">
          {(
            [
              ['CS', segments.cs, 'Code'],
              ['DS', segments.ds, 'Data'],
              ['SS', segments.ss, 'Stack'],
              ['ES', segments.es, 'Extra'],
              ['FS', segments.fs, 'TEB'],
              ['GS', segments.gs, 'Ext'],
            ] as const
          ).map(([name, val, desc]) => (
            <div
              key={name}
              className="px-1.5 py-1 bg-slate-900/70 border border-slate-800 rounded text-center"
              title={`${name} (${desc} Segment Selector): ${toHex16(val)}`}
            >
              <span className="text-slate-400 font-bold block text-[9px]">{name}</span>
              <span className="text-indigo-300 font-mono text-[9px]">
                {val.toString(16).toUpperCase().padStart(2, '0')}h
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Special Registers Grid */}
      <div>
        <div className="text-[11px] font-semibold text-slate-400 mb-1">
          Microarchitectural Latches
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          {/* EIP */}
          <div className="p-1.5 bg-slate-900/70 border border-slate-800 rounded-lg">
            <span className="text-slate-400 block text-[10px]">EIP (Program Counter)</span>
            <span className="text-emerald-400 font-bold">{toHex32(eip)}</span>
          </div>

          {/* IR */}
          <div className="p-1.5 bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden">
            <span className="text-slate-400 block text-[10px]">IR (x86 Bytes)</span>
            <span className="text-sky-400 font-bold block truncate text-[10px]" title={irDisplay}>
              {irDisplay}
            </span>
            {decodedString && (
              <span className="block text-[9px] text-slate-300 truncate">
                {decodedString}
              </span>
            )}
          </div>

          {/* Latch A */}
          <div className="p-1.5 bg-slate-900/70 border border-slate-800 rounded-lg">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Latch A</span>
              {latchASource !== 'NONE' && (
                <span className="text-[9px] bg-sky-950 text-sky-400 px-1 rounded border border-sky-800 truncate max-w-[85px]">
                  {latchASource}
                </span>
              )}
            </div>
            <span className="text-sky-300 font-bold">{toHex32(latchA)}</span>
          </div>

          {/* Latch B */}
          <div className="p-1.5 bg-slate-900/70 border border-slate-800 rounded-lg">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Latch B</span>
              {latchBSource !== 'NONE' && (
                <span
                  className={`text-[9px] px-1 rounded border truncate max-w-[85px] ${
                    latchBIsImmediate
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-sky-950 text-sky-400 border-sky-800'
                  }`}
                >
                  {latchBSource}
                </span>
              )}
            </div>
            <span className={latchBIsImmediate ? 'text-amber-300 font-bold' : 'text-sky-300 font-bold'}>
              {toHex32(latchB)}
            </span>
          </div>

          {/* MAR */}
          <div className="p-1.5 bg-slate-900/70 border border-slate-800 rounded-lg">
            <span className="text-slate-400 block text-[10px]">MAR (Memory Address)</span>
            <span className="text-purple-400 font-bold">{toHex32(mar)}</span>
          </div>

          {/* MDR */}
          <div className="p-1.5 bg-slate-900/70 border border-slate-800 rounded-lg">
            <span className="text-slate-400 block text-[10px]">MDR (Memory Data)</span>
            <span className="text-purple-300 font-bold">{toHex32(mdr)}</span>
          </div>

          {/* ALU_Out */}
          <div className="p-1.5 bg-slate-900/70 border border-slate-800 rounded-lg col-span-2 flex items-center justify-between">
            <span className="text-slate-400 text-[10px]">ALU_Out Result Latch</span>
            <span className="text-rose-400 font-bold">{toHex32(aluOut)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
