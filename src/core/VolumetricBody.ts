import { Camera } from './Camera';
import { reconstructBody } from '../objects/BodyReconstruction';

const vertexSource = `
attribute vec3 position;
attribute vec3 color;
attribute float energy;
uniform vec2 viewport;
uniform vec2 angle;
uniform float scale;
uniform float pixelRatio;
varying vec4 tint;
void main() {
  float cy = cos(angle.x), sy = sin(angle.x), cp = cos(angle.y), sp = sin(angle.y);
  vec3 p = vec3(position.x * cy + position.z * sy, position.y, -position.x * sy + position.z * cy);
  p = vec3(p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp);
  float perspective = 7.0 / (7.0 + p.z);
  gl_Position = vec4(p.x * scale * perspective * 2.0 / viewport.x, -p.y * scale * perspective * 2.0 / viewport.y, p.z * .1, 1.0);
  gl_PointSize = pixelRatio * clamp(scale / 115.0, .8, 2.1) * mix(1.8, 1.5, energy);
  float depth = clamp(.85 - p.z * .09, .45, 1.0);
  tint = vec4(color * depth, mix(.3, .9, energy));
}`;
const fragmentSource = `
precision mediump float;
varying vec4 tint;
void main() {
  float radius = length(gl_PointCoord - vec2(.5));
  float softness = 1.0 - smoothstep(.2, .5, radius);
  if (softness < .02) discard;
  gl_FragColor = vec4(tint.rgb, tint.a * softness);
}`;

/** A genuine 3D point volume, rotated on the GPU with native WebGL. */
export class VolumetricBody {
  readonly canvas = document.createElement('canvas');
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private count: number;
  private viewport: WebGLUniformLocation | null;
  private angle: WebGLUniformLocation | null;
  private scale: WebGLUniformLocation | null;
  private pixelRatio: WebGLUniformLocation | null;
  private lost = false;

  constructor(images: HTMLImageElement[], lowPower: boolean) {
    const gl = this.canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL is required for continuous body rotation');
    this.gl = gl;
    this.canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.lost = true; });
    this.canvas.addEventListener('webglcontextrestored', () => window.location.reload());
    const shader = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Unable to create shader');
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compilation failed');
      return shader;
    };
    const vertex = shader(gl.VERTEX_SHADER, vertexSource), fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create WebGL program');
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Program linking failed');
    this.program = program; gl.useProgram(program);
    const data = reconstructBody(images, lowPower); this.count = data.length / 7;
    const buffer = gl.createBuffer(); if (!buffer) throw new Error('Unable to create body buffer');
    this.buffer = buffer; gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    for (const [name, size, offset] of [['position', 3, 0], ['color', 3, 12], ['energy', 1, 24]] as const) {
      const location = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 28, offset);
    }
    this.viewport = gl.getUniformLocation(program, 'viewport'); this.angle = gl.getUniformLocation(program, 'angle');
    this.scale = gl.getUniformLocation(program, 'scale'); this.pixelRatio = gl.getUniformLocation(program, 'pixelRatio');
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.DEPTH_TEST);
  }

  render(camera: Camera, initialYaw: number, initialPitch: number): void {
    if (this.lost) return;
    const gl = this.gl, dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.round(camera.width * dpr), height = Math.round(camera.height * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    gl.viewport(0, 0, width, height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniform2f(this.viewport, camera.width, camera.height);
    gl.uniform2f(this.angle, camera.yaw - initialYaw, camera.pitch - initialPitch + camera.drift);
    gl.uniform1f(this.scale, Math.min(camera.height * .145, camera.width * .32) * Math.min(camera.zoom, 3.2));
    gl.uniform1f(this.pixelRatio, dpr); gl.drawArrays(gl.POINTS, 0, this.count);
  }

  dispose(): void { this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); }
}
