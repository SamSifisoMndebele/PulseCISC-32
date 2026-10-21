# PulseCISC-32

> **Interactive 32-Bit Microarchitecture & Full CISC/x86 Assembly Simulator**  
> Built with React 19, TypeScript, Vite, HTML5 Canvas, and Tailwind CSS.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.3-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Opcodes](https://img.shields.io/badge/Instruction_Set-64_Opcodes-emerald)](https://github.com/)
[![Architecture](https://img.shields.io/badge/Architecture-32--Bit_CISC-purple)](https://github.com/)

---

## Overview

**PulseCISC-32** is an interactive, browser-based computer architecture simulation environment designed for computer science education, assembly programming, and microarchitectural exploration.

It provides a complete multi-cycle CPU simulation with real-time visual datapath packet animations, cycle-by-cycle micro-step debugging, live register and memory inspection, and a two-pass assembler supporting **over 90% of classic x86 CISC assembly code** across all fundamental computer architecture concepts.

---

## Key Features

### 1. Live Interactive Microarchitectural Datapath
* **5-Phase FSM Simulation**: Faithfully models the classical multi-cycle CPU finite-state machine: `FETCH` $\to$ `DECODE` $\to$ `EXECUTE` $\to$ `MEMORY` $\to$ `WRITEBACK`.
* **Visual Bus Flows & Particle Animation**: High-performance HTML5 Canvas datapath illustrating bus routing between `EIP`, `IR`, `MAR`, `MDR`, `ALU`, `EFLAGS`, `Latch A`, `Latch B`, `Register File`, and `RAM`.
* **Pan & Zoom Canvas**: Interactive zoom, dragging, and component inspection with architectural explanations.

### 2. Comprehensive 64-Opcode CISC Instruction Set
* **Subroutines & Stack**: Full hardware call stack via `PUSH`, `POP`, `CALL`, and `RET`, supporting stack frames (`EBP`/`ESP`), local variable offsets, and recursion.
* **Multi-Precision Arithmetic**: 4 condition flags (**`ZF`**, **`SF`**, **`OF`**, and **`CF`** Carry/Borrow) with `ADC`, `SBB`, `CLC`, `STC`, and `CMC` for 64-bit and 128-bit multi-precision mathematics.
* **Full Branching & Loops**: Signed relational jumps (`JL`, `JLE`, `JG`, `JGE`), unsigned relational jumps (`JB`, `JBE`, `JA`, `JAE`), flag branches (`JE`/`JZ`, `JNE`/`JNZ`, `JS`/`JNS`, `JO`/`JNO`), and hardware loop counter `LOOP`.
* **Multiplication & Division**: 64-bit unsigned product/dividend routing via $EDX:EAX$ (`MUL`, `DIV`), signed 32-bit math (`IMUL`, `IDIV`), and divide-by-zero CPU exception traps.
* **Bit Shifts & Rotates**: `SHL`/`SAL`, `SHR`, `SAR` (arithmetic sign-preserving right shift), `ROL`, `ROR`, and non-destructive `TEST`.
* **Address Generation & Byte Memory**: Pointer calculations via `LEA reg, [mem]` without RAM access, atomic `XCHG`, and byte-level memory operations via `MOVB` / `MOV BYTE [mem], reg`.
* **Authentic Linux System Calls**: `INT 0x80` dispatching `sys_exit`, `sys_write`, `sys_print_int`, and `sys_print_char`.

### 3. Real-Time Pedagogical Trace & System Console
* **RTL Micro-Op Tracing**: Every clock edge generates both formal Register-Transfer Level (RTL) notation and plain English explanations of microarchitectural operations.
* **Console Terminal**: Built-in I/O log displaying standard outputs, formatted integers, characters, and system call events.

### 4. Segmented 64 KB Memory & Visual Register File
* **Configurable Segmentation**: Standard 8 KB Code Segment (`0x0000 - 0x1FFF`) and 56 KB Data RAM (`0x2000 - 0xFFFF`), customizable up to 64 KB+.
* **Sub-Register Overlays**: Live 32-bit registers (`EAX`-`ESP`), 16-bit sub-registers (`AX`-`SP`), and 8-bit registers (`AL`-`DH`) with authentic aliasing.
* **Memory Grid Viewer**: Hex and ASCII inspection, byte-level mutation tracking, and memory-mapped I/O (MMIO console at `0x0FF0`).

---

## Variable-Length x86 Machine Code Format (1 to 11 Bytes)

PulseCISC-32 encodes instructions into an authentic **variable-length x86 instruction byte stream**:

```
+----------------+---------------+-------------------+-------------------+--------------------+--------------------+
| Prefix (0-1B)  | Opcode (1-2B) |   ModR/M (0-1B)   |    SIB (0-1B)     |   Disp8 / Disp32   |  Imm8 / 16 / 32    |
| REP / OpSize   | Primary / 0Fh | [mod(2)|reg|rm(3)]| [scale|index|base]|   (0, 1, or 4 B)   |  (0, 1, 2, or 4 B) |
+----------------+---------------+-------------------+--------------------+--------------------+--------------------+
```

| Assembly Instruction | Assembled x86 Bytes (Hex) | Size | Description |
| :--- | :--- | :---: | :--- |
| `NOP` / `RET` / `LEAVE` / `CDQ` | `90` / `C3` / `C9` / `99` | **1 B** | Single-byte x86 opcodes |
| `PUSH EBP` / `POP EAX` / `INC ECX` | `55` / `58` / `41` | **1 B** | Register-embedded single-byte opcodes |
| `MOV EBP, ESP` / `ADD EAX, EBX` | `89 E5` / `01 D8` | **2 B** | `Opcode` + `ModR/M (mod=11)` |
| `RET 12` / `SUB ESP, 8` | `C2 0C 00` / `83 EC 08` | **3 B** | `STDCALL` return cleanup / `imm8` ALU |
| `MOV EAX, [EBX + ESI*4 + 16]` | `8B 44 B3 10` | **4 B** | `Opcode` + `ModR/M` + `SIB` + `disp8` |
| `MOV EAX, 0x12345678` | `B8 78 56 34 12` | **5 B** | Full 32-bit immediate load |

---

## High-Level MASM Directives & Complex Addressing

### 1. MASM Directives (`masmPreprocessor.ts`)
* **Module & Model Headers**: `.386`..`.686`, `.MODEL FLAT, STDCALL` (and `C`), `OPTION CASEMAP:NONE`, `.STACK`, `.DATA`, `.CODE`, `END [main]`.
* **Procedures & Automatic Stack Frames**:
  * `MyProc PROC [USES reg1 reg2,] [arg1:DWORD, arg2:DWORD]` ... `MyProc ENDP`
  * `LOCAL var1:DWORD, buffer[16]:BYTE` — automatically generates `PUSH EBP` / `MOV EBP, ESP` / `SUB ESP, N` prologue, maps parameter & local names to `[EBP + offset]` / `[EBP - offset]`, and expands `RET` into `LEAVE` + `RET paramBytes`.
* **`INVOKE` Directive**:
  * `INVOKE MyProc, arg1, arg2, ADDR localVar` — pushes arguments right-to-left, resolves `ADDR` via `LEA` or `OFFSET`, and emits `CALL MyProc` (also supports `INVOKE ExitProcess, status`).
* **Custom Structures (`STRUCT ... ENDS`)**:
  * Defines typed fields, computes byte offsets (`[EBX + ItemRecord.price]`), and supports `<...>` instance initialization in `.DATA`.
* **Structured Control Flow**:
  * `.IF`, `.ELSEIF`, `.ELSE`, `.ENDIF`, `.WHILE`, `.ENDW`, `.REPEAT`, `.UNTIL`, `.BREAK`, `.CONTINUE` with relational operators (`==`, `!=`, `>`, `>=`, `<`, `<=`) and flag tests (`ZERO?`, `CARRY?`, `SIGN?`).
* **Data Allocation & Compile-Time Operators**:
  * `BYTE`/`DB`, `WORD`/`DW`, `DWORD`/`DD`, `DUP(...)`, uninitialized `?`, `EQU` / `=`, `OFFSET`, `SIZEOF`, `LENGTHOF`, `TYPE`.

### 2. Complex Scale-Index-Base (SIB) Addressing
* **Direct & Bare Variable Access**: `[0x2000]`, `[myVar]`, or bare MASM variable `MOV EAX, myVar`.
* **Base + Displacement**: `[EBP + 8]`, `[EBP - 4]`, `[EBX + ItemRecord.price]`.
* **Scaled-Index**: `[ESI * 4]`, `scores[ECX * 4]`.
* **Full SIB (`[Base + Index * Scale + Disp]`)**: `[EBX + ESI*4 + 16]`, `matrix[EBX][ESI*4]`, `[EAX + EDX]` where `Scale` $\in \{1, 2, 4, 8\}$.
* **Size & Segment Qualifiers**: `BYTE PTR`, `WORD PTR`, `DWORD PTR`, and segment overrides `CS:`, `DS:`, `SS:`, `ES:`, `FS:`, `GS:`.

---

## Register Architecture & Segment Selectors

### General-Purpose Registers
| ID | 32-Bit Register | 16-Bit Sub-Register | 8-Bit Low | 8-Bit High | Typical Role |
| :---: | :---: | :---: | :---: | :---: | :--- |
| `0` | **EAX** | `AX` | `AL` | `AH` | Accumulator, Multiply/Divide, Return Value |
| `1` | **EBX** | `BX` | `BL` | `BH` | Base Pointer |
| `2` | **ECX** | `CX` | `CL` | `CH` | Loop & `REP` Counter (`LOOP`, `REP`, shifts) |
| `3` | **EDX** | `DX` | `DL` | `DH` | Data Register, High 32 bits in `MUL`/`DIV`/`CDQ` |
| `4` | **ESI** | `SI` | — | — | Source Index (`MOVSB`/`LODSB`, array indexing) |
| `5` | **EDI** | `DI` | — | — | Destination Index (`MOVSB`/`STOSB`, array indexing) |
| `6` | **EBP** | `BP` | — | — | Stack Frame Base Pointer (`PROC` params & `LOCAL`s) |
| `7` | **ESP** | `SP` | — | — | Stack Pointer (defaults to top of RAM, e.g. `0xFFFC`) |

### Segment Selectors (`.MODEL FLAT` Protected Mode)
* **`CS` (`0x001B`)**: Code Segment Selector
* **`DS` (`0x0023`)**: Data Segment Selector
* **`SS` (`0x0023`)**: Stack Segment Selector
* **`ES` (`0x0023`), `FS` (`0x003B`), `GS` (`0x0000`)**: Extra & Thread Environment Segment Selectors

### Condition & Direction Flags (`EFLAGS`)
* **`ZF` (Zero Flag)**, **`SF` (Sign Flag)**, **`OF` (Overflow Flag)**, **`CF` (Carry Flag)**, and **`DF` (Direction Flag: `0` = forward, `1` = backward for string operations)**.

---

## Instruction Set Summary

| Category | Supported Mnemonics |
| :--- | :--- |
| **Data Movement & Extension** | `MOV`, `MOVB`, `MOVW`, `MOVH`, `MOVZX`, `MOVSX`, `LEA`, `XCHG`, `XADD`, `CMPXCHG`, `BSWAP`, `CMOVcc` (`CMOVE`, `CMOVNE`, `CMOVG`, `CMOVGE`, `CMOVL`, `CMOVLE`, `CMOVA`, `CMOVB`, etc.) |
| **Stack & Procedure Frames** | `PUSH`, `POP`, `PUSHAD`/`PUSHA`, `POPAD`/`POPA`, `PUSHFD`/`PUSHF`, `POPFD`/`POPF`, `CALL`, `RET [imm16]`, `ENTER`, `LEAVE` |
| **Arithmetic & Conversion** | `ADD`, `ADC`, `SUB`, `SBB`, `INC`, `DEC`, `NEG`, `MUL`, `IMUL` (1/2/3-op), `DIV`, `IDIV`, `CBW`, `CWDE`, `CWD`, `CDQ` |
| **Bitwise, Shifts & Bit Scan** | `AND`, `OR`, `XOR`, `NOT`, `TEST`, `CMP`, `SHL`/`SAL`, `SHR`, `SAR`, `ROL`, `ROR`, `BT`, `BTS`, `BTR`, `BTC`, `BSF`, `BSR`, `SETcc` |
| **String & Block Primitives** | `MOVSB`, `MOVSW`, `MOVSD`, `STOSB`, `STOSW`, `STOSD`, `LODSB`, `LODSW`, `LODSD`, `CMPSB`, `CMPSW`, `CMPSD`, `SCASB`, `SCASW`, `SCASD` + `REP`/`REPE`/`REPNE` |
| **Control Flow & Loops** | `JMP`, `JE`/`JZ`, `JNE`/`JNZ`, `JL`, `JLE`, `JG`, `JGE`, `JB`/`JC`, `JBE`, `JA`, `JAE`/`JNC`, `JS`, `JNS`, `JO`, `JNO`, `JECXZ`, `LOOP`, `LOOPE`/`LOOPZ`, `LOOPNE`/`LOOPNZ` |
| **Flags & System Control** | `CLC`, `STC`, `CMC`, `CLD`, `STD`, `LAHF`, `SAHF`, `NOP`, `HLT`, `INT 0x80` / `SYSCALL`, Irvine32 HLE (`WriteString`, `WriteInt`, `DumpRegs`, etc.) |


---

## Project Structure

```
PulseCISC-32/
├── web/
│   ├── public/                 # Static assets & icons
│   ├── src/
│   │   ├── components/         # React UI panels
│   │   │   ├── CanvasView.tsx          # Datapath Canvas container
│   │   │   ├── CodeEditor.tsx          # Multi-pass assembly source editor
│   │   │   ├── MachineCodeView.tsx     # Hex & disassembly inspection
│   │   │   ├── RegisterFileView.tsx    # Live 32/16/8-bit register view
│   │   │   ├── SpecialRegistersView.tsx# EIP, IR, MAR, MDR & EFLAGS
│   │   │   ├── MemoryGridView.tsx      # RAM segmented hex viewer
│   │   │   ├── TraceLogView.tsx        # RTL micro-op execution trace & console
│   │   │   ├── CheatsheetModal.tsx     # Built-in reference manual
│   │   │   ├── SettingsModal.tsx       # Memory & speed preferences
│   │   │   └── Navbar.tsx              # Playback, step, & preset controls
│   │   ├── core/               # Simulation Engine
│   │   │   ├── alu.ts                  # 32-bit ALU with full flag evaluation
│   │   │   ├── assembler.ts            # Two-pass CISC assembler & tokenizer
│   │   │   ├── config.ts               # Storage & segmentation preferences
│   │   │   ├── cpu.ts                  # Multi-cycle FSM CPU engine
│   │   │   ├── disassembler.ts         # Machine word disassembler
│   │   │   ├── isa.ts                  # 64-opcode specification & encodings
│   │   │   ├── memory.ts               # Byte-addressable segmented RAM
│   │   │   └── types.ts                # TypeScript architectural types
│   │   ├── samples/
│   │   │   └── presets.ts              # 13 educational sample assembly programs
│   │   ├── visualizer/         # HTML5 Canvas Datapath Rendering
│   │   │   ├── datapath.ts             # Microarchitectural packet renderer
│   │   │   ├── particles.ts            # Animated bus flow particle system
│   │   │   └── theme.ts                # Visual theme & colors
│   │   ├── App.tsx             # Root application orchestrator
│   │   ├── main.tsx            # Entry point
│   │   └── index.css           # Styling with Tailwind CSS
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```

---

## Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Installation

1. Clone or navigate to the repository:
   ```bash
   cd PulseCISC-32/web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173`.

### Production Build & Verification

To run TypeScript verification and create an optimized production build:
```bash
npm run build
```

To run linting:
```bash
npm run lint
```

---

## Built-in Educational Presets

Explore 13 guided programs accessible directly from the top navigation bar:
1. **Hello Math**: `MOV` & `ADD` register basics.
2. **Subtraction & Flags**: Demonstrates `SF` (Sign Flag) and `ZF` (Zero Flag).
3. **RAM Store & Load**: Memory interaction with `MOV [EBX], EAX`.
4. **Simple Loop**: Conditional branching with `CMP` & `JNE`.
5. **Fibonacci Generator**: Populates array in Data RAM at `0x2000`.
6. **Max in Array**: Pointer iteration and signed comparison `JG`.
7. **String Uppercase**: ASCII conversion using pointer offsets.
8. **Bitwise Masking**: Packing data with `AND`, `OR`, and shifts.
9. **Linux System Calls**: Direct console greeting via `INT 0x80` (`sys_write`).
10. **Subroutines & Call Stack**: Function calls, activation frames (`EBP`), arguments, `CALL` and `RET`.
11. **Recursive Factorial**: Recursive function ($5! = 120$) highlighting hardware stack allocation.
12. **64-Bit Multi-Precision Math**: Large addition using `ADC` and the Carry Flag (`CF`).
13. **Bit Shifts & Masking**: Fast binary powers of 2 using `SHL`, `SAR`, `ROL`, and `TEST`.

---

## License

This project is licensed under the MIT License.
