// PulseCISC-32 Preset Assembly Programs
// Ordered from beginner-friendly basics to intermediate algorithms

export interface ProgramPreset {
  id: string;
  name: string;
  description: string;
  code: string;
  isCustom?: boolean;
  updatedAt?: number;
}

const USER_PROGRAMS_STORAGE_KEY = 'pulsecisc_user_programs';
const ACTIVE_SESSION_STORAGE_KEY = 'pulsecisc_active_session';

export interface ActiveProgramSession {
  selectedPresetId: string;
  code: string;
}

export const DEFAULT_CUSTOM_PROGRAM_TEMPLATE = `; Custom x86 Assembly Program
; Uses Irvine32 library routines for console I/O
INCLUDE Irvine32.inc

.data
  msg BYTE "Calculation Result: ", 0

.code
main PROC
  MOV EAX, 10         ; Load 10 into EAX
  MOV EBX, 20         ; Load 20 into EBX
  ADD EAX, EBX        ; EAX = EAX + EBX (30)

  MOV EDX, OFFSET msg ; Load string address
  CALL WriteString    ; Print prompt to Console!
  CALL WriteInt       ; Output result (+30) to Console!
  CALL Crlf           ; Print newline

  exit                ; Halt CPU execution
main ENDP
END main
`;

export function loadUserPrograms(): ProgramPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_PROGRAMS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ProgramPreset =>
          item &&
          typeof item.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.code === 'string'
      )
      .map((item) => ({
        ...item,
        description: item.description || 'User custom program saved in local storage.',
        isCustom: true,
      }));
  } catch {
    return [];
  }
}

export function saveUserPrograms(programs: ProgramPreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_PROGRAMS_STORAGE_KEY, JSON.stringify(programs));
  } catch (err) {
    console.error('Failed to persist user programs to localStorage:', err);
  }
}

export function loadActiveSession(): ActiveProgramSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.selectedPresetId === 'string' &&
      typeof parsed.code === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveActiveSession(session: ActiveProgramSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota errors
  }
}

export function getShortProgramName(name: string): string {
  const dashIdx = name.lastIndexOf(' - ');
  return dashIdx !== -1 ? name.slice(0, dashIdx) : name;
}

