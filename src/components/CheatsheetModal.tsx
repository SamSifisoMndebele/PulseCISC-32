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
              <div><span className="text-sky-300 font-bold">ESP (SP)</span>: Stack Pointer (defaults 0xFFFC in 64 KB)</div>
            </div>
            <p className="text-[10px] text-slate-400">
              * Writing to 16-bit sub-registers (e.g. <code className="text-sky-300">MOV AX, 0x1234</code>) modifies bits [15:0] while preserving upper bits [31:16].
            </p>
          </div>

          {/* Section 2: Instructions */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase text-[11px] tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Full CISC / x86 Architecture Instruction Set</span>
            </div>
            <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-[11px]">
              {/* Stack & Subroutines */}
              <div className="border-b border-slate-800/80 pb-2 mb-2">
                <span className="text-amber-400 font-bold block mb-1">Stack, Calling Conventions & Functions</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
                  <div><span className="text-emerald-300 font-bold">PUSH src</span>: Decrement ESP (-4), store in [ESP] (<code className="text-slate-200">PUSH EAX</code>, <code className="text-slate-200">PUSH 42</code>)</div>
                  <div><span className="text-emerald-300 font-bold">POP dest</span>: Read from [ESP], increment ESP (+4) (<code className="text-slate-200">POP EBX</code>)</div>
                  <div><span className="text-emerald-300 font-bold">CALL label</span>: Push return EIP to stack and jump to function (<code className="text-slate-200">CALL factorial</code>)</div>
                  <div><span className="text-emerald-300 font-bold">RET</span>: Pop return address from stack into EIP (<code className="text-slate-200">RET</code>)</div>
                </div>
              </div>

              {/* Data Transfer & Pointers */}
              <div className="border-b border-slate-800/80 pb-2 mb-2">
                <span className="text-sky-400 font-bold block mb-1">Data Transfer, Pointers & Byte Access</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
                  <div><span className="text-emerald-300 font-bold">MOV</span>: Transfer 32/16-bit (<code className="text-slate-200">MOV EAX, 10</code>, <code className="text-slate-200">MOV [EBX + 4], EAX</code>)</div>
                  <div><span className="text-emerald-300 font-bold">MOVB</span>: 8-bit Byte load/store (<code className="text-slate-200">MOV AL, BYTE [ESI]</code>, <code className="text-slate-200">MOV BYTE [EDI], AL</code>)</div>
                  <div><span className="text-emerald-300 font-bold">LEA</span>: Load Effective Address without RAM access (<code className="text-slate-200">LEA EBX, [EBP - 8]</code>)</div>
                  <div><span className="text-emerald-300 font-bold">XCHG</span>: Atomic register swap (<code className="text-slate-200">XCHG EAX, EBX</code>)</div>
                </div>
              </div>

              {/* Arithmetic */}
              <div className="border-b border-slate-800/80 pb-2 mb-2">
                <span className="text-emerald-400 font-bold block mb-1">Arithmetic & Multi-Precision</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
                  <div><span className="text-emerald-300 font-bold">ADD / SUB</span>: Add / Subtract with flags (<code className="text-slate-200">ADD EAX, 5</code>, <code className="text-slate-200">SUB ECX, EBX</code>)</div>
                  <div><span className="text-emerald-300 font-bold">ADC / SBB</span>: Add/Sub with Carry/Borrow (<code className="text-slate-200">ADC EDX, 0</code>)</div>
                  <div><span className="text-emerald-300 font-bold">INC / DEC</span>: Increment / Decrement by 1 (preserves CF) (<code className="text-slate-200">INC ECX</code>)</div>
                  <div><span className="text-emerald-300 font-bold">NEG</span>: Two's complement negate (<code className="text-slate-200">NEG EAX</code>)</div>
                  <div><span className="text-emerald-300 font-bold">MUL / IMUL</span>: Unsigned/Signed multiply (<code className="text-slate-200">MUL EBX</code>, <code className="text-slate-200">IMUL EAX, 10</code>)</div>
                  <div><span className="text-emerald-300 font-bold">DIV / IDIV</span>: Unsigned/Signed divide (<code className="text-slate-200">DIV EBX</code>: EAX=quot, EDX=rem)</div>
                </div>
              </div>

              {/* Bitwise, Shifts & Tests */}
              <div className="border-b border-slate-800/80 pb-2 mb-2">
                <span className="text-purple-400 font-bold block mb-1">Logic, Shifts & Bit Twiddling</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
                  <div><span className="text-emerald-300 font-bold">AND / OR / XOR</span>: Bitwise logic (<code className="text-slate-200">XOR EAX, EAX</code>, <code className="text-slate-200">AND EAX, 0xFF</code>)</div>
                  <div><span className="text-emerald-300 font-bold">NOT</span>: One's complement bit inversion (<code className="text-slate-200">NOT EAX</code>)</div>
                  <div><span className="text-emerald-300 font-bold">TEST</span>: Non-destructive AND, sets ZF & SF (<code className="text-slate-200">TEST EAX, EAX</code>)</div>
                  <div><span className="text-emerald-300 font-bold">CMP</span>: Non-destructive SUB, updates EFLAGS (<code className="text-slate-200">CMP EAX, 100</code>)</div>
                  <div><span className="text-emerald-300 font-bold">SHL / SAL</span>: Shift Left by imm or CL (<code className="text-slate-200">SHL EAX, 2</code> multiplies by 4)</div>
                  <div><span className="text-emerald-300 font-bold">SHR / SAR</span>: Logical / Arithmetic Shift Right (<code className="text-slate-200">SAR EAX, 1</code> divides signed by 2)</div>
                  <div><span className="text-emerald-300 font-bold">ROL / ROR</span>: Rotate bits left / right (<code className="text-slate-200">ROL EAX, 4</code>)</div>
                  <div><span className="text-emerald-300 font-bold">CLC / STC / CMC</span>: Clear / Set / Complement Carry Flag (CF)</div>
                </div>
              </div>

              {/* Control Flow */}
              <div>
                <span className="text-rose-400 font-bold block mb-1">Control Flow & Conditionals</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
                  <div><span className="text-emerald-300 font-bold">JMP</span>: Unconditional jump (<code className="text-slate-200">JMP main</code>)</div>
                  <div><span className="text-emerald-300 font-bold">LOOP</span>: Decrement ECX, branch if ECX != 0 (<code className="text-slate-200">LOOP loop_start</code>)</div>
                  <div><span className="text-emerald-300 font-bold">JE / JZ</span>: Jump if Equal / Zero (ZF=1)</div>
                  <div><span className="text-emerald-300 font-bold">JNE / JNZ</span>: Jump if Not Equal / Non-Zero (ZF=0)</div>
                  <div><span className="text-emerald-300 font-bold">JL / JLE / JG / JGE</span>: Signed comparisons (<code className="text-slate-200">JL target</code>, <code className="text-slate-200">JG target</code>)</div>
                  <div><span className="text-emerald-300 font-bold">JB / JBE / JA / JAE</span>: Unsigned comparisons using Carry (<code className="text-slate-200">JB target</code>, <code className="text-slate-200">JA target</code>)</div>
                  <div><span className="text-emerald-300 font-bold">JS / JNS / JO / JNO</span>: Flag checks: Sign negative, Overflow (<code className="text-slate-200">JS negative</code>)</div>
                  <div><span className="text-emerald-300 font-bold">NOP / HLT</span>: No-operation / Halt processor clock</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Memory Segmentation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-bold uppercase text-[11px] tracking-wider">
              <Database className="w-4 h-4" />
              <span>64 KB Memory Segmentation (8 KB Code / 56 KB Data RAM)</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-purple-300 font-bold">Code Segment</span>: 0x0000 - 0x1FFF (8 KB standard)
                <p className="text-[10px] text-slate-400 mt-1">Holds up to 2,048 assembled 32-bit instructions pointed to by EIP (configurable via Settings).</p>
              </div>
              <div>
                <span className="text-purple-300 font-bold">Data Segment</span>: 0x2000 - 0xFFFF (56 KB RAM)
                <p className="text-[10px] text-slate-400 mt-1">Word-aligned RAM read/write via MOV [mem], reg. Stack top defaults to 0xFFFC.</p>
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
