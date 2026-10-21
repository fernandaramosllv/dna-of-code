import { Camera } from '../core/Camera';
interface Mote { x: number; y: number; depth: number; phase: number; speed: number; dx: number; dy: number }
export class AmbientParticles {
  private motes: Mote[] = [];
  private lastTime = 0;
  constructor(lowPower: boolean) {
    for (let i=0;i<(lowPower?210:520);i++) this.motes.push({x:(i*.61803398875)%1,y:(i*.754877666)%1,depth:[.22,.5,.88][i%3],phase:i*2.39996,speed:.002+(i%5)*.0012,dx:0,dy:0});
  }
  render(ctx: CanvasRenderingContext2D,width:number,height:number,time:number,opacity:number,camera:Camera):void {
    const dt=Math.min(.05,Math.max(0,time-this.lastTime));this.lastTime=time;
    ctx.save();ctx.shadowBlur=0;
    for(let i=0;i<5;i++){
      const x=width*((i%2 ? .95 : .05)+Math.sin(time*.07+i*2)*.04),y=height*(.45+Math.cos(time*.06+i)*.23),radius=Math.max(width,height)*(.3+(i%2)*.12);
      const fog=ctx.createRadialGradient(x,y,0,x,y,radius);fog.addColorStop(0,i%2===1?'rgba(164,117,49,.105)':'rgba(42,103,151,.16)');fog.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=opacity;ctx.fillStyle=fog;ctx.fillRect(0,0,width,height);
    }
    for(const p of this.motes){
      const bx=((p.x+Math.sin(time*.12+p.phase)*.018+time*p.speed*p.depth*1.4)%1+1)%1*width,by=((p.y-time*p.speed*p.depth*1.4)%1+1)%1*height;
      const rx=bx-camera.pointerX*width,ry=by-camera.pointerY*height,distance=Math.hypot(rx,ry);
      const push=camera.pointerInside&&!camera.reducedMotion?Math.max(0,1-distance/115)*20*p.depth:0,ease=camera.reducedMotion?1:1-Math.exp(-3*dt);
      p.dx+=(rx/(distance||1)*push-p.dx)*ease;p.dy+=(ry/(distance||1)*push-p.dy)*ease;
      const px=camera.reducedMotion?0:(camera.pointerX-.5)*p.depth*9,py=camera.reducedMotion?0:(camera.pointerY-.5)*p.depth*6;
      const clarity=.35+.65*Math.min(1,Math.abs(bx/width-.5)/.32);
      ctx.globalAlpha=opacity*clarity*p.depth*.65*(.65+.35*Math.sin(time*.6+p.phase)**2);ctx.fillStyle=p.depth>.7?'#ffe3a2':'#c5ad7f';ctx.beginPath();ctx.arc(bx+p.dx+px,by+p.dy+py,.3+p.depth*1.5,0,Math.PI*2);ctx.fill();
      if(p.depth>.7&&Math.sin(p.phase)>.7){const glow=ctx.createRadialGradient(bx+p.dx+px,by+p.dy+py,0,bx+p.dx+px,by+p.dy+py,5);glow.addColorStop(0,'rgba(255,220,145,.16)');glow.addColorStop(1,'rgba(255,220,145,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(bx+p.dx+px,by+p.dy+py,5,0,Math.PI*2);ctx.fill();}
    }
    ctx.restore();
  }
}
