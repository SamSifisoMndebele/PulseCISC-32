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

## Machine Word Format (32-Bit Fixed Width)

All instructions are encoded into fixed 32-bit (4-byte) little-endian machine words:

```
 31        26 25    23 22    20 19      18     17     16 15                    0
+------------+--------+--------+-------+------+------+------+--------------------+
|   Opcode   | DestReg| SrcReg |Dest16 |Src16 |Direct| Byte |    Imm16 / Offset  |
|   (6 bits) |(3 bits)|(3 bits)| (1 b) |(1 b) |(1 b) |(1 b) |      (16 bits)     |
+------------+--------+--------+-------+------+------+------+--------------------+
```

* **Opcode `[31:26]`**: 6-bit operation code (`0x00` - `0x3F`).
* **DestReg `[25:23]`**: Destination register index (`0` - `7`).
* **SrcReg `[22:20]`**: Source register or base address register index (`0` - `7`).
* **DestIs16 `[19]`**: `1` if destination is 16-bit sub-register (`AX`..`SP`).
* **SrcIs16 `[18]`**: `1` if source is 16-bit sub-register or immediate shift flag.
* **IsDirectMem `[17]`**: `1` for direct address displacement (`[0x2000]`).
* **IsByte `[16]`**: `1` for 8-bit byte transfers (`MOVB`, `AL`..`DH`).
* **Imm16 `[15:0]`**: 16-bit signed immediate operand or memory displacement offset.
* *Jump Instructions (`JMP`, `CALL`, `JE`, etc.) use bits `[25:0]` to encode target word addresses.*

---

## Register Architecture

The processor contains 8 general-purpose 32-bit registers with authentic x86 aliasing:

| ID | 32-Bit Register | 16-Bit Sub-Register | 8-Bit Low | 8-Bit High | Typical Role |
| :---: | :---: | :---: | :---: | :---: | :--- |
| `0` | **EAX** | `AX` | `AL` | `AH` | Accumulator, Multiplication/Division, Syscall Service / Return |
| `1` | **EBX** | `BX` | `BL` | `BH` | Base Pointer, Syscall Argument 1 |
| `2` | **ECX** | `CX` | `CL` | `CH` | Loop Counter (`LOOP`, shift count), Syscall Argument 2 |
| `3` | **EDX** | `DX` | `DL` | `DH` | Data Register, High 32 bits in `MUL`/`DIV`, Syscall Argument 3 |
| `4` | **ESI** | `SI` | — | — | Source Index (string & array operations) |
| `5` | **EDI** | `DI` | — | — | Destination Index (string & array operations) |
| `6` | **EBP** | `BP` | — | — | Stack Frame Base Pointer |
| `7` | **ESP** | `SP` | — | — | Stack Pointer (defaults to top of RAM, e.g. `0xFFFC`) |

---

## Condition Codes (`EFLAGS`)

The CPU evaluates 4 architectural condition flags on arithmetic and comparison operations:

