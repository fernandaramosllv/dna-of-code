import { Vector3 } from '../core/Vector3';

export interface BodyLine { a: Vector3; b: Vector3; skin: boolean }

/** Procedural translucent anatomy: surface rings, meridians and inner nerve paths. */
export class HumanBody {
  readonly lines: BodyLine[] = [];
  readonly lights: Vector3[] = [];
  private seed = 173;

  constructor(lowPower: boolean) {
    const density = lowPower ? 14 : 22;
    this.part(new Vector3(0, -2.56, 0), new Vector3(0, -1.65, 0), .40, .35, density); // Head
    this.part(new Vector3(0, -1.78, 0), new Vector3(0, -1.32, 0), .17, .17, density);
    this.part(new Vector3(0, -1.38, 0), new Vector3(0, .35, 0), .64, .29, density); // Thorax
    this.part(new Vector3(0, .12, 0), new Vector3(0, .82, 0), .43, .28, density);
    for (const side of [-1, 1]) {
      this.part(new Vector3(side * .53, -1.27, 0), new Vector3(side * .91, -.24, 0), .19, .18, density);
      this.part(new Vector3(side * .91, -.24, 0), new Vector3(side * 1.07, .65, .03), .14, .13, density);
      this.part(new Vector3(side * 1.07, .60, .03), new Vector3(side * 1.09, .99, .04), .105, .07, density);
      this.part(new Vector3(side * .24, .55, 0), new Vector3(side * .28, 1.88, 0), .245, .23, density);
      this.part(new Vector3(side * .28, 1.78, 0), new Vector3(side * .30, 2.98, 0), .165, .16, density);
      this.part(new Vector3(side * .30, 2.87, .08), new Vector3(side * .30, 3.10, -.19), .16, .13, density);
    }
    // Dense curved connections concentrated inside the brain.
    for (let i = 0; i < (lowPower ? 40 : 85); i++) {
      const phase = this.random() * Math.PI * 2;
      const latitude = (this.random() - .5) * 1.8;
      let previous: Vector3 | undefined;
      for (let j = 0; j <= 30; j++) {
        const angle = phase + j / 30 * Math.PI * 2;
        const point = new Vector3(
          Math.cos(angle) * .33 * Math.cos(latitude),
          -2.105 + Math.sin(angle * 2 + phase) * .34 * Math.cos(latitude),
          Math.sin(angle) * .28 * Math.cos(latitude) + Math.sin(latitude) * .08,
        );
        if (previous) this.lines.push({ a: previous, b: point, skin: false });
        previous = point;
      }
    }
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private part(start: Vector3, end: Vector3, radius: number, depth: number, density: number): void {
    const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z;
    const length = Math.hypot(dx, dy);
    const nx = dy / length, ny = -dx / length;
    const ringCount = density;
    const sides = 24;
    const rings: Vector3[][] = [];
    for (let i = 0; i <= ringCount; i++) {
      const t = i / ringCount;
      const bulge = Math.pow(Math.sin(Math.PI * t), .45);
      const ring: Vector3[] = [];
      for (let j = 0; j < sides; j++) {
        const angle = j / sides * Math.PI * 2;
        ring.push(new Vector3(
          start.x + dx * t + nx * Math.cos(angle) * radius * bulge,
          start.y + dy * t + ny * Math.cos(angle) * radius * bulge,
          start.z + dz * t + Math.sin(angle) * depth * bulge,
        ));
      }
      rings.push(ring);
      for (let j = 0; j < sides; j++) {
        if (i % 3 === 0) this.lines.push({ a: ring[j], b: ring[(j + 1) % sides], skin: true });
        if (i > 0 && j % 3 === 0) this.lines.push({ a: rings[i - 1][j], b: ring[j], skin: true });
      }
    }
    for (let branch = 0; branch < 15; branch++) {
      const phase = this.random() * Math.PI * 2;
      let previous: Vector3 | undefined;
      for (let i = 0; i <= 28; i++) {
        const t = i / 28;
        const bulge = Math.sin(Math.PI * t);
        const angle = phase + Math.sin(t * 7 + phase) * .75;
        const offset = radius * bulge * (.45 + .15 * Math.sin(t * 11 + phase));
        const point = new Vector3(
          start.x + dx * t + nx * Math.cos(angle) * offset,
          start.y + dy * t + ny * Math.cos(angle) * offset,
          start.z + dz * t + Math.sin(angle) * depth * bulge * .7,
        );
        if (previous) this.lines.push({ a: previous, b: point, skin: false });
        if (i % 7 === 0) this.lights.push(point);
        previous = point;
      }
    }
  }
}
