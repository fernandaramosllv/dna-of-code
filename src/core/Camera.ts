import { Vector3 } from './Vector3';
export interface Projected { x: number; y: number; z: number; scale: number }
export class Camera {
  yaw = .35;
  pitch = -.12;
  zoom = 1;
  focusX = .5;
  focusY = .47;
  panX = 0;
  panY = 0;
  pointerX = .5;
  pointerY = .47;
  pointerInside = false;
  dnaHovered = false;
  interactionEnergy = 0;
  clickSerial = 0;
  clickX = .5;
  clickY = .47;
  reducedMotion = false;
  dnaAngle = 0;
  pointerHeld = false;
  stretching = false;
  stretchMode = false;
  stretchX = 0;
  stretchY = 0;
  releaseSerial = 0;
  breakSerial = 0;
  repairSerial = 0;
  drift = 0;
  width = 1;
  height = 1;
  private cy=1; private sy=0; private cp=1; private sp=0;
  update(): void { this.cy=Math.cos(this.yaw); this.sy=Math.sin(this.yaw); this.cp=Math.cos(this.pitch+this.drift); this.sp=Math.sin(this.pitch+this.drift); }
  project(point: Vector3, out: Projected, zoom = this.zoom): void {
    const x=point.x*this.cy+point.z*this.sy;
    const z=-point.x*this.sy+point.z*this.cy;
    const y=point.y*this.cp-z*this.sp;
    out.z=point.y*this.sp+z*this.cp;
    out.scale=6/(6+out.z)*Math.min(this.height*.115,this.width*.27)*zoom;
    out.x=this.width*.5+x*out.scale;
    out.y=this.height*.47+y*out.scale;
  }
}
