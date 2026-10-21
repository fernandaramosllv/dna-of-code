import { Camera } from './Camera';
import { AmbientParticles } from '../objects/AmbientParticles';
import { DNAEffects } from '../objects/DNAEffects';
import { BasePairBreaks } from '../objects/BasePairBreaks';

interface Dust {
  x: number; y: number; phase: number; speed: number; radius: number; angle: number;
}
interface Art {
  image: HTMLImageElement;
  dust: Dust[];
  loaded: boolean;
  surface?: HTMLCanvasElement;
}
interface Composition {
  x: number; y: number; width: number; height: number; alpha: number; sway: number;
}
const smoothstep = (start: number, end: number, value: number): number => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

/** Layered reference-led artwork with particle motion, parallax and zoom. */
export class Renderer {
  backgroundOverlay: ((ctx: CanvasRenderingContext2D, time: number) => void) | null = null;
  private ctx: CanvasRenderingContext2D;
  private background: CanvasGradient | null = null;
  private body: Art;
  private ambient: AmbientParticles;
  private dna: Art;
  private lowPower = navigator.hardwareConcurrency <= 4 || window.innerWidth < 600;
  private fade = 0;
  private previousTime = 0;
  private dnaLeanX = 0;
  private dnaLeanY = 0;
  private effects: DNAEffects;
  private waves = Array.from({ length: 6 }, () => ({ t: 0, start: -10 }));
  private nextWave = 0;
  private lastWaveClick = 0;
  private lastHoverWave = -10;
  private lastHoverRow = -1;
  private baseBreaks: BasePairBreaks | null = null;

