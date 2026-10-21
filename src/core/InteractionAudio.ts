import { Camera } from './Camera';

/** Locally synthesized sound, unlocked by a user gesture; no external requests. */
export class InteractionAudio {
  private context: AudioContext | null = null;
  private enabled = true;
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;
  private lastTone = -1;
  private abort = new AbortController();
  constructor(canvas: HTMLCanvasElement, private camera: Camera) {
    const options = { signal: this.abort.signal };
    window.addEventListener('keydown', e => {
      if (e.key.toLowerCase() !== 'm' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      this.toggle();
    }, options);
    canvas.addEventListener('pointerdown', () => { if (!this.enabled) return; this.context ??= new AudioContext(); void this.context.resume().then(() => { if (this.camera.dnaHovered) this.tone(330 + this.camera.pointerY * 260, .18); }); }, options);
    canvas.addEventListener('pointermove', () => {
      if (this.camera.dnaHovered && !this.camera.pointerHeld) this.tone(480 + this.camera.pointerY * 140, .1);
    }, options);
  }
  unlock(): void {
    if (!this.enabled) return;
    this.context ??= new AudioContext(); void this.context.resume();
  }
  recordingTrack(): MediaStreamTrack | undefined {
    if (!this.enabled) return undefined;
    this.context ??= new AudioContext();
    void this.context.resume();
    this.recordingDestination ??= this.context.createMediaStreamDestination();
    return this.recordingDestination.stream.getAudioTracks()[0];
  }
  get isEnabled(): boolean { return this.enabled; }
  toggle(): void {
    this.enabled = !this.enabled;
    if (this.enabled) { this.context ??= new AudioContext(); void this.context.resume(); }
    else if (this.context) void this.context.suspend();
    window.dispatchEvent(new Event('dna-sound-change'));
  }
  private tone(frequency: number, duration: number, structural = false, rising = false): void {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (!structural && now - this.lastTone < .15) return;
    this.lastTone = now;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = structural ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * (rising ? 1.7 : .7), now + duration);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.035, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain); gain.connect(this.context.destination);
    if (this.recordingDestination) gain.connect(this.recordingDestination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now); oscillator.stop(now + duration + .02);
  }
  dispose(): void { this.abort.abort(); if (this.context) void this.context.close(); }
}
