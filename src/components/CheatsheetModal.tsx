// PulseCISC-32 x86 Architecture & ISA Cheatsheet Modal
import React from 'react';
import { X, BookOpen, Layers, Cpu, Database } from 'lucide-react';

interface CheatsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheatsheetModal: React.FC<CheatsheetModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="flex flex-col w-full max-w-2xl max-h-[85vh] bg-[#0d121f] border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold font-mono tracking-tight text-white">
              PulseCISC-32 x86 Reference Manual
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs font-mono">
          {/* Section 1: Registers */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sky-400 font-bold uppercase text-[11px] tracking-wider">
              <Cpu className="w-4 h-4" />
              <span>Registers (Classic x86 IA-32)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div><span className="text-sky-300 font-bold">EAX (AX)</span>: Accumulator (returns, math)</div>
              <div><span className="text-sky-300 font-bold">EBX (BX)</span>: Base pointer (data array)</div>
              <div><span className="text-sky-300 font-bold">ECX (CX)</span>: Counter (loops, shifts)</div>
              <div><span className="text-sky-300 font-bold">EDX (DX)</span>: Data (arithmetic, I/O)</div>
              <div><span className="text-sky-300 font-bold">ESI (SI)</span>: Source Index (pointer)</div>
              <div><span className="text-sky-300 font-bold">EDI (DI)</span>: Destination Index (pointer)</div>
              <div><span className="text-sky-300 font-bold">EBP (BP)</span>: Base Pointer (stack frame)</div>
              <div><span className="text-sky-300 font-bold">ESP (SP)</span>: Stack Pointer (defaults 0x0FFC)</div>
            </div>
            <p className="text-[10px] text-slate-400">
              * Writing to 16-bit sub-registers (e.g. <code className="text-sky-300">MOV AX, 0x1234</code>) modifies bits [15:0] while preserving upper bits [31:16].
            </p>
          </div>

          {/* Section 2: Instructions */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase text-[11px] tracking-wider">
              <Layers className="w-4 h-4" />
              <span>2-Operand CISC Instruction Set</span>
            </div>
            <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-[11px]">
              <div className="flex items-start gap-2">
                <span className="text-emerald-300 font-bold min-w-[70px]">MOV</span>
                <span className="text-slate-300">Transfer data: <code className="text-slate-200">MOV EAX, 10</code>, <code className="text-slate-200">MOV EAX, EBX</code>, <code className="text-slate-200">MOV EAX, [EBX + 4]</code>, <code className="text-slate-200">MOV [EBX], EAX</code></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-300 font-bold min-w-[70px]">MOVH</span>
                <span className="text-slate-300">Load upper 16-bits: <code className="text-slate-200">MOVH EAX, 0x1234</code> (useful for loading 32-bit constants)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-300 font-bold min-w-[70px]">ADD</span>
                <span className="text-slate-300">Addition: <code className="text-slate-200">ADD EAX, EBX</code> or <code className="text-slate-200">ADD EAX, 10</code> (Updates ZF, SF, OF)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-300 font-bold min-w-[70px]">SUB</span>
                <span className="text-slate-300">Subtraction: <code className="text-slate-200">SUB EAX, 5</code> (Updates ZF, SF, OF)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-300 font-bold min-w-[70px]">AND / OR</span>
                <span className="text-slate-300">Bitwise logic: <code className="text-slate-200">AND EAX, 0xFF</code>, <code className="text-slate-200">OR EAX, EBX</code></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-300 font-bold min-w-[70px]">XOR</span>
                <span className="text-slate-300">Bitwise XOR: <code className="text-slate-200">XOR EAX, EAX</code> (Zeroes register and sets ZF=1)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-300 font-bold min-w-[70px]">CMP</span>
                <span className="text-slate-300">Compare: <code className="text-slate-200">CMP ECX, 0</code> (Computes ECX - 0, updates EFLAGS without modifying ECX)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-300 font-bold min-w-[70px]">JE / JNE</span>
                <span className="text-slate-300">Conditional jumps: <code className="text-slate-200">JE loop_end</code> (jump if ZF=1), <code className="text-slate-200">JNE loop_start</code> (jump if ZF=0)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-300 font-bold min-w-[70px]">PRINT</span>
                <span className="text-slate-300">Console print: <code className="text-slate-200">PRINT EAX</code> (prints register decimal & hex), <code className="text-slate-200">PRINT 42</code> (prints immediate) to the System Console</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-300 font-bold min-w-[70px]">JMP / HLT</span>
                <span className="text-slate-300">Unconditional jump: <code className="text-slate-200">JMP main</code>; Halt processor: <code className="text-slate-200">HLT</code></span>
              </div>
            </div>
          </div>

          {/* Section 3: Memory Segmentation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-bold uppercase text-[11px] tracking-wider">
              <Database className="w-4 h-4" />
              <span>4 KB Memory Segmentation</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-purple-300 font-bold">Code Segment</span>: 0x0000 - 0x07FF (2 KB)
                <p className="text-[10px] text-slate-400 mt-1">Holds up to 512 32-bit instructions pointed to by EIP.</p>
              </div>
              <div>
                <span className="text-purple-300 font-bold">Data Segment</span>: 0x0800 - 0x0FFF (2 KB)
                <p className="text-[10px] text-slate-400 mt-1">Word-aligned RAM read/write via MOV [mem], reg. Stack top at 0x0FFC.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 bg-slate-900 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
