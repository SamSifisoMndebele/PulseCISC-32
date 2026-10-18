// PulseCISC-32 Datapath Canvas Renderer
import type { CPUMicroState, ActiveBusId, CPUPhase, DecodedInstruction } from '../core/types';
import { toHex32, toInt32, REGISTER_NAMES, SUB_REGISTER_NAMES, OPCODES } from '../core/isa';
import { THEME } from './theme';
import { ParticleSystem } from './particles';
import type { Point2D } from './particles';

export interface DatapathComponentInfo {
  id: string;
  title: string;
  category: 'PC' | 'MEMORY' | 'REGISTER' | 'ALU' | 'CONTROL';
  role: string;
  summary: string;
  pedagogicalInsight?: string;
  whyExplanation?: string;
  mnemonic?: string;
  bounds: { x: number; y: number; w: number; h: number };
}

interface ComponentBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
}

interface DisplaySnapshot {
  eip: number;
  ir: number;
  mar: number;
  codeWord: number;
  latchA: number;
  latchB: number;
  aluOut: number;
  mdr: number;
  decoded: DecodedInstruction | null;
  flags: { zf: boolean; sf: boolean; of: boolean; cf: boolean };
  registers: number[];
}

export class DatapathRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particleSystem: ParticleSystem;

  // Track previous state for sequential animation triggers
  private prevCycles: number = -1;
  private currentTransform = { scale: 1, offsetX: 0, offsetY: 0 };

  // Sequential Animation Timing & Staging
  private animProgress: number = 1.0; // 0.0 to 1.0
  private lastFrameTime: number = 0;
  private animStepPhase: CPUPhase = 'FETCH';
  private prevDisplayed: DisplaySnapshot | null = null;
  private targetDisplayed: DisplaySnapshot | null = null;
  public enableParticles: boolean = true;
  public particleSpeedMultiplier: number = 1.0;
  private lastState: CPUMicroState | null = null;

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

  private snapshotDisplay(state: CPUMicroState): DisplaySnapshot {
    return {
      eip: state.eip,
      ir: state.ir,
      mar: state.mar,
      codeWord: state.codeWord ?? state.ir,
      latchA: state.latchA,
      latchB: state.latchB,
      aluOut: state.aluOut,
      mdr: state.mdr,
      decoded: state.decoded ? { ...state.decoded } : null,
      flags: { ...state.flags },
      registers: Array.from(state.registers),
    };
  }

  /**
   * Main render loop called on every animation frame.
   */
  public render(state: CPUMicroState, speedScale: number = 1.0): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    // Clear background
    ctx.fillStyle = THEME.canvasBg;
    ctx.fillRect(0, 0, width, height);

    // Draw subtle grid pattern
    this.drawGrid(ctx, width, height);

    // Scale coordinates to fit canvas dimensions (1140x680 reference design)
    const scaleX = width / 1140;
    const scaleY = height / 680;
    const scale = Math.min(scaleX, scaleY, 1.3);

    ctx.save();
    const offsetX = (width - 1140 * scale) / 2;
    const offsetY = (height - 680 * scale) / 2;
    this.currentTransform = { scale, offsetX, offsetY };
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Redesigned Datapath Layout Coordinates
    const bAdder: ComponentBounds = { x: 50, y: 15, w: 105, h: 42, title: '+4 Adder' };
    const bEIP: ComponentBounds = { x: 50, y: 75, w: 135, h: 70, title: 'EIP (Program Counter)' };
    const bCodeMem: ComponentBounds = { x: 245, y: 70, w: 160, h: 85, title: 'Code Memory (ROM)' };
    const bIR: ComponentBounds = { x: 465, y: 70, w: 185, h: 85, title: 'Instruction Register (IR)' };

    // Control Unit as dedicated FSM controller banner in top-right
    const bCU: ComponentBounds = { x: 695, y: 45, w: 375, h: 115, title: 'Control Unit (FSM)' };

    // Execution & Storage Datapath components
    const bRegs: ComponentBounds = { x: 160, y: 210, w: 220, h: 265, title: 'Register File (8 x 32-bit)' };
    const bLatchA: ComponentBounds = { x: 430, y: 235, w: 120, h: 55, title: 'Latch A (Dest)' };
    const bLatchB: ComponentBounds = { x: 430, y: 315, w: 120, h: 55, title: 'Latch B (Src)' };

    const bALU: ComponentBounds = { x: 600, y: 245, w: 140, h: 140, title: 'ALU 32-Bit' };
    const bFlags: ComponentBounds = { x: 790, y: 225, w: 125, h: 70, title: 'EFLAGS (ZF, SF, OF, CF)' };
    const bALUOut: ComponentBounds = { x: 790, y: 320, w: 120, h: 55, title: 'ALU_Out Latch' };

    const bMAR: ComponentBounds = { x: 945, y: 215, w: 105, h: 55, title: 'MAR (Address)' };
    const bMDR: ComponentBounds = { x: 945, y: 295, w: 105, h: 55, title: 'MDR (Data)' };
    const bDataRAM: ComponentBounds = { x: 980, y: 395, w: 140, h: 165, title: 'Data RAM (4 KB)' };

    const boxes = {
      bAdder,
      bEIP,
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
    };

    this.lastState = state;

    // Update Sequential Animation Timing on CPU Step
    const now = performance.now();
    if (this.lastFrameTime === 0) this.lastFrameTime = now;
    const dt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (state.cycles === 0) {
      this.prevDisplayed = this.snapshotDisplay(state);
      this.targetDisplayed = this.snapshotDisplay(state);
      this.animProgress = 1.0;
      this.animStepPhase = state.phase;
      this.prevCycles = 0;
    } else if (state.cycles !== this.prevCycles) {
      if (this.prevCycles === -1) {
        // Initial setup
        this.prevDisplayed = this.snapshotDisplay(state);
        this.targetDisplayed = this.snapshotDisplay(state);
        this.animProgress = 1.0;
        this.animStepPhase = state.phase;
      } else {
        // Step transition triggered!
        this.prevDisplayed = this.targetDisplayed ? { ...this.targetDisplayed } : this.snapshotDisplay(state);
        this.targetDisplayed = this.snapshotDisplay(state);
        this.animStepPhase = state.stepPhase || state.phase;
        this.animProgress = 0.0;
      }
      this.prevCycles = state.cycles;
    }

    // Advance animation progress smoothly
    if (this.animProgress < 1.0) {
      const animDuration = Math.max(0.25, 0.95 / speedScale);
      this.animProgress = Math.min(1.0, this.animProgress + dt / animDuration);
    }

    const P = this.animProgress;
    const from = this.prevDisplayed || this.snapshotDisplay(state);
    const to = this.targetDisplayed || this.snapshotDisplay(state);
    const stepPhase = this.animStepPhase;

    // Active CU phase determining overall state highlights
    // If we are currently transitioning through a step (P < 1.0), the active operations belong to stepPhase!
    // Otherwise, when idle/waiting for next step, the CU state is state.phase.
    const activeCUPhase: CPUPhase = (P < 1.0 && stepPhase) ? stepPhase : state.phase;

    // Calculate sequential pulses ("stress to ROM", latch activations, etc.)
    let pulseROM = 0;
    let pulseIR = 0;
    let pulseAdder = 0;
    let pulseRegs = 0;
    let pulseLatches = 0;
    let pulseALU = 0;
    let pulseALUOut = 0;
    let pulseRAM = 0;
    let pulseMDR = 0;

    if (P < 1.0) {
      if (stepPhase === 'FETCH') {
        if (P >= 0.12 && P <= 0.44) pulseAdder = Math.sin(((P - 0.12) / 0.32) * Math.PI);
        if (P >= 0.38 && P <= 0.55) pulseROM = Math.sin(((P - 0.38) / 0.17) * Math.PI); // Stress to ROM!
        if (P >= 0.88 && P <= 1.0) pulseIR = Math.sin(((P - 0.88) / 0.12) * Math.PI); // Latch into IR!
      } else if (stepPhase === 'DECODE') {
        if (P >= 0.35 && P <= 0.55) pulseRegs = Math.sin(((P - 0.35) / 0.2) * Math.PI);
        if (P >= 0.88 && P <= 1.0) pulseLatches = Math.sin(((P - 0.88) / 0.12) * Math.PI);
      } else if (stepPhase === 'EXECUTE') {
        if (P >= 0.38 && P <= 0.6) pulseALU = Math.sin(((P - 0.38) / 0.22) * Math.PI);
        if (P >= 0.88 && P <= 1.0) pulseALUOut = Math.sin(((P - 0.88) / 0.12) * Math.PI);
      } else if (stepPhase === 'MEMORY') {
        const isStore =
          state.activeBuses.includes('LATCH_TO_MDR') ||
          Boolean(
            state.decoded &&
              (state.decoded.opcode === OPCODES.MOV_MR ||
                state.decoded.opcode === OPCODES.MOVB_MR ||
                state.decoded.opcode === OPCODES.MOVW_MR ||
                state.decoded.opcode === OPCODES.MOV_MI)
          );
        if (isStore) {
          if (P >= 0.35 && P <= 0.6) pulseMDR = Math.sin(((P - 0.35) / 0.25) * Math.PI);
          if (P >= 0.7 && P <= 1.0) pulseRAM = Math.sin(((P - 0.7) / 0.3) * Math.PI);
        } else {
          if (P >= 0.35 && P <= 0.65) pulseRAM = Math.sin(((P - 0.35) / 0.3) * Math.PI);
          if (P >= 0.75 && P <= 1.0) pulseMDR = Math.sin(((P - 0.75) / 0.25) * Math.PI);
        }
      } else if (stepPhase === 'WRITEBACK') {
        if (P >= 0.75 && P <= 1.0) pulseRegs = Math.sin(((P - 0.75) / 0.25) * Math.PI);
      }
    }

    // Determine currently displayed values based on sequential progress
    let dispEIP = to.eip;
    let dispMar = to.mar;
    let dispCodeWord = to.codeWord;
    let dispIR = to.ir;
    let dispDecoded = to.decoded;
    let dispLatchA = to.latchA;
    let dispLatchB = to.latchB;
    let dispAluOut = to.aluOut;
    let dispMdr = to.mdr;

    if (P < 1.0) {
      if (stepPhase === 'FETCH') {
        dispEIP = P < 0.42 ? (state.oldEip ?? from.eip) : to.eip;
        dispMar = P < 0.38 ? from.mar : to.mar;
        dispCodeWord = P < 0.38 ? from.codeWord : to.ir;
        dispIR = P < 0.9 ? from.ir : to.ir;
        dispDecoded = P < 0.9 ? from.decoded : to.decoded;
      } else if (stepPhase === 'DECODE') {
        dispLatchA = P < 0.9 ? from.latchA : to.latchA;
        dispLatchB = P < 0.9 ? from.latchB : to.latchB;
      } else if (stepPhase === 'EXECUTE') {
        dispAluOut = P < 0.9 ? from.aluOut : to.aluOut;
      } else if (stepPhase === 'MEMORY') {
        dispMdr = P < 0.9 ? from.mdr : to.mdr;
      }
    }

    // --- COMPONENT HIGHLIGHTING FOR CURRENT CU STATE ---
    // All parts involved in the active CU phase are brightly illuminated in that phase's color!
    const fetchCol = THEME.phases.FETCH.primary;
    const decodeCol = THEME.phases.DECODE.primary;
    const execCol = THEME.phases.EXECUTE.primary;
    const memCol = THEME.phases.MEMORY.primary;
    const wbCol = THEME.phases.WRITEBACK.primary;

    const isEIPActive = activeCUPhase === 'FETCH' || state.activeBuses.includes('BRANCH_TARGET_TO_EIP') || state.activeBuses.includes('JUMP_TARGET_TO_EIP');
    const eipColor = activeCUPhase === 'FETCH' ? fetchCol : execCol;

    const isAdderActive = activeCUPhase === 'FETCH';
    const adderColor = fetchCol;

    const isCodeMemActive = activeCUPhase === 'FETCH';
    const codeMemColor = fetchCol;

    const isIRActive = activeCUPhase === 'FETCH' || activeCUPhase === 'DECODE';
    const irColor = activeCUPhase === 'FETCH' ? fetchCol : decodeCol;

    const isRegsActive = activeCUPhase === 'DECODE' || activeCUPhase === 'WRITEBACK';
    const regsColor = activeCUPhase === 'WRITEBACK' ? wbCol : decodeCol;

    const isLatchAActive = activeCUPhase === 'DECODE' || activeCUPhase === 'EXECUTE';
    const latchAColor = activeCUPhase === 'EXECUTE' ? execCol : decodeCol;

    const isLatchBActive = activeCUPhase === 'DECODE' || activeCUPhase === 'EXECUTE' || (activeCUPhase === 'MEMORY' && state.activeBuses.includes('LATCH_TO_MDR'));
    const latchBColor = state.latchBIsImmediate ? '#f59e0b' : (activeCUPhase === 'EXECUTE' ? execCol : decodeCol);

    const isALUActive = activeCUPhase === 'EXECUTE';
    const aluColor = execCol;

    const isFlagsActive = activeCUPhase === 'EXECUTE';
    const flagsColor = execCol;

    const isALUOutActive = activeCUPhase === 'EXECUTE' || activeCUPhase === 'MEMORY' || (activeCUPhase === 'WRITEBACK' && state.activeBuses.includes('ALU_OUT_TO_REG_WB'));
    const aluOutColor = activeCUPhase === 'EXECUTE' ? execCol : (activeCUPhase === 'MEMORY' ? memCol : wbCol);

    const isMARActive = activeCUPhase === 'MEMORY' || state.activeBuses.includes('ALU_OUT_TO_MAR');
    const marColor = memCol;

    const isMDRActive = activeCUPhase === 'MEMORY' || (activeCUPhase === 'WRITEBACK' && state.activeBuses.includes('MDR_TO_REG_WB'));
    const mdrColor = activeCUPhase === 'MEMORY' ? memCol : wbCol;

    const isDataRAMActive = activeCUPhase === 'MEMORY';
    const dataRAMColor = memCol;

    // 1. Draw Static & Active Bus Lines
    this.drawBuses(ctx, state, boxes, P, activeCUPhase);

    // 2. Draw Datapath Components with full CU state lighting
    this.drawEIP(ctx, bEIP, dispEIP, isEIPActive, eipColor);
    this.drawAdder(ctx, bAdder, isAdderActive, adderColor, pulseAdder);
    this.drawCodeMem(ctx, bCodeMem, dispMar, dispCodeWord, isCodeMemActive, codeMemColor, pulseROM);
    this.drawIR(ctx, bIR, dispIR, dispDecoded, isIRActive, irColor, pulseIR);
    this.drawControlUnit(ctx, bCU, state, activeCUPhase);

    this.drawRegisterFile(ctx, bRegs, state, isRegsActive, regsColor, pulseRegs);
    this.drawLatch(
      ctx,
      bLatchA,
      'Latch A',
      dispLatchA,
      isLatchAActive,
      latchAColor,
      state.latchASource,
      false,
      pulseLatches
    );
    this.drawLatch(
      ctx,
      bLatchB,
      'Latch B',
      dispLatchB,
      isLatchBActive,
      latchBColor,
      state.latchBSource,
      Boolean(state.latchBIsImmediate),
      pulseLatches
    );

    this.drawALU(ctx, bALU, state, isALUActive, aluColor, pulseALU);
    this.drawFlags(ctx, bFlags, to.flags, isFlagsActive, flagsColor);
    this.drawLatch(
      ctx,
      bALUOut,
      'ALU_Out',
      dispAluOut,
      isALUOutActive,
      aluOutColor,
      undefined,
      false,
      pulseALUOut
    );

    this.drawLatch(
      ctx,
      bMAR,
      'MAR',
      to.mar,
      isMARActive,
      marColor
    );
    this.drawLatch(
      ctx,
      bMDR,
      'MDR',
      dispMdr,
      isMDRActive,
      mdrColor,
      undefined,
      false,
      pulseMDR
    );
    this.drawDataRAM(ctx, bDataRAM, state, isDataRAMActive, dataRAMColor, pulseRAM);

    // 3. Render Continuous Bus Flow & Sequential Staged Particles
    if (this.enableParticles) {
      this.renderDatapathParticles(ctx, boxes, state, P, activeCUPhase, from, to, speedScale * this.particleSpeedMultiplier);
    }

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
    b: Record<string, ComponentBounds>,
    P: number,
    activeCUPhase: CPUPhase
  ): void {
    const isAct = (id: ActiveBusId) => state.activeBuses.includes(id);

    // Helper to draw bus line with optional glow and arrowhead
    const drawLine = (points: Point2D[], active: boolean, activeColor: string = THEME.textAccent) => {
      if (points.length < 2) return;
      ctx.save();

      const p1 = points[points.length - 2];
      const p2 = points[points.length - 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      const arrowLen = active ? THEME.activeArrowHeadLength : THEME.arrowHeadLength;
      const arrowAngle = Math.PI / 6;

      // Shorten line slightly so the blunt line cap does not protrude past the sharp arrowhead tip
      const shortenDist = segLen > 0 ? Math.min(arrowLen * 0.7, segLen * 0.7) : 0;
      const lineEndX = p2.x - shortenDist * Math.cos(angle);
      const lineEndY = p2.y - shortenDist * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(lineEndX, lineEndY);

      if (active) {
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = THEME.activeBusWidth;
        ctx.shadowColor = activeColor;
        ctx.shadowBlur = 12;
      } else {
        ctx.strokeStyle = THEME.busDefault;
        ctx.lineWidth = THEME.busWidth;
      }
      ctx.stroke();

      // Directional arrow on last segment
      ctx.fillStyle = active ? activeColor : (THEME.busArrowDefault || THEME.busDefault);
      ctx.beginPath();
      ctx.moveTo(p2.x, p2.y);
      ctx.lineTo(
        p2.x - arrowLen * Math.cos(angle - arrowAngle),
        p2.y - arrowLen * Math.sin(angle - arrowAngle)
      );
      ctx.lineTo(
        p2.x - arrowLen * Math.cos(angle + arrowAngle),
        p2.y - arrowLen * Math.sin(angle + arrowAngle)
      );
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    const fetchColor = THEME.phases.FETCH.primary;
    const decodeColor = THEME.phases.DECODE.primary;
    const execColor = THEME.phases.EXECUTE.primary;
    const memColor = THEME.phases.MEMORY.primary;
    const wbColor = THEME.phases.WRITEBACK.primary;

    // 1. EIP -> Code Memory (ROM) Address Bus
    const isFetchAddrActive = activeCUPhase === 'FETCH' && (P <= 0.48 || P >= 1.0 || isAct('EIP_TO_MAR'));
    drawLine(
      [
        { x: b.bEIP.x + b.bEIP.w, y: b.bEIP.y + 35 },
        { x: b.bCodeMem.x, y: b.bCodeMem.y + 35 },
      ],
      isFetchAddrActive,
      fetchColor
    );

    // 2. EIP <-> +4 Adder Loop
    const isAdderActive = activeCUPhase === 'FETCH';
    drawLine(
      [
        { x: b.bEIP.x + 35, y: b.bEIP.y },
        { x: b.bAdder.x + 35, y: b.bAdder.y + b.bAdder.h },
      ],
      isAdderActive,
      fetchColor
    );
    drawLine(
      [
        { x: b.bAdder.x + 75, y: b.bAdder.y + b.bAdder.h },
        { x: b.bEIP.x + 75, y: b.bEIP.y },
      ],
      isAdderActive,
      fetchColor
    );

    // 3. Code Memory (ROM) -> IR Instruction Word Data Bus
    const isFetchDataActive = activeCUPhase === 'FETCH' && (P >= 0.45 || P >= 1.0 || isAct('CODE_MEM_TO_IR'));
    drawLine(
      [
        { x: b.bCodeMem.x + b.bCodeMem.w, y: b.bCodeMem.y + 35 },
        { x: b.bIR.x, y: b.bIR.y + 35 },
      ],
      isFetchDataActive,
      fetchColor
    );

    // 4. IR -> Register File (Register address lines for Decode)
    const isRegReadActive = activeCUPhase === 'DECODE';
    drawLine(
      [
        { x: b.bIR.x + 45, y: b.bIR.y + b.bIR.h },
        { x: b.bIR.x + 45, y: 185 },
        { x: b.bRegs.x + 110, y: 185 },
        { x: b.bRegs.x + 110, y: b.bRegs.y },
      ],
      isRegReadActive,
      decodeColor
    );

    // 5. IR -> Latch B (Immediate constant line)
    const isImmActive = Boolean(state.latchBIsImmediate) && (activeCUPhase === 'DECODE' || isAct('IMM_TO_ALU'));
    drawLine(
      [
        { x: b.bIR.x + 130, y: b.bIR.y + b.bIR.h },
        { x: b.bIR.x + 130, y: b.bLatchB.y + 27 },
        { x: b.bLatchB.x, y: b.bLatchB.y + 27 },
      ],
      isImmActive,
      '#f59e0b'
    );

    // 6. Register File -> Latches A & B
    const isRegToLatchActive = activeCUPhase === 'DECODE';
    drawLine(
      [
        { x: b.bRegs.x + b.bRegs.w, y: b.bLatchA.y + 27 },
        { x: b.bLatchA.x, y: b.bLatchA.y + 27 },
      ],
      isRegToLatchActive,
      decodeColor
    );
    drawLine(
      [
        { x: b.bRegs.x + b.bRegs.w, y: b.bLatchB.y + 27 },
        { x: b.bLatchB.x, y: b.bLatchB.y + 27 },
      ],
      isRegToLatchActive && !state.latchBIsImmediate,
      decodeColor
    );

    // 7. Latches -> ALU Inputs
    const isLatchToALUActive = activeCUPhase === 'EXECUTE';
    drawLine(
      [
        { x: b.bLatchA.x + b.bLatchA.w, y: b.bLatchA.y + 27 },
        { x: b.bALU.x, y: b.bALU.y + 35 },
      ],
      isLatchToALUActive,
      execColor
    );
    drawLine(
      [
        { x: b.bLatchB.x + b.bLatchB.w, y: b.bLatchB.y + 27 },
        { x: b.bALU.x, y: b.bALU.y + 105 },
      ],
      isLatchToALUActive || isAct('IMM_TO_ALU'),
      execColor
    );

    // 8. ALU -> ALU_Out
    const isALUToOutActive = activeCUPhase === 'EXECUTE';
    drawLine(
      [
        { x: b.bALU.x + b.bALU.w, y: b.bALU.y + 70 },
        { x: b.bALUOut.x, y: b.bALUOut.y + 27 },
      ],
      isALUToOutActive,
      execColor
    );

    // 9. ALU -> Flags
    const isALUToFlagsActive = activeCUPhase === 'EXECUTE';
    drawLine(
      [
        { x: b.bALU.x + b.bALU.w, y: b.bALU.y + 30 },
        { x: b.bFlags.x, y: b.bFlags.y + 35 },
      ],
      isALUToFlagsActive,
      execColor
    );

    // 10. ALU_Out -> MAR (Data RAM address)
    const isALUToMARActive = activeCUPhase === 'MEMORY' || isAct('ALU_OUT_TO_MAR');
    drawLine(
      [
        { x: b.bALUOut.x + b.bALUOut.w, y: b.bALUOut.y + 27 },
        { x: 920, y: b.bALUOut.y + 27 },
        { x: 920, y: b.bMAR.y + 27 },
        { x: b.bMAR.x, y: b.bMAR.y + 27 },
      ],
      isALUToMARActive,
      memColor
    );

    // 11. MAR -> Data RAM (Memory Address Bus routed around to the right of MDR)
    const bypassX = b.bMDR.x + b.bMDR.w + 20;
    drawLine(
      [
        { x: b.bMAR.x + b.bMAR.w, y: b.bMAR.y + 27 },
        { x: bypassX, y: b.bMAR.y + 27 },
        { x: bypassX, y: b.bDataRAM.y },
      ],
      isALUToMARActive,
      memColor
    );

    // 12. Latch B -> MDR (Memory Store data)
    const isStoreInst =
      isAct('LATCH_TO_MDR') ||
      isAct('MDR_TO_DATA_MEM') ||
      (activeCUPhase === 'MEMORY' &&
        Boolean(
          state.decoded &&
            (state.decoded.opcode === OPCODES.MOV_MR ||
              state.decoded.opcode === OPCODES.MOVB_MR ||
              state.decoded.opcode === OPCODES.MOVW_MR ||
              state.decoded.opcode === OPCODES.MOV_MI)
        ));
    const isLatchToMDRActive = isStoreInst;
    drawLine(
      [
        { x: b.bLatchB.x + b.bLatchB.w / 2, y: b.bLatchB.y + b.bLatchB.h },
        { x: b.bLatchB.x + b.bLatchB.w / 2, y: 425 },
        { x: 932, y: 425 },
        { x: 932, y: b.bMDR.y + 27 },
        { x: b.bMDR.x, y: b.bMDR.y + 27 },
      ],
      isLatchToMDRActive,
      memColor
    );

    // 13. MDR <-> Data RAM
    const isRAMDataActive = activeCUPhase === 'MEMORY' || isAct('MEM_TO_MDR') || isAct('MDR_TO_DATA_MEM');
    const dataConnX = 1015;
    drawLine(
      isStoreInst
        ? [
            { x: dataConnX, y: b.bMDR.y + b.bMDR.h },
            { x: dataConnX, y: b.bDataRAM.y },
          ]
        : [
            { x: dataConnX, y: b.bDataRAM.y },
            { x: dataConnX, y: b.bMDR.y + b.bMDR.h },
          ],
      isRAMDataActive,
      memColor
    );

    // 14. Writeback Bus (ALU_Out / MDR back to Register File)
    const isWBActive = activeCUPhase === 'WRITEBACK' || isAct('ALU_OUT_TO_REG_WB') || isAct('MDR_TO_REG_WB');
    drawLine(
      [
        { x: b.bALUOut.x + 40, y: b.bALUOut.y + b.bALUOut.h },
        { x: b.bALUOut.x + 40, y: 550 },
        { x: b.bRegs.x + b.bRegs.w / 2, y: 550 },
        { x: b.bRegs.x + b.bRegs.w / 2, y: b.bRegs.y + b.bRegs.h },
      ],
      isWBActive && !isAct('MDR_TO_REG_WB'),
      wbColor
    );

    drawLine(
      [
        { x: b.bMDR.x + 15, y: b.bMDR.y + b.bMDR.h },
        { x: b.bMDR.x + 15, y: 575 },
        { x: b.bRegs.x + b.bRegs.w / 2 - 25, y: 575 },
        { x: b.bRegs.x + b.bRegs.w / 2 - 25, y: b.bRegs.y + b.bRegs.h },
      ],
      isWBActive && isAct('MDR_TO_REG_WB'),
      wbColor
    );

    // 15. Branch/Jump Target feedback to EIP
    const isBranchActive = isAct('BRANCH_TARGET_TO_EIP') || isAct('JUMP_TARGET_TO_EIP');
    drawLine(
      [
        { x: b.bALU.x + 40, y: b.bALU.y },
        { x: b.bALU.x + 40, y: 175 },
        { x: b.bEIP.x + 60, y: 175 },
        { x: b.bEIP.x + 60, y: b.bEIP.y + b.bEIP.h },
      ],
      isBranchActive,
      execColor
    );
  }

  /**
   * Renders continuous flowing particles on all active buses AND sequential staged packets during transitions.
   */
  private renderDatapathParticles(
    ctx: CanvasRenderingContext2D,
    b: Record<string, ComponentBounds>,
    state: CPUMicroState,
    P: number,
    activeCUPhase: CPUPhase,
    from: DisplaySnapshot,
    to: DisplaySnapshot,
    speedScale: number
  ): void {
    const fetchCol = THEME.phases.FETCH.primary;
    const fetchGlow = THEME.phases.FETCH.glow;
    const decodeCol = THEME.phases.DECODE.primary;
    const decodeGlow = THEME.phases.DECODE.glow;
    const execCol = THEME.phases.EXECUTE.primary;
    const execGlow = THEME.phases.EXECUTE.glow;
    const memCol = THEME.phases.MEMORY.primary;
    const memGlow = THEME.phases.MEMORY.glow;
    const wbCol = THEME.phases.WRITEBACK.primary;
    const wbGlow = THEME.phases.WRITEBACK.glow;

    // A. SEQUENTIAL STAGED PACKETS DURING STEP TRANSITION (P < 1.0)
    if (P < 1.0) {
      if (activeCUPhase === 'FETCH') {
        // Stage 1: Address Packet EIP -> Code Memory (ROM)
        const pAddr = P / 0.42;
        if (pAddr >= 0 && pAddr <= 1) {
          const pathEIPToROM: Point2D[] = [
            { x: b.bEIP.x + b.bEIP.w, y: b.bEIP.y + 35 },
            { x: b.bCodeMem.x, y: b.bCodeMem.y + 35 },
          ];
          const fetchAddrHex = toHex32(state.oldEip ?? from.eip);
          ParticleSystem.renderPacket(ctx, pathEIPToROM, pAddr, fetchCol, fetchGlow, fetchAddrHex, 4);
        }

        // Parallel/Staggered: EIP loop through +4 Dedicated Adder
        const pAdder = (P - 0.1) / 0.34;
        if (pAdder >= 0 && pAdder <= 1) {
          const pathAdder: Point2D[] = [
            { x: b.bEIP.x + 35, y: b.bEIP.y },
            { x: b.bAdder.x + 35, y: b.bAdder.y + b.bAdder.h },
            { x: b.bAdder.x + 75, y: b.bAdder.y + b.bAdder.h },
            { x: b.bEIP.x + 75, y: b.bEIP.y },
          ];
          const newEipHex = toHex32(to.eip);
          ParticleSystem.renderPacket(ctx, pathAdder, pAdder, fetchCol, fetchGlow, newEipHex, 3);
        }

        // Stage 3: Instruction Word Packet Code Memory (ROM) -> IR
        // Starts after address arrives and ROM is read (P = 0.48 to 0.90)
        const pWord = (P - 0.48) / 0.42;
        if (pWord >= 0 && pWord <= 1) {
          const pathROMToIR: Point2D[] = [
            { x: b.bCodeMem.x + b.bCodeMem.w, y: b.bCodeMem.y + 35 },
            { x: b.bIR.x, y: b.bIR.y + 35 },
          ];
          const wordHex = toHex32(to.ir);
          ParticleSystem.renderPacket(ctx, pathROMToIR, pWord, fetchCol, fetchGlow, wordHex, 4);
        }
      } else if (activeCUPhase === 'DECODE') {
        const pIRToRegs = P / 0.45;
        if (pIRToRegs >= 0 && pIRToRegs <= 1) {
          const pathIRToRegs: Point2D[] = [
            { x: b.bIR.x + 45, y: b.bIR.y + b.bIR.h },
            { x: b.bIR.x + 45, y: 185 },
            { x: b.bRegs.x + 110, y: 185 },
            { x: b.bRegs.x + 110, y: b.bRegs.y },
          ];
          ParticleSystem.renderPacket(ctx, pathIRToRegs, pIRToRegs, decodeCol, decodeGlow, 'REG_ADDR', 3);
        }

        const pRegToLatch = (P - 0.48) / 0.42;
        if (pRegToLatch >= 0 && pRegToLatch <= 1) {
          const pathA: Point2D[] = [
            { x: b.bRegs.x + b.bRegs.w, y: b.bLatchA.y + 27 },
            { x: b.bLatchA.x, y: b.bLatchA.y + 27 },
          ];
          ParticleSystem.renderPacket(ctx, pathA, pRegToLatch, decodeCol, decodeGlow, toHex32(to.latchA), 3);

          if (state.latchBIsImmediate) {
            const pathImm: Point2D[] = [
              { x: b.bIR.x + 130, y: b.bIR.y + b.bIR.h },
              { x: b.bIR.x + 130, y: b.bLatchB.y + 27 },
              { x: b.bLatchB.x, y: b.bLatchB.y + 27 },
            ];
            ParticleSystem.renderPacket(ctx, pathImm, pRegToLatch, '#f59e0b', '#fbbf24', toHex32(to.latchB), 3);
          } else {
            const pathB: Point2D[] = [
              { x: b.bRegs.x + b.bRegs.w, y: b.bLatchB.y + 27 },
              { x: b.bLatchB.x, y: b.bLatchB.y + 27 },
            ];
            ParticleSystem.renderPacket(ctx, pathB, pRegToLatch, decodeCol, decodeGlow, toHex32(to.latchB), 3);
          }
        }
      } else if (activeCUPhase === 'EXECUTE') {
        const pIn = P / 0.45;
        if (pIn >= 0 && pIn <= 1) {
          const pathA: Point2D[] = [
            { x: b.bLatchA.x + b.bLatchA.w, y: b.bLatchA.y + 27 },
            { x: b.bALU.x, y: b.bALU.y + 35 },
          ];
          const pathB: Point2D[] = [
            { x: b.bLatchB.x + b.bLatchB.w, y: b.bLatchB.y + 27 },
            { x: b.bALU.x, y: b.bALU.y + 105 },
          ];
          ParticleSystem.renderPacket(ctx, pathA, pIn, execCol, execGlow, undefined, 3);
          ParticleSystem.renderPacket(ctx, pathB, pIn, execCol, execGlow, undefined, 3);
        }

        const pOut = (P - 0.5) / 0.42;
        if (pOut >= 0 && pOut <= 1) {
          const pathOut: Point2D[] = [
            { x: b.bALU.x + b.bALU.w, y: b.bALU.y + 70 },
            { x: b.bALUOut.x, y: b.bALUOut.y + 27 },
          ];
          ParticleSystem.renderPacket(ctx, pathOut, pOut, execCol, execGlow, toHex32(to.aluOut), 4);

          const pathFlags: Point2D[] = [
            { x: b.bALU.x + b.bALU.w, y: b.bALU.y + 30 },
            { x: b.bFlags.x, y: b.bFlags.y + 35 },
          ];
          ParticleSystem.renderPacket(ctx, pathFlags, pOut, execCol, execGlow, undefined, 2);

          if (state.activeBuses.includes('BRANCH_TARGET_TO_EIP') || state.activeBuses.includes('JUMP_TARGET_TO_EIP')) {
            const pathBranch: Point2D[] = [
              { x: b.bALU.x + 40, y: b.bALU.y },
              { x: b.bALU.x + 40, y: 175 },
              { x: b.bEIP.x + 60, y: 175 },
              { x: b.bEIP.x + 60, y: b.bEIP.y + b.bEIP.h },
            ];
            ParticleSystem.renderPacket(ctx, pathBranch, pOut, execCol, execGlow, toHex32(to.eip), 4);
          }
        }
      } else if (activeCUPhase === 'MEMORY') {
        const bypassX = b.bMDR.x + b.bMDR.w + 20;
        const dataConnX = 1015;
        const isStore =
          state.activeBuses.includes('LATCH_TO_MDR') ||
          state.activeBuses.includes('MDR_TO_DATA_MEM') ||
          Boolean(
            state.decoded &&
              (state.decoded.opcode === OPCODES.MOV_MR ||
                state.decoded.opcode === OPCODES.MOVB_MR)
          );

        if (isStore) {
          // Store Operation Stage 1: ALU_Out -> MAR (Target Address) & Latch B -> MDR (Data)
          const pStage1 = P / 0.45;
          if (pStage1 >= 0 && pStage1 <= 1) {
            const pathMAR: Point2D[] = [
              { x: b.bALUOut.x + b.bALUOut.w, y: b.bALUOut.y + 27 },
              { x: 920, y: b.bALUOut.y + 27 },
              { x: 920, y: b.bMAR.y + 27 },
              { x: b.bMAR.x, y: b.bMAR.y + 27 },
            ];
            ParticleSystem.renderPacket(ctx, pathMAR, pStage1, memCol, memGlow, toHex32(to.mar), 3);

            const pathLatchToMDR: Point2D[] = [
              { x: b.bLatchB.x + b.bLatchB.w / 2, y: b.bLatchB.y + b.bLatchB.h },
              { x: b.bLatchB.x + b.bLatchB.w / 2, y: 425 },
              { x: 932, y: 425 },
              { x: 932, y: b.bMDR.y + 27 },
              { x: b.bMDR.x, y: b.bMDR.y + 27 },
            ];
            ParticleSystem.renderPacket(ctx, pathLatchToMDR, pStage1, memCol, memGlow, toHex32(to.mdr), 4);
          }

          // Store Operation Stage 2: MAR -> RAM (Address around right of MDR) & MDR -> RAM (Data)
          const pStage2 = (P - 0.48) / 0.45;
          if (pStage2 >= 0 && pStage2 <= 1) {
            const pathMARToRAM: Point2D[] = [
              { x: b.bMAR.x + b.bMAR.w, y: b.bMAR.y + 27 },
              { x: bypassX, y: b.bMAR.y + 27 },
              { x: bypassX, y: b.bDataRAM.y },
            ];
            ParticleSystem.renderPacket(ctx, pathMARToRAM, pStage2, memCol, memGlow, toHex32(to.mar), 3);

            const pathMDRToRAM: Point2D[] = [
              { x: dataConnX, y: b.bMDR.y + b.bMDR.h },
              { x: dataConnX, y: b.bDataRAM.y },
            ];
            ParticleSystem.renderPacket(ctx, pathMDRToRAM, pStage2, memCol, memGlow, toHex32(to.mdr), 4);
          }
        } else {
          // Load Operation Stage 1: ALU_Out -> MAR (Target Address) & MAR -> RAM (Address around right of MDR)
          const pMem = P / 0.45;
          if (pMem >= 0 && pMem <= 1) {
            const pathMAR: Point2D[] = [
              { x: b.bALUOut.x + b.bALUOut.w, y: b.bALUOut.y + 27 },
              { x: 920, y: b.bALUOut.y + 27 },
              { x: 920, y: b.bMAR.y + 27 },
              { x: b.bMAR.x, y: b.bMAR.y + 27 },
            ];
            ParticleSystem.renderPacket(ctx, pathMAR, pMem, memCol, memGlow, toHex32(to.mar), 3);
          }

          const pAddrRAM = (P - 0.2) / 0.35;
          if (pAddrRAM >= 0 && pAddrRAM <= 1) {
            const pathMARToRAM: Point2D[] = [
              { x: b.bMAR.x + b.bMAR.w, y: b.bMAR.y + 27 },
              { x: bypassX, y: b.bMAR.y + 27 },
              { x: bypassX, y: b.bDataRAM.y },
            ];
            ParticleSystem.renderPacket(ctx, pathMARToRAM, pAddrRAM, memCol, memGlow, toHex32(to.mar), 3);
          }

          // Load Operation Stage 2: Data RAM -> MDR (Data read)
          const pMDR = (P - 0.5) / 0.42;
          if (pMDR >= 0 && pMDR <= 1) {
            const pathRead: Point2D[] = [
              { x: dataConnX, y: b.bDataRAM.y },
              { x: dataConnX, y: b.bMDR.y + b.bMDR.h },
            ];
            ParticleSystem.renderPacket(ctx, pathRead, pMDR, memCol, memGlow, toHex32(to.mdr), 4);
          }
        }
      } else if (activeCUPhase === 'WRITEBACK') {
        const pWB = P / 0.8;
        if (pWB >= 0 && pWB <= 1) {
          if (!state.activeBuses.includes('MDR_TO_REG_WB')) {
            const pathWB: Point2D[] = [
              { x: b.bALUOut.x + 40, y: b.bALUOut.y + b.bALUOut.h },
              { x: b.bALUOut.x + 40, y: 550 },
              { x: b.bRegs.x + b.bRegs.w / 2, y: 550 },
              { x: b.bRegs.x + b.bRegs.w / 2, y: b.bRegs.y + b.bRegs.h },
            ];
            ParticleSystem.renderPacket(ctx, pathWB, pWB, wbCol, wbGlow, toHex32(to.aluOut), 5);
          } else {
            const pathWB: Point2D[] = [
              { x: b.bMDR.x + 15, y: b.bMDR.y + b.bMDR.h },
              { x: b.bMDR.x + 15, y: 575 },
              { x: b.bRegs.x + b.bRegs.w / 2 - 25, y: 575 },
              { x: b.bRegs.x + b.bRegs.w / 2 - 25, y: b.bRegs.y + b.bRegs.h },
            ];
            ParticleSystem.renderPacket(ctx, pathWB, pWB, wbCol, wbGlow, toHex32(to.mdr), 5);
          }
        }
      }
    }

    // B. CONTINUOUS FLOWING PARTICLES ON ACTIVE BUSES
    // Ensures the datapath ALWAYS shows glowing, flowing data movement while in any CU state!
    const timeSec = (performance.now() / 1000) * Math.max(0.7, speedScale);

    const renderFlow = (path: Point2D[], col: string, glow: string, count: number = 2) => {
      for (let i = 0; i < count; i++) {
        const progress = (timeSec * 0.75 + (i / count)) % 1.0;
        ParticleSystem.renderPacket(ctx, path, progress, col, glow, undefined, 2);
      }
    };

    if (activeCUPhase === 'FETCH') {
      const pathEIPToROM: Point2D[] = [
        { x: b.bEIP.x + b.bEIP.w, y: b.bEIP.y + 35 },
        { x: b.bCodeMem.x, y: b.bCodeMem.y + 35 },
      ];
      renderFlow(pathEIPToROM, fetchCol, fetchGlow, 2);

      const pathAdder: Point2D[] = [
        { x: b.bEIP.x + 35, y: b.bEIP.y },
        { x: b.bAdder.x + 35, y: b.bAdder.y + b.bAdder.h },
        { x: b.bAdder.x + 75, y: b.bAdder.y + b.bAdder.h },
        { x: b.bEIP.x + 75, y: b.bEIP.y },
      ];
      renderFlow(pathAdder, fetchCol, fetchGlow, 2);

      const pathROMToIR: Point2D[] = [
        { x: b.bCodeMem.x + b.bCodeMem.w, y: b.bCodeMem.y + 35 },
        { x: b.bIR.x, y: b.bIR.y + 35 },
      ];
      renderFlow(pathROMToIR, fetchCol, fetchGlow, 2);
    } else if (activeCUPhase === 'DECODE') {
      const pathIRToRegs: Point2D[] = [
        { x: b.bIR.x + 45, y: b.bIR.y + b.bIR.h },
        { x: b.bIR.x + 45, y: 185 },
        { x: b.bRegs.x + 110, y: 185 },
        { x: b.bRegs.x + 110, y: b.bRegs.y },
      ];
      renderFlow(pathIRToRegs, decodeCol, decodeGlow, 2);

      const pathA: Point2D[] = [
        { x: b.bRegs.x + b.bRegs.w, y: b.bLatchA.y + 27 },
        { x: b.bLatchA.x, y: b.bLatchA.y + 27 },
      ];
      renderFlow(pathA, decodeCol, decodeGlow, 2);

      if (state.latchBIsImmediate) {
        const pathImm: Point2D[] = [
          { x: b.bIR.x + 130, y: b.bIR.y + b.bIR.h },
          { x: b.bIR.x + 130, y: b.bLatchB.y + 27 },
          { x: b.bLatchB.x, y: b.bLatchB.y + 27 },
        ];
        renderFlow(pathImm, '#f59e0b', '#fbbf24', 2);
      } else {
        const pathB: Point2D[] = [
          { x: b.bRegs.x + b.bRegs.w, y: b.bLatchB.y + 27 },
          { x: b.bLatchB.x, y: b.bLatchB.y + 27 },
        ];
        renderFlow(pathB, decodeCol, decodeGlow, 2);
      }
    } else if (activeCUPhase === 'EXECUTE') {
      const pathA: Point2D[] = [
        { x: b.bLatchA.x + b.bLatchA.w, y: b.bLatchA.y + 27 },
        { x: b.bALU.x, y: b.bALU.y + 35 },
      ];
      const pathB: Point2D[] = [
        { x: b.bLatchB.x + b.bLatchB.w, y: b.bLatchB.y + 27 },
        { x: b.bALU.x, y: b.bALU.y + 105 },
      ];
      renderFlow(pathA, execCol, execGlow, 2);
      renderFlow(pathB, execCol, execGlow, 2);

      const pathOut: Point2D[] = [
        { x: b.bALU.x + b.bALU.w, y: b.bALU.y + 70 },
        { x: b.bALUOut.x, y: b.bALUOut.y + 27 },
      ];
      renderFlow(pathOut, execCol, execGlow, 2);

      const pathFlags: Point2D[] = [
        { x: b.bALU.x + b.bALU.w, y: b.bALU.y + 30 },
        { x: b.bFlags.x, y: b.bFlags.y + 35 },
      ];
      renderFlow(pathFlags, execCol, execGlow, 1);
    } else if (activeCUPhase === 'MEMORY') {
      const bypassX = b.bMDR.x + b.bMDR.w + 20;
      const dataConnX = 1015;
      const isStore =
        state.activeBuses.includes('LATCH_TO_MDR') ||
        state.activeBuses.includes('MDR_TO_DATA_MEM') ||
        Boolean(
          state.decoded &&
            (state.decoded.opcode === OPCODES.MOV_MR ||
              state.decoded.opcode === OPCODES.MOVB_MR)
        );

      const pathMAR: Point2D[] = [
        { x: b.bALUOut.x + b.bALUOut.w, y: b.bALUOut.y + 27 },
        { x: 920, y: b.bALUOut.y + 27 },
        { x: 920, y: b.bMAR.y + 27 },
        { x: b.bMAR.x, y: b.bMAR.y + 27 },
      ];
      renderFlow(pathMAR, memCol, memGlow, 2);

      const pathMARToRAM: Point2D[] = [
        { x: b.bMAR.x + b.bMAR.w, y: b.bMAR.y + 27 },
        { x: bypassX, y: b.bMAR.y + 27 },
        { x: bypassX, y: b.bDataRAM.y },
      ];
      renderFlow(pathMARToRAM, memCol, memGlow, 2);

      if (isStore) {
        const pathLatchToMDR: Point2D[] = [
          { x: b.bLatchB.x + b.bLatchB.w / 2, y: b.bLatchB.y + b.bLatchB.h },
          { x: b.bLatchB.x + b.bLatchB.w / 2, y: 425 },
          { x: 932, y: 425 },
          { x: 932, y: b.bMDR.y + 27 },
          { x: b.bMDR.x, y: b.bMDR.y + 27 },
        ];
        renderFlow(pathLatchToMDR, memCol, memGlow, 2);

        const pathMDRToRAM: Point2D[] = [
          { x: dataConnX, y: b.bMDR.y + b.bMDR.h },
          { x: dataConnX, y: b.bDataRAM.y },
        ];
        renderFlow(pathMDRToRAM, memCol, memGlow, 2);
      } else {
        const pathRAMToMDR: Point2D[] = [
          { x: dataConnX, y: b.bDataRAM.y },
          { x: dataConnX, y: b.bMDR.y + b.bMDR.h },
        ];
        renderFlow(pathRAMToMDR, memCol, memGlow, 2);
      }
    } else if (activeCUPhase === 'WRITEBACK') {
      if (!state.activeBuses.includes('MDR_TO_REG_WB')) {
        const pathWB: Point2D[] = [
          { x: b.bALUOut.x + 40, y: b.bALUOut.y + b.bALUOut.h },
          { x: b.bALUOut.x + 40, y: 550 },
          { x: b.bRegs.x + b.bRegs.w / 2, y: 550 },
          { x: b.bRegs.x + b.bRegs.w / 2, y: b.bRegs.y + b.bRegs.h },
        ];
        renderFlow(pathWB, wbCol, wbGlow, 3);
      } else {
        const pathWB: Point2D[] = [
          { x: b.bMDR.x + 15, y: b.bMDR.y + b.bMDR.h },
          { x: b.bMDR.x + 15, y: 575 },
          { x: b.bRegs.x + b.bRegs.w / 2 - 25, y: 575 },
          { x: b.bRegs.x + b.bRegs.w / 2 - 25, y: b.bRegs.y + b.bRegs.h },
        ];
        renderFlow(pathWB, wbCol, wbGlow, 3);
      }
    }
  }

  // --- Component Drawing Helpers ---

  private drawCard(
    ctx: CanvasRenderingContext2D,
    box: { x: number; y: number; w: number; h: number },
    title: string,
    active: boolean = false,
    activeColor: string = THEME.textAccent,
    pulse: number = 0
  ): void {
    ctx.save();
    if (active || pulse > 0) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = pulse > 0 ? 2.5 : 2;
      ctx.shadowColor = activeColor;
      ctx.shadowBlur = pulse > 0 ? 18 + pulse * 12 : 14;
    } else {
      ctx.fillStyle = THEME.cardBg;
      ctx.strokeStyle = THEME.cardBorder;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 6);
    ctx.fill();
    ctx.stroke();

    // Title bar
    ctx.shadowBlur = 0;
    ctx.fillStyle = active || pulse > 0 ? activeColor : THEME.textSecondary;
    ctx.font = '11px "Inter", system-ui, sans-serif';
    ctx.fillText(title, box.x + 8, box.y + 16);
    ctx.restore();
  }

  private drawEIP(
    ctx: CanvasRenderingContext2D,
    box: ComponentBounds,
    val: number,
    active: boolean,
    activeColor: string
  ): void {
    this.drawCard(ctx, box, 'EIP (Program Counter)', active, activeColor);

    ctx.fillStyle = THEME.textPrimary;
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillText(toHex32(val), box.x + 10, box.y + 42);

    ctx.fillStyle = THEME.textMuted;
    ctx.font = '10px monospace';
    ctx.fillText(`Dec: ${toInt32(val)}`, box.x + 10, box.y + 58);
  }

  private drawAdder(
    ctx: CanvasRenderingContext2D,
    box: ComponentBounds,
    active: boolean,
    activeColor: string,
    pulse: number
  ): void {
    this.drawCard(ctx, box, '+4 Dedicated Adder', active || pulse > 0, activeColor, pulse);
    ctx.fillStyle = active || pulse > 0 ? activeColor : THEME.textSecondary;
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText('EIP + 4', box.x + 18, box.y + 32);
  }

  private drawCodeMem(
    ctx: CanvasRenderingContext2D,
    box: ComponentBounds,
    addr: number,
    word: number,
    active: boolean,
    activeColor: string,
    pulse: number
  ): void {
    this.drawCard(ctx, box, 'Code Memory (ROM)', active || pulse > 0, activeColor, pulse);

    ctx.fillStyle = active || pulse > 0 ? '#6ee7b7' : THEME.textMuted;
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillText('Addr: ' + toHex32(addr), box.x + 10, box.y + 38);

    ctx.fillStyle = active || pulse > 0 ? '#a7f3d0' : (word !== 0 ? THEME.textAccent : THEME.textMuted);
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText('Word: ' + toHex32(word), box.x + 10, box.y + 62);
  }

  private drawIR(
    ctx: CanvasRenderingContext2D,
    box: ComponentBounds,
    val: number,
    decoded: DecodedInstruction | null,
    active: boolean,
    activeColor: string,
    pulse: number
  ): void {
    this.drawCard(ctx, box, 'Instruction Register (IR)', active || pulse > 0, activeColor, pulse);

    ctx.fillStyle = active || val !== 0 ? THEME.textPrimary : THEME.textMuted;
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.fillText(toHex32(val), box.x + 10, box.y + 40);

    ctx.fillStyle = active ? activeColor : (decoded ? THEME.phases.DECODE.primary : THEME.textMuted);
    ctx.font = 'bold 11.5px "JetBrains Mono", monospace';
    ctx.fillText(decoded ? decoded.assemblyString : (val !== 0 ? 'FETCHED WORD' : 'NOP / IDLE'), box.x + 10, box.y + 64);
  }

  /**
   * Draws the Control Unit as an overarching FSM controller panel without misleading datapath arrows.
   */
  private drawControlUnit(
    ctx: CanvasRenderingContext2D,
    box: ComponentBounds,
    state: CPUMicroState,
    activeCUPhase: CPUPhase
  ): void {
    const phaseInfo = THEME.phases[activeCUPhase] || THEME.phases.FETCH;

    this.drawCard(ctx, box, 'Control Unit (FSM Controller)', true, phaseInfo.primary);

    // Phase Pill
    ctx.save();
    ctx.fillStyle = phaseInfo.primary;
    ctx.beginPath();
    ctx.roundRect(box.x + 10, box.y + 26, 95, 24, 12);
    ctx.fill();

    ctx.fillStyle = '#0a0d14';
    ctx.font = 'bold 11.5px "Inter", sans-serif';
    ctx.fillText(phaseInfo.name.toUpperCase(), box.x + 20, box.y + 42);

    // Active Cycle & Insts statistics
    ctx.fillStyle = THEME.textSecondary;
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillText(`Cycle: ${state.cycles}`, box.x + 115, box.y + 35);
    ctx.fillText(`Insts: ${state.instructionCount}`, box.x + 115, box.y + 48);

    // Microcode RTL description
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9.5px "JetBrains Mono", monospace';
    ctx.fillText(phaseInfo.description.substring(0, 48) + '...', box.x + 10, box.y + 72);

    // Hardware Microcode Control Signals Bar
    const signals = [
      { name: 'PC_Inc', active: activeCUPhase === 'FETCH' },
      { name: 'MemRead', active: activeCUPhase === 'FETCH' || (activeCUPhase === 'MEMORY' && state.activeBuses.includes('MEM_TO_MDR')) },
      { name: 'IR_Latch', active: activeCUPhase === 'FETCH' },
      { name: 'RegRead', active: activeCUPhase === 'DECODE' },
      { name: 'ALU_Op', active: activeCUPhase === 'EXECUTE' },
      { name: 'RegWrite', active: activeCUPhase === 'WRITEBACK' },
    ];

    const sigW = 54;
    const sigH = 18;
    signals.forEach((sig, idx) => {
      const sx = box.x + 10 + idx * (sigW + 4);
      const sy = box.y + 85;

      ctx.fillStyle = sig.active ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = sig.active ? phaseInfo.primary : '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(sx, sy, sigW, sigH, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = sig.active ? phaseInfo.primary : '#64748b';
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.fillText(sig.name, sx + 5, sy + 12);
    });

    ctx.restore();
  }

  private drawRegisterFile(
    ctx: CanvasRenderingContext2D,
    box: ComponentBounds,
    state: CPUMicroState,
    active: boolean,
    activeColor: string,
    pulse: number
  ): void {
    this.drawCard(
      ctx,
      box,
      'Register File (8 x 32-bit)',
      active || pulse > 0,
      activeColor,
      pulse
    );

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
    box: ComponentBounds,
    label: string,
    val: number,
    active: boolean,
    activeColor: string,
    sourceTag?: string,
    isImmediate?: boolean,
    pulse: number = 0
  ): void {
    const cardColor = isImmediate ? '#f59e0b' : activeColor;
    this.drawCard(ctx, box, label, active || pulse > 0, cardColor, pulse);

    if (sourceTag && sourceTag !== 'NONE') {
      ctx.save();
      const badgeText = isImmediate
        ? 'IMM'
        : sourceTag.startsWith('REG')
        ? 'REG'
        : sourceTag.startsWith('MEM')
        ? 'MEM'
        : sourceTag;
      const badgeBg = isImmediate ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.2)';
      const badgeBorder = isImmediate ? '#f59e0b' : '#38bdf8';
      const badgeFg = isImmediate ? '#fbbf24' : '#7dd3fc';

      ctx.fillStyle = badgeBg;
      ctx.strokeStyle = badgeBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(box.x + box.w - 48, box.y + 5, 42, 14, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = badgeFg;
      ctx.font = 'bold 8.5px "Inter", sans-serif';
      ctx.fillText(badgeText, box.x + box.w - 43, box.y + 15);
      ctx.restore();
    }

    ctx.fillStyle = active ? (isImmediate ? '#fef08a' : activeColor) : THEME.textPrimary;
    ctx.font = '11.5px "JetBrains Mono", monospace';
    ctx.fillText(toHex32(val), box.x + 8, box.y + 35);

    ctx.fillStyle = THEME.textMuted;
    ctx.font = '9.5px "JetBrains Mono", monospace';
    ctx.fillText(`Dec: ${toInt32(val)}`, box.x + 8, box.y + 48);
  }

  private drawALU(
    ctx: CanvasRenderingContext2D,
    box: ComponentBounds,
    state: CPUMicroState,
    active: boolean,
    activeColor: string,
    pulse: number = 0
  ): void {
    const isExec = active || pulse > 0;
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

    ctx.fillStyle = pulse > 0 ? 'rgba(239, 68, 68, 0.15)' : THEME.cardBg;
    ctx.strokeStyle = isExec ? activeColor : THEME.cardBorder;
    ctx.lineWidth = pulse > 0 ? 3 : isExec ? 2.5 : 1;

    if (isExec) {
      ctx.shadowColor = activeColor;
      ctx.shadowBlur = pulse > 0 ? 22 : 16;
    }

    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = isExec ? activeColor : THEME.textSecondary;
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
    box: ComponentBounds,
    flags: { zf: boolean; sf: boolean; of: boolean; cf: boolean },
    active: boolean,
    activeColor: string
  ): void {
    this.drawCard(ctx, box, 'EFLAGS', active, activeColor);

    const drawFlagPill = (x: number, y: number, name: string, isActive: boolean) => {
      ctx.fillStyle = isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = isActive ? '#10b981' : THEME.cardBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, 26, 18, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isActive ? '#10b981' : THEME.textMuted;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(name, x + 5, y + 13);
    };

    drawFlagPill(box.x + 6, box.y + 32, 'ZF', flags.zf);
    drawFlagPill(box.x + 35, box.y + 32, 'SF', flags.sf);
    drawFlagPill(box.x + 64, box.y + 32, 'OF', flags.of);
    drawFlagPill(box.x + 93, box.y + 32, 'CF', flags.cf);
  }

  private drawDataRAM(
    ctx: CanvasRenderingContext2D,
    box: ComponentBounds,
    state: CPUMicroState,
    active: boolean,
    activeColor: string,
    pulse: number = 0
  ): void {
    const isMem = active || pulse > 0;
    const memKb = Math.round((state.memorySize ?? 65536) / 1024);
    this.drawCard(ctx, box, `Data RAM (${memKb} KB)`, isMem, activeColor, pulse);

    const baseDataAddr = state.dataStart ?? 0x2000;
    for (let i = 0; i < 4; i++) {
      const addr = baseDataAddr + i * 4;
      const previewVal = state.ramPreview?.[i] ?? 0;
      const val = state.mar === addr && isMem ? state.mdr : previewVal;
      const y = box.y + 30 + i * 30;

      const isTarget = state.mar === addr && isMem;
      if (isTarget) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
        ctx.fillRect(box.x + 4, y - 2, box.w - 8, 26);
      }

      ctx.fillStyle = isTarget ? activeColor : THEME.textMuted;
      ctx.font = '10px monospace';
      ctx.fillText(`0x${addr.toString(16).toUpperCase()}:`, box.x + 8, y + 16);

      ctx.fillStyle = THEME.textPrimary;
      ctx.font = '11px monospace';
      ctx.fillText(toHex32(val), box.x + 55, y + 16);
    }
  }

  /**
   * Hit test to find which datapath component the user is hovering over.
   */
  public getComponentAt(screenX: number, screenY: number): DatapathComponentInfo | null {
    const scale = this.currentTransform.scale;
    const offsetX = this.currentTransform.offsetX;
    const offsetY = this.currentTransform.offsetY;

    const unscaledX = (screenX - offsetX) / scale;
    const unscaledY = (screenY - offsetY) / scale;

    const boxes: Record<string, { x: number; y: number; w: number; h: number }> = {
      EIP: { x: 50, y: 75, w: 135, h: 70 },
      ADDER: { x: 50, y: 15, w: 105, h: 42 },
      CODE_MEM: { x: 245, y: 70, w: 160, h: 85 },
      IR: { x: 465, y: 70, w: 185, h: 85 },
      CU: { x: 695, y: 45, w: 375, h: 115 },
      REGS: { x: 160, y: 210, w: 220, h: 265 },
      LATCH_A: { x: 430, y: 235, w: 120, h: 55 },
      LATCH_B: { x: 430, y: 315, w: 120, h: 55 },
      ALU: { x: 600, y: 245, w: 140, h: 140 },
      FLAGS: { x: 790, y: 225, w: 120, h: 70 },
      ALU_OUT: { x: 790, y: 320, w: 120, h: 55 },
      MAR: { x: 945, y: 215, w: 105, h: 55 },
      MDR: { x: 945, y: 295, w: 105, h: 55 },
      DATA_RAM: { x: 980, y: 395, w: 140, h: 165 },
    };

    for (const [id, box] of Object.entries(boxes)) {
      if (
        unscaledX >= box.x &&
        unscaledX <= box.x + box.w &&
        unscaledY >= box.y &&
        unscaledY <= box.y + box.h
      ) {
        return this.getComponentMetadata(id, box);
      }
    }
    return null;
  }

  private getComponentMetadata(id: string, bounds: { x: number; y: number; w: number; h: number }): DatapathComponentInfo {
    switch (id) {
      case 'EIP':
        return {
          id: 'EIP',
          title: 'EIP (Extended Instruction Pointer)',
          category: 'PC',
          role: 'Points to memory address of the next instruction',
          summary: 'Stores the 32-bit address where the CPU fetches instructions from Code Memory.',
          pedagogicalInsight: 'Notice that EIP advances by +4 during Fetch before Execution finishes!',
          whyExplanation: '1. Sequential Fetch: Address is sent to Code Memory first, then EIP is incremented by +4 via dedicated hardware.\n2. Non-blocking: Advancing EIP prepares the next instruction without stalling memory reading.\n3. Safe for Jumps: If this instruction is a branch or jump (JE/JNE/JMP), the Execute phase overwrites EIP with the target address.\n4. Instruction Safely Latched: The current instruction word is frozen inside the Instruction Register (IR).',
          mnemonic: '"Read the current page, slide the bookmark to the next."',
          bounds,
        };

      case 'ADDER':
        return {
          id: 'ADDER',
          title: '+4 Dedicated Adder',
          category: 'ALU',
          role: 'Advances EIP to the next 32-bit instruction word',
          summary: 'Dedicated hardware adder that computes EIP_next = EIP + 4.',
          pedagogicalInsight: 'Why +4 bytes instead of +1?',
          whyExplanation: 'PulseCISC-32 memory is byte-addressable (1 address = 1 byte). Since each instruction word is 32 bits (4 bytes) wide, jumping to the next instruction requires adding 4 to the memory address (0x0000 -> 0x0004 -> 0x0008).',
          mnemonic: '32 bits = 4 bytes per word.',
          bounds,
        };

      case 'CODE_MEM':
        return {
          id: 'CODE_MEM',
          title: 'Code Memory (ROM)',
          category: 'MEMORY',
          role: 'Stores program machine code instructions',
          summary: 'Addressed by EIP during Fetch to output a 32-bit instruction word into IR.',
          pedagogicalInsight: 'During Fetch, the address arrives from EIP, Code Memory is accessed ("stressed" to read the word), and the fetched word is then transmitted to the Instruction Register.',
          bounds,
        };

      case 'IR':
        return {
          id: 'IR',
          title: 'Instruction Register (IR)',
          category: 'REGISTER',
          role: 'Holds the active 32-bit instruction word',
          summary: 'Latches the instruction word after it arrives from Code Memory so the rest of the CPU can decode and execute it.',
          pedagogicalInsight: 'IR freezes the instruction bits so EIP can safely increment to the next instruction.',
          bounds,
        };

      case 'CU':
        return {
          id: 'CU',
          title: 'Control Unit (FSM Controller)',
          category: 'CONTROL',
          role: 'Brain of the processor; orchestrates all datapath operations and control signals',
          summary: 'Inspects opcode bits and coordinates the micro-operation sequence (FETCH -> DECODE -> EXECUTE -> MEMORY -> WRITEBACK) via dedicated enable signals.',
          pedagogicalInsight: 'The Control Unit oversees the processor through enable lines rather than carrying data payloads in the datapath.',
          bounds,
        };

      case 'REGS':
        return {
          id: 'REGS',
          title: 'Register File (EAX - ESP)',
          category: 'REGISTER',
          role: '8 x 32-bit general purpose high-speed storage',
          summary: 'Has 2 read ports (feeding Latches A & B) and 1 writeback port (from ALU_Out or MDR).',
          pedagogicalInsight: 'Reading registers takes 0 extra clock cycles; writing occurs on the clock edge during WRITEBACK.',
          bounds,
        };

      case 'LATCH_A':
        return {
          id: 'LATCH_A',
          title: 'ALU Latch A (Destination / Operand 1)',
          category: 'REGISTER',
          role: 'Holds the first operand for the ALU',
          summary: 'Latches the value of the destination register or base pointer during Decode.',
          pedagogicalInsight: 'Input latches prevent feedback loops and electrical race conditions while the ALU computes.',
          bounds,
        };

      case 'LATCH_B':
        return {
          id: 'LATCH_B',
          title: 'ALU Latch B (Source / Operand 2)',
          category: 'REGISTER',
          role: 'Holds second operand from Register File or Immediate field',
          summary: 'Can receive a value from a register [REG] or extracted directly from instruction bits [IMM].',
          pedagogicalInsight: 'Check the badge: [IMM] means the number came straight from instruction bits, not memory!',
          mnemonic: 'Amber = Literal Constant; Blue = Register File.',
          bounds,
        };

      case 'ALU':
        return {
          id: 'ALU',
          title: '32-Bit Arithmetic Logic Unit (ALU)',
          category: 'ALU',
          role: 'Performs arithmetic, logic, and comparisons',
          summary: 'Computes Latch_A [OP] Latch_B, places result in ALU_Out, and updates condition flags in EFLAGS.',
          bounds,
        };

      case 'FLAGS':
        return {
          id: 'FLAGS',
          title: 'EFLAGS (Condition Codes)',
          category: 'CONTROL',
          role: 'Status flags recording arithmetic side effects',
          summary: 'ZF (Zero Flag) = 1 if result is 0; SF (Sign Flag) = 1 if negative; OF = 1 if signed overflow.',
          pedagogicalInsight: 'Conditional jumps (JE / JNE) inspect ZF to determine whether to branch.',
          bounds,
        };

      case 'ALU_OUT':
        return {
          id: 'ALU_OUT',
          title: 'ALU Output Latch',
          category: 'REGISTER',
          role: 'Buffers ALU result before writeback or memory addressing',
          summary: 'Routes computed values to either MAR (for memory address calculation) or Register File (for writeback).',
          bounds,
        };

      case 'MAR':
        return {
          id: 'MAR',
          title: 'Memory Address Register (MAR)',
          category: 'MEMORY',
          role: 'Holds the physical address for RAM access',
          summary: 'Specifies which memory byte address the CPU is reading from or writing to.',
          mnemonic: 'MAR = "Where to look in RAM".',
          bounds,
        };

      case 'MDR':
        return {
          id: 'MDR',
          title: 'Memory Data Register (MDR)',
          category: 'MEMORY',
          role: 'Holds the 32-bit data word travelling to or from RAM',
          summary: 'Receives words read from RAM (Loads) or holds data waiting to be written to RAM (Stores).',
          mnemonic: 'MDR = "What is inside the envelope".',
          bounds,
        };

      case 'DATA_RAM':
      default: {
        const memKb = Math.round((this.lastState?.memorySize ?? 65536) / 1024);
        const dStart = (this.lastState?.dataStart ?? 0x800).toString(16).toUpperCase().padStart(4, '0');
        const dEnd = (this.lastState?.dataEnd ?? 0xffff).toString(16).toUpperCase().padStart(4, '0');
        return {
          id: 'DATA_RAM',
          title: `Data RAM (0x${dStart} - 0x${dEnd}) • ${memKb} KB`,
          category: 'MEMORY',
          role: 'Volatile memory storing variables and program data',
          summary: 'Read and written only during the MEMORY phase of memory instructions (MOV reg, [mem]).',
          bounds,
        };
      }
    }
  }
}
