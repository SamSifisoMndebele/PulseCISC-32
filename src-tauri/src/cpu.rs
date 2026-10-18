// Native 32-Bit x86 IA-32 High-Frequency CPU Execution & Benchmark Core in Rust
use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Clone, Copy, Serialize, Deserialize, Default)]
pub struct NativeEFlags {
    pub zf: bool,
    pub sf: bool,
    pub of: bool,
    pub cf: bool,
    pub df: bool,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct NativeTurboResult {
    pub registers: [u32; 8],
    pub eip: u32,
    pub flags: NativeEFlags,
    pub cycles_executed: u64,
    pub instructions_executed: u64,
    pub elapsed_us: u128,
    pub effective_mips: f64,
    pub halted: bool,
}

pub struct NativeCpuCore {
    pub registers: [u32; 8],
    pub eip: u32,
    pub flags: NativeEFlags,
    pub memory: Vec<u8>,
    pub halted: bool,
    pub total_cycles: u64,
}

impl NativeCpuCore {
    pub fn new(memory_size: usize) -> Self {
        let mut core = Self {
            registers: [0; 8],
            eip: 0,
            flags: NativeEFlags::default(),
            memory: vec![0; memory_size],
            halted: false,
            total_cycles: 0,
        };
        core.registers[7] = (memory_size as u32).saturating_sub(4);
        core
    }

    #[inline(always)]
    pub fn alu_add(&mut self, a: u32, b: u32) -> u32 {
        let (res, carry) = a.overflowing_add(b);
        let (_, overflow) = (a as i32).overflowing_add(b as i32);
        self.flags.cf = carry;
        self.flags.of = overflow;
        self.flags.zf = res == 0;
        self.flags.sf = (res & 0x8000_0000) != 0;
        res
    }

    #[inline(always)]
    pub fn alu_sub(&mut self, a: u32, b: u32) -> u32 {
        let (res, borrow) = a.overflowing_sub(b);
        let (_, overflow) = (a as i32).overflowing_sub(b as i32);
        self.flags.cf = borrow;
        self.flags.of = overflow;
        self.flags.zf = res == 0;
        self.flags.sf = (res & 0x8000_0000) != 0;
        res
    }

    /// Executes a native hardware-speed benchmark & stress test on the 32-bit Rust ALU/Register file
    pub fn run_native_alu_benchmark(&mut self, iterations: u64) -> NativeTurboResult {
        let start = Instant::now();
        let mut eax = self.registers[0].max(1);
        let mut ebx = self.registers[1].max(3);
        let mut ecx = self.registers[2];
        let mut edx = self.registers[3];

        for i in 0..iterations {
            eax = eax.wrapping_add(ebx ^ (i as u32));
            ebx = ebx.rotate_left(5).wrapping_sub(eax);
            ecx = ecx.wrapping_add(1);
            edx ^= eax.wrapping_mul(3);
        }

        self.registers[0] = eax;
        self.registers[1] = ebx;
        self.registers[2] = ecx;
        self.registers[3] = edx;
        self.flags.zf = eax == 0;
        self.flags.sf = (eax & 0x8000_0000) != 0;
        self.total_cycles = self.total_cycles.wrapping_add(iterations * 4);

        let elapsed_us = start.elapsed().as_micros().max(1);
        let total_inst = iterations * 4;
        let effective_mips = (total_inst as f64) / (elapsed_us as f64);

        NativeTurboResult {
            registers: self.registers,
            eip: self.eip,
            flags: self.flags,
            cycles_executed: total_inst,
            instructions_executed: total_inst,
            elapsed_us,
            effective_mips,
            halted: self.halted,
        }
    }
}
