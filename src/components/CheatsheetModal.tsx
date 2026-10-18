// PulseCISC-32 x86 & MASM Architecture Reference Manual Modal
import React from 'react';
import { X, BookOpen, Layers, Cpu, Database, Code } from 'lucide-react';

interface CheatsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheatsheetModal: React.FC<CheatsheetModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="flex flex-col w-full max-w-3xl max-h-[85vh] bg-[#0d121f] border border-slate-700/80 rounded-2xl shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold font-mono tracking-tight text-white">
              PulseCISC-32 MASM & x86 Reference Manual
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
          {/* Section 1: MASM Directives & Structured Syntax */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase text-[11px] tracking-wider">
              <Code className="w-4 h-4" />
              <span>MASM High-Level Directives & Structured Syntax</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-amber-300 font-bold">.MODEL FLAT, STDCALL</span>
                <p className="text-[10px] text-slate-400">Enables 32-bit flat memory and STDCALL stack cleanup (`RET n`). Supports `.386`, `.DATA`, `.CODE`, `END main`.</p>
              </div>
              <div>
                <span className="text-amber-300 font-bold">PROC / LOCAL / ENDP</span>
                <p className="text-[10px] text-slate-400">
                  <code className="text-slate-200">MyFn PROC USES ebx, a:DWORD</code> + <code className="text-slate-200">LOCAL x:DWORD</code> auto-builds EBP frames.
                </p>
              </div>
              <div>
                <span className="text-amber-300 font-bold">INVOKE proc, arg1, ADDR v</span>
                <p className="text-[10px] text-slate-400">Pushes arguments right-to-left, resolves `ADDR` via `LEA`/`OFFSET`, and calls `proc`.</p>
              </div>
              <div>
                <span className="text-amber-300 font-bold">STRUCT ... ENDS</span>
                <p className="text-[10px] text-slate-400">Defines custom structs and resolves field offsets like <code className="text-slate-200">[EBX + Item.price]</code>.</p>
              </div>
              <div>
                <span className="text-amber-300 font-bold">.IF / .ELSEIF / .ELSE / .ENDIF</span>
                <p className="text-[10px] text-slate-400">Structured comparisons (`==`, `!=`, `&gt;`, `&gt;=`, `&lt;`, `&lt;=`, `ZERO?`, `CARRY?`).</p>
              </div>
              <div>
                <span className="text-amber-300 font-bold">.WHILE / .ENDW & .REPEAT / .UNTIL</span>
                <p className="text-[10px] text-slate-400">High-level loops with `.BREAK` and `.CONTINUE` plus `DUP`, `SIZEOF`, `LENGTHOF`, `TYPE`.</p>
              </div>
            </div>
          </div>

          {/* Section 2: Registers & Complex SIB Addressing */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sky-400 font-bold uppercase text-[11px] tracking-wider">
              <Cpu className="w-4 h-4" />
              <span>Registers (32/16/8-bit, Segments) & Complex SIB Addressing</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div><span className="text-sky-300 font-bold">EAX / AX / AH / AL</span>: Accumulator</div>
              <div><span className="text-sky-300 font-bold">EBX / BX / BH / BL</span>: Base Register</div>
              <div><span className="text-sky-300 font-bold">ECX / CX / CH / CL</span>: Loop & Shift Counter</div>
              <div><span className="text-sky-300 font-bold">EDX / DX / DH / DL</span>: Data & Multiply/Divide High</div>
              <div><span className="text-sky-300 font-bold">ESI / SI & EDI / DI</span>: Source & Destination Index</div>
              <div><span className="text-sky-300 font-bold">EBP / BP & ESP / SP</span>: Frame Base & Stack Pointer</div>
              <div className="col-span-2 pt-1 border-t border-slate-800/80 text-slate-300">
                <span className="text-indigo-300 font-bold">SIB Addressing</span>: <code className="text-emerald-300">[Base + Index*Scale + Disp]</code> where Scale ∈ &#123;1, 2, 4, 8&#125; (e.g. <code className="text-slate-200">[EBX + ESI*4 + 16]</code>, <code className="text-slate-200">arr[ECX*4]</code>, <code className="text-slate-200">BYTE PTR [EDI]</code>, <code className="text-slate-200">WORD PTR [EBP - 4]</code>).
              </div>
            </div>
          </div>

          {/* Section 3: Variable-Length x86 Instruction Set */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase text-[11px] tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Variable-Length x86 Instruction Set (1 to 11 Bytes)</span>
            </div>
            <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-[11px]">
              {/* Stack & Subroutines */}
              <div className="border-b border-slate-800/80 pb-2 mb-2">
                <span className="text-amber-400 font-bold block mb-1">Stack, Frames & Subroutines</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
                  <div><span className="text-emerald-300 font-bold">PUSH / POP</span>: 1-byte reg (`50+r`/`58+r`), imm, or `[mem]`</div>
                  <div><span className="text-emerald-300 font-bold">PUSHAD / POPAD</span>: Push/Pop all 8 general registers (`60`/`61`)</div>
                  <div><span className="text-emerald-300 font-bold">PUSHFD / POPFD</span>: Push/Pop 32-bit EFLAGS (`9C`/`9D`)</div>
                  <div><span className="text-emerald-300 font-bold">ENTER / LEAVE</span>: Setup / teardown stack frame (`C8`/`C9`)</div>
                  <div><span className="text-emerald-300 font-bold">CALL / RET [n]</span>: Call subroutine (`E8`) / Return & clean stack (`C3`/`C2`)</div>
                </div>
              </div>

              {/* Data Transfer & Extension */}
              <div className="border-b border-slate-800/80 pb-2 mb-2">
                <span className="text-sky-400 font-bold block mb-1">Data Movement, Zero/Sign Extension & Conditional Move</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
                  <div><span className="text-emerald-300 font-bold">MOV / MOVB / MOVW</span>: 32/16/8-bit transfers (full 32-bit imm & SIB)</div>
                  <div><span className="text-emerald-300 font-bold">MOVZX / MOVSX</span>: Move with Zero-Extend or Sign-Extend</div>
                  <div><span className="text-emerald-300 font-bold">LEA</span>: Load Effective SIB Address (`8D`) without memory read</div>
                  <div><span className="text-emerald-300 font-bold">CMOVcc / SETcc</span>: Branchless conditional move (`CMOVG`) & byte set (`SETE`)</div>
                  <div><span className="text-emerald-300 font-bold">XCHG / XADD / CMPXCHG</span>: Swap, Exchange-Add, Compare-Exchange</div>
                  <div><span className="text-emerald-300 font-bold">CBW / CWDE / CWD / CDQ</span>: Sign-extend AL→AX→EAX→EDX:EAX</div>
                </div>
              </div>

              {/* String & Block Primitives */}
              <div className="border-b border-slate-800/80 pb-2 mb-2">
                <span className="text-indigo-400 font-bold block mb-1">Hardware String & Block Memory Primitives</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
                  <div><span className="text-emerald-300 font-bold">MOVSB / MOVSW / MOVSD</span>: Copy `[ESI]` → `[EDI]`</div>
                  <div><span className="text-emerald-300 font-bold">STOSB / STOSW / STOSD</span>: Store `AL/AX/EAX` → `[EDI]`</div>
                  <div><span className="text-emerald-300 font-bold">LODSB / LODSW / LODSD</span>: Load `[ESI]` → `AL/AX/EAX`</div>
                  <div><span className="text-emerald-300 font-bold">CMPSB / SCASB</span>: Compare `[ESI],[EDI]` / Scan `[EDI]` for `AL`</div>
                  <div><span className="text-emerald-300 font-bold">REP / REPE / REPNE</span>: Hardware `ECX` repeat prefix (`F3`/`F2`)</div>
                  <div><span className="text-emerald-300 font-bold">CLD / STD</span>: Clear (`DF=0`) or Set (`DF=1`) Direction Flag</div>
                </div>
              </div>

              {/* Arithmetic, Bitwise & Loops */}
              <div>
                <span className="text-emerald-400 font-bold block mb-1">Arithmetic, Bit Manipulation & Control Flow</span>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
                  <div><span className="text-emerald-300 font-bold">ADD / ADC / SUB / SBB</span>: Reg, Imm32, or `[mem]` operands</div>
                  <div><span className="text-emerald-300 font-bold">MUL / IMUL / DIV / IDIV</span>: 1-, 2-, and 3-operand forms</div>
                  <div><span className="text-emerald-300 font-bold">BT / BTS / BTR / BTC</span>: Bit Test & Set/Reset/Complement in `CF`</div>
                  <div><span className="text-emerald-300 font-bold">BSF / BSR / BSWAP</span>: Bit Scan Forward/Reverse & Byte Swap</div>
                  <div><span className="text-emerald-300 font-bold">JMP / Jcc / JECXZ</span>: All signed/unsigned jumps + jump if `ECX=0`</div>
                  <div><span className="text-emerald-300 font-bold">LOOP / LOOPE / LOOPNE</span>: Decrement `ECX` and loop</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Memory Segmentation */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-bold uppercase text-[11px] tracking-wider">
              <Database className="w-4 h-4" />
              <span>32-Bit Flat Memory Model & Segment Selectors</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-purple-300 font-bold">CS (0x1B) — Code Segment</span>: 0x0000 - 0x1FFF
                <p className="text-[10px] text-slate-400 mt-1">Holds variable-length x86 machine code bytes pointed to by EIP.</p>
              </div>
              <div>
                <span className="text-purple-300 font-bold">DS / SS / ES (0x23) — Data & Stack</span>: 0x2000 - 0xFFFF
                <p className="text-[10px] text-slate-400 mt-1">Flat byte-addressable Data & Stack RAM. ESP initializes to top of RAM (0xFFFC).</p>
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
