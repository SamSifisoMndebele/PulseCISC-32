// PulseCISC-32 Preset Assembly Programs
// Ordered from beginner-friendly basics to intermediate algorithms

export interface ProgramPreset {
  id: string;
  name: string;
  description: string;
  code: string;
}

export const PRESETS: ProgramPreset[] = [
  // --- Beginner Examples ---
  {
    id: 'hello_add',
    name: '1. Beginner: Hello Math (MOV & ADD)',
    description: 'The simplest introduction: loads numbers into EAX and EBX, adds them, and prints the result.',
    code: `; PulseCISC-32: Introductory Lesson 1
; Learn how CPU registers and addition work

MOV EAX, 5          ; Load number 5 into register EAX
MOV EBX, 7          ; Load number 7 into register EBX
ADD EAX, EBX        ; EAX = EAX + EBX (5 + 7 = 12)

PRINT EAX           ; Print the calculated result to the Console!
HLT                 ; Halt processor clock
`,
  },
  {
    id: 'sub_flags',
    name: '2. Beginner: Subtraction & Flags (SF & ZF)',
    description: 'Demonstrates subtraction resulting in a negative number (Sign Flag / SF) and adding back to zero (Zero Flag / ZF).',
    code: `; PulseCISC-32: Introductory Lesson 2
; Learn subtraction and watch EFLAGS in action

MOV EAX, 15         ; EAX = 15
SUB EAX, 20         ; EAX = 15 - 20 = -5
PRINT EAX           ; Output -5 to Console
; Notice that the SF (Sign Flag) badge turns GREEN!

ADD EAX, 5          ; EAX = -5 + 5 = 0
PRINT EAX           ; Output 0 to Console
; Notice that the ZF (Zero Flag) badge turns GREEN!

HLT                 ; Execution finished
`,
  },
  {
    id: 'ram_basics',
    name: '3. Beginner: RAM Store & Load (Memory)',
    description: 'Demonstrates storing a value into Data RAM at 0x2000 and loading it back into another register.',
    code: `; PulseCISC-32: Introductory Lesson 3
; Learn how the CPU interacts with 64 KB RAM (Data Segment starts at 0x2000)

MOV EAX, 42         ; Put the answer (42) into EAX
MOV EBX, 0x2000     ; Set EBX to point to Data RAM address 0x2000

MOV [EBX], EAX      ; Store word: RAM[0x2000] = 42
; Watch the purple Memory phase animate into Data RAM!

MOV ECX, [EBX]      ; Load word: ECX = RAM[0x2000]
PRINT ECX           ; Output loaded value (42) to Console!

HLT                 ; Done
`,
  },
  {
    id: 'countdown_loop',
    name: '4. Beginner: Simple Loop (CMP & JNE)',
    description: 'A 3-step countdown loop illustrating conditional branching using CMP and JNE.',
    code: `; PulseCISC-32: Introductory Lesson 4
; Learn loops: Count down from 3 to 1

MOV ECX, 3          ; Set loop counter to 3

count_loop:
  PRINT ECX         ; Print current count to Console
  SUB ECX, 1        ; Decrement counter: ECX = ECX - 1
  CMP ECX, 0        ; Compare counter with 0
  JNE count_loop    ; Jump if Not Equal to 0

PRINT 0             ; Final liftoff message!
HLT
`,
  },

  // --- Intermediate & Advanced Programs ---
  {
    id: 'fibonacci',
    name: '5. Intermediate: Fibonacci Sequence',
    description: 'Computes first 8 Fibonacci numbers and writes them consecutively into Data RAM at 0x2000.',
    code: `; PulseCISC-32: Fibonacci Sequence Generator
; Computes first 8 Fibonacci numbers into Data RAM at 0x2000

MOV EAX, 0          ; Fib(0) = 0
MOV EBX, 1          ; Fib(1) = 1
MOV ECX, 8          ; Total numbers to generate
MOV ESI, 0x2000     ; Data RAM pointer (0x2000)

fib_loop:
  PRINT EAX         ; Print each Fibonacci number to Console
  MOV [ESI], EAX    ; Store current number into memory
  ADD ESI, 4        ; Advance memory pointer by 4 bytes
  MOV EDX, EAX      ; Temp copy of a
  ADD EDX, EBX      ; Next = a + b
  MOV EAX, EBX      ; a = b
  MOV EBX, EDX      ; b = Next
  SUB ECX, 1        ; Decrement counter
  CMP ECX, 0        ; Compare counter with 0
  JNE fib_loop      ; If counter != 0, repeat loop

HLT                 ; Execution finished!
`,
  },
  {
    id: 'factorial',
    name: '6. Intermediate: Factorial Calculator',
    description: 'Computes factorial N! iteratively (5! = 120) using CMP and conditional branching.',
    code: `; PulseCISC-32: Factorial Calculator
; Computes 5! = 120 (0x78) into EAX

MOV EAX, 1          ; Accumulator result = 1
MOV EBX, 5          ; N = 5
MOV EDX, 0x2000     ; Result memory address (0x2000)

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
  MOV [EDX], EAX    ; Store final factorial (120) in RAM[0x2000]
  PRINT EAX         ; Output final factorial result to Console!
  HLT
`,
  },
  {
    id: 'arraySum',
    name: '7. Intermediate: Array Summation',
    description: 'Initializes an array in Data RAM at 0x2000, computes the sum in EAX, and stores the total at 0x2020.',
    code: `; PulseCISC-32: Array Summation
; Writes [10, 20, 30, 40] into RAM at 0x2000, then sums them

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
PRINT EAX           ; Print sum to Console!
HLT
`,
  },
  {
    id: 'bitwise',
    name: '8. Advanced: Bitwise Logic & Sub-Registers',
    description: 'Demonstrates XOR register clearing, AND/OR bitmasking, and 16-bit sub-register manipulation.',
    code: `; PulseCISC-32: Bitwise Logic & Sub-Registers
; Demonstrates classic x86 idioms

; 1. Classic zeroing idiom
XOR EAX, EAX        ; EAX = 0 (EFLAGS ZF = 1)

; 2. 16-bit sub-register write
MOVH EAX, 0x1234    ; Load upper 16 bits
MOV AX, 0x5678      ; Load lower 16 bits (EAX is now 0x12345678)
PRINT EAX

; 3. Bitmasking with AND and OR
MOV EBX, 0x00FF     ; Mask
AND EBX, EAX        ; EBX = 0x0078 (low byte)
PRINT EBX

MOV ECX, 0x0F00     ; Bitmask to set
OR  ECX, EBX        ; ECX = 0x0F78
PRINT ECX

; 4. Store results to Data RAM at 0x2000
MOV [0x2000], EAX
MOV [0x2004], EBX
MOV [0x2008], ECX
HLT
`,
  },
  {
    id: 'syscalls_db',
    name: '9. Authentic x86: System Calls (INT 0x80 & DB)',
    description: 'Real OS interface: uses INT 0x80 (sys_write and sys_exit) with DB string storage in Data RAM (0x2000).',
    code: `; PulseCISC-32: Authentic Linux x86 System Calls
; Real processors do not have a PRINT instruction.
; Instead, output is done via kernel system calls (INT 0x80):
;   EAX = 4 : sys_write (EBX=fd, ECX=buffer_ptr, EDX=byte_count)
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
    name: '10. CPU Concept: Subroutines & Call Stack (CALL & RET)',
    description: 'Hardware stack and activation frames: uses PUSH, POP, CALL, and RET with standard calling convention.',
    code: `; PulseCISC-32: Function Calls & Stack Frames
; Demonstrates hardware stack operations:
; 1. Caller pushes arguments to stack
; 2. CALL pushes return address (EIP) and jumps
; 3. Callee sets up stack frame using EBP
; 4. RET pops return address back into EIP

main:
  MOV EAX, 15         ; Argument 1: a = 15
  MOV EBX, 27         ; Argument 2: b = 27
  PUSH EBX            ; Push arg 2
  PUSH EAX            ; Push arg 1

  CALL add_numbers    ; Call function! (pushes return EIP)
  ADD ESP, 8          ; Clean up 2 arguments from stack (8 bytes)

  PRINT EAX           ; Result returned in EAX (15 + 27 = 42)
  HLT                 ; End of main

add_numbers:
  PUSH EBP            ; Save caller's base pointer
  MOV EBP, ESP        ; Set up current stack frame

  MOV EAX, [EBP + 8]  ; Load arg 1 (15)
  MOV EDX, [EBP + 12] ; Load arg 2 (27)
  ADD EAX, EDX        ; EAX = 15 + 27 = 42

  MOV ESP, EBP        ; Restore stack pointer
  POP EBP             ; Restore caller's base pointer
  RET                 ; Return to caller!
`,
  },
  {
    id: 'recursive_factorial',
    name: '11. CPU Concept: Recursive Functions (Stack Depth)',
    description: 'Recursive Factorial (5! = 120): demonstrates stack growth, activation records, and base condition testing.',
    code: `; PulseCISC-32: Recursive Factorial (5! = 120)
; Demonstrates recursion and stack memory allocation

main:
  MOV EAX, 5          ; Calculate 5!
  PUSH EAX            ; Pass n = 5
  CALL factorial
  ADD ESP, 4          ; Clean argument

  PRINT EAX           ; Prints 120 (5!)
  HLT

factorial:
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
`,
  },
  {
    id: 'multi_precision_adc',
    name: '12. CPU Concept: 64-bit Multi-Precision Math (ADC & CF)',
    description: 'Multi-precision 64-bit addition using 32-bit registers, demonstrating the Carry Flag (CF) and ADC instruction.',
    code: `; PulseCISC-32: 64-Bit Addition using 32-Bit ALU
; Demonstrates Carry Flag (CF) propagation:
; Number A: 0x00000001_FFFFFFFF (8,589,934,591)
; Number B: 0x00000000_00000001 (1)
; Sum:      0x00000002_00000000 (8,589,934,592)

CLC                   ; Clear carry flag (CF = 0)

; Lower 32 bits: 0xFFFFFFFF + 0x00000001 = 0x00000000 (CF = 1!)
MOV EAX, 0xFFFFFFFF
MOV EBX, 0x00000001
ADD EAX, EBX          ; EAX = 0, Carry Flag (CF) turns ON!
PRINT EAX             ; Output low 32 bits (0)

; Upper 32 bits: 0x00000001 + 0x00000000 + Carry (1) = 0x00000002
MOV ECX, 0x00000001
MOV EDX, 0x00000000
ADC ECX, EDX          ; ECX = 1 + 0 + CF(1) = 2
PRINT ECX             ; Output high 32 bits (2)

HLT
`,
  },
  {
    id: 'bit_shifts_twiddling',
    name: '13. CPU Concept: Bit Shifts & Masking (SHL, SAR, TEST)',
    description: 'Fast binary arithmetic and bit twiddling: SHL (x4), SAR (/2 signed), ROL, and TEST non-destructive masking.',
    code: `; PulseCISC-32: Bit Shifts & Masking
; Demonstrates arithmetic shifts and bitwise manipulation

; 1. Fast multiplication by 4 via SHL (shift left by 2)
MOV EAX, 12           ; 12 in binary: 0000 1100
SHL EAX, 2            ; 12 * 4 = 48
PRINT EAX

; 2. Fast division of negative number via SAR (preserves sign!)
MOV EBX, -16          ; -16
SAR EBX, 1            ; -16 / 2 = -8 (sign bit preserved)
PRINT EBX

; 3. Rotate bits (ROL)
MOV ECX, 0x0000000F   ; Lower 4 bits set
ROL ECX, 4            ; Rotate into next nibble: 0x000000F0
PRINT ECX

; 4. Non-destructive bit testing (TEST)
TEST ECX, 0x000000F0  ; AND without modifying ECX; sets ZF=0
JNE bit_set
PRINT 0
HLT

bit_set:
PRINT 1               ; Bit was set!
HLT
`,
  },
];
