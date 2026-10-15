// PulseCISC-32 Engine Verification Script
import { CPU } from './cpu';
import { Assembler } from './assembler';
import { toHex32 } from './isa';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

console.log('--- Testing PulseCISC-32 2-Operand Assembler & CPU Engine ---');

const testProgram = `
; PulseCISC-32 Core Test
MOV EAX, 10
MOV EBX, 25
ADD EAX, EBX       ; EAX = 35
SUB EBX, 10        ; EBX = 15
XOR ECX, ECX       ; ECX = 0 (ZF should be 1)
MOV EDX, 0x0800    ; memory address pointer
MOV [EDX], EAX     ; Store 35 at RAM[0x0800]
MOV ESI, [EDX]     ; Load 35 into ESI
PRINT EAX          ; Print EAX result to console
PRINT 100          ; Print immediate to console
HLT
`;

const assembled = Assembler.assemble(testProgram);
if (assembled.errors.length > 0) {
  console.error('Assembly Errors:', assembled.errors);
  throw new Error('Assembly failed in verify.ts');
}
console.log(`✓ Assembled ${assembled.codeBytes.length} bytes successfully.`);

const cpu = new CPU();
cpu.memory.loadCode(assembled.codeBytes);

let maxSteps = 200;
while (!cpu.halted && maxSteps > 0) {
  cpu.stepMicro();
  maxSteps--;
}

assert(cpu.halted, 'CPU halted cleanly on HLT');
assert(cpu.readRegister(0) === 35, 'EAX == 35 (ADD)');
assert(cpu.readRegister(1) === 15, 'EBX == 15 (SUB)');
assert(cpu.readRegister(2) === 0, 'ECX == 0 (XOR ECX, ECX)');
assert(cpu.memory.readWord(0x0800) === 35, 'Data RAM[0x0800] == 35 (MOV [EDX], EAX)');
assert(cpu.readRegister(4) === 35, 'ESI == 35 (MOV ESI, [EDX])');
assert(cpu.consoleOutput.length >= 3, 'Console received system reset + PRINT outputs');
assert(cpu.consoleOutput.some(e => e.text.includes('EAX = 35')), 'Console printed EAX = 35');
assert(cpu.consoleOutput.some(e => e.text.includes('100')), 'Console printed 100');

console.log('--- Testing 16-Bit Sub-Registers (AX, BX, etc.) ---');
const subRegProgram = `
MOVH EAX, 0x1234
MOV AX, 0xABCD
HLT
`;
const subRegAssembled = Assembler.assemble(subRegProgram);
cpu.reset();
cpu.memory.loadCode(subRegAssembled.codeBytes);
maxSteps = 50;
while (!cpu.halted && maxSteps > 0) {
  cpu.stepInstruction();
  maxSteps--;
}
const eaxVal = cpu.readRegister(0);
assert(eaxVal === 0x1234abcd, `AX sub-register write preserved upper bits: expected 0x1234ABCD, got ${toHex32(eaxVal)}`);
assert(cpu.readRegister(0, true) === 0xabcd, 'Reading AX returned 0xABCD');

console.log('--- Testing CISC Loops with CMP and JNE (Fibonacci) ---');
const fibProgram = `
; Fibonacci Calculator (first 6 numbers)
MOV EAX, 0          ; a = 0
MOV EBX, 1          ; b = 1
MOV ECX, 6          ; count = 6
MOV ESI, 0x0800     ; memory pointer

loop:
  MOV [ESI], EAX    ; RAM[ESI] = EAX
  ADD ESI, 4        ; ESI += 4
  MOV EDX, EAX      ; temp = a
  ADD EDX, EBX      ; next = a + b
  MOV EAX, EBX      ; a = b
  MOV EBX, EDX      ; b = next
  SUB ECX, 1        ; count--
  CMP ECX, 0        ; compare count with 0
  JNE loop          ; loop if ECX != 0

HLT
`;

const fibAssembled = Assembler.assemble(fibProgram);
if (fibAssembled.errors.length > 0) {
  console.error('Fibonacci Assembly Errors:', fibAssembled.errors);
  throw new Error('Fibonacci assembly failed');
}

cpu.reset();
cpu.memory.loadCode(fibAssembled.codeBytes);

maxSteps = 1000;
while (!cpu.halted && maxSteps > 0) {
  cpu.stepInstruction();
  maxSteps--;
}

assert(cpu.halted, 'Fibonacci program completed and halted');
const fibExpected = [0, 1, 1, 2, 3, 5];
for (let i = 0; i < 6; i++) {
  const val = cpu.memory.readWord(0x0800 + i * 4);
  assert(val === fibExpected[i], `Fib[${i}] == ${fibExpected[i]} (got ${val})`);
}

console.log('\nAll PulseCISC-32 Engine Verification Tests Passed Successfully! 🚀');
