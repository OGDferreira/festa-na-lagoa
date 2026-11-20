// overlay/src/audio.js
// Som da festa. Quem manda e o PAINEL DE ADMIN (/admin): ele manda a
// playlist e os comandos (tocar, pausar, proxima...). Se a playlist estiver
// vazia (ou o admin escolher "trilha gerada"), toca uma batida de festa
// gerada aqui mesmo com WebAudio, sem risco de copyright.
//
// Tudo passa por um analisador, entao as luzes e a danca pulsam junto com
// a musica de verdade (graves = "batida").
export function criarAudio({ bpm = 120, onTocando, onLiberou } = {}) {
  let ctx, master, analisador, dados, mediaNode;
  const el = new Audio();
  el.crossOrigin = 'anonymous';
  el.preload = 'auto';

  let estado = { faixas: [], modo: 'gerada', volume: 0.6, aleatorio: false, tocando: true, atual: 0 };
  let liberado = false;     // navegador ja deixou tocar som?
  let micAberto = false;    // admin falando: musica abaixa
  const volAlvo = () => estado.volume * (micAberto ? 0.2 : 1);
  let geradaTimer = null;
  let proxBatida = 0, passoGerado = 0;

  // ---- ritmo (pras luzes e danca) ----
  let fase = 0;             // batidas desde o inicio
  let pulso = 0;            // 0..1, decai
  let mediaGraves = 0, ultimoPico = 0;

  function garanteCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    analisador = ctx.createAnalyser();
    analisador.fftSize = 512;
    analisador.smoothingTimeConstant = 0.6;
    dados = new Uint8Array(analisador.frequencyBinCount);
    master.connect(analisador);
    analisador.connect(ctx.destination);
    mediaNode = ctx.createMediaElementSource(el);
    mediaNode.connect(master);
    master.gain.value = estado.volume;
  }

  // ------------------------------------------------------------------
  //  PLAYLIST (arquivos enviados pelo admin)
  // ------------------------------------------------------------------
  function usandoPlaylist() { return estado.modo === 'playlist' && estado.faixas.length > 0; }

  function tocarFaixa(idx) {
    if (!estado.faixas.length) return;
    estado.atual = ((idx % estado.faixas.length) + estado.faixas.length) % estado.faixas.length;
    const f = estado.faixas[estado.atual];
    el.src = '/assets/musica/' + encodeURIComponent(f.arquivo);
    if (estado.tocando && liberado) el.play().catch(() => {});
    avisa();
  }

  function proxima() {
    if (!estado.faixas.length) return;
    if (estado.aleatorio && estado.faixas.length > 1) {
      let n; do { n = Math.floor(Math.random() * estado.faixas.length); } while (n === estado.atual);
      tocarFaixa(n);
    } else tocarFaixa(estado.atual + 1);
  }
  function anterior() { tocarFaixa(estado.atual - 1); }

  el.addEventListener('ended', proxima);
  el.addEventListener('error', () => setTimeout(proxima, 1500)); // arquivo quebrado: pula
  el.addEventListener('play', avisa);
  el.addEventListener('pause', avisa);

  // ------------------------------------------------------------------
  //  TRILHA GERADA (batida de festa simples, royalty-free)
  // ------------------------------------------------------------------
  const ACORDES = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 196, 246.94]];
  function kick(tm) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, tm); o.frequency.exponentialRampToValueAtTime(40, tm + 0.12);
    g.gain.setValueAtTime(0.9, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + 0.3);
    o.connect(g); g.connect(master); o.start(tm); o.stop(tm + 0.32);
  }
  let ruido;
  function chimbal(tm, vol = 0.12) {
    if (!ruido) {
      ruido = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, tm); g.gain.exponentialRampToValueAtTime(0.001, tm + 0.06);
    s.connect(f); f.connect(g); g.connect(master); s.start(tm); s.stop(tm + 0.08);
  }
  function nota(tm, freq, dur, tipo, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, tm); g.gain.exponentialRampToValueAtTime(vol, tm + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, tm + dur);
    o.connect(g); g.connect(master); o.start(tm); o.stop(tm + dur + 0.02);
  }
  function agendaGerada() {
    const meio = 60 / bpm / 2; // colcheia
    while (proxBatida < ctx.currentTime + 0.2) {
      const tm = proxBatida, p = passoGerado % 32;
      const acorde = ACORDES[Math.floor(passoGerado / 32) % ACORDES.length];
      if (p % 2 === 0) kick(tm);
      chimbal(tm, p % 2 ? 0.14 : 0.05);
      if (p % 2 === 1) nota(tm, acorde[0] / 2, meio * 0.9, 'triangle', 0.22);       // baixo no contratempo
      if (p % 8 === 2 || p % 8 === 5) acorde.forEach((f) => nota(tm, f * 2, meio * 0.8, 'square', 0.025)); // stab
      if (p === 0 || p === 16) nota(tm, acorde[2] * 2, meio * 6, 'sine', 0.05);       // melodiazinha
      proxBatida += meio; passoGerado++;
    }
  }
  function ligaGerada() {
    if (geradaTimer || !ctx) return;
    proxBatida = ctx.currentTime + 0.05;
    geradaTimer = setInterval(agendaGerada, 50);
  }
  function desligaGerada() { clearInterval(geradaTimer); geradaTimer = null; }

  // ------------------------------------------------------------------
  //  aplica o que o admin mandou
  // ------------------------------------------------------------------
  function aplicar() {
    if (!liberado) return;
    garanteCtx();
    master.gain.setTargetAtTime(volAlvo(), ctx.currentTime, 0.05);
    if (!estado.tocando) { el.pause(); desligaGerada(); avisa(); return; }
    if (usandoPlaylist()) {
      desligaGerada();
      const f = estado.faixas[estado.atual];
      const esperado = f && ('/assets/musica/' + encodeURIComponent(f.arquivo));
      if (!f || !el.src.endsWith(esperado)) tocarFaixa(estado.atual || 0);
      else el.play().catch(() => {});
    } else {
      el.pause();
      ligaGerada();
    }
    avisa();
  }

  function setEstado(novo) {
    const idxAntes = estado.atual;
    const faixaAntes = estado.faixas[idxAntes] && estado.faixas[idxAntes].arquivo;
    estado = { ...estado, ...novo };
    // mantem a faixa atual se ela ainda existe na nova lista
    const i = estado.faixas.findIndex((f) => f.arquivo === faixaAntes);
    estado.atual = i >= 0 ? i : Math.min(estado.atual || 0, Math.max(0, estado.faixas.length - 1));
    aplicar();
  }

  function comando(acao, arg) {
    if (acao === 'proxima') { estado.tocando = true; if (usandoPlaylist()) proxima(); aplicar(); }
    else if (acao === 'anterior') { estado.tocando = true; if (usandoPlaylist()) anterior(); aplicar(); }
    else if (acao === 'tocar') { estado.tocando = true; if (typeof arg === 'number') { estado.modo = 'playlist'; garanteCtx(); tocarFaixa(arg); } aplicar(); }
    else if (acao === 'pausar') { estado.tocando = false; aplicar(); }
  }

  function avisa() {
    if (!onTocando) return;
    const f = usandoPlaylist() ? estado.faixas[estado.atual] : null;
    onTocando({
      modo: usandoPlaylist() ? 'playlist' : 'gerada',
      idx: usandoPlaylist() ? estado.atual : -1,
      titulo: f ? f.titulo : 'Batida da Lagoa (gerada)',
      tocando: estado.tocando && liberado && (usandoPlaylist() ? !el.paused : !!geradaTimer),
      liberado
    });
  }

  // o navegador so deixa tocar depois de um clique (no OBS e automatico)
  function liberar() {
    if (liberado) { if (ctx && ctx.state === 'suspended') ctx.resume(); return true; }
    garanteCtx();
    if (ctx.state === 'running') { liberado = true; aplicar(); return true; }
    ctx.resume().then(() => {
      if (ctx.state === 'running' && !liberado) { liberado = true; aplicar(); if (onLiberou) onLiberou(); }
    }).catch(() => {});
    return false;
  }

  // ------------------------------------------------------------------
  //  ritmo: chamado todo frame
  // ------------------------------------------------------------------
  function ritmo(dt) {
    fase += dt * (bpm / 60);
    pulso = Math.max(0, pulso - dt * 3.2);
    let ouvindo = false;
    if (analisador && liberado && estado.tocando) {
      analisador.getByteFrequencyData(dados);
      // graves: ~40-160 Hz
      const hzPorBin = ctx.sampleRate / analisador.fftSize;
      const a = Math.max(1, Math.floor(40 / hzPorBin)), b = Math.max(a + 1, Math.ceil(160 / hzPorBin));
      let soma = 0;
      for (let i = a; i <= b; i++) soma += dados[i];
      const graves = soma / (b - a + 1) / 255;
      if (graves > 0.05) ouvindo = true;
      mediaGraves = mediaGraves * 0.95 + graves * 0.05;
      const agora = performance.now();
      if (graves > mediaGraves * 1.25 && graves > 0.3 && agora - ultimoPico > 220) {
        pulso = Math.min(1, 0.6 + graves * 0.5);
        ultimoPico = agora;
        // puxa a fase da danca pra cair junto com o pico
        const frac = fase - Math.round(fase);
        fase -= frac * 0.5;
      }
    }
    if (!ouvindo) {
      // sem som: pulso sintetico no bpm, pra festa nunca parar
      const frac = fase - Math.floor(fase);
      pulso = Math.max(pulso, Math.pow(1 - frac, 4));
    }
    return { fase, batida: pulso };
  }

  // ------------------------------------------------------------------
  //  EFEITOS SONOROS (novo top 1)
  //  tipo 'buzina' = buzina de DJ (novo top 1 doador)
  //  tipo 'fanfarra' = fanfarrinha (novo top 1 curtidor)
  //  Se o config apontar um arquivo, toca o arquivo no lugar do som gerado.
  // ------------------------------------------------------------------
  const arquivosEfeito = {};
  function efeito(tipo, arquivo, volume = 0.9) {
    if (!liberado || !ctx) return;
    const tm = ctx.currentTime + 0.02;
    const saida = ctx.createGain();
    saida.gain.value = volume;
    saida.connect(ctx.destination); // fora do master: o volume da musica nao abafa o efeito
    // abaixa a musica rapidinho pro efeito aparecer
    master.gain.cancelScheduledValues(tm);
    master.gain.setTargetAtTime(volAlvo() * 0.35, tm, 0.03);
    master.gain.setTargetAtTime(volAlvo(), tm + 1.3, 0.25);

    if (arquivo) {
      const a = arquivosEfeito[arquivo] || (arquivosEfeito[arquivo] = new Audio(arquivo));
      a.currentTime = 0; a.volume = Math.min(1, volume);
      a.play().catch(() => {});
      return;
    }
    if (tipo === 'buzina') {
      // buzina de DJ: 3 toques curtos + 1 longo, onda serrilhada com vibrato
      const toques = [[0, 0.12], [0.16, 0.12], [0.32, 0.12], [0.5, 0.7]];
      for (const [ini, dur] of toques) {
        for (const det of [0, 7, -7]) {
          const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(466, tm + ini);
          o.frequency.linearRampToValueAtTime(440, tm + ini + dur);
          o.detune.value = det;
          const lfo = ctx.createOscillator(), lg = ctx.createGain();
          lfo.frequency.value = 9; lg.gain.value = 12;
          lfo.connect(lg); lg.connect(o.frequency);
          f.type = 'lowpass'; f.frequency.value = 2400;
          g.gain.setValueAtTime(0.0001, tm + ini);
          g.gain.exponentialRampToValueAtTime(0.12, tm + ini + 0.02);
          g.gain.setValueAtTime(0.12, tm + ini + dur - 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, tm + ini + dur);
          o.connect(f); f.connect(g); g.connect(saida);
          o.start(tm + ini); lfo.start(tm + ini);
          o.stop(tm + ini + dur + 0.05); lfo.stop(tm + ini + dur + 0.05);
        }
      }
    } else {
      // fanfarra: arpejo subindo + acorde final brilhante
      const notas = [[0, 523.25, 0.12], [0.12, 659.25, 0.12], [0.24, 783.99, 0.12], [0.38, 1046.5, 0.6]];
      for (const [ini, fq, dur] of notas) {
        for (const [tipoO, mult, vol] of [['square', 1, 0.05], ['triangle', 1, 0.12], ['sine', 2, 0.04]]) {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = tipoO; o.frequency.value = fq * mult;
          g.gain.setValueAtTime(0.0001, tm + ini);
          g.gain.exponentialRampToValueAtTime(vol, tm + ini + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, tm + ini + dur);
          o.connect(g); g.connect(saida);
          o.start(tm + ini); o.stop(tm + ini + dur + 0.05);
        }
      }
    }
  }

  // mic do admin aberto: musica desce suave pra ~20%; fechou, volta
  function abaixar(on) {
    micAberto = on;
    if (ctx) master.gain.setTargetAtTime(volAlvo(), ctx.currentTime, on ? 0.25 : 0.6);
  }

  return { setEstado, comando, liberar, ritmo, efeito, abaixar, get liberado() { return liberado; } };
}