export const PRESETS: ProgramPreset[] = [
  // --- Beginner Examples ---
  {
    id: 'hello_add',
    name: '1. Hello Math (MOV & ADD) - Beginner',
    description: 'The simplest introduction: loads numbers into EAX and EBX, adds them, and prints the result using Irvine32 WriteString & WriteInt.',
    code: `; PulseCISC-32: Introductory Lesson 1
; Learn how CPU registers and addition work with Irvine32
INCLUDE Irvine32.inc

.data
  prompt BYTE "5 + 7 = ", 0

.code
main PROC
  MOV EAX, 5          ; Load number 5 into register EAX
  MOV EBX, 7          ; Load number 7 into register EBX
  ADD EAX, EBX        ; EAX = EAX + EBX (5 + 7 = 12)

  MOV EDX, OFFSET prompt
  CALL WriteString    ; Print prompt to Console!
  CALL WriteInt       ; Print the calculated result (+12)!
  CALL Crlf           ; Print newline
  exit                ; Halt processor clock
main ENDP
END main
`,
  },
  {
    id: 'sub_flags',
    name: '2. Subtraction & Flags (SF & ZF) - Beginner',
    description: 'Demonstrates subtraction resulting in a negative number (Sign Flag / SF) and adding back to zero (Zero Flag / ZF).',
    code: `; PulseCISC-32: Introductory Lesson 2
; Learn subtraction and watch EFLAGS in action
INCLUDE Irvine32.inc

.data
  msgSub BYTE "15 - 20 = ", 0
  msgAdd BYTE "-5 + 5  = ", 0

.code
main PROC
  MOV EAX, 15         ; EAX = 15
  SUB EAX, 20         ; EAX = 15 - 20 = -5
  MOV EDX, OFFSET msgSub
  CALL WriteString
  CALL WriteInt       ; Output -5 to Console
  CALL Crlf
  ; Notice that the SF (Sign Flag) badge turns GREEN!

  ADD EAX, 5          ; EAX = -5 + 5 = 0
  MOV EDX, OFFSET msgAdd
  CALL WriteString
  CALL WriteInt       ; Output 0 to Console
  CALL Crlf
  ; Notice that the ZF (Zero Flag) badge turns GREEN!

  exit                ; Execution finished
main ENDP
END main
`,
  },
  {
    id: 'ram_basics',
    name: '3. RAM Store & Load (Memory) - Beginner',
    description: 'Demonstrates storing a value into Data RAM and loading it back into another register.',
    code: `; PulseCISC-32: Introductory Lesson 3
; Learn how the CPU interacts with 64 KB RAM (Data Segment starts at 0x2000)
INCLUDE Irvine32.inc

.data
  resultMsg BYTE "Loaded from RAM: ", 0, 0, 0, 0
  myData    DWORD 0

.code
main PROC
  MOV EAX, 42         ; Put the answer (42) into EAX
  MOV EBX, OFFSET myData ; Set EBX to point to Data RAM address

  MOV [EBX], EAX      ; Store word: RAM[myData] = 42
  ; Watch the purple Memory phase animate into Data RAM!

  MOV ECX, [EBX]      ; Load word: ECX = RAM[myData]
  MOV EDX, OFFSET resultMsg
  CALL WriteString
  MOV EAX, ECX
  CALL WriteInt       ; Output loaded value (+42) to Console!
  CALL Crlf

  exit                ; Done
main ENDP
END main
`,
  },
  {
    id: 'countdown_loop',
    name: '4. Simple Loop (CMP & JNE) - Beginner',
    description: 'A 3-step countdown loop illustrating conditional branching using CMP and JNE.',
    code: `; PulseCISC-32: Introductory Lesson 4
; Learn loops: Count down from 3 to 1
INCLUDE Irvine32.inc

.data
  liftoffMsg BYTE "Liftoff!", 0

.code
main PROC
  MOV ECX, 3          ; Set loop counter to 3

count_loop:
  MOV EAX, ECX
  CALL WriteInt       ; Print current count to Console
  CALL Crlf
  SUB ECX, 1          ; Decrement counter: ECX = ECX - 1
  CMP ECX, 0          ; Compare counter with 0
  JNE count_loop      ; Jump if Not Equal to 0

  MOV EDX, OFFSET liftoffMsg
  CALL WriteString    ; Final liftoff message!
  CALL Crlf
  exit
main ENDP
END main
`,
  },

  // --- Intermediate & Advanced Programs ---
  {
    id: 'fibonacci',
    name: '5. Fibonacci Sequence - Intermediate',
    description: 'Computes first 8 Fibonacci numbers and writes them consecutively into Data RAM at 0x2000.',
    code: `; PulseCISC-32: Fibonacci Sequence Generator
; Computes first 8 Fibonacci numbers into Data RAM at 0x2000
INCLUDE Irvine32.inc

.code
main PROC
  MOV EAX, 0          ; Fib(0) = 0
  MOV EBX, 1          ; Fib(1) = 1
  MOV ECX, 8          ; Total numbers to generate
  MOV ESI, 0x2000     ; Data RAM pointer (0x2000)

fib_loop:
  CALL WriteInt       ; Print each Fibonacci number to Console
  CALL Crlf
  MOV [ESI], EAX    ; Store current number into memory
  ADD ESI, 4        ; Advance memory pointer by 4 bytes
  MOV EDX, EAX      ; Temp copy of a
  ADD EDX, EBX      ; Next = a + b
  MOV EAX, EBX      ; a = b
  MOV EBX, EDX      ; b = Next
  SUB ECX, 1        ; Decrement counter
  CMP ECX, 0        ; Compare counter with 0
  JNE fib_loop      ; If counter != 0, repeat loop

  exit              ; Execution finished!
main ENDP
END main
`,
  },
  {
    id: 'factorial',
    name: '6. Factorial Calculator - Intermediate',
    description: 'Computes factorial N! iteratively (5! = 120) using CMP and conditional branching.',
    code: `; PulseCISC-32: Factorial Calculator
; Computes 5! = 120 (0x78) into EAX
INCLUDE Irvine32.inc

.data
  factMsg BYTE "5! = ", 0

.code
main PROC
  MOV EAX, 1          ; Accumulator result = 1
  MOV EBX, 5          ; N = 5
  MOV EDX, 0x2020     ; Result memory address (0x2020)

fact_loop:
  CMP EBX, 1        ; Check if N <= 1
  JE fact_done      ; If N == 1, jump to done

  ; Multiply EAX by EBX via repeated addition
  MOV ECX, EBX      ; Loop counter for addition
  MOV ESI, 0        ; Partial product

mult_loop:
  ADD ESI, EAX      ; Add EAX
  SUB ECX, 1        ; Counter--
  CMP ECX, 0
  JNE mult_loop

  MOV EAX, ESI      ; EAX = EAX * EBX
  SUB EBX, 1        ; EBX--
  JMP fact_loop     ; Next factorial iteration

fact_done:
  MOV [EDX], EAX    ; Store final factorial (120) in RAM[0x2020]
  MOV EDX, OFFSET factMsg
  CALL WriteString
  CALL WriteInt     ; Output final factorial result (+120) to Console!
  CALL Crlf
  exit
main ENDP
END main
`,
  },
  {
    id: 'arraySum',
    name: '7. Array Summation - Intermediate',
    description: 'Initializes an array in Data RAM at 0x2000, computes the sum in EAX, and stores the total at 0x2020.',
    code: `; PulseCISC-32: Array Summation
; Writes [10, 20, 30, 40] into RAM at 0x2000, then sums them
INCLUDE Irvine32.inc

.data
  sumMsg BYTE "Array Sum = ", 0

.code
main PROC
  ; Step 1: Initialize array at 0x2000
  MOV ESI, 0x2000
  MOV EAX, 10
  MOV [ESI], EAX
  MOV EAX, 20
  MOV [ESI + 4], EAX
  MOV EAX, 30
  MOV [ESI + 8], EAX
  MOV EAX, 40
  MOV [ESI + 12], EAX

  ; Step 2: Sum the array
  MOV EAX, 0          ; Sum accumulator = 0
  MOV ECX, 4          ; Count = 4
  MOV ESI, 0x2000     ; Reset pointer

sum_loop:
  MOV EBX, [ESI]    ; Load word from array
  ADD EAX, EBX      ; Sum += element
  ADD ESI, 4        ; Advance pointer
  SUB ECX, 1        ; Count--
  CMP ECX, 0
  JNE sum_loop

  ; Store result sum (100 = 0x64) at 0x2020
  MOV [0x2020], EAX
  MOV EDX, OFFSET sumMsg
  CALL WriteString
  CALL WriteInt       ; Print sum (+100) to Console!
  CALL Crlf
  exit
main ENDP
END main
`,
  },
  {
    id: 'bitwise',
    name: '8. Bitwise Logic & Sub-Registers - Advanced',
    description: 'Demonstrates XOR register clearing, AND/OR bitmasking, and 16-bit sub-register manipulation.',
    code: `; PulseCISC-32: Bitwise Logic & Sub-Registers
; Demonstrates classic x86 idioms
INCLUDE Irvine32.inc

.code
main PROC
  ; 1. Classic zeroing idiom
  XOR EAX, EAX        ; EAX = 0 (EFLAGS ZF = 1)

  ; 2. 16-bit sub-register write
  MOVH EAX, 0x1234    ; Load upper 16 bits
  MOV AX, 0x5678      ; Load lower 16 bits (EAX is now 0x12345678)
  CALL WriteHex       ; Print 12345678h
  CALL Crlf

  ; 3. Bitmasking with AND and OR
  MOV EBX, 0x00FF     ; Mask
  AND EBX, EAX        ; EBX = 0x0078 (low byte)
  MOV EAX, EBX
  CALL WriteHex       ; Print 00000078h
  CALL Crlf

  MOV ECX, 0x0F00     ; Bitmask to set
  OR  ECX, EBX        ; ECX = 0x0F78
  MOV EAX, ECX
  CALL WriteHex       ; Print 00000F78h
  CALL Crlf

  ; 4. Store results to Data RAM at 0x2000
  MOV [0x2000], EAX
  MOV [0x2004], EBX
  MOV [0x2008], ECX
  exit
main ENDP
END main
`,
  },
  {
    id: 'syscalls_db',
    name: '9. System Calls (INT 0x80 & DB) - Authentic x86',
    description: 'Real OS interface: uses INT 0x80 (sys_write and sys_exit) with DB string storage in Data RAM (0x2000).',
    code: `; PulseCISC-32: Authentic Linux x86 System Calls
; System calls invoke the OS kernel via INT 0x80:
;   EAX = 4 : sys_write (EBX=fd, ECX=buffer_ptr, EDX=byte_count)
;   EAX = 5 : sys_print_int (EBX=value)
;   EAX = 1 : sys_exit  (EBX=exit_code)

; --- 1. sys_write: Print greeting string to stdout ---
MOV EAX, 4          ; System call number 4: sys_write
MOV EBX, 1          ; File descriptor 1: stdout (standard terminal)
MOV ECX, msg        ; Memory pointer to string in Data RAM (0x2000)
MOV EDX, 22         ; String byte length
INT 0x80            ; Trigger kernel interrupt!

; --- 2. sys_print_int: Print a calculated integer ---
MOV EAX, 5          ; Syscall 5: sys_print_int
MOV EBX, 2026       ; Value to print
INT 0x80

; --- 3. sys_exit: Terminate program cleanly ---
MOV EAX, 1          ; System call number 1: sys_exit
MOV EBX, 0          ; Return status code 0 (success)
INT 0x80            ; Process exits cleanly!

; --- Data Segment (Loaded into RAM at 0x2000) ---
msg: DB "Hello from INT 0x80!", 0
`,
  },
  {
    id: 'function_call_stack',
    name: '10. Subroutines & Call Stack (CALL & RET) - CPU Concept',
    description: 'Hardware stack and activation frames: uses PUSH, POP, CALL, and RET with standard calling convention.',
    code: `; PulseCISC-32: Function Calls & Stack Frames
; Demonstrates hardware stack operations:
; 1. Caller pushes arguments to stack
; 2. CALL pushes return address (EIP) and jumps
; 3. Callee sets up stack frame using EBP
; 4. RET pops return address back into EIP
INCLUDE Irvine32.inc

.data
  resultMsg BYTE "Sum = ", 0

.code
main PROC
  MOV EAX, 15         ; Argument 1: a = 15
  MOV EBX, 27         ; Argument 2: b = 27
  PUSH EBX            ; Push arg 2
  PUSH EAX            ; Push arg 1

  CALL add_numbers    ; Call function! (pushes return EIP)
  ADD ESP, 8          ; Clean up 2 arguments from stack (8 bytes)

  MOV EDX, OFFSET resultMsg
  CALL WriteString
  CALL WriteInt       ; Result returned in EAX (15 + 27 = +42)
  CALL Crlf
  exit                ; End of main
main ENDP

add_numbers PROC
  PUSH EBP            ; Save caller's base pointer
  MOV EBP, ESP        ; Set up current stack frame

  MOV EAX, [EBP + 8]  ; Load arg 1 (15)
  MOV EDX, [EBP + 12] ; Load arg 2 (27)
  ADD EAX, EDX        ; EAX = 15 + 27 = 42

  MOV ESP, EBP        ; Restore stack pointer
  POP EBP             ; Restore caller's base pointer
  RET                 ; Return to caller!
add_numbers ENDP
END main
`,
  },
  {
    id: 'recursive_factorial',
    name: '11. Recursive Functions (Stack Depth) - CPU Concept',
    description: 'Recursive Factorial (5! = 120): demonstrates stack growth, activation records, and base condition testing.',
    code: `; PulseCISC-32: Recursive Factorial (5! = 120)
; Demonstrates recursion and stack memory allocation
INCLUDE Irvine32.inc

.data
  factMsg BYTE "Recursive 5! = ", 0

.code
main PROC
  MOV EAX, 5          ; Calculate 5!
  PUSH EAX            ; Pass n = 5
  CALL factorial
  ADD ESP, 4          ; Clean argument

  MOV EDX, OFFSET factMsg
  CALL WriteString
  CALL WriteInt       ; Prints +120 (5!)
  CALL Crlf
  exit
main ENDP

factorial PROC
  PUSH EBP
  MOV EBP, ESP

  MOV EBX, [EBP + 8]  ; EBX = n
  CMP EBX, 1          ; Base case: if n <= 1, return 1
  JLE base_case

  ; Recursive case: return n * factorial(n - 1)
  DEC EBX             ; n - 1
  PUSH EBX
  CALL factorial      ; Recursive call!
  ADD ESP, 4          ; Clean argument (EAX now has factorial(n-1))

  MOV EBX, [EBP + 8]  ; Reload n
  IMUL EAX, EBX       ; EAX = factorial(n-1) * n
  JMP fact_done

base_case:
  MOV EAX, 1          ; 1! = 1

fact_done:
  MOV ESP, EBP
  POP EBP
  RET
factorial ENDP
END main
`,
  },
  {
    id: 'multi_precision_adc',
    name: '12. 64-bit Multi-Precision Math (ADC & CF) - CPU Concept',
    description: 'Multi-precision 64-bit addition using 32-bit registers, demonstrating the Carry Flag (CF) and ADC instruction.',
    code: `; PulseCISC-32: 64-Bit Addition using 32-Bit ALU
; Demonstrates Carry Flag (CF) propagation:
; Number A: 0x00000001_FFFFFFFF (8,589,934,591)
; Number B: 0x00000000_00000001 (1)
; Sum:      0x00000002_00000000 (8,589,934,592)
INCLUDE Irvine32.inc

.data
  msgLow  BYTE "Low 32 bits:  ", 0
  msgHigh BYTE "High 32 bits: ", 0

.code
main PROC
  CLC                   ; Clear carry flag (CF = 0)

  ; Lower 32 bits: 0xFFFFFFFF + 0x00000001 = 0x00000000 (CF = 1!)
  MOV EAX, 0xFFFFFFFF
  MOV EBX, 0x00000001
  ADD EAX, EBX          ; EAX = 0, Carry Flag (CF) turns ON!
  MOV EDX, OFFSET msgLow
  CALL WriteString
  CALL WriteHex         ; Output low 32 bits (00000000h)
  CALL Crlf

  ; Upper 32 bits: 0x00000001 + 0x00000000 + Carry (1) = 0x00000002
  MOV ECX, 0x00000001
  MOV EDX, 0x00000000
  ADC ECX, EDX          ; ECX = 1 + 0 + CF(1) = 2
  MOV EDX, OFFSET msgHigh
  CALL WriteString
  MOV EAX, ECX
  CALL WriteHex         ; Output high 32 bits (00000002h)
  CALL Crlf

  exit
main ENDP
END main
`,
  },
  {
    id: 'bit_shifts_twiddling',
    name: '13. Bit Shifts & Masking (SHL, SAR, TEST) - CPU Concept',
    description: 'Fast binary arithmetic and bit twiddling: SHL (x4), SAR (/2 signed), ROL, and TEST non-destructive masking.',
    code: `; PulseCISC-32: Bit Shifts & Masking
; Demonstrates arithmetic shifts and bitwise manipulation
INCLUDE Irvine32.inc

.code
main PROC
  ; 1. Fast multiplication by 4 via SHL (shift left by 2)
  MOV EAX, 12           ; 12 in binary: 0000 1100
  SHL EAX, 2            ; 12 * 4 = 48
  CALL WriteInt         ; Output +48
  CALL Crlf

  ; 2. Fast division of negative number via SAR (preserves sign!)
  MOV EBX, -16          ; -16
  SAR EBX, 1            ; -16 / 2 = -8 (sign bit preserved)
  MOV EAX, EBX
  CALL WriteInt         ; Output -8
  CALL Crlf

  ; 3. Rotate bits (ROL)
  MOV ECX, 0x0000000F   ; Lower 4 bits set
  ROL ECX, 4            ; Rotate into next nibble: 0x000000F0
  MOV EAX, ECX
  CALL WriteHex         ; Output 000000F0h
  CALL Crlf

  ; 4. Non-destructive bit testing (TEST)
  TEST ECX, 0x000000F0  ; AND without modifying ECX; sets ZF=0
  JNE bit_set
  MOV EAX, 0
  CALL WriteInt
  CALL Crlf
  exit

bit_set:
  MOV EAX, 1            ; Bit was set!
  CALL WriteInt         ; Output +1
  CALL Crlf
  exit
main ENDP
END main
`,
  },
  {
    id: 'masm_proc_invoke',
    name: '14. PROC, LOCAL & INVOKE (.MODEL FLAT) - MASM Style',
    description: 'Authentic 32-bit MASM syntax: uses .MODEL FLAT, STDCALL, PROC with typed parameters, LOCAL stack variables, and INVOKE.',
    code: `; PulseCISC-32: Authentic MASM Procedure & INVOKE Demo
INCLUDE Irvine32.inc
.386
.MODEL FLAT, STDCALL
OPTION CASEMAP:NONE

.DATA
  baseScore DWORD 25
  bonus     DWORD 15
  totalMsg  BYTE "Total Score = ", 0

.CODE
; Procedure with STDCALL parameters and LOCAL stack variable
ComputeTotal PROC USES ebx, a:DWORD, b:DWORD, mult:DWORD
  LOCAL partialSum:DWORD

  MOV EAX, a            ; Resolves to [EBP + 8]
  ADD EAX, b            ; Resolves to [EBP + 12]
  MOV partialSum, EAX   ; Resolves to [EBP - 4]

  MOV EBX, mult         ; Resolves to [EBP + 16]
  MOV EAX, partialSum
  IMUL EAX, EBX         ; (25 + 15) * 3 = 120
  RET                   ; Auto-restores EBX, LEAVE, and RET 12
ComputeTotal ENDP

main PROC
  INVOKE ComputeTotal, baseScore, bonus, 3
  MOV EDX, OFFSET totalMsg
  CALL WriteString
  CALL WriteInt         ; Outputs +120
  CALL Crlf
  INVOKE ExitProcess, 0
main ENDP
END main
`,
  },
  {
    id: 'masm_struct_sib',
    name: '15. STRUCT & Complex SIB Addressing - MASM Style',
    description: 'Demonstrates STRUCT ... ENDS field offsets, DUP array initialization, and Scale-Index-Base [EBX + ESI*4] addressing.',
    code: `; PulseCISC-32: MASM STRUCT & Scale-Index-Base (SIB) Addressing
INCLUDE Irvine32.inc
.386
.MODEL FLAT, STDCALL

; Define a custom structure (12 bytes total)
ItemRecord STRUCT
  id    DWORD 0
  price DWORD 0
  qty   DWORD 0
ItemRecord ENDS

.DATA
  myItem ItemRecord <101, 45, 4>
  scores DWORD 10, 20, 30, 40

.CODE
main PROC
  ; 1. Access STRUCT fields via base register + Struct.field offset
  MOV EBX, OFFSET myItem
  MOV EAX, [EBX + ItemRecord.price]   ; [EBX + 4] = 45
  IMUL EAX, [EBX + ItemRecord.qty]    ; 45 * 4 = 180
  CALL WriteInt                       ; Prints +180
  CALL Crlf

  ; 2. Full Scale-Index-Base (SIB) array sum: [EBX + ESI*4]
  MOV EBX, OFFSET scores
  XOR ESI, ESI                        ; Index ESI = 0
  XOR EAX, EAX                        ; Sum EAX = 0
  MOV ECX, LENGTHOF scores            ; ECX = 4 elements

sib_loop:
  ADD EAX, [EBX + ESI*4]              ; SIB Addressing: Base + Index * 4
  INC ESI
  LOOP sib_loop

  CALL WriteInt                       ; Prints +100 (10+20+30+40)
  CALL Crlf
  exit
main ENDP
END main
`,
  },
  {
    id: 'masm_structured_control',
    name: '16. Structured Control (.IF, .ELSE, .WHILE) - MASM Style',
    description: 'Uses high-level MASM structured directives (.WHILE, .IF, .ELSE, .ENDIF) that automatically compile into CMP and conditional jumps.',
    code: `; PulseCISC-32: MASM Structured Control Directives (.IF / .WHILE)
INCLUDE Irvine32.inc
.386
.MODEL FLAT, STDCALL

MAX_LIMIT = 6

.DATA
  totalEven DWORD 0
  totalOdd  DWORD 0

.CODE
main PROC
  MOV ECX, 1

  .WHILE ECX <= MAX_LIMIT
    MOV EAX, ECX
    AND EAX, 1

    .IF EAX == 0
      ADD totalEven, ECX    ; 2 + 4 + 6 = 12
    .ELSE
      ADD totalOdd, ECX     ; 1 + 3 + 5 = 9
    .ENDIF

    INC ECX
  .ENDW

  MOV EAX, totalEven
  CALL WriteInt             ; Prints +12
  CALL Crlf
  MOV EAX, totalOdd
  CALL WriteInt             ; Prints +9
  CALL Crlf
  exit
main ENDP
END main
`,
  },
  {
    id: 'x86_string_ops',
    name: '17. REP MOVSD, STOSD, CMOV & BSWAP - x86 Primitives',
    description: 'Hardware block memory operations (CLD, REP STOSD, REP MOVSD), conditional move (CMOVG), and endianness swap (BSWAP).',
    code: `; PulseCISC-32: Hardware String Primitives, CMOVcc & BSWAP
INCLUDE Irvine32.inc
.386
.MODEL FLAT, STDCALL

.DATA
  srcBuf DWORD 4 DUP(0)
  dstBuf DWORD 4 DUP(0)

.CODE
main PROC
  CLD                       ; Clear Direction Flag (DF = 0: forward)

  ; 1. Fill srcBuf with 0x11223344 using REP STOSD
  MOV EDI, OFFSET srcBuf
  MOV EAX, 0x11223344
  MOV ECX, 4
  REP STOSD

  ; 2. Copy srcBuf -> dstBuf using REP MOVSD
  MOV ESI, OFFSET srcBuf
  MOV EDI, OFFSET dstBuf
  MOV ECX, 4
  REP MOVSD

  ; 3. Load copied dword and byte-swap endianness with BSWAP
  MOV EBX, OFFSET dstBuf
  MOV EAX, [EBX + 8]        ; EAX = 0x11223344
  BSWAP EAX                 ; EAX = 0x44332211
  CALL WriteHex             ; Output 44332211h
  CALL Crlf

  ; 4. Branchless maximum using CMOVG
  MOV EAX, 42
  MOV EDX, 99
  CMP EDX, EAX
  CMOVG EAX, EDX            ; EAX becomes 99 without a branch!
  CALL WriteInt             ; Output +99
  CALL Crlf
  exit
main ENDP
END main
`,
  },
];
