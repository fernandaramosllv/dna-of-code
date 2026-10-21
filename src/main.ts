import './style.css';
import { Discoveries } from './core/Discoveries';
import { Camera } from './core/Camera';
import { Renderer } from './core/Renderer';

import { InteractionAudio } from './core/InteractionAudio';


import { InteractionController } from './controls/InteractionController';

// Configure Fernanda's exact profile URL before publishing.
export const LINKEDIN_URL = 'https://www.linkedin.com/';
const link=document.querySelector<HTMLAnchorElement>('#linkedin')!;
link.href=LINKEDIN_URL;
const canvas=document.querySelector<HTMLCanvasElement>('#scene')!;
const camera=new Camera();


const renderer=new Renderer(canvas,camera);
const controls=new InteractionController(canvas,camera);
const audio=new InteractionAudio(canvas,camera);
const discoveries=new Discoveries();
renderer.backgroundOverlay=(ctx,time)=>discoveries.draw(ctx,time);
const preference=matchMedia('(prefers-reduced-motion: reduce)');
const abort=new AbortController();
let frame=0,last=0,time=0,entrance=0,started=false;
renderer.resize();
function animate(now:number):void {
  const dt=last?Math.min((now-last)/1000,.05):0;last=now;
  controls.update(dt,preference.matches);
  updateInterface();
  if(!preference.matches)time+=dt;
  camera.drift=preference.matches?0:Math.sin(time*.35)*.025;
  entrance+=dt;
  renderer.render(preference.matches?1:Math.min(1,entrance/1.6),time);


  frame=requestAnimationFrame(animate);
}
window.addEventListener('resize',()=>renderer.resize(),{signal:abort.signal});
document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)cancelAnimationFrame(frame);else if(started) frame=requestAnimationFrame(animate);},{signal:abort.signal});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);discoveries.dispose();controls.dispose();renderer.dispose();audio.dispose();abort.abort();},{once:true});
window.addEventListener('pageshow',e=>{if(e.persisted)window.location.reload();});

const help=document.querySelector<HTMLElement>('#help')!;
const helpToggle=document.querySelector<HTMLButtonElement>('#help-toggle')!;
const soundButton=document.querySelector<HTMLButtonElement>('#sound')!;
let hintTimer=0;
function showHelp(show:boolean):void { help.classList.toggle('is-hidden',!show); helpToggle.setAttribute('aria-expanded',String(show)); }
helpToggle.addEventListener('click',()=>{clearTimeout(hintTimer);showHelp(help.classList.contains('is-hidden'));},{signal:abort.signal});
document.querySelector('#reset')!.addEventListener('click',()=>{controls.reset();camera.stretchMode=false;updateInterface();canvas.focus();},{signal:abort.signal});
soundButton.addEventListener('click',()=>audio.toggle(),{signal:abort.signal});
window.addEventListener('dna-sound-change',()=>{soundButton.querySelector('.control-label')!.textContent=audio.isEnabled?'Som ligado':'Som desligado';soundButton.setAttribute('aria-pressed',String(audio.isEnabled));},{signal:abort.signal});
document.addEventListener('pointerdown',event=>{
  if(!started || !(event.target instanceof Node) || help.contains(event.target) || helpToggle.contains(event.target))return;
  clearTimeout(hintTimer);showHelp(false);
},{signal:abort.signal});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!help.classList.contains('is-hidden')){clearTimeout(hintTimer);showHelp(false);if(help.contains(document.activeElement))helpToggle.focus();}
},{signal:abort.signal});
help.addEventListener('pointerenter',()=>clearTimeout(hintTimer),{signal:abort.signal});
help.addEventListener('focusin',()=>clearTimeout(hintTimer),{signal:abort.signal});

const welcome=document.querySelector<HTMLElement>('#welcome')!;
const experience=document.querySelector<HTMLElement>('#experience')!;
document.querySelector<HTMLButtonElement>('#continue')!.addEventListener('click',()=>{
  if(started)return;
  started=true;last=0;entrance=0;audio.unlock();
  experience.inert=false;experience.removeAttribute('aria-hidden');experience.classList.add('is-started');
  welcome.inert=true;welcome.classList.add('is-leaving');
  window.setTimeout(()=>{welcome.hidden=true;canvas.focus({preventScroll:true});},preference.matches?0:850);
  window.setTimeout(()=>document.querySelector('#intro')?.classList.add('is-hidden'),5500);
  renderer.resize();frame=requestAnimationFrame(animate);
  showHelp(true);hintTimer=window.setTimeout(()=>showHelp(false),11000);

},{signal:abort.signal});const stretchMode=document.querySelector<HTMLButtonElement>('#stretch-mode')!;
let dnaStage=false;
const stretchIndicator=document.querySelector<HTMLElement>('#stretch-indicator')!;
function updateInterface():void {
  experience.classList.toggle('dna-revealed',camera.zoom>=4.5);
  const next=camera.zoom>(dnaStage?1.8:2.4);
  if(next!==dnaStage){dnaStage=next;experience.classList.toggle('dna-stage',dnaStage);document.querySelector('#help-title')!.textContent=dnaStage?'Explore o DNA':'Explore o corpo';}
  const active=camera.stretchMode&&dnaStage;
  stretchIndicator.hidden=!active;
  canvas.classList.toggle('stretch-cursor',active);
  stretchMode.setAttribute('aria-pressed',String(camera.stretchMode));
  stretchMode.textContent=camera.stretchMode?'Desativar modo esticar':'Ativar modo esticar';
}
stretchMode.addEventListener('click',()=>{camera.stretchMode=!camera.stretchMode;updateInterface();},{signal:abort.signal});
document.querySelector('#stretch-exit')!.addEventListener('click',()=>{camera.stretchMode=false;updateInterface();},{signal:abort.signal});
const fullscreen=document.querySelector<HTMLButtonElement>('#fullscreen')!;
fullscreen.hidden=!document.fullscreenEnabled;
fullscreen.addEventListener('click',async()=>{
  try {if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch {const status=document.querySelector('#ui-status')!;status.textContent='Tela cheia indisponível neste navegador.';window.setTimeout(()=>{status.textContent='';},4000);}
},{signal:abort.signal});
document.addEventListener('fullscreenchange',()=>{
  const active=Boolean(document.fullscreenElement);
  fullscreen.setAttribute('aria-pressed',String(active));
  fullscreen.title=active?'Sair da tela cheia':'Entrar em tela cheia';fullscreen.setAttribute('aria-label',fullscreen.title);
  renderer.resize();
},{signal:abort.signal});


