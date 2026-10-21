import { Vector3 } from '../core/Vector3';
export class DNAHelix {
  readonly turns=2.8;
  readonly height=5.5;
  readonly segments=280;
  readonly strands: Vector3[][]=[[],[]];
  readonly bases: [Vector3,Vector3][]=[];
  constructor() {
    for(let side=0;side<2;side++) for(let i=0;i<=this.segments;i++) this.strands[side].push(this.point(i/this.segments,side,new Vector3()));
    for(let i=0;i<=40;i++) this.bases.push([this.point(i/40,0,new Vector3()),this.point(i/40,1,new Vector3())]);
  }
  point(t: number, side: number, out: Vector3): Vector3 {
    const angle=t*Math.PI*2*this.turns+side*Math.PI;
    return out.set(Math.cos(angle)*.78,(t-.5)*this.height,Math.sin(angle)*.78);
  }
}