* **`ZF` (Zero Flag)**: Set to `1` when an operation result is zero (`0`).
* **`SF` (Sign Flag)**: Set to `1` when the most significant bit (bit 31) is `1` (negative in two's complement).
* **`OF` (Overflow Flag)**: Set to `1` on signed two's complement arithmetic overflow.
* **`CF` (Carry Flag)**: Set to `1` on unsigned overflow or borrow; controlled directly via `CLC`, `STC`, and `CMC`.

---

## Complete Instruction Set Reference (64 Opcodes)

### 1. Data Movement & Memory
| Mnemonic | Opcode | Syntax | Description |
| :--- | :---: | :--- | :--- |
| `MOV` | `0x01` | `MOV reg, reg` | Copy 32/16/8-bit register |
| `MOV` | `0x02` | `MOV reg, imm` | Load 16-bit immediate constant |
| `MOV` | `0x03` | `MOV reg, [mem]` | Load 32-bit word from memory (`[reg]`, `[reg + offset]`, `[addr]`) |
| `MOV` | `0x04` | `MOV [mem], reg` | Store 32-bit word to memory |
| `MOVH` | `0x14` | `MOVH reg, imm` | Load upper 16 bits of register (`reg[31:16] = imm`) |
| `MOVB` | `0x3D` | `MOVB reg, [mem]` | Load 8-bit byte from RAM (zero-extended) |
| `MOVB` | `0x3E` | `MOVB [mem], reg` | Store 8-bit byte to RAM (`MOV BYTE [mem], reg`) |
| `LEA` | `0x28` | `LEA reg, [mem]` | Load Effective Address (pointer calculation without RAM read) |
| `XCHG` | `0x29` | `XCHG reg, reg` | Atomically swap two register values |

### 2. Stack & Subroutines (Function Calls)
| Mnemonic | Opcode | Syntax | Description |
| :--- | :---: | :--- | :--- |
| `PUSH` | `0x26` | `PUSH reg / imm` | Decrement `ESP` by 4, write value to `RAM[ESP]` |
| `POP` | `0x27` | `POP reg` | Read value from `RAM[ESP]`, increment `ESP` by 4 |
| `CALL` | `0x24` | `CALL target` | Push return address (`EIP`) to stack and branch to subroutine |
| `RET` | `0x25` | `RET` | Pop return address from stack into `EIP` |

### 3. Arithmetic Operations
| Mnemonic | Opcode | Syntax | Description | Flags |
| :--- | :---: | :--- | :--- | :---: |
| `ADD` | `0x05 / 0x06` | `ADD dest, src/imm` | Addition: `dest = dest + src` | `ZF, SF, OF, CF` |
| `ADC` | `0x30 / 0x31` | `ADC dest, src/imm` | Add with Carry: `dest = dest + src + CF` | `ZF, SF, OF, CF` |
| `SUB` | `0x07 / 0x08` | `SUB dest, src/imm` | Subtraction: `dest = dest - src` | `ZF, SF, OF, CF` |
| `SBB` | `0x32 / 0x33` | `SBB dest, src/imm` | Subtract with Borrow: `dest = dest - src - CF` | `ZF, SF, OF, CF` |
| `INC` | `0x2A` | `INC reg` | Increment register by 1 (preserves `CF`) | `ZF, SF, OF` |
| `DEC` | `0x2B` | `DEC reg` | Decrement register by 1 (preserves `CF`) | `ZF, SF, OF` |
| `NEG` | `0x2C` | `NEG reg` | Two's complement negation: `reg = 0 - reg` | `ZF, SF, OF, CF` |
| `MUL` | `0x39` | `MUL src` | Unsigned multiply: `EDX:EAX = EAX * src` | `CF, OF, ZF, SF` |
| `IMUL` | `0x39` | `IMUL reg, reg/imm`| Signed 32-bit multiply: `dest = dest * src` | `CF, OF, ZF, SF` |
| `DIV` | `0x3A` | `DIV src` | Unsigned divide: `EAX = quot, EDX = rem` | Traps `#DE` on 0 |
| `IDIV` | `0x3B` | `IDIV src` | Signed divide: `EAX = quot, EDX = rem` | Traps `#DE` on 0 |

### 4. Logic, Shifts & Comparisons
| Mnemonic | Opcode | Syntax | Description | Flags |
| :--- | :---: | :--- | :--- | :---: |
| `AND` | `0x09 / 0x0A` | `AND dest, src/imm` | Bitwise AND | `ZF, SF` (`CF=0, OF=0`) |
| `OR` | `0x0B / 0x0C` | `OR dest, src/imm` | Bitwise OR | `ZF, SF` (`CF=0, OF=0`) |
| `XOR` | `0x0D / 0x0E` | `XOR dest, src/imm` | Bitwise XOR (`XOR EAX, EAX` zeroes reg) | `ZF, SF` (`CF=0, OF=0`) |
| `NOT` | `0x2D` | `NOT reg` | Bitwise inversion (one's complement) | None |
| `CMP` | `0x0F / 0x10` | `CMP dest, src/imm` | Non-destructive `dest - src`, sets condition flags | `ZF, SF, OF, CF` |
| `TEST` | `0x2E / 0x2F` | `TEST dest, src/imm`| Non-destructive `dest & src`, sets condition flags | `ZF, SF` (`CF=0, OF=0`) |
| `SHL` / `SAL` | `0x34` | `SHL reg, imm/CL` | Logical shift left (multiplies by $2^n$) | `CF, OF, ZF, SF` |
| `SHR` | `0x35` | `SHR reg, imm/CL` | Logical shift right (zero-fill high bits) | `CF, OF, ZF, SF` |
| `SAR` | `0x36` | `SAR reg, imm/CL` | Arithmetic shift right (preserves sign bit) | `CF, OF, ZF, SF` |
| `ROL` | `0x37` | `ROL reg, imm/CL` | Rotate bits left | `CF, OF` |
| `ROR` | `0x38` | `ROR reg, imm/CL` | Rotate bits right | `CF, OF` |

### 5. Control Flow & Branching
| Mnemonic | Opcode | Condition / Test | Semantics |
| :--- | :---: | :--- | :--- |
| `JMP` | `0x13` | Always taken | Unconditional jump |
| `LOOP` | `0x23` | `ECX = ECX - 1; ECX != 0` | Hardware loop iteration |
| `JE` / `JZ` | `0x11` | `ZF == 1` | Jump if Equal / Zero |
| `JNE` / `JNZ` | `0x12` | `ZF == 0` | Jump if Not Equal / Non-Zero |
| `JL` / `JNGE` | `0x17` | `SF != OF` | Jump if Less (Signed) |
| `JLE` / `JNG` | `0x18` | `ZF == 1 || SF != OF` | Jump if Less or Equal (Signed) |
| `JG` / `JNLE` | `0x19` | `ZF == 0 && SF == OF` | Jump if Greater (Signed) |
| `JGE` / `JNL` | `0x1A` | `SF == OF` | Jump if Greater or Equal (Signed) |
| `JB` / `JC` | `0x1B` | `CF == 1` | Jump if Below / Carry (Unsigned) |
| `JBE` / `JNA` | `0x1C` | `CF == 1 || ZF == 1` | Jump if Below or Equal (Unsigned) |
| `JA` / `JNBE` | `0x1D` | `CF == 0 && ZF == 0` | Jump if Above (Unsigned) |
| `JAE` / `JNC` | `0x1E` | `CF == 0` | Jump if Above or Equal / No Carry (Unsigned) |
| `JS` | `0x1F` | `SF == 1` | Jump if Sign (Negative) |
| `JNS` | `0x20` | `SF == 0` | Jump if Not Sign (Positive) |
| `JO` | `0x21` | `OF == 1` | Jump if Overflow |
| `JNO` | `0x22` | `OF == 0` | Jump if No Overflow |

### 6. Flags & Processor Control
| Mnemonic | Opcode | Syntax | Description |
| :--- | :---: | :--- | :--- |
| `NOP` | `0x00` | `NOP` | No operation |
| `CLC` | `0x3C` | `CLC` | Clear Carry Flag (`CF = 0`) |
| `STC` | `0x3C` | `STC` | Set Carry Flag (`CF = 1`) |
| `CMC` | `0x3C` | `CMC` | Complement Carry Flag (`CF = !CF`) |
| `PRINT` | `0x15` | `PRINT reg / imm` | Print decimal & hex to console |
| `INT 0x80` | `0x16` | `INT 0x80` | Trigger kernel system call |
| `HLT` | `0x3F` | `HLT` | Freeze CPU clock |

---

## Authentic Linux System Calls (`INT 0x80`)

The simulator implements real Linux x86 kernel services invoked with `INT 0x80`:

| `EAX` Value | Service | Arguments | Description |
| :---: | :--- | :--- | :--- |
| **`1`** | `sys_exit` | `EBX: exit_code` | Halts execution and prints termination status. |
| **`4`** | `sys_write` | `EBX: fd`<br>`ECX: buf_addr`<br>`EDX: count` | Writes string from RAM to standard output (`fd=1`) or error (`fd=2`). Returns bytes written in `EAX`. |
| **`5`** | `sys_print_int` | `EBX: value` | Outputs signed integer and hex representation to console. |
| **`11`** | `sys_print_char`| `EBX: ascii_code` | Outputs single ASCII character to console. |

---

## Assembler Directives

Supported for static data segment layout:

* **`DB` / `BYTE`**: Define 8-bit bytes or strings (`msg: DB "Hello, world!\n", 0` or `nums: DB 1, 2, 3`).
* **`DW` / `WORD`**: Define 16-bit words (little-endian).
* **`DD`**: Define 32-bit double words (little-endian).
* **`section .data` / `section .text`**: Section demarcations (cleanly parsed and mapped).

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
