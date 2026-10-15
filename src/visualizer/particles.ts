// PulseRISC-32 Particle Bus Animation Engine

export interface Point2D {
  x: number;
  y: number;
}

export interface BusPath {
  id: string;
  points: Point2D[];
  color: string;
  glowColor: string;
  label?: string;
}

export interface Particle {
  id: number;
  path: Point2D[];
  progress: number; // 0 to 1 along entire path length
  speed: number; // rate per frame
  color: string;
  glowColor: string;
  size: number;
  payloadText?: string;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private nextId: number = 1;

  public clear(): void {
    this.particles = [];
  }

  /**
   * Spawns a packet of glowing particles along a given bus path.
   */
  public emit(
    path: Point2D[],
    color: string,
    glowColor: string,
    count: number = 3,
    payloadText?: string
  ): void {
    if (path.length < 2) return;

    for (let i = 0; i < count; i++) {
      const stagger = (i / count) * 0.25;
      this.particles.push({
        id: this.nextId++,
        path,
        progress: -stagger, // delayed start for trailing effect
        speed: 0.018 + Math.random() * 0.006,
        color,
        glowColor,
        size: 3.5 + Math.random() * 1.5,
        payloadText: i === 0 ? payloadText : undefined,
      });
    }
  }

  /**
   * Updates particle positions. Removes finished particles.
   */
  public update(speedMultiplier: number = 1.0): void {
    const updated: Particle[] = [];

    for (const p of this.particles) {
      p.progress += p.speed * speedMultiplier;
      if (p.progress <= 1.0) {
        updated.push(p);
      }
    }

    this.particles = updated;
  }

  /**
   * Renders active particles onto HTML5 2D Canvas.
   */
  public render(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) return;

    ctx.save();

    for (const p of this.particles) {
      if (p.progress < 0 || p.progress > 1) continue;

      const pos = this.interpolatePath(p.path, p.progress);
      if (!pos) continue;

      // Glow halo
      ctx.shadowColor = p.glowColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
      ctx.fill();

      // Bright inner core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, p.size * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Optional payload badge
      if (p.payloadText && p.progress > 0.1 && p.progress < 0.9) {
        ctx.shadowBlur = 0;
        ctx.font = '10px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(p.payloadText).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(pos.x - textWidth / 2 - 4, pos.y - 18, textWidth + 8, 14);
        ctx.fillStyle = p.color;
        ctx.fillText(p.payloadText, pos.x - textWidth / 2, pos.y - 7);
      }
    }

    ctx.restore();
  }

  private interpolatePath(points: Point2D[], progress: number): Point2D | null {
    if (points.length < 2) return null;

    // Calculate segment lengths
    let totalLength = 0;
    const lengths: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const len = Math.hypot(dx, dy);
      lengths.push(len);
      totalLength += len;
    }

    if (totalLength === 0) return points[0];

    const targetDist = progress * totalLength;
    let accumulated = 0;

    for (let i = 0; i < lengths.length; i++) {
      const segLen = lengths[i];
      if (accumulated + segLen >= targetDist) {
        const segProgress = (targetDist - accumulated) / segLen;
        const p0 = points[i];
        const p1 = points[i + 1];
        return {
          x: p0.x + (p1.x - p0.x) * segProgress,
          y: p0.y + (p1.y - p0.y) * segProgress,
        };
      }
      accumulated += segLen;
    }

    return points[points.length - 1];
  }
}
