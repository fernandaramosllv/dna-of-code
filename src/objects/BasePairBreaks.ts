import { Camera } from '../core/Camera';
interface Grain { x: number; y: number; color: string; seed: number; weight: number }
interface Rung { t: number; left: number; right: number; grains: Grain[] }
interface Break { rung: Rung; start: number; active: boolean; repaired: boolean }
const smooth = (a: number, b: number, t: number): number => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

/** Masks just the central rung, leaving the outer helical strands intact. */
export class BasePairBreaks {
  readonly surface = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement;
  private rungs: Rung[] = [];
  private breaks: Break[] = [];
  private hover: Rung | undefined;
  private tension: Rung | undefined;
  private dx = 0; private dy = 0;
  private vx = 0; private vy = 0;
  private previousTime = 0;
  private wasStretching = false;
  interact(x: number, t: number, camera: Camera, time: number, dx: number, dy: number): void {
    this.hover = x > .38 && x < .62 ? this.rungs.find(r => Math.abs(r.t - t) < .012) : undefined;
    if (camera.stretching && !this.wasStretching) this.tension = this.hover;
    this.wasStretching = camera.stretching;
    const dt = Math.max(0, Math.min(.05, time - this.previousTime)); this.previousTime = time;
    const tx = camera.stretching && this.tension ? Math.tanh(dx * 4) * .22 : 0;
    const ty = camera.stretching && this.tension ? Math.tanh(dy * 6) * .12 : 0;
    if (camera.reducedMotion) { this.dx = tx; this.dy = ty; this.vx = this.vy = 0; }
    else for (let step = 0; step < 3; step++) {
      const h = dt / 3, damping = camera.stretching ? 22 : 12;
      this.vx += ((tx - this.dx) * 180 - this.vx * damping) * h;
      this.vy += ((ty - this.dy) * 180 - this.vy * damping) * h;
      this.dx += this.vx * h; this.dy += this.vy * h;
    }
    if (!camera.stretching && Math.abs(this.dx) + Math.abs(this.dy) + Math.abs(this.vx) + Math.abs(this.vy) < .0002) this.tension = undefined;
  }
  constructor(image: HTMLImageElement) {
    this.image = image; this.surface.width = image.naturalWidth; this.surface.height = image.naturalHeight;
    const ctx = this.surface.getContext('2d'); if (!ctx) throw new Error('Rung compositor unavailable'); this.ctx = ctx;
    const probe = document.createElement('canvas'); probe.width = 256; probe.height = 384;
    const p = probe.getContext('2d', { willReadFrequently: true }); if (!p) return;
    p.drawImage(image, 0, 0, 256, 384);
    const data = p.getImageData(0, 0, 256, 384).data;
    const brightness = new Float32Array(384);
    for (let y = 18; y < 367; y++) for (let x = 106; x <= 150; x++) {
      const i = (y * 256 + x) * 4;
      if (data[i + 3] > 140 && data[i] > 155 && data[i + 1] > 110 && data[i] > data[i + 2] * 1.12) brightness[y]++;
    }
    for (let y = 20; y < 365; y++) {
      if (brightness[y] < 10 || brightness[y] < brightness[y - 1] || brightness[y] <= brightness[y + 1]) continue;
      const previous = this.rungs[this.rungs.length - 1];
      if (previous && y / 384 - previous.t < .018) continue;
      const grains: Grain[] = [];
      for (let gy = y - 12; gy <= y + 12; gy++) for (let gx = 88; gx <= 168; gx++) {
        const i = (gy * 256 + gx) * 4;
        if (data[i + 3] > 140 && data[i] > 145 && data[i + 1] > 95 && data[i] > data[i + 2] * 1.12)
          grains.push({ x: gx / 256, y: gy / 384, color: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`, seed: gx * 17 + gy * 31, weight: Math.exp(-Math.pow((gx - 128) / 18, 4) - Math.pow((gy - y - Math.sin(gx * .12) * 1.3) / 3.8, 2)) });
      }
      this.rungs.push({ t: y / 384, left: .405, right: .595, grains });
    }
  }
  pick(x: number, t: number, time: number, camera: Camera): boolean {
    if (camera.reducedMotion || x < .4 || x > .6) return false;
    let chosen: Rung | undefined, distance = .018;
    for (const rung of this.rungs) if (Math.abs(t - rung.t) < distance) { chosen = rung; distance = Math.abs(t - rung.t); }
    if (!chosen || this.breaks.some(b => b.active && b.rung === chosen)) return false;
    const slot = this.breaks.find(b => !b.active);
    if (slot) { slot.rung = chosen; slot.start = time; slot.active = true; slot.repaired = false; }
    else if (this.breaks.length < 8) this.breaks.push({ rung: chosen, start: time, active: true, repaired: false });
    else return false;
    camera.breakSerial++; return true;
  }
  prepare(time: number, camera: Camera): HTMLImageElement | HTMLCanvasElement {
    let active = false;
    for (const b of this.breaks) {
      if (!b.active) continue;
      const age = time - b.start;
      if (age >= 1.9 && !b.repaired) { b.repaired = true; camera.repairSerial++; }
      if (age >= 2.4 || camera.reducedMotion) b.active = false;
      else active = true;
    }
    if (!active && !this.tension) return this.image;
    const ctx = this.ctx, w = this.surface.width, h = this.surface.height;
    ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, w, h); ctx.drawImage(this.image, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    for (const b of this.breaks) {
      if (!b.active) continue;
      const age = time - b.start;
      ctx.fillStyle = "#000";
      for (const grain of b.rung.grains) {
        const edge = .65 + (Math.sin(grain.seed) + 1) * .3;
        const delay = (grain.x - .34) * 1.1;
        const dissolve = smooth(0, .26, age) * (1 - smooth(1.05 + delay, 2.05 + delay, age));
        ctx.globalAlpha = Math.min(1, edge * grain.weight * dissolve);
        ctx.beginPath(); ctx.ellipse(grain.x * w, grain.y * h, w / 256 * .52, h / 384 * .52, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (this.tension) {
      ctx.fillStyle = '#000';
      const strength = Math.min(1, (Math.abs(this.dx) + Math.abs(this.dy)) * 60);
      for (const g of this.tension.grains) {
        ctx.globalAlpha = g.weight * strength;
        ctx.beginPath(); ctx.ellipse(g.x * w, g.y * h, w / 256 * .52, h / 384 * .52, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; return this.surface;
  }
  draw(ctx: CanvasRenderingContext2D, time: number, x: number, y: number, width: number, height: number, alpha: number, warp: (t: number) => number): void {
    ctx.save(); ctx.fillStyle = '#ffe2a0';
    for (const b of this.breaks) {
      if (!b.active) continue;
      const age = time - b.start;
      for (const grain of b.rung.grains) {
        const delay = (grain.x - .34) * 1.1;
        const scatter = smooth(0, .45, age) * (1 - smooth(.95 + delay, 2.05 + delay, age));
        const angle = grain.seed * 2.39996;
        const distance = scatter * width * (.018 + (grain.seed % 19) * .003);
        const px = x + grain.x * width + Math.cos(angle + scatter * .8) * distance + warp(grain.y);
        const py = y + grain.y * height + Math.sin(angle) * distance * .8;
        ctx.fillStyle = grain.color;
        ctx.globalAlpha = alpha * scatter * grain.weight * .85;
        ctx.beginPath(); ctx.arc(px, py, Math.min(1.4, Math.max(.45, width / 256 * .22)), 0, Math.PI * 2); ctx.fill();
      }
    }
    if (this.tension || this.hover) {
      const rung = this.tension ?? this.hover!;
      const strength = this.tension ? Math.min(1, (Math.abs(this.dx) + Math.abs(this.dy)) * 60) : .35;
      for (const g of rung.grains) {
        if (g.weight < .03) continue;
        const u = Math.max(0, Math.min(1, (g.x - rung.left) / (rung.right - rung.left)));
        const bend = Math.sin(u * Math.PI) * Math.exp(-Math.pow((g.y - rung.t) / .01, 2));
        const vibration = this.hover && !this.tension ? Math.sin(time * 28 + g.seed) * .6 : 0;
        ctx.globalAlpha = alpha * g.weight * strength;
        ctx.fillStyle = g.color;
        ctx.beginPath(); ctx.arc(x + (g.x + this.dx * bend) * width + warp(g.y), y + (g.y + this.dy * bend) * height + vibration, Math.min(1.6, Math.max(.5, width / 256 * .25)), 0, Math.PI * 2); ctx.fill();
      }
    }
    if (this.tension) {
      const r = this.tension, magnitude = Math.min(1,Math.hypot(this.dx,this.dy)*10);
      const cx=x+(.5+this.dx)*width+warp(r.t),cy=y+(r.t+this.dy)*height;
      const glow=ctx.createRadialGradient(cx,cy,0,cx,cy,35+magnitude*30);
      glow.addColorStop(0,'rgba(255,221,143,.22)');glow.addColorStop(1,'rgba(255,193,70,0)');
      ctx.globalAlpha=alpha*magnitude;ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,35+magnitude*30,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#ffe3a0';ctx.lineWidth=.7;ctx.globalAlpha=alpha*magnitude*.55;
      ctx.beginPath();ctx.moveTo(x+r.left*width+warp(r.t),y+r.t*height);
      ctx.quadraticCurveTo(x+(.5+this.dx*2)*width+warp(r.t),y+(r.t+this.dy*2)*height,x+r.right*width+warp(r.t),y+r.t*height);ctx.stroke();
      for(let i=0;i<48;i++){
        const angle=i*2.39996+time*.7,orbit=8+((i*13)%43)*magnitude;
        const shimmer=.35+.65*Math.sin(time*2+i)**2;
        ctx.globalAlpha=alpha*magnitude*shimmer*.65;ctx.fillStyle=i%3===0?'#fff0be':'#d9ac62';
        ctx.beginPath();ctx.arc(cx+Math.cos(angle)*orbit,cy+Math.sin(angle)*orbit*.7,.45+(i%3)*.25,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  }
}
