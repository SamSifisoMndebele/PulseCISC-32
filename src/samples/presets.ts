// PulseCISC-32 Preset Assembly Programs

export interface ProgramPreset {
  id: string;
  name: string;
  description: string;
  code: string;
}

export const PRESETS: ProgramPreset[] = [
  {
    id: 'fibonacci',
    name: '1. Fibonacci Sequence',
    description: 'Computes first 8 Fibonacci numbers and writes them consecutively into Data RAM at 0x0800.',
    code: `; PulseCISC-32: Fibonacci Sequence Generator
; Computes first 8 Fibonacci numbers into Data RAM at 0x0800

MOV EAX, 0          ; Fib(0) = 0
MOV EBX, 1          ; Fib(1) = 1
MOV ECX, 8          ; Total numbers to generate
MOV ESI, 0x0800     ; Data RAM pointer

fib_loop:
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
    name: '2. Factorial Calculator',
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
  HLT
`,
  },
  {
    id: 'arraySum',
    name: '3. Array Sum & Average',
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
HLT
`,
  },
  {
    id: 'bitwise',
    name: '4. Bitwise Logic & Sub-Registers',
    description: 'Demonstrates XOR register clearing, AND/OR bitmasking, and 16-bit sub-register manipulation.',
    code: `; PulseCISC-32: Bitwise Logic & Sub-Registers
; Demonstrates classic x86 idioms

; 1. Classic zeroing idiom
XOR EAX, EAX        ; EAX = 0 (EFLAGS ZF = 1)

; 2. 16-bit sub-register write
MOVH EAX, 0x1234    ; Load upper 16 bits
MOV AX, 0x5678      ; Load lower 16 bits (EAX is now 0x12345678)

; 3. Bitmasking with AND and OR
MOV EBX, 0x00FF     ; Mask
AND EBX, EAX        ; EBX = 0x0078 (low byte)

MOV ECX, 0x0F00     ; Bitmask to set
OR  ECX, EBX        ; ECX = 0x0F78

; 4. Store results to Data RAM
MOV [0x0800], EAX
MOV [0x0804], EBX
MOV [0x0808], ECX
HLT
`,
  },
];
