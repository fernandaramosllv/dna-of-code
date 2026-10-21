import { Camera } from '../core/Camera';
interface PointerPosition { x: number; y: number; time: number }
export class InteractionController {
  private pointers = new Map<number, PointerPosition>();
  private vx = 0; private vy = 0; private targetZoom = 1; private pinch = 0;
  private abort = new AbortController();
  private cursorX = .5; private cursorY = .47;
  private resetting = false;
  private angularVelocity = 0;
  private pinchAngle = 0;
  constructor(private canvas: HTMLCanvasElement, private camera: Camera) {
    const options = { signal: this.abort.signal };
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId); this.resetting = false;
      this.camera.pointerInside = true;
      const rect = canvas.getBoundingClientRect();
      this.camera.clickX = (e.clientX - rect.left) / rect.width;
      this.camera.clickY = (e.clientY - rect.top) / rect.height;
      this.camera.clickSerial++;
      this.camera.pointerHeld = true;
      this.camera.stretching = this.camera.stretchMode && this.camera.zoom > 1.8;
      this.camera.stretchX = this.camera.stretchY = 0;
      this.camera.pointerX = this.camera.clickX; this.camera.pointerY = this.camera.clickY;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, time: e.timeStamp });
      this.pinch = this.distance(); this.pinchAngle = this.touchAngle(); this.vx = this.vy = this.angularVelocity = 0;
    }, options);
    canvas.addEventListener('pointermove', e => {
      const rect = canvas.getBoundingClientRect();
      const nextX = (e.clientX - rect.left) / rect.width, nextY = (e.clientY - rect.top) / rect.height;
      this.camera.interactionEnergy = Math.min(1, this.camera.interactionEnergy + Math.hypot(nextX - this.cursorX, nextY - this.cursorY) * 5);
      this.cursorX = nextX; this.cursorY = nextY;
      this.camera.pointerX = nextX; this.camera.pointerY = nextY; this.camera.pointerInside = true;
      const previous = this.pointers.get(e.pointerId); if (!previous) return;
      const dx = e.clientX - previous.x, dy = e.clientY - previous.y;
      const seconds = Math.max(.004, Math.min(.05, (e.timeStamp - previous.time) / 1000));
      previous.x = e.clientX; previous.y = e.clientY; previous.time = e.timeStamp;
      if (this.pointers.size === 2) {
        this.camera.stretching = false;
        const d = this.distance();
        const angle = this.touchAngle();
        if (this.camera.zoom > 1.8) this.camera.dnaAngle += Math.atan2(Math.sin(angle - this.pinchAngle), Math.cos(angle - this.pinchAngle));
        this.pinchAngle = angle;
        if (this.pinch > 0) {
          if (d > this.pinch && this.targetZoom <= 1.5) {
            const points = [...this.pointers.values()];
            this.setFocus((points[0].x + points[1].x) * .5, (points[0].y + points[1].y) * .5);
          }
          this.targetZoom *= d / this.pinch;
        }
        this.pinch = d; this.clampZoom();
        this.pan(dx * .5 / rect.width, dy * .5 / rect.height);
        this.vx = this.vy = 0;
      } else if (this.camera.stretching) {
        this.camera.stretchX = Math.max(-.15, Math.min(.15, this.camera.stretchX + dx / rect.width));
        this.camera.stretchY = Math.max(-.15, Math.min(.15, this.camera.stretchY + dy / rect.height));
        this.vx = this.vy = this.angularVelocity = 0;
      } else if (e.shiftKey && this.camera.zoom > 1.8) {
        this.camera.dnaAngle += dx * .012;
        this.angularVelocity = Math.max(-8, Math.min(8, dx * .012 / seconds));
        this.vx = this.vy = 0;
      } else {
        this.angularVelocity = 0;
        this.pan(dx / rect.width, dy / rect.height);
        this.vx = Math.max(-1.5, Math.min(1.5, this.vx * .65 + dx / rect.width / seconds * .35));
        this.vy = Math.max(-1.5, Math.min(1.5, this.vy * .65 + dy / rect.height / seconds * .35));
      }
    }, options);
    const release = (e: PointerEvent): void => {
      const pointer = this.pointers.get(e.pointerId);
      if (e.type !== 'pointerup' || pointer && e.timeStamp - pointer.time > 80) this.vx = this.vy = this.angularVelocity = 0;
      this.pointers.delete(e.pointerId); this.pinch = this.distance();
      this.camera.pointerHeld = this.pointers.size > 0;
      if (!this.camera.pointerHeld) this.camera.stretching = false;
      if (e.type === 'pointerup' && !this.camera.pointerHeld) this.camera.releaseSerial++;
    };
    canvas.addEventListener('pointerup', release, options);
    canvas.addEventListener('pointercancel', release, options);
    canvas.addEventListener('lostpointercapture', e => { this.pointers.delete(e.pointerId); this.pinch = this.distance(); this.camera.pointerHeld = this.pointers.size > 0; if (!this.camera.pointerHeld) this.camera.stretching = false; }, options);
    canvas.addEventListener('pointerleave', () => { if (this.pointers.size === 0) this.camera.pointerInside = false; }, options);
    canvas.addEventListener('wheel', e => {
      e.preventDefault(); this.resetting = false;
      if (e.deltaY < 0 && this.targetZoom <= 1.5) this.setFocus(e.clientX, e.clientY);
      this.targetZoom *= Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1) * .001);
      this.clampZoom();
    }, { ...options, passive: false });
    canvas.addEventListener('dblclick', () => this.reset(), options);
    canvas.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(e.key)) return;
      e.preventDefault(); this.resetting = false;
      if (e.key === 'Home') { this.reset(); return; }
      if (e.key === 'ArrowLeft') this.pan(-.035, 0);
      if (e.key === 'ArrowRight') this.pan(.035, 0);
      if (e.key === 'ArrowUp') this.pan(0, -.035);
      if (e.key === 'ArrowDown') this.pan(0, .035);
      if (e.key === '+' || e.key === '=') {
        if (this.targetZoom <= 1.5) { this.camera.focusX = this.cursorX - this.camera.panX; this.camera.focusY = this.cursorY - this.camera.panY; }
        this.targetZoom *= 1.1;
      }
      if (e.key === '-') this.targetZoom /= 1.1;
      this.clampZoom();
    }, options);
  }
  private setFocus(x: number, y: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.camera.focusX = Math.max(0, Math.min(1, (x - rect.left) / rect.width)) - this.camera.panX;
    this.camera.focusY = Math.max(0, Math.min(1, (y - rect.top) / rect.height)) - this.camera.panY;
  }
  private pan(dx: number, dy: number): void { this.camera.panX += dx; this.camera.panY += dy; this.clampPan(); }
  private clampPan(): void {
    const t = Math.max(0, Math.min(1, (this.camera.zoom - 1.5) / 2.8));
    const centerX = .5 + (this.camera.focusX - .5) * t, centerY = .47 + (this.camera.focusY - .47) * t;
    const x = Math.max(.1 - centerX, Math.min(.9 - centerX, this.camera.panX));
    const y = Math.max(.1 - centerY, Math.min(.9 - centerY, this.camera.panY));
    if (x !== this.camera.panX) this.vx = 0; if (y !== this.camera.panY) this.vy = 0;
    this.camera.panX = x; this.camera.panY = y;
  }
  private distance(): number { const p = [...this.pointers.values()]; return p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0; }
  private touchAngle(): number { const p = [...this.pointers.values()]; return p.length === 2 ? Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x) : 0; }
  private clampZoom(): void { this.targetZoom = Math.max(.75, Math.min(36, this.targetZoom)); }
  reset(): void { this.camera.stretching = false; this.camera.stretchX = this.camera.stretchY = 0; this.targetZoom = 1; this.vx = this.vy = this.angularVelocity = 0; this.camera.dnaAngle = Math.atan2(Math.sin(this.camera.dnaAngle), Math.cos(this.camera.dnaAngle)); this.resetting = true; }
  update(dt: number, reduced: boolean): void {
    this.camera.reducedMotion = reduced;
    this.camera.interactionEnergy *= Math.exp(-2.3 * dt);
    if (this.resetting) {
      const ease = reduced ? 1 : 1 - Math.exp(-8 * dt);
      this.camera.panX *= 1 - ease; this.camera.panY *= 1 - ease;
      this.camera.dnaAngle *= 1 - ease;
      if (Math.abs(this.camera.panX) + Math.abs(this.camera.panY) < .0001 && Math.abs(this.camera.zoom - 1) < .01) {
        this.camera.panX = this.camera.panY = 0; this.camera.focusX = .5; this.camera.focusY = .47; this.resetting = false;
      }
    } else if (this.pointers.size === 0) {
      if (reduced) this.vx = this.vy = this.angularVelocity = 0;
      this.camera.dnaAngle += this.angularVelocity * dt; this.angularVelocity *= Math.exp(-6 * dt);
      this.pan(this.vx * dt, this.vy * dt); this.vx *= Math.exp(-8 * dt); this.vy *= Math.exp(-8 * dt);
    }
    this.camera.zoom += (this.targetZoom - this.camera.zoom) * (1 - Math.exp(-10 * dt));
    this.clampPan();
  }
  dispose(): void { this.abort.abort(); this.pointers.clear(); }
}