  constructor(private canvas: HTMLCanvasElement, private camera: Camera) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    this.ctx = ctx;
    this.ambient = new AmbientParticles(this.lowPower);
    this.effects = new DNAEffects(this.lowPower);
    this.body = this.load(new URL('../assets/body-front-transparent.png', import.meta.url).href, false);
    this.dna = this.load(new URL('../assets/dna-molecular-gold.png', import.meta.url).href, true);
  }

  private load(url: string, dna: boolean): Art {
    const art: Art = { image: new Image(), dust: [], loaded: false };
    art.image.decoding = 'async';
    art.image.onload = (): void => {
      art.dust = this.sample(art.image, dna);
      art.loaded = true;
      if (dna) this.baseBreaks = new BasePairBreaks(art.image);
    };
    art.image.onerror = (): void => { console.error(`Unable to load artwork: ${url}`); };
    art.image.src = url;
    return art;
  }

  private sample(image: HTMLImageElement, dna: boolean): Dust[] {
    const sample = document.createElement('canvas');
    sample.width = 256; sample.height = 384;
    const ctx = sample.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];
    ctx.drawImage(image, 0, 0, sample.width, sample.height);
    const pixels = ctx.getImageData(0, 0, sample.width, sample.height).data;
    const count = this.lowPower ? (dna ? 650 : 180) : (dna ? 1400 : 400);
    const dust: Dust[] = [];
    let seed = dna ? 7251 : 1867;
    const random = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    // Anchor energy to actual golden pixels rather than an approximate shape.
    for (let attempt = 0; attempt < count * 90 && dust.length < count; attempt++) {
      const x = Math.floor(random() * sample.width), y = Math.floor(random() * sample.height);
      const i = (y * sample.width + x) * 4;
      if (pixels[i + 3] < 160 || pixels[i] < 170 || pixels[i + 1] < 115 || pixels[i] < pixels[i + 2] * 1.12) continue;
      dust.push({ x: x / sample.width, y: y / sample.height, phase: random() * Math.PI * 2,
        speed: .38 + random() * .28, radius: .45 + random() * .65, angle: random() * Math.PI * 2 });
    }
    return dust;
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, this.lowPower ? 1.5 : 2);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.width = w; this.camera.height = h;
    this.background = this.ctx.createRadialGradient(w * .5, h * .44, 0, w * .5, h * .44, Math.max(w, h) * .6);
    this.background.addColorStop(0, '#0a1a29'); this.background.addColorStop(.6, '#07101a'); this.background.addColorStop(1, '#05070d');
  }

  render(opacity: number, time = 0): void {
    const ctx = this.ctx, w = this.camera.width, h = this.camera.height;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
    ctx.fillStyle = this.background ?? '#05070d'; ctx.fillRect(0, 0, w, h);
    const dt = Math.min(.05, Math.max(0, time - this.previousTime)); this.previousTime = time;
    const response = 1 - Math.exp(-7 * (dt || .016));
    const targetX = this.camera.pointerInside ? Math.max(-1, Math.min(1, (this.camera.pointerX - .5) * 2)) : 0;
    const targetY = this.camera.pointerInside ? Math.max(-1, Math.min(1, (this.camera.pointerY - .47) * 2)) : 0;
    this.dnaLeanX += (targetX - this.dnaLeanX) * response;
    this.dnaLeanY += (targetY - this.dnaLeanY) * response;
    if (this.body.loaded && this.dna.loaded) this.fade = Math.min(1, this.fade + (dt || .016) * 1.5);
    this.ambient.render(ctx, w, h, time, opacity, this.camera);
    const zoom = this.camera.zoom;
    const journey = smoothstep(1.5, 5.4, zoom);
    const sway = 0, vertical = 0;
    const panX = this.camera.panX * w, panY = this.camera.panY * h;
    const bodyZoom = Math.min(zoom, 3.2);
    const focusX = this.camera.focusX * w, focusY = this.camera.focusY * h;
    const centerX = w * .5 + sway * w, centerY = h * .47 + vertical;
    const bodyHeight = Math.min(h * .91, w * 2.65) * bodyZoom;
    const bodyWidth = bodyHeight * (this.body.image.naturalWidth / this.body.image.naturalHeight || 934 / 1684);
    const bodyAlpha = 1 - smoothstep(2.1, 5.3, zoom);
    const body: Composition = {
      x: focusX + (centerX - focusX) * bodyZoom - bodyWidth * .5 + panX,
      y: focusY + (centerY - focusY) * bodyZoom - bodyHeight * .5 + panY,
      width: bodyWidth, height: bodyHeight, alpha: bodyAlpha * smoothstep(.15, 1, opacity) * this.fade, sway: 0,
    };
    const closeZoom = Math.max(0, zoom - 5.4);
    const immersiveScale = closeZoom * .17 + Math.max(0, zoom - 12) ** 1.18 * .035;
    const dnaHeight = Math.min(h * .90, w * 2.1) * (.22 + journey * (.88 + immersiveScale));
    const dnaWidth = dnaHeight * 2 / 3;
    const dnaAlpha = smoothstep(1.8, 4.5, zoom);
    const dna: Composition = {
      x: focusX - dnaWidth * .5 + panX, y: focusY - dnaHeight * .5 + panY,
      width: dnaWidth, height: dnaHeight, alpha: dnaAlpha * opacity * this.fade, sway: sway * .5,
    };
    this.backgroundOverlay?.(ctx, time);
    this.camera.dnaHovered = false;
    this.drawArt(this.body, body, time, false);
      this.drawArt(this.dna, dna, time, true);
    this.effects.render(ctx, this.camera, time, dna.alpha, dna.x + dna.width * .5, dna.y + dna.height * .5, dna.width, dna.height);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  dispose(): void {
    this.body.image.onload = null; this.dna.image.onload = null;
    this.body.image.onerror = null; this.dna.image.onerror = null;
  }

  private drawArt(art: Art, position: Composition, time: number, dna: boolean, ctx = this.ctx): void {
    if (!art.loaded || position.alpha < .001) return;
    const strips = this.lowPower ? 48 : 96;
    const sourceHeight = art.image.naturalHeight / strips;
    const stripHeight = position.height / strips;
    ctx.save();
    ctx.globalAlpha = position.alpha * (dna ? .88 : 1);
    const centerX = position.x + position.width * .5, centerY = position.y + position.height * .5;
    let pointerX = this.camera.pointerX * this.camera.width, pointerY = this.camera.pointerY * this.camera.height;
    if (dna) {
      const angle = this.camera.dnaAngle + Math.sin(time * .85) * .035 + this.dnaLeanX * .045;
      const dx = pointerX - centerX - this.dnaLeanX * position.width * .025;
      const dy = pointerY - centerY - this.dnaLeanY * position.height * .012;
      const breath = Math.sin(time * 1.7) * .025;
      pointerX = centerX + (dx * Math.cos(angle) + dy * Math.sin(angle)) / (1 + breath);
      pointerY = centerY + (-dx * Math.sin(angle) + dy * Math.cos(angle)) / (1 - breath * .3);
      const localT = (pointerY - position.y) / position.height;
      const near = this.camera.pointerInside && Math.abs(pointerX - centerX) < position.width * .3 && localT >= 0 && localT <= 1;
      this.camera.dnaHovered = near;
      const row = Math.round(localT * 40);
      const clicked = this.camera.clickSerial !== this.lastWaveClick;
      const localX = (pointerX - position.x - this.warp(localT, time, position.width, true)) / position.width;
      const sx = this.camera.stretchX * this.camera.width, sy = this.camera.stretchY * this.camera.height;
      this.baseBreaks?.interact(near ? localX : -1, localT, this.camera, time, (sx * Math.cos(angle) + sy * Math.sin(angle)) / position.width, (-sx * Math.sin(angle) + sy * Math.cos(angle)) / position.height);
      if (clicked && near && !this.camera.stretching) {
        const localX = (pointerX - position.x - this.warp(localT, time, position.width, true)) / position.width;
        this.baseBreaks?.pick(localX, localT, time, this.camera);
      }
      this.lastWaveClick = this.camera.clickSerial;
      if (near && !this.camera.reducedMotion && (clicked || row !== this.lastHoverRow && time - this.lastHoverWave > .22)) {
        const wave = this.waves[this.nextWave++ % this.waves.length]; wave.t = row / 40; wave.start = time;
        this.lastHoverWave = time; this.lastHoverRow = row;
      }
    }
    ctx.translate(centerX + (dna ? this.dnaLeanX * position.width * .025 : 0), centerY + (dna ? this.dnaLeanY * position.height * .012 : 0));
    if (dna) {
      ctx.rotate(this.camera.dnaAngle + Math.sin(time * .85) * .035 + this.dnaLeanX * .045);
      const breath = Math.sin(time * 1.7) * .025;
      ctx.scale(1 + breath, 1 - breath * .3);
    }
    ctx.translate(-centerX, -centerY);
    const source = dna ? this.baseBreaks?.prepare(time, this.camera) ?? art.image : art.image;
    // Tiny continuous distortion creates motion without sacrificing the artwork.
    for (let i = 0; i < strips; i++) {
      const offset = this.warp(i / strips, time, position.width, dna);
      ctx.drawImage(source, 0, i * sourceHeight, art.image.naturalWidth, sourceHeight,
        position.x + offset, position.y + i * stripHeight, position.width, stripHeight + .15);
      if (dna) {
        const illumination = this.waveAt(i / strips, time);
        if (illumination > .05) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = position.alpha * illumination * .13;
          ctx.drawImage(source, 0, i * sourceHeight, art.image.naturalWidth, sourceHeight,
            position.x + offset, position.y + i * stripHeight, position.width, stripHeight + .15);
          ctx.restore();
        }
      }
    }
    if (dna) this.baseBreaks?.draw(ctx, time, position.x, position.y, position.width, position.height, position.alpha, t => this.warp(t, time, position.width, true));
    for (const p of art.dust) {
      const cycle = time * p.speed * (dna ? 2.5 : 1) + p.phase;
      const scatter = Math.pow((1 - Math.cos(cycle)) * .5, 2);
      const distance = scatter * position.width * (dna ? .1 + this.camera.interactionEnergy * .035 : .012);
      let x = position.x + p.x * position.width + Math.cos(p.angle + time * (dna ? .28 : .05)) * distance;
      let y = position.y + p.y * position.height + Math.sin(p.angle + (dna ? time * .12 : 0)) * distance * .8;
      if (dna) {
        x += this.warp(p.y, time, position.width, true);
        if (this.camera.pointerInside) {
          const dx = x - pointerX, dy = y - pointerY;
          const length = Math.hypot(dx, dy), radius = Math.min(150, position.width * .3);
          const proximity = Math.exp(-(length * length) / (radius * radius));
          const attract = this.camera.pointerHeld || this.camera.interactionEnergy < .25;
          const force = proximity * (attract ? -(this.camera.pointerHeld ? 65 : 18) : 18 + this.camera.interactionEnergy * 40);
          const orbit = proximity * (6 + this.camera.interactionEnergy * 15) * Math.sin(time * 2 + p.phase);
          x += (dx * force - dy * orbit) / Math.max(1, length);
          y += (dy * force + dx * orbit) / Math.max(1, length);
        }
      }
      const flicker = .6 + .4 * Math.sin(time * (dna ? 3 : 1.3) + p.phase) ** 2;
      ctx.globalAlpha = position.alpha * (dna ? .5 + this.waveAt(p.y, time) * .35 : .35) * flicker * (1 - scatter * .45);
      ctx.fillStyle = p.radius > .9 ? '#fff0bc' : '#eec56f';
      ctx.beginPath(); ctx.arc(x, y, p.radius * Math.min(1.5, position.height / 900), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  private warp(t: number, time: number, width: number, dna: boolean): number {
    if (!dna) return Math.sin(t * Math.PI * 3 - time * .4) * width * .0008;
    const wave = Math.sin(t * Math.PI * 7 - time * 1.6) * .012;
    const ripple = Math.sin(t * Math.PI * 13 + time * 2.4) * .003;
    const interaction = Math.sin(t * Math.PI * 5 - time * 3.2) * this.camera.interactionEnergy * .006;
    return (wave + ripple + interaction + this.waveAt(t, time) * .004 * Math.sin(t * 30 - time * 5)) * width;
  }

  private waveAt(t: number, time: number): number {
    let energy = 0;
    for (const wave of this.waves) {
      const age = time - wave.start;
      if (age < 0 || age > 2) continue;
      const distance = Math.abs(t - wave.t) - age * .55;
      energy += Math.exp(-distance * distance / .0009) * (1 - age / 2);
    }
    return Math.min(1, energy);
  }
}




