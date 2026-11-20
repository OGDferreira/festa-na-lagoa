// overlay/src/audio.js
// Trilha de fundo. Se o config tiver uma playlist, toca os arquivos em
// sequencia. Se estiver vazia, gera uma trilha ambiente com WebAudio
// (royalty-free, sem risco de copyright) pra ja ter musica rolando.
export function criarAudio(cfg) {
  let ctx, masterGain, started = false, modo;
  let audioEl;

  function garanteCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = cfg.volume ?? 0.5;
      masterGain.connect(ctx.destination);
    }
  }

  function tocarPlaylist() {
    modo = 'playlist';
    let i = 0;
    audioEl = new Audio();
    audioEl.volume = cfg.volume ?? 0.5;
    const proximo = () => { audioEl.src = cfg.playlist[i % cfg.playlist.length]; i++; audioEl.play().catch(() => {}); };
    audioEl.addEventListener('ended', proximo);
    proximo();
  }

  // ambiente gerado: acordes lentos + um "glub" de agua ocasional
  function tocarAmbiente() {
    modo = 'ambiente';
    garanteCtx();
    const escala = [220, 261.63, 293.66, 329.63, 392, 440]; // La menor pentatonicaish
    const pad = (freqs) => {
      freqs.forEach((f, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = idx === 0 ? 'sine' : 'triangle';
        o.frequency.value = f;
        g.gain.value = 0;
        o.connect(g); g.connect(masterGain);
        o.start();
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.08, now + 2);
        g.gain.linearRampToValueAtTime(0, now + 8);
        o.stop(now + 8.2);
      });
    };
    const loop = () => {
      const root = escala[Math.floor(Math.random() * 3)];
      pad([root / 2, root, root * 1.5]);
      setTimeout(loop, 6500);
    };
    loop();

    // glub de agua
    const glub = () => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(600, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.18);
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.connect(g); g.connect(masterGain); o.start(); o.stop(ctx.currentTime + 0.3);
      setTimeout(glub, 2500 + Math.random() * 4000);
    };
    glub();
  }

  function start() {
    if (started || !cfg.ligado) return false;
    started = true;
    if (cfg.playlist && cfg.playlist.length) tocarPlaylist();
    else tocarAmbiente();
    return true;
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); if (audioEl) audioEl.play().catch(() => {}); }

  return { start, resume, get started() { return started; } };
}
