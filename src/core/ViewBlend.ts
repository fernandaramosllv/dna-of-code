export interface ViewWeight { index: number; weight: number }

/** Front, right, back, left, top, bottom. Angles wrap across the 360° seam. */
export function viewBlend(yaw: number, pitch: number, output: ViewWeight[]): void {
  const turn = Math.PI * 2;
  const wrapped = ((yaw % turn) + turn) % turn;
  const sector = wrapped / (Math.PI * .5);
  const first = Math.floor(sector) % 4;
  const fraction = sector - Math.floor(sector);
  const blend = fraction * fraction * (3 - 2 * fraction);
  // Top and bottom photographs depict the front; taper their influence toward
  // the side/back views instead of inventing unprovided elevated viewpoints.
  const facingFront = Math.max(0, Math.cos(wrapped)) ** 4;
  const elevation = Math.min(1, Math.abs(pitch) / .55) * facingFront;
  output[0].index = first; output[0].weight = (1 - blend) * (1 - elevation);
  output[1].index = (first + 1) % 4; output[1].weight = blend * (1 - elevation);
  output[2].index = pitch < 0 ? 4 : 5; output[2].weight = elevation;
}
