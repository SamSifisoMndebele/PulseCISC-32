// PulseCISC-32 Datapath Canvas Renderer
import type { CPUMicroState, ActiveBusId } from '../core/types';
import { toHex32, REGISTER_NAMES, SUB_REGISTER_NAMES } from '../core/isa';
import { THEME } from './theme';
import { ParticleSystem } from './particles';
import type { Point2D } from './particles';

export class DatapathRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particleSystem: ParticleSystem;

  // Track previous state for particle emission triggers
  private prevCycles: number = -1;
  private prevPhase: string = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;
    this.particleSystem = new ParticleSystem();
  }

  public getParticleSystem(): ParticleSystem {
    return this.particleSystem;
  }

  /**
   * Main render loop called on every animation frame.
   */
  public render(state: CPUMicroState, speedScale: number = 1.0): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // Handle high-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      // already managed by caller or CSS
    }

    // Clear background
    ctx.fillStyle = THEME.canvasBg;
    ctx.fillRect(0, 0, width, height);

    // Draw subtle grid pattern
    this.drawGrid(ctx, width, height);

    // Scale coordinates to fit canvas dimensions
    const scaleX = width / 1100;
    const scaleY = height / 680;
    const scale = Math.min(scaleX, scaleY, 1.3);

    ctx.save();
    // Center if aspect ratio differs
    const offsetX = (width - 1100 * scale) / 2;
    const offsetY = (height - 680 * scale) / 2;
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Coordinate Definitions for Datapath Blocks
    const bEIP = { x: 50, y: 80, w: 130, h: 65, title: 'EIP (Program Counter)' };
    const bAdder = { x: 50, y: 15, w: 100, h: 42, title: '+4 Adder' };
    const bCodeMem = { x: 230, y: 70, w: 150, h: 85, title: 'Code Memory (0x000-0x7FF)' };
    const bIR = { x: 420, y: 70, w: 170, h: 85, title: 'Instruction Register (IR)' };
    const bCU = { x: 630, y: 65, w: 190, h: 95, title: 'Control Unit (FSM)' };

    const bRegs = { x: 260, y: 220, w: 210, h: 260, title: 'Register File (EAX - ESP)' };
    const bLatchA = { x: 510, y: 240, w: 110, h: 55, title: 'Latch A (Dest)' };
    const bLatchB = { x: 510, y: 320, w: 110, h: 55, title: 'Latch B (Src)' };

    const bALU = { x: 670, y: 250, w: 130, h: 140, title: 'ALU' };
    const bFlags = { x: 820, y: 240, w: 110, h: 70, title: 'EFLAGS (ZF, SF, OF)' };
    const bALUOut = { x: 820, y: 330, w: 120, h: 55, title: 'ALU_Out Latch' };

    const bMAR = { x: 970, y: 230, w: 100, h: 55, title: 'MAR (Address)' };
    const bMDR = { x: 970, y: 310, w: 100, h: 55, title: 'MDR (Data)' };
    const bDataRAM = { x: 950, y: 410, w: 135, h: 160, title: 'Data RAM (0x800-0xFFF)' };

    // Emit particles if state changed
    if (state.cycles !== this.prevCycles || state.phase !== this.prevPhase) {
      this.emitPhaseParticles(state, {
        bEIP,
        bAdder,
        bCodeMem,
        bIR,
        bCU,
        bRegs,
        bLatchA,
        bLatchB,
        bALU,
        bFlags,
        bALUOut,
        bMAR,
        bMDR,
        bDataRAM,
      });
      this.prevCycles = state.cycles;
      this.prevPhase = state.phase;
    }

    // 1. Draw Static & Active Bus Lines
    this.drawBuses(ctx, state, {
      bEIP,
      bAdder,
      bCodeMem,
      bIR,
      bCU,
      bRegs,
      bLatchA,
      bLatchB,
      bALU,
      bFlags,
      bALUOut,
      bMAR,
      bMDR,
      bDataRAM,
    });

    // 2. Draw Datapath Components
    this.drawEIP(ctx, bEIP, state);
    this.drawAdder(ctx, bAdder);
    this.drawCodeMem(ctx, bCodeMem, state);
    this.drawIR(ctx, bIR, state);
    this.drawControlUnit(ctx, bCU, state);

    this.drawRegisterFile(ctx, bRegs, state);
    this.drawLatch(ctx, bLatchA, 'Latch A', state.latchA, state.activeBuses.includes('REGS_TO_LATCHES'));
    this.drawLatch(ctx, bLatchB, 'Latch B', state.latchB, state.activeBuses.includes('REGS_TO_LATCHES'));

    this.drawALU(ctx, bALU, state);
    this.drawFlags(ctx, bFlags, state.flags);
    this.drawLatch(ctx, bALUOut, 'ALU_Out', state.aluOut, state.activeBuses.includes('ALU_TO_ALU_OUT'));

    this.drawLatch(ctx, bMAR, 'MAR', state.mar, state.activeBuses.includes('ALU_OUT_TO_MAR') || state.activeBuses.includes('EIP_TO_MAR'));
    this.drawLatch(ctx, bMDR, 'MDR', state.mdr, state.activeBuses.includes('MEM_TO_MDR') || state.activeBuses.includes('LATCH_TO_MDR'));
    this.drawDataRAM(ctx, bDataRAM, state);

    // 3. Update & Render Particles
    this.particleSystem.update(speedScale);
    this.particleSystem.render(ctx);

    ctx.restore();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.strokeStyle = THEME.gridLines;
    ctx.lineWidth = 1;
    const step = 40;
    ctx.beginPath();
    for (let x = 0; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  private drawBuses(
    ctx: CanvasRenderingContext2D,
    state: CPUMicroState,
    b: Record<string, { x: number; y: number; w: number; h: number }>
  ): void {
    const isAct = (id: ActiveBusId) => state.activeBuses.includes(id);
    const phaseColor = THEME.phases[state.phase]?.primary || THEME.textAccent;

    // Helper to draw bus line
    const drawLine = (points: Point2D[], active: boolean) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }

      if (active) {
        ctx.strokeStyle = phaseColor;
        ctx.lineWidth = THEME.activeBusWidth;
        ctx.shadowColor = phaseColor;
        ctx.shadowBlur = 12;
      } else {
        ctx.strokeStyle = THEME.busDefault;
        ctx.lineWidth = THEME.busWidth;
      }
      ctx.stroke();

      // Draw directional arrow on last segment
      if (points.length >= 2) {
        const p1 = points[points.length - 2];
        const p2 = points[points.length - 1];
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        ctx.fillStyle = active ? phaseColor : THEME.busDefault;
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - 7 * Math.cos(angle - Math.PI / 6), p2.y - 7 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(p2.x - 7 * Math.cos(angle + Math.PI / 6), p2.y - 7 * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    };

    // EIP -> Code Memory
    drawLine([
      { x: b.bEIP.x + b.bEIP.w, y: b.bEIP.y + 30 },
      { x: b.bCodeMem.x, y: b.bCodeMem.y + 30 },
    ], isAct('EIP_TO_MAR'));

    // EIP -> Adder (+4) loop
    drawLine([
      { x: b.bEIP.x + 30, y: b.bEIP.y },
      { x: b.bAdder.x + 30, y: b.bAdder.y + b.bAdder.h },
    ], isAct('EIP_INCREMENT'));
    drawLine([
      { x: b.bAdder.x + 70, y: b.bAdder.y + b.bAdder.h },
      { x: b.bEIP.x + 70, y: b.bEIP.y },
    ], isAct('EIP_INCREMENT'));

    // Code Memory -> IR
    drawLine([
      { x: b.bCodeMem.x + b.bCodeMem.w, y: b.bCodeMem.y + 40 },
      { x: b.bIR.x, y: b.bIR.y + 40 },
    ], isAct('CODE_MEM_TO_IR'));

    // IR -> CU
    drawLine([
      { x: b.bIR.x + b.bIR.w, y: b.bIR.y + 40 },
      { x: b.bCU.x, y: b.bCU.y + 40 },
    ], isAct('IR_TO_CU'));

    // IR -> Reg File (Read address lines)
    drawLine([
      { x: b.bIR.x + 50, y: b.bIR.y + b.bIR.h },
      { x: b.bIR.x + 50, y: 190 },
      { x: b.bRegs.x + 60, y: 190 },
      { x: b.bRegs.x + 60, y: b.bRegs.y },
    ], isAct('IR_TO_REG_READ'));

    // Reg File -> Latches A & B
    drawLine([
      { x: b.bRegs.x + b.bRegs.w, y: b.bLatchA.y + 25 },
      { x: b.bLatchA.x, y: b.bLatchA.y + 25 },
    ], isAct('REGS_TO_LATCHES'));

    drawLine([
      { x: b.bRegs.x + b.bRegs.w, y: b.bLatchB.y + 25 },
      { x: b.bLatchB.x, y: b.bLatchB.y + 25 },
    ], isAct('REGS_TO_LATCHES'));

    // Latches -> ALU
    drawLine([
      { x: b.bLatchA.x + b.bLatchA.w, y: b.bLatchA.y + 25 },
      { x: b.bALU.x, y: b.bALU.y + 35 },
    ], isAct('LATCHES_TO_ALU'));

    drawLine([
      { x: b.bLatchB.x + b.bLatchB.w, y: b.bLatchB.y + 25 },
      { x: b.bALU.x, y: b.bALU.y + 105 },
    ], isAct('LATCHES_TO_ALU') || isAct('IMM_TO_ALU'));

    // ALU -> ALU_Out
    drawLine([
      { x: b.bALU.x + b.bALU.w, y: b.bALU.y + 70 },
      { x: b.bALUOut.x, y: b.bALUOut.y + 25 },
    ], isAct('ALU_TO_ALU_OUT'));

    // ALU -> Flags
    drawLine([
      { x: b.bALU.x + b.bALU.w, y: b.bALU.y + 30 },
      { x: b.bFlags.x, y: b.bFlags.y + 35 },
    ], isAct('ALU_TO_FLAGS'));

    // ALU_Out -> MAR (Data RAM)
    drawLine([
      { x: b.bALUOut.x + b.bALUOut.w, y: b.bALUOut.y + 25 },
      { x: b.bMAR.x - 20, y: b.bALUOut.y + 25 },
      { x: b.bMAR.x - 20, y: b.bMAR.y + 25 },
      { x: b.bMAR.x, y: b.bMAR.y + 25 },
    ], isAct('ALU_OUT_TO_MAR'));

    // MAR -> Data RAM
    drawLine([
      { x: b.bMAR.x + b.bMAR.w / 2, y: b.bMAR.y + b.bMAR.h },
      { x: b.bMAR.x + b.bMAR.w / 2, y: b.bDataRAM.y },
    ], isAct('ALU_OUT_TO_MAR'));

    // Latch B -> MDR
    drawLine([
      { x: b.bLatchB.x + b.bLatchB.w / 2, y: b.bLatchB.y + b.bLatchB.h },
      { x: b.bLatchB.x + b.bLatchB.w / 2, y: 440 },
      { x: 930, y: 440 },
      { x: 930, y: b.bMDR.y + 25 },
      { x: b.bMDR.x, y: b.bMDR.y + 25 },
    ], isAct('LATCH_TO_MDR'));

    // MDR <-> Data RAM
    drawLine([
      { x: b.bMDR.x + 30, y: b.bMDR.y + b.bMDR.h },
      { x: b.bMDR.x + 30, y: b.bDataRAM.y },
    ], isAct('MEM_TO_MDR') || isAct('MDR_TO_DATA_MEM'));

    // Writeback Bus (ALU_Out / MDR back to Register File)
    drawLine([
      { x: b.bALUOut.x + 40, y: b.bALUOut.y + b.bALUOut.h },
      { x: b.bALUOut.x + 40, y: 550 },
      { x: b.bRegs.x + b.bRegs.w / 2, y: 550 },
      { x: b.bRegs.x + b.bRegs.w / 2, y: b.bRegs.y + b.bRegs.h },
    ], isAct('ALU_OUT_TO_REG_WB'));

    drawLine([
      { x: b.bMDR.x + 70, y: b.bMDR.y + b.bMDR.h },
      { x: b.bMDR.x + 70, y: 570 },
      { x: b.bRegs.x + b.bRegs.w / 2 - 20, y: 570 },
      { x: b.bRegs.x + b.bRegs.w / 2 - 20, y: b.bRegs.y + b.bRegs.h },
    ], isAct('MDR_TO_REG_WB'));

    // Branch Target feedback to EIP
    drawLine([
      { x: b.bALU.x + 40, y: b.bALU.y },
      { x: b.bALU.x + 40, y: 175 },
      { x: 100, y: 175 },
      { x: 100, y: b.bEIP.y + b.bEIP.h },
    ], isAct('BRANCH_TARGET_TO_EIP') || isAct('JUMP_TARGET_TO_EIP'));
  }

  private emitPhaseParticles(
    state: CPUMicroState,
    b: Record<string, { x: number; y: number; w: number; h: number }>
  ): void {
    const isAct = (id: ActiveBusId) => state.activeBuses.includes(id);
    const phaseInfo = THEME.phases[state.phase];
    if (!phaseInfo) return;

    const col = phaseInfo.primary;
    const glow = phaseInfo.glow;

    if (isAct('EIP_TO_MAR')) {
      this.particleSystem.emit([
        { x: b.bEIP.x + b.bEIP.w, y: b.bEIP.y + 30 },
        { x: b.bCodeMem.x, y: b.bCodeMem.y + 30 },
      ], col, glow, 4, toHex32(state.eip));
    }

    if (isAct('CODE_MEM_TO_IR')) {
      this.particleSystem.emit([
        { x: b.bCodeMem.x + b.bCodeMem.w, y: b.bCodeMem.y + 40 },
        { x: b.bIR.x, y: b.bIR.y + 40 },
      ], col, glow, 4, toHex32(state.ir));
    }

    if (isAct('REGS_TO_LATCHES')) {
      this.particleSystem.emit([
        { x: b.bRegs.x + b.bRegs.w, y: b.bLatchA.y + 25 },
        { x: b.bLatchA.x, y: b.bLatchA.y + 25 },
      ], col, glow, 3, toHex32(state.latchA));
      this.particleSystem.emit([
        { x: b.bRegs.x + b.bRegs.w, y: b.bLatchB.y + 25 },
        { x: b.bLatchB.x, y: b.bLatchB.y + 25 },
      ], col, glow, 3, toHex32(state.latchB));
    }

    if (isAct('LATCHES_TO_ALU')) {
      this.particleSystem.emit([
        { x: b.bLatchA.x + b.bLatchA.w, y: b.bLatchA.y + 25 },
        { x: b.bALU.x, y: b.bALU.y + 35 },
      ], col, glow, 3);
      this.particleSystem.emit([
        { x: b.bLatchB.x + b.bLatchB.w, y: b.bLatchB.y + 25 },
        { x: b.bALU.x, y: b.bALU.y + 105 },
      ], col, glow, 3);
    }

    if (isAct('ALU_TO_ALU_OUT')) {
      this.particleSystem.emit([
        { x: b.bALU.x + b.bALU.w, y: b.bALU.y + 70 },
        { x: b.bALUOut.x, y: b.bALUOut.y + 25 },
      ], col, glow, 4, toHex32(state.aluOut));
    }

    if (isAct('ALU_OUT_TO_MAR')) {
      this.particleSystem.emit([
        { x: b.bALUOut.x + b.bALUOut.w, y: b.bALUOut.y + 25 },
        { x: b.bMAR.x - 20, y: b.bALUOut.y + 25 },
        { x: b.bMAR.x - 20, y: b.bMAR.y + 25 },
        { x: b.bMAR.x, y: b.bMAR.y + 25 },
      ], col, glow, 4, toHex32(state.mar));
    }

    if (isAct('MEM_TO_MDR')) {
      this.particleSystem.emit([
        { x: b.bDataRAM.x + 30, y: b.bDataRAM.y },
        { x: b.bMDR.x + 30, y: b.bMDR.y + b.bMDR.h },
      ], col, glow, 4, toHex32(state.mdr));
    }

    if (isAct('ALU_OUT_TO_REG_WB')) {
      this.particleSystem.emit([
        { x: b.bALUOut.x + 40, y: b.bALUOut.y + b.bALUOut.h },
        { x: b.bALUOut.x + 40, y: 550 },
        { x: b.bRegs.x + b.bRegs.w / 2, y: 550 },
        { x: b.bRegs.x + b.bRegs.w / 2, y: b.bRegs.y + b.bRegs.h },
      ], col, glow, 5, toHex32(state.aluOut));
    }

    if (isAct('MDR_TO_REG_WB')) {
      this.particleSystem.emit([
        { x: b.bMDR.x + 70, y: b.bMDR.y + b.bMDR.h },
        { x: b.bMDR.x + 70, y: 570 },
        { x: b.bRegs.x + b.bRegs.w / 2 - 20, y: 570 },
        { x: b.bRegs.x + b.bRegs.w / 2 - 20, y: b.bRegs.y + b.bRegs.h },
      ], col, glow, 5, toHex32(state.mdr));
    }
  }

  // --- Component Drawing Helpers ---

  private drawCard(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    title: string,
    active: boolean = false,
    activeColor: string = THEME.textAccent
  ): void {
    ctx.save();
    ctx.fillStyle = THEME.cardBg;
    ctx.strokeStyle = active ? activeColor : THEME.cardBorder;
    ctx.lineWidth = active ? 2 : 1;

    if (active) {
      ctx.shadowColor = activeColor;
      ctx.shadowBlur = 14;
    }

    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 6);
    ctx.fill();
    ctx.stroke();

    // Title bar
    ctx.shadowBlur = 0;
    ctx.fillStyle = active ? activeColor : THEME.textSecondary;
    ctx.font = '11px "Inter", system-ui, sans-serif';
    ctx.fillText(title, box.x + 8, box.y + 16);
    ctx.restore();
  }

  private drawEIP(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    state: CPUMicroState
  ): void {
    const isFetch = state.phase === 'FETCH';
    this.drawCard(ctx, box, 'EIP (Program Counter)', isFetch, THEME.phases.FETCH.primary);

    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillText(toHex32(state.eip), box.x + 10, box.y + 42);

    ctx.fillStyle = THEME.textMuted;
    ctx.font = '10px monospace';
    ctx.fillText(`Dec: ${state.eip}`, box.x + 10, box.y + 57);
  }

  private drawAdder(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number }
  ): void {
    this.drawCard(ctx, box, '+4 Adder', false);
    ctx.fillStyle = THEME.textSecondary;
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText('EIP + 4', box.x + 15, box.y + 32);
  }

  private drawCodeMem(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    state: CPUMicroState
  ): void {
    const isFetch = state.phase === 'FETCH';
    this.drawCard(ctx, box, 'Code Memory (ROM)', isFetch, THEME.phases.FETCH.primary);

    ctx.fillStyle = THEME.textMuted;
    ctx.font = '10px "Inter", sans-serif';
    ctx.fillText('Addr: ' + toHex32(state.mar), box.x + 10, box.y + 38);

    ctx.fillStyle = THEME.textAccent;
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText('Word: ' + toHex32(state.ir), box.x + 10, box.y + 60);
  }

  private drawIR(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    state: CPUMicroState
  ): void {
    const isDecode = state.phase === 'DECODE';
    this.drawCard(ctx, box, 'Instruction Register (IR)', isDecode, THEME.phases.DECODE.primary);

    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.fillText(toHex32(state.ir), box.x + 10, box.y + 40);

    ctx.fillStyle = isDecode ? THEME.phases.DECODE.primary : THEME.textAccent;
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(state.decoded ? state.decoded.assemblyString : 'NOP / IDLE', box.x + 10, box.y + 64);
  }

  private drawControlUnit(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    state: CPUMicroState
  ): void {
    const phaseInfo = THEME.phases[state.phase] || THEME.phases.FETCH;
    this.drawCard(ctx, box, 'Control Unit (FSM)', true, phaseInfo.primary);

    // Phase Pill
    ctx.fillStyle = phaseInfo.primary;
    ctx.beginPath();
    ctx.roundRect(box.x + 10, box.y + 26, 85, 22, 11);
    ctx.fill();

    ctx.fillStyle = '#0a0d14';
    ctx.font = 'bold 11px "Inter", sans-serif';
    ctx.fillText(phaseInfo.name.toUpperCase(), box.x + 18, box.y + 41);

    // Active Microcode signals
    ctx.fillStyle = THEME.textSecondary;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`Cycle: ${state.cycles}`, box.x + 105, box.y + 35);
    ctx.fillText(`Insts: ${state.instructionCount}`, box.x + 105, box.y + 48);

    ctx.fillStyle = THEME.textMuted;
    ctx.font = '9px monospace';
    ctx.fillText(phaseInfo.description.substring(0, 32) + '...', box.x + 10, box.y + 75);
  }

  private drawRegisterFile(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    state: CPUMicroState
  ): void {
    const isWB = state.phase === 'WRITEBACK';
    const isDecode = state.phase === 'DECODE';
    this.drawCard(
      ctx,
      box,
      'Register File (8 x 32-bit)',
      isWB || isDecode,
      isWB ? THEME.phases.WRITEBACK.primary : THEME.phases.DECODE.primary
    );

    // Draw 8 registers in compact rows
    const rowH = 25;
    for (let i = 0; i < 8; i++) {
      const regId = i as keyof typeof REGISTER_NAMES;
      const regName = REGISTER_NAMES[regId];
      const subName = SUB_REGISTER_NAMES[regId];
      const val = state.registers[i];
      const y = box.y + 26 + i * rowH;

      const isModified = state.lastModifiedReg === i;
      const isSrc = state.decoded?.src.reg === i;
      const isDest = state.decoded?.dest.reg === i;

      if (isModified) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.fillRect(box.x + 4, y, box.w - 8, rowH - 2);
      } else if (isDest) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fillRect(box.x + 4, y, box.w - 8, rowH - 2);
      } else if (isSrc) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
        ctx.fillRect(box.x + 4, y, box.w - 8, rowH - 2);
      }

      ctx.fillStyle = isModified ? THEME.phases.WRITEBACK.primary : isDest ? THEME.textAccent : THEME.textSecondary;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(regName, box.x + 10, y + 16);

      ctx.fillStyle = THEME.textMuted;
      ctx.font = '9px monospace';
      ctx.fillText(subName, box.x + 45, y + 16);

      ctx.fillStyle = isModified ? '#ffffff' : THEME.textPrimary;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(toHex32(val), box.x + 85, y + 16);
    }
  }

  private drawLatch(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    label: string,
    val: number,
    active: boolean
  ): void {
    this.drawCard(ctx, box, label, active, THEME.textAccent);
    ctx.fillStyle = active ? THEME.textAccent : THEME.textPrimary;
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(toHex32(val), box.x + 10, box.y + 40);
  }

  private drawALU(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    state: CPUMicroState
  ): void {
    const isExec = state.phase === 'EXECUTE';
    ctx.save();

    // Classic ALU Trapezoid Polygon
    ctx.beginPath();
    ctx.moveTo(box.x, box.y);
    ctx.lineTo(box.x + box.w, box.y + 35);
    ctx.lineTo(box.x + box.w, box.y + box.h - 35);
    ctx.lineTo(box.x, box.y + box.h);
    ctx.lineTo(box.x, box.y + box.h - 40);
    ctx.lineTo(box.x + 25, box.y + box.h / 2);
    ctx.lineTo(box.x, box.y + 40);
    ctx.closePath();

    ctx.fillStyle = THEME.cardBg;
    ctx.strokeStyle = isExec ? THEME.phases.EXECUTE.primary : THEME.cardBorder;
    ctx.lineWidth = isExec ? 2.5 : 1;

    if (isExec) {
      ctx.shadowColor = THEME.phases.EXECUTE.glow;
      ctx.shadowBlur = 16;
    }

    ctx.fill();
    ctx.stroke();

    // Label and active operator icon
    ctx.shadowBlur = 0;
    ctx.fillStyle = isExec ? THEME.phases.EXECUTE.primary : THEME.textSecondary;
    ctx.font = 'bold 12px "Inter", sans-serif';
    ctx.fillText('ALU 32-Bit', box.x + 35, box.y + 30);

    let opSymbol = '+';
    if (state.decoded) {
      const m = state.decoded.mnemonic;
      if (m === 'SUB' || m === 'CMP') opSymbol = '−';
      else if (m === 'AND') opSymbol = '&';
      else if (m === 'OR') opSymbol = '|';
      else if (m === 'XOR') opSymbol = '⊕';
    }

    ctx.fillStyle = isExec ? '#ffffff' : THEME.textAccent;
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.fillText(opSymbol, box.x + 55, box.y + box.h / 2 + 8);

    ctx.restore();
  }

  private drawFlags(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    flags: { zf: boolean; sf: boolean; of: boolean }
  ): void {
    this.drawCard(ctx, box, 'EFLAGS', false);

    const drawFlagPill = (x: number, y: number, name: string, active: boolean) => {
      ctx.fillStyle = active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = active ? '#10b981' : THEME.cardBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, 26, 18, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = active ? '#10b981' : THEME.textMuted;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(name, x + 5, y + 13);
    };

    drawFlagPill(box.x + 8, box.y + 32, 'ZF', flags.zf);
    drawFlagPill(box.x + 40, box.y + 32, 'SF', flags.sf);
    drawFlagPill(box.x + 72, box.y + 32, 'OF', flags.of);
  }

  private drawDataRAM(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    state: CPUMicroState
  ): void {
    const isMem = state.phase === 'MEMORY';
    this.drawCard(ctx, box, 'Data RAM (4 KB)', isMem, THEME.phases.MEMORY.primary);

    // Show top 4 words of Data Segment (0x0800 - 0x080C)
    for (let i = 0; i < 4; i++) {
      const addr = 0x0800 + i * 4;
      const val = state.mar === addr && isMem ? state.mdr : 0; // live view
      const y = box.y + 30 + i * 30;

      const isTarget = state.mar === addr && isMem;
      if (isTarget) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
        ctx.fillRect(box.x + 4, y - 2, box.w - 8, 26);
      }

      ctx.fillStyle = isTarget ? THEME.phases.MEMORY.primary : THEME.textMuted;
      ctx.font = '10px monospace';
      ctx.fillText(`0x${addr.toString(16).toUpperCase()}:`, box.x + 8, y + 16);

      ctx.fillStyle = THEME.textPrimary;
      ctx.font = '11px monospace';
      ctx.fillText(toHex32(val), box.x + 55, y + 16);
    }
  }
}
