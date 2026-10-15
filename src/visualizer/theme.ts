// PulseRISC-32 Visual Theme & Phase Palette

export const THEME = {
  bg: '#0a0d14',
  canvasBg: '#0d111a',
  gridLines: 'rgba(255, 255, 255, 0.03)',
  cardBg: 'rgba(18, 24, 38, 0.85)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  textAccent: '#38bdf8',

  // Phase Specific Colors & Glows
  phases: {
    FETCH: {
      name: 'Fetch',
      primary: '#10b981', // Emerald
      glow: 'rgba(16, 185, 129, 0.5)',
      soft: 'rgba(16, 185, 129, 0.15)',
      description: 'MAR <- PC; IR <- MEM[PC]; PC <- PC + 4',
    },
    DECODE: {
      name: 'Decode',
      primary: '#3b82f6', // Electric Blue
      glow: 'rgba(59, 130, 246, 0.5)',
      soft: 'rgba(59, 130, 246, 0.15)',
      description: 'Decode IR; Read R[rs] & R[rt] into Latches A & B',
    },
    EXECUTE: {
      name: 'Execute',
      primary: '#ef4444', // Crimson Red
      glow: 'rgba(239, 68, 68, 0.5)',
      soft: 'rgba(239, 68, 68, 0.15)',
      description: 'ALU calculation / Branch evaluation / Target calc',
    },
    MEMORY: {
      name: 'Memory',
      primary: '#a855f7', // Neon Purple / Violet
      glow: 'rgba(168, 85, 247, 0.5)',
      soft: 'rgba(168, 85, 247, 0.15)',
      description: 'Data RAM Read (LW) / Write (SW) via MAR and MDR',
    },
    WRITEBACK: {
      name: 'Writeback',
      primary: '#f59e0b', // Amber / Warm Gold
      glow: 'rgba(245, 158, 11, 0.5)',
      soft: 'rgba(245, 158, 11, 0.15)',
      description: 'Write result (ALU_Out or MDR) into Destination Register',
    },
    HALTED: {
      name: 'Halted',
      primary: '#e11d48', // Rose Red
      glow: 'rgba(225, 29, 72, 0.6)',
      soft: 'rgba(225, 29, 72, 0.2)',
      description: 'CPU clock halted.',
    },
  },

  // Bus Lines
  busDefault: '#1e293b',
  busInactive: 'rgba(255, 255, 255, 0.12)',
  busWidth: 2.5,
  activeBusWidth: 3.5,
};
