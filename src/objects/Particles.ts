import { DNAHelix } from './DNAHelix';
import { Vector3 } from '../core/Vector3';
export interface Particle {
  point: Vector3; phase: number; speed: number; kind: number; side: number;
  opacity: number; anchor: Vector3; index: number;
}
export class Particles {
  readonly items: Particle[] = [];
  constructor(lowPower: boolean) {
    const count = lowPower ? 850 : 1700;
    for (let i = 0; i < count; i++) this.items.push({
      point: new Vector3(), anchor: new Vector3(), phase: (i * .61803398875) % 1,
      speed: .045 + (i % 7) * .004, kind: i < 60 ? i % 3 : (i % 5 === 0 ? 4 : 3),
      side: i % 2, opacity: 1, index: i,
    });
  }
  update(time: number, helix: DNAHelix): void {
    for (const p of this.items) {
      const t = (p.phase + time * p.speed) % 1;
      if (p.kind === 0) helix.point(t, p.side, p.point);
      else if (p.kind === 1) {
        const base = helix.bases[Math.floor(p.phase * helix.bases.length)];
        p.point.set(base[0].x + (base[1].x - base[0].x) * t, base[0].y, base[0].z + (base[1].z - base[0].z) * t);
      } else if (p.kind === 2) {
        const angle = p.phase * 40 + time * .08;
        p.point.set(Math.cos(angle) * (1.1 + p.phase * .6), (p.phase - .5) * 6, Math.sin(angle) * (1.1 + p.phase * .6));
        p.opacity = .35;
      } else {
        if (p.kind === 3) helix.point(p.phase, p.side, p.anchor);
        else {
          const base = helix.bases[p.index % helix.bases.length];
          p.anchor.set(base[0].x + (base[1].x - base[0].x) * p.phase, base[0].y, base[0].z + (base[1].z - base[0].z) * p.phase);
        }
        // A smooth closed cycle scatters each fragment, then returns it exactly
        // to its strand or base pair. No respawn jumps or frame allocations.
        const cycle = time * (.55 + (p.index % 9) * .025) + p.phase * Math.PI * 2;
        const scatter = Math.pow((1 - Math.cos(cycle)) * .5, 1.8);
        const angle = p.index * 2.399963;
        const distance = scatter * (.15 + (p.index % 17) / 17 * .65);
        const flutter = scatter * Math.sin(time * 1.5 + angle) * .025;
        p.point.set(
          p.anchor.x + Math.cos(angle) * distance + flutter,
          p.anchor.y + Math.sin(angle * 1.37) * distance * .65,
          p.anchor.z + Math.sin(angle) * distance + flutter,
        );
        p.opacity = .8 - scatter * .5;
      }
    }
  }
}
