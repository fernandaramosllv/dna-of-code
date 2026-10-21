const facts = [
  {category:'CÉREBRO',title:'Uma conversa elétrica e química',text:'Seus neurônios usam sinais elétricos para conduzir mensagens e, em muitas sinapses, substâncias químicas para passá-las adiante. Pensar e mover um dedo dependem dessas conversas.'},
  {category:'CÉREBRO',title:'Dormindo, mas trabalhando',text:'O cérebro não desliga quando você dorme. Durante o sono, ele continua ativo e participa da consolidação das memórias que você formou enquanto estava acordado.'},
  {category:'CÉREBRO',title:'Neurônios não trabalham sozinhos',text:'O cérebro também tem células da glia. Elas ajudam a sustentar, proteger e manter o ambiente dos neurônios, e algumas envolvem os axônios com uma camada que acelera os sinais.'},
  {category:'CÉREBRO',title:'Aprender transforma conexões',text:'Quando você aprende, as conexões entre neurônios podem mudar de força. Essa capacidade de reorganização, chamada plasticidade, ajuda o cérebro a se adaptar às experiências.'},
  {category:'DNA',title:'Quatro letras, bilhões de combinações',text:'O DNA usa quatro tipos de bases, representados por A, T, C e G. A ordem dessas letras forma sequências que ajudam a orientar o funcionamento das células.'},
  {category:'DNA',title:'As escadinhas têm pares certos',text:'Na dupla hélice, A se liga a T e C se liga a G. Esses pares de bases formam os degraus do DNA, enquanto as laterais são feitas de açúcar e fosfato.'},
  {category:'DNA',title:'Uma cópia feita de duas metades',text:'Quando o DNA é copiado, suas duas fitas se separam e servem de molde. Cada nova dupla hélice fica com uma fita antiga e outra recém-formada.'},
  {category:'DNA',title:'DNA além do núcleo',text:'Nem todo DNA das suas células fica no núcleo. As mitocôndrias também têm um pequeno genoma próprio, organizado em uma molécula circular.'},
  {category:'DNA',title:'O mesmo código, funções diferentes',text:'Uma célula da pele e um neurônio geralmente carregam o mesmo DNA nuclear, mas usam diferentes conjuntos de genes. Isso ajuda a explicar suas formas e funções tão distintas.'},
  {category:'CÉLULAS',title:'Pequenas fábricas de proteínas',text:'Os ribossomos leem instruções do RNA mensageiro e juntam aminoácidos para construir proteínas. Essas moléculas participam da estrutura, dos sinais e de muitas reações nas células.'},
  {category:'CÉLULAS',title:'Energia em pequenas unidades',text:'As células usam ATP para alimentar muitos de seus processos. As mitocôndrias produzem grande parte desse ATP em muitas células humanas.'},
  {category:'CÉLULAS',title:'Uma fronteira que escolhe',text:'A membrana celular não é apenas uma embalagem. Ela controla a passagem de substâncias e tem proteínas que recebem sinais, ajudando a célula a responder ao ambiente.'},
  {category:'CÉLULAS',title:'Uma central de reciclagem',text:'Os lisossomos contêm enzimas que ajudam a desmontar materiais e componentes desgastados. Parte dessas peças pode ser reaproveitada pela célula.'},
];
/** Screen-space discoveries stay available while the artwork pans and zooms. */
export class Discoveries {
  private abort = new AbortController();
  private active: HTMLButtonElement | null = null;
  private group = document.createElement('div');
  private panel = document.createElement('section');
  constructor() {
    const options = { signal: this.abort.signal };
    this.group.className = 'discoveries'; this.group.setAttribute('role', 'group');
    this.group.setAttribute('aria-label', 'Pontos de luz: curiosidades sobre cérebro, DNA e células');
    this.panel.id = 'discovery-panel'; this.panel.className = 'discovery-panel'; this.panel.hidden = true;
    this.panel.setAttribute('role', 'region'); this.panel.setAttribute('aria-labelledby', 'discovery-title');
    const locations: { x: number; y: number }[] = [];
    facts.forEach((fact, i) => {
      let spot = { x: 0, y: 0 };
      for (let attempt = 0; attempt < 150; attempt++) {
        spot = { x: (i % 2 === 0 ? 7 : 73) + Math.random() * 20, y: 24 + Math.random() * 59 };
        if (locations.every(p => Math.hypot((p.x - spot.x) * window.innerWidth / 100, (p.y - spot.y) * window.innerHeight / 100) > 62)) break;
      }
      locations.push(spot);
      const button = document.createElement('button'); button.className = `discovery-light ${spot.x < 50 ? 'left' : 'right'}`;
      button.style.left = `${spot.x}%`; button.style.right = 'auto'; button.style.top = `${spot.y}%`;
      button.style.setProperty('--phase', String(i * 1.7));
      button.setAttribute('aria-label', `Descobrir: ${fact.title}`);
      button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', this.panel.id);
      button.title = fact.title;
      button.addEventListener('click', () => {
        if (this.active === button) { this.close(); return; }
        this.close(); this.active = button; button.setAttribute('aria-expanded', 'true');
        const kicker = document.createElement('p'); kicker.className = 'discovery-kicker'; kicker.textContent = 'VOCÊ SABIA? · ' + fact.category;
        const heading = document.createElement('h2'); heading.id = 'discovery-title'; heading.textContent = fact.title;
        const text = document.createElement('p'); text.textContent = fact.text;
        const close = document.createElement('button'); close.className = 'discovery-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Fechar curiosidade');
        close.addEventListener('click', () => { this.close(); button.focus(); }, options);
        this.panel.replaceChildren(kicker, heading, text, close);
        this.panel.hidden = false; this.position();
      }, options);
      this.group.append(button);
    });
    (document.querySelector('#experience') ?? document.body).append(this.group, this.panel);
    document.addEventListener('pointerdown', e => {
      if (e.target instanceof Node && !this.panel.contains(e.target) && !this.group.contains(e.target)) this.close();
    }, options);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.active) { const button = this.active; this.close(); button.focus(); } }, options);
    window.addEventListener('resize', () => this.position(), options);
  }
  draw(ctx: CanvasRenderingContext2D, time: number): void {
    ctx.save();
    for (const button of Array.from(this.group.querySelectorAll<HTMLButtonElement>('button'))) {
      const phase = Number(button.style.getPropertyValue('--phase'));
      const floating = this.active !== button;
      button.style.transform = `translate(calc(-50% + ${floating ? Math.sin(time * .32 + phase) * 9 : 0}px), calc(-50% + ${floating ? Math.cos(time * .4 + phase) * 11 : 0}px))`;
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      const selected = this.active === button || button.matches(':hover, :focus-visible');
      const dim = this.active && this.active !== button ? .3 : 1;
      ctx.globalAlpha = dim;
      const radius = selected ? 6 : 4;
      const pulse = .8 + Math.sin(time * 1.2 + rect.top * .01) * .12;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, selected ? 23 : 17);
      glow.addColorStop(0, `rgba(255,224,156,${pulse * .6})`); glow.addColorStop(1, 'rgba(218,171,73,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, selected ? 23 : 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe8ae'; ctx.globalAlpha = pulse * dim;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = (selected ? .8 : .5) * dim; ctx.strokeStyle = '#efbb65'; ctx.lineWidth = .7; ctx.shadowColor = '#ffbf55'; ctx.shadowBlur = 4;
      const orbit = selected ? 19 : 15;
      for (let ring = 0; ring < 3; ring++) {
        const angle = ring * Math.PI / 3 + Math.sin(time * .3 + phase) * .15;
        ctx.beginPath(); ctx.ellipse(x, y, orbit, orbit * .36, angle, 0, Math.PI * 2); ctx.stroke();
        const t = time * (.5 + ring * .12) + phase + ring * 2;
        const ox = Math.cos(t) * orbit, oy = Math.sin(t) * orbit * .36;
        ctx.fillStyle = '#fff0b6'; ctx.beginPath(); ctx.arc(x + ox * Math.cos(angle) - oy * Math.sin(angle), y + ox * Math.sin(angle) + oy * Math.cos(angle), 1.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  private position(): void {
    if (!this.active || this.panel.hidden) return;
    const rect = this.active.getBoundingClientRect(), mobile = window.innerWidth < 600;
    const width = Math.min(280, window.innerWidth - 32); this.panel.style.width = `${width}px`;
    const left = mobile ? (window.innerWidth - width) / 2 : this.active.classList.contains('left') ? rect.right + 14 : rect.left - width - 14;
    this.panel.style.left = `${Math.max(16, Math.min(window.innerWidth - width - 16, left))}px`;
    this.panel.style.top = `${Math.max(116, Math.min(window.innerHeight - this.panel.offsetHeight - 58, rect.top - 30))}px`;
  }
  private close(): void { this.active?.setAttribute('aria-expanded', 'false'); this.active = null; this.panel.hidden = true; }
  dispose(): void { this.abort.abort(); this.group.remove(); this.panel.remove(); }
}

