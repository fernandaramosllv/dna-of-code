import { Camera } from '../core/Camera';
interface Spark { x: number; y: number; vx: number; vy: number; life: number; duration: number; size: number }
export class DNAEffects {
  private sparks: Spark[];
  private nextSpark = 0; private lastClick = 0;
  private lastX = 0; private lastY = 0; private previousTime = 0; private wasInside = false; private shimmer = 0;
  private seed = 7293;
  private lastRelease = 0;
  private lastBurstTime = -1;
  constructor(lowPower: boolean) {
    this.sparks = Array.from({ length: lowPower ? 150 : 300 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, duration: 1, size: 1 }));
  }
  private random(): number { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  private emit(x: number, y: number, burst: boolean): void {
    const p = this.sparks[this.nextSpark++ % this.sparks.length];
    const angle = this.random() * Math.PI * 2, speed = burst ? 35 + this.random() * 150 : 5 + this.random() * 24;
    p.x = x; p.y = y; p.vx = Math.cos(angle) * speed; p.vy = Math.sin(angle) * speed;
    p.duration = burst ? .7 + this.random() * .6 : .4 + this.random() * .45;
    p.life = p.duration; p.size = .5 + this.random() * (burst ? 1.3 : .8);
  }
  render(ctx: CanvasRenderingContext2D, camera: Camera, time: number, alpha: number, centerX: number, centerY: number, artWidth: number, artHeight: number): void {
    const dt = Math.min(.05, Math.max(0, time - this.previousTime)); this.previousTime = time;
    const x = camera.pointerX * camera.width, y = camera.pointerY * camera.height;
    const near = (px: number, py: number): boolean => {
      const dx = px - centerX, dy = py - centerY;
      const cosine = Math.cos(camera.dnaAngle), sine = Math.sin(camera.dnaAngle);
      return Math.abs(dx * cosine + dy * sine) < artWidth * .3 + 35 && Math.abs(-dx * sine + dy * cosine) < artHeight * .47;
    };
    const inside = camera.pointerInside && near(x, y) && alpha > .03;
    if (camera.releaseSerial !== this.lastRelease) {
      this.lastRelease = camera.releaseSerial;
      if (inside && !camera.reducedMotion) for (let i = 0; i < 65; i++) this.emit(x, y, true);
    }
    if (camera.reducedMotion) { for (const p of this.sparks) p.life = 0; }
    if (camera.clickSerial !== this.lastClick) {
      this.lastClick = camera.clickSerial;
      const clickX = camera.clickX * camera.width, clickY = camera.clickY * camera.height;
      if (!camera.reducedMotion && alpha > .03 && near(clickX, clickY)) {
        for (let i = 0; i < 36; i++) this.emit(clickX, clickY, true);
      }
    }
    if (inside && !camera.reducedMotion) {
      if (camera.interactionEnergy > .75 && time - this.lastBurstTime > .35) {
        this.lastBurstTime = time; for (let i = 0; i < 16; i++) this.emit(x, y, true);
      }
      if (this.wasInside) {
        const distance = Math.hypot(x - this.lastX, y - this.lastY);
        const count = Math.min(14, Math.floor(distance / 4));
        for (let i = 1; i <= count; i++) this.emit(this.lastX + (x - this.lastX) * i / count, this.lastY + (y - this.lastY) * i / count, false);
      }
      this.shimmer += dt;
      if (this.shimmer > .09) { this.shimmer = 0; this.emit(x + (this.random() - .5) * 16, y + (this.random() - .5) * 16, false); }
    }
    this.wasInside = inside; this.lastX = x; this.lastY = y;
    ctx.save(); ctx.shadowBlur = 0;
    if (inside) {
      const radius = 55 + camera.interactionEnergy * 25;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, 'rgba(255,219,140,.09)'); glow.addColorStop(1, 'rgba(255,219,140,0)');
      ctx.globalAlpha = alpha; ctx.fillStyle = glow; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    for (const p of this.sparks) {
      if (p.life <= 0) continue;
      if (inside && camera.pointerHeld) {
        p.vx += (x - p.x) * dt * 9; p.vy += (y - p.y) * dt * 9;
      }
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-2.5 * dt); p.vy *= Math.exp(-2.5 * dt);
      const fade = Math.max(0, p.life / p.duration);
      ctx.globalAlpha = alpha * fade * .8; ctx.fillStyle = '#ffe5a4';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.4 + fade * .6), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
