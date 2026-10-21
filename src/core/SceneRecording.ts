/** Records a bounded-resolution copy of the scene, without screen or microphone access. */
export class SceneRecording {
  private recorder: MediaRecorder | null = null;
  private timer = 0;
  private clock = 0;
  private stream: MediaStream | null = null;
  private output: HTMLCanvasElement | null = null;
  private outputContext: CanvasRenderingContext2D | null = null;
  private lastFrame = -Infinity;
  constructor(private canvas: HTMLCanvasElement, private button: HTMLButtonElement, private audioTrack: () => MediaStreamTrack | undefined) {
    button.hidden = !('MediaRecorder' in window) || !canvas.captureStream;
    button.addEventListener('click', () => this.toggle());
  }
  /** Called after rendering: never encode duplicate frames while the scene is busy. */
  captureFrame(now: number): void {
    if(this.recorder?.state!=='recording'||!this.output||!this.outputContext||now-this.lastFrame<1000/30)return;
    this.lastFrame=now;
    this.outputContext.drawImage(this.canvas,0,0,this.output.width,this.output.height);
    const track=this.stream?.getVideoTracks()[0] as (MediaStreamTrack & {requestFrame?:()=>void}) | undefined;
    track?.requestFrame?.();
  }
  private toggle(): void {
    if (this.recorder?.state === 'recording') { this.recorder.stop(); return; }
    const mimeType = ['video/mp4;codecs=avc1.42001f,mp4a.40.2','video/webm;codecs=vp8,opus','video/mp4','video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    if (!mimeType) { this.button.textContent = 'Gravação indisponível'; return; }
    try {
      const output=document.createElement('canvas');
      const scale=Math.min(1,1920/this.canvas.width,1080/this.canvas.height);
      output.width=Math.max(2,Math.floor(this.canvas.width*scale/2)*2);
      output.height=Math.max(2,Math.floor(this.canvas.height*scale/2)*2);
      const context=output.getContext('2d',{alpha:false});
      if(!context)throw new Error('Recording canvas unavailable');
      context.drawImage(this.canvas,0,0,output.width,output.height);
      this.output=output;this.outputContext=context;this.lastFrame=-Infinity;
      this.stream=output.captureStream(0);
      const video=this.stream.getVideoTracks()[0] as MediaStreamTrack & {requestFrame?:()=>void};
      if(!video.requestFrame){video.stop();this.stream=output.captureStream(30);}
      const audio = this.audioTrack(); if (audio) this.stream.addTrack(audio.clone());
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(this.stream, { mimeType, videoBitsPerSecond: 4_000_000, audioBitsPerSecond:128_000 });
      this.recorder = recorder;
      let failed=false;
      const finish = (): void => {
        clearTimeout(this.timer); clearInterval(this.clock);
        this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
        this.output=null;this.outputContext=null;this.recorder = null; this.button.textContent = 'Gravar 30s';
      };
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onerror = () => { failed=true;finish(); this.button.textContent = 'Tentar gravar novamente'; };
      recorder.onstop = () => {
        finish();
        if (failed||!chunks.length) return;
        const actualType=recorder.mimeType||mimeType;
        const url = URL.createObjectURL(new Blob(chunks, { type: actualType }));
        const link = document.createElement('a'); link.href = url;
        link.download = `DNA-of-Code.${actualType.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
        link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      };
      let remaining = 30; this.button.textContent = `Parar · ${remaining}s`;
      recorder.start(1000);this.captureFrame(performance.now());
      this.clock = window.setInterval(() => { this.button.textContent = `Parar · ${--remaining}s`; }, 1000);
      this.timer = window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 30000);
    } catch {
      clearTimeout(this.timer);clearInterval(this.clock);
      this.stream?.getTracks().forEach(t => t.stop());this.stream=null;
      this.output=null;this.outputContext=null;this.recorder=null;
      this.button.textContent = 'Tentar gravar novamente';
    }
  }
  dispose(): void { if (this.recorder?.state === 'recording') this.recorder.stop(); clearTimeout(this.timer); clearInterval(this.clock); }
}
