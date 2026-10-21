// Tauri v2 Native Rust Bridge (with seamless fallback when running in Vite preview)
import { invoke } from '@tauri-apps/api/core';

export interface EngineInfo {
  backend: string;
  arch: string;
  os: string;
  threads: number;
  psi_enabled: boolean;
  isNativeTauri: boolean;
}

export interface PsiSymbol {
  name: string;
  kind: 'LABEL' | 'DATA' | 'CONSTANT' | 'PROC' | string;
  line: number;
  references: number;
  detail: string;
}

export interface PsiDiagnostic {
  line: number;
  severity: 'warning' | 'info' | 'hint' | string;
  code: string;
  message: string;
}

export interface RegisterUsage {
  name: string;
  reads: number;
  writes: number;
}

export interface PsiAnalysisReport {
  symbols: PsiSymbol[];
  diagnostics: PsiDiagnostic[];
  register_usage: RegisterUsage[];
  instruction_count: number;
  parse_time_us: number;
}

export interface NativeTurboResult {
  registers: number[];
  eip: number;
  flags: {
    zf: boolean;
    sf: boolean;
    of: boolean;
    cf: boolean;
    df: boolean;
  };
  cycles_executed: number;
  instructions_executed: number;
  elapsed_us: number;
  effective_mips: number;
  halted: boolean;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function getRustEngineInfo(): Promise<EngineInfo> {
  if (isTauriRuntime()) {
    try {
      const info = await invoke<Omit<EngineInfo, 'isNativeTauri'>>('rust_engine_info');
      return { ...info, isNativeTauri: true };
    } catch {
      // Fall through
    }
  }
  return {
    backend: 'PulseCISC-32 High-Speed Execution Core',
    arch: 'x86_64',
    os: 'windows',
    threads: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
    psi_enabled: true,
    isNativeTauri: false,
  };
}

export async function analyzeAssemblyPsi(source: string): Promise<PsiAnalysisReport> {
  if (isTauriRuntime()) {
    try {
      return await invoke<PsiAnalysisReport>('rust_analyze_psi', { source });
    } catch {
      // Fall through to local fallback
    }
  }
  return fallbackAnalyzePsi(source);
}

export async function runNativeTurboBenchmark(
  iterations: number,
  registers: Uint32Array
): Promise<NativeTurboResult> {
  const regArray = Array.from(registers).slice(0, 8);
  while (regArray.length < 8) regArray.push(0);

  if (isTauriRuntime()) {
    try {
      return await invoke<NativeTurboResult>('rust_run_turbo_benchmark', {
        iterations,
        registers: regArray,
      });
    } catch {
      // Fall through
    }
  }

  // Local fallback benchmark if outside Tauri window
  const t0 = performance.now();
  let eax = (regArray[0] >>> 0) || 1;
  let ebx = (regArray[1] >>> 0) || 3;
  let ecx = regArray[2] >>> 0;
  let edx = regArray[3] >>> 0;
  for (let i = 0; i < iterations; i++) {
    eax = (eax + (ebx ^ i)) >>> 0;
    ebx = (((ebx << 5) | (ebx >>> 27)) - eax) >>> 0;
    ecx = (ecx + 1) >>> 0;
    edx = (edx ^ Math.imul(eax, 3)) >>> 0;
  }
  const elapsedUs = Math.max(1, Math.round((performance.now() - t0) * 1000));
  const totalInst = iterations * 4;
  return {
    registers: [eax, ebx, ecx, edx, regArray[4], regArray[5], regArray[6], regArray[7]],
    eip: 0,
    flags: {
      zf: eax === 0,
      sf: (eax & 0x80000000) !== 0,
      of: false,
      cf: false,
      df: false,
    },
    cycles_executed: totalInst,
    instructions_executed: totalInst,
    elapsed_us: elapsedUs,
    effective_mips: totalInst / elapsedUs,
    halted: false,
  };
}

export async function saveAsmFileNative(filename: string, content: string): Promise<string> {
  if (isTauriRuntime()) {
    return await invoke<string>('rust_save_asm_file', { filename, content });
  }
  // Browser download fallback
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.asm') ? filename : `${filename}.asm`;
  a.click();
  URL.revokeObjectURL(url);
  return a.download;
}

// Fast local TypeScript mirror of the Rust PSI analyzer when previewing in browser
function fallbackAnalyzePsi(source: string): PsiAnalysisReport {
  const t0 = performance.now();
  const symbols: PsiSymbol[] = [];
  const symbolMap = new Map<string, number>();
  const diagnostics: PsiDiagnostic[] = [];
  const canonicalRegs = ['EAX', 'EBX', 'ECX', 'EDX', 'ESI', 'EDI', 'EBP', 'ESP'];
  const reads: Record<string, number> = Object.fromEntries(canonicalRegs.map((r) => [r, 0]));
  const writes: Record<string, number> = Object.fromEntries(canonicalRegs.map((r) => [r, 0]));

  const mapReg = (tok: string): string | null => {
    const u = tok.toUpperCase();
    if (['EAX', 'AX', 'AL', 'AH'].includes(u)) return 'EAX';
    if (['EBX', 'BX', 'BL', 'BH'].includes(u)) return 'EBX';
    if (['ECX', 'CX', 'CL', 'CH'].includes(u)) return 'ECX';
    if (['EDX', 'DX', 'DL', 'DH'].includes(u)) return 'EDX';
    if (['ESI', 'SI'].includes(u)) return 'ESI';
    if (['EDI', 'DI'].includes(u)) return 'EDI';
    if (['EBP', 'BP'].includes(u)) return 'EBP';
    if (['ESP', 'SP'].includes(u)) return 'ESP';
    return null;
  };

  const lines = source.split('\n');
  lines.forEach((raw, idx) => {
    const lineNum = idx + 1;
    const clean = raw.split(';')[0].trim();
    if (!clean || clean.startsWith('.')) return;
    const colon = clean.indexOf(':');
    if (colon !== -1) {
      const name = clean.slice(0, colon).trim();
      if (name && !name.includes(' ') && !name.includes('[')) {
        const key = name.toUpperCase();
        if (!symbolMap.has(key)) {
          symbolMap.set(key, symbols.length);
          symbols.push({
            name,
            kind: 'LABEL',
            line: lineNum,
            references: 0,
            detail: 'Code branch/jump target',
          });
        }
      }
    } else {
      const parts = clean.split(/\s+/);
      if (parts.length >= 2) {
        const dir = parts[1].toUpperCase();
        if (['DB', 'DW', 'DD', 'EQU'].includes(dir)) {
          const name = parts[0];
          const key = name.toUpperCase();
          if (!symbolMap.has(key)) {
            symbolMap.set(key, symbols.length);
            symbols.push({
              name,
              kind: dir === 'EQU' ? 'CONSTANT' : 'DATA',
              line: lineNum,
              references: 0,
              detail: `${dir} definition`,
            });
          }
        }
      }
    }
  });

  let instructionCount = 0;
  lines.forEach((raw) => {
    let clean = raw.split(';')[0].trim();
    if (!clean || clean.startsWith('.')) return;
    const colon = clean.indexOf(':');
    if (colon !== -1) {
      clean = clean.slice(colon + 1).trim();
      if (!clean) return;
    }
    const tokens = clean.split(/\s+/);
    if (tokens.length >= 2 && ['DB', 'DW', 'DD', 'EQU', 'PROC', 'ENDP'].includes(tokens[1].toUpperCase())) {
      return;
    }
    instructionCount++;
    const rest = tokens.slice(1).join(' ');
    for (const w of rest.split(/[^A-Za-z0-9_]+/)) {
      const idx = symbolMap.get(w.toUpperCase());
      if (idx !== undefined) symbols[idx].references++;
      const r = mapReg(w);
      if (r) reads[r]++;
    }
    const firstOp = rest.split(',')[0]?.trim() || '';
    const dstReg = mapReg(firstOp);
    if (dstReg) writes[dstReg]++;
  });

  const elapsedUs = Math.max(1, Math.round((performance.now() - t0) * 1000));
  return {
    symbols,
    diagnostics,
    register_usage: canonicalRegs.map((name) => ({
      name,
      reads: reads[name],
      writes: writes[name],
    })),
    instruction_count: instructionCount,
    parse_time_us: elapsedUs,
  };
}
