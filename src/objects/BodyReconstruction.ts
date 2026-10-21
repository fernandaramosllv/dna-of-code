interface Photo { width: number; height: number; pixels: Uint8ClampedArray; first: number; last: number; rows: [number, number][][] }

function photo(image: HTMLImageElement, width: number): Photo {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = Math.round(width * image.naturalHeight / image.naturalWidth);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Image sampling is unavailable');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const rows: [number, number][][] = [];
  let first = canvas.height, last = 0;
  for (let y = 0; y < canvas.height; y++) {
    const intervals: [number, number][] = [];
    let start = -1, previous = -1;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 85) continue;
      if (start < 0) start = x;
      else if (x - previous > width * .055) { intervals.push([start, previous]); start = x; }
      previous = x;
    }
    if (start >= 0) { intervals.push([start, previous]); first = Math.min(first, y); last = y; }
    rows.push(intervals);
  }
  return { width, height: canvas.height, pixels, rows, first, last };
}

/** Approximate visual-hull reconstruction from four silhouettes, with six-view
 * neural color samples. This is inferred geometry, not medical reconstruction. */
export function reconstructBody(images: HTMLImageElement[], lowPower: boolean): Float32Array {
  const photos = images.map(image => photo(image, lowPower ? 260 : 440));
  const front = photos[0], side = photos[1];
  const vertices: number[] = [];
  const span = (p: Photo): number => Math.max(1, p.last - p.first);
  const row = (p: Photo, t: number): [number, number][] => p.rows[Math.max(0, Math.min(p.height - 1, Math.round(p.first + t * span(p))))];
  const largest = (intervals: [number, number][]): [number, number] | undefined => {
    let best: [number, number] | undefined;
    for (const interval of intervals) if (!best || interval[1] - interval[0] > best[1] - best[0]) best = interval;
    return best;
  };
  for (let view = 0; view < 4; view++) {
    const p = photos[view];
    const scale = 5.6 / span(p);
    for (let y = p.first; y <= p.last; y++) {
      const t = (y - p.first) / span(p);
      // Elevated views supply the scalp and soles, without duplicating a
      // foreshortened torso into the upright reconstruction.
      if (view === 4 && t > .15 || view === 5 && t < .86) continue;
      const frontal = row(front, t), lateral = largest(row(side, t));
      if (!frontal.length || !lateral) continue;
      const sideScale = 5.6 / span(side);
      const zCenter = -(lateral[0] + lateral[1] - side.width) * .5 * sideScale;
      const zRadius = Math.max(.07, (lateral[1] - lateral[0]) * .5 * sideScale);
      for (let x = 0; x < p.width; x++) {
        const i = (y * p.width + x) * 4;
        const r = p.pixels[i], g = p.pixels[i + 1], b = p.pixels[i + 2];
        const gold = r > 105 && r > b * 1.17 && g > 65;
        const blue = b > 115 && b > r * 1.1;
        const silhouette = p.rows[y].find(pair => x >= pair[0] && x <= pair[1]);
        if (!silhouette) continue;
        if (!gold && !blue && view !== 0 && view !== 2) continue;
        let wx = (x - p.width * .5) * scale;
        let wy = (t - .5) * 5.6;
        let wz = 0;
        const random = ((Math.imul(x + view * 971, 73856093) ^ Math.imul(y, 19349663)) >>> 0) / 4294967296;
        if (view === 0 || view === 2) {
          const frontX = x / p.width * front.width;
          const interval = frontal.find(pair => frontX >= pair[0] - 2 && frontX <= pair[1] + 2);
          if (!interval) continue;
          const middle = (interval[0] + interval[1]) * .5;
          const radius = Math.max(1, (interval[1] - interval[0]) * .5);
          const local = Math.min(1, Math.abs((frontX - middle) / radius));
          const curvature = Math.sqrt(Math.max(0, 1 - local * local));
          const limb = Math.abs(middle - front.width * .5) > front.width * .19;
          const depth = limb ? Math.min(zRadius, radius * 5.6 / span(front)) : zRadius;
          const inward = gold ? .9 + random * .08 : 1;
          wz = zCenter + (view === 0 ? -1 : 1) * depth * curvature * inward;
        } else if (view === 1 || view === 3) {
          wz = (view === 1 ? -1 : 1) * (x - p.width * .5) * scale;
          const interval = largest(frontal);
          if (!interval) continue;
          const width = (interval[1] - interval[0]) * .5 * 5.6 / span(front);
          const local = Math.min(1, Math.abs((wz - zCenter) / zRadius));
          wx = (view === 1 ? 1 : -1) * width * Math.sqrt(Math.max(0, 1 - local * local)) * (gold ? .9 + random * .08 : 1);
        } else if (view === 4) {
          wx *= .7; wy = -2.46 + t * 1.8;
          wz = (random - .5) * .55;
        } else {
          wy = 2.64 + (t - .86) * .5;
          wz = -.3 + random * .7;
        }
        // A continuous pale-blue surface keeps the glass silhouette readable,
        // even where the source photograph contains dark transparent skin.
        vertices.push(wx, wy, wz,
          gold ? r / 255 : Math.max(.12, r / 255),
          gold ? g / 255 : Math.max(.28, g / 255),
          gold ? b / 255 : Math.max(.4, b / 255), gold ? 1 : 0);
      }
    }
  }
  return new Float32Array(vertices);
}
