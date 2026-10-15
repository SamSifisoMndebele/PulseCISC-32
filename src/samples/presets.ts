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
    name: '2. Beginner: Subtraction & Zero Flag (SUB)',
    description: 'Demonstrates arithmetic subtraction and watches the Zero Flag (ZF) turn active when reaching 0.',
    code: `; PulseCISC-32: Introductory Lesson 2
; Learn subtraction and watch EFLAGS in action

MOV EAX, 20         ; EAX = 20
SUB EAX, 15         ; EAX = 20 - 15 = 5
PRINT EAX           ; Output 5 to Console

SUB EAX, 5          ; EAX = 5 - 5 = 0
PRINT EAX           ; Output 0 to Console
; Notice that the ZF (Zero Flag) badge turns GREEN!

HLT                 ; Execution finished
`,
  },
  {
    id: 'ram_basics',
    name: '3. Beginner: RAM Store & Load (Memory)',
    description: 'Demonstrates storing a value into Data RAM at 0x0800 and loading it back into another register.',
    code: `; PulseCISC-32: Introductory Lesson 3
; Learn how the CPU interacts with 4 KB RAM

MOV EAX, 42         ; Put the answer (42) into EAX
MOV EBX, 0x0800     ; Set EBX to point to Data RAM address 0x0800

MOV [EBX], EAX      ; Store word: RAM[0x0800] = 42
; Watch the purple Memory phase animate into Data RAM!

MOV ECX, [EBX]      ; Load word: ECX = RAM[0x0800]
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
    description: 'Computes first 8 Fibonacci numbers and writes them consecutively into Data RAM at 0x0800.',
    code: `; PulseCISC-32: Fibonacci Sequence Generator
; Computes first 8 Fibonacci numbers into Data RAM at 0x0800

MOV EAX, 0          ; Fib(0) = 0
MOV EBX, 1          ; Fib(1) = 1
MOV ECX, 8          ; Total numbers to generate
MOV ESI, 0x0800     ; Data RAM pointer

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
MOV EDX, 0x0800     ; Result memory address

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
  MOV [EDX], EAX    ; Store final factorial (120) in RAM[0x0800]
  PRINT EAX         ; Output final factorial result to Console!
  HLT
`,
  },
  {
    id: 'arraySum',
    name: '7. Intermediate: Array Summation',
    description: 'Initializes an array in Data RAM, computes the sum in EAX, and stores the total at 0x0820.',
    code: `; PulseCISC-32: Array Summation
; Writes [10, 20, 30, 40] into RAM, then sums them

; Step 1: Initialize array at 0x0800
MOV ESI, 0x0800
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
MOV ESI, 0x0800     ; Reset pointer

sum_loop:
  MOV EBX, [ESI]    ; Load word from array
  ADD EAX, EBX      ; Sum += element
  ADD ESI, 4        ; Advance pointer
  SUB ECX, 1        ; Count--
  CMP ECX, 0
  JNE sum_loop

; Store result sum (100 = 0x64) at 0x0820
MOV [0x0820], EAX
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

; 4. Store results to Data RAM
MOV [0x0800], EAX
MOV [0x0804], EBX
MOV [0x0808], ECX
HLT
`,
  },
];
