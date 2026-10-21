// PulseCISC-32 System Configuration & Preferences
export interface SystemConfig {
  memorySize: number; // in bytes: 4096 (4KB), 8192 (8KB), 16384 (16KB), 32768 (32KB), 65536 (64KB - default)
  dataStart: number; // default 0x0800
  codeStart: number; // default 0x0000
  initialEsp: number | 'auto'; // 'auto' = (memorySize - 4) e.g. 0xFFFC for 64KB, or custom hex number
  defaultClockSpeed: number; // default 1 Hz (1-60 Hz range, integer)
  maxExecutionSteps: number; // safety cycle limit (default 5000, 0 = unlimited)
  enableParticleAnimations: boolean; // default true
  particleSpeed: 'slow' | 'normal' | 'fast'; // default normal
  memoryPageSize: number; // words per page in MemoryGridView: 16 (64B), 32 (128B), 64 (256B)
  autoScrollTrace: boolean; // default true
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  memorySize: 65536, // 64 KB standard default
  dataStart: 0x2000, // 8 KB default code segment (0x0000 - 0x1FFF)
  codeStart: 0x0000,
  initialEsp: 'auto',
  defaultClockSpeed: 1,
  maxExecutionSteps: 5000,
  enableParticleAnimations: true,
  particleSpeed: 'normal',
  memoryPageSize: 16,
  autoScrollTrace: true,
};

const STORAGE_KEY = 'pulsecisc_system_config_v2';

/**
 * Loads system configuration from localStorage, falling back to defaults.
 */
export function loadSystemConfig(): SystemConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SYSTEM_CONFIG };
    const parsed = JSON.parse(raw);
    const loaded: SystemConfig = {
      ...DEFAULT_SYSTEM_CONFIG,
      ...parsed,
    };
    if (loaded.defaultClockSpeed !== undefined) {
      loaded.defaultClockSpeed = Math.max(
        1,
        Math.min(60, Math.round(Number(loaded.defaultClockSpeed) || 1))
      );
    }
    return loaded;
  } catch {
    return { ...DEFAULT_SYSTEM_CONFIG };
  }
}

/**
 * Persists system configuration to localStorage.
 */
export function saveSystemConfig(config: SystemConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save system config to localStorage:', err);
  }
}

/**
 * Returns human-readable memory capacity label (e.g. "64 KB", "4 KB").
 */
export function getMemoryCapacityLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  }
  return `${(bytes / 1024).toFixed(0)} KB`;
}
