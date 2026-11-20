// overlay/src/assets.js
// Desenha os sprites (sapo, folha, avatar) em canvas. Nada de imagem de
// terceiros: tudo gerado aqui, entao e arte propria e livre.
import * as THREE from 'three';

const _cache = new Map();

function canvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// ---- cor por string (pra cada sapo ter uma cor estavel) ------------------
export function corDaString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

// ---- VITORIA-REGIA (folha) ----------------------------------------------
export function texturaFolha(cores) {
  const key = 'folha';
  if (_cache.has(key)) return _cache.get(key);
  const c = canvas(256);
  const g = c.getContext('2d');
  const cx = 128, cy = 128, r = 118;
  // corpo da folha com recorte (fenda) tipico da vitoria-regia
  g.beginPath();
  for (let a = 0.35; a <= Math.PI * 2 + 0.35; a += 0.02) {
    const wobble = 1 + Math.sin(a * 11) * 0.015;
    const rr = (a > 0.0 && a < 0.7) ? r * 0.0 : r * wobble; // fenda
    const x = cx + Math.cos(a) * (a < 0.35 || a > Math.PI * 2 ? 0 : rr);
    const y = cy + Math.sin(a) * rr;
    if (a === 0.35) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  const grad = g.createRadialGradient(cx, cy, 10, cx, cy, r);
  grad.addColorStop(0, cores.folha);
  grad.addColorStop(1, cores.folhaBorda);
  g.fillStyle = grad; g.fill();
  // borda levantada
  g.lineWidth = 10; g.strokeStyle = '#7a3b2b'; g.stroke();
  // nervuras
  g.strokeStyle = 'rgba(20,80,30,.45)'; g.lineWidth = 2;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
    g.beginPath(); g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * r * .92, cy + Math.sin(a) * r * .92); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _cache.set(key, tex);
  return tex;
}

// ---- SAPO (visto de frente, estilo cartoon proprio) ----------------------
// hue = matiz base; estagio influencia detalhes (perereca ganha olhos vermelhos)
export function texturaSapo(hue, perereca = false) {
  const key = 'sapo-' + Math.round(hue) + (perereca ? '-p' : '');
  if (_cache.has(key)) return _cache.get(key);
  const c = canvas(256);
  const g = c.getContext('2d');
  const base = `hsl(${hue}, 65%, 50%)`;
  const claro = `hsl(${hue}, 60%, 68%)`;
  const barriga = `hsl(${hue}, 45%, 86%)`;

  // patas
  g.fillStyle = base;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(128 + s * 78, 196, 30, 16, s * 0.4, 0, Math.PI * 2);
    g.fill();
  }
  // corpo
  g.beginPath(); g.ellipse(128, 160, 70, 60, 0, 0, Math.PI * 2);
  g.fillStyle = base; g.fill();
  // barriga
  g.beginPath(); g.ellipse(128, 172, 44, 42, 0, 0, Math.PI * 2);
  g.fillStyle = barriga; g.fill();
  // cabeca
  g.beginPath(); g.ellipse(128, 100, 62, 50, 0, 0, Math.PI * 2);
  g.fillStyle = base; g.fill();
  // olhos (bolhas em cima)
  for (const s of [-1, 1]) {
    g.beginPath(); g.ellipse(128 + s * 34, 66, 26, 26, 0, 0, Math.PI * 2);
    g.fillStyle = claro; g.fill();
    g.beginPath(); g.ellipse(128 + s * 34, 66, 24, 24, 0, 0, Math.PI * 2);
    g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.ellipse(128 + s * 34, 70, 11, 11, 0, 0, Math.PI * 2);
    g.fillStyle = perereca ? '#e01e2b' : '#101810'; g.fill();
    g.beginPath(); g.ellipse(128 + s * 34 - 3, 66, 4, 4, 0, 0, Math.PI * 2);
    g.fillStyle = '#fff'; g.fill();
  }
  // boca sorrindo
  g.strokeStyle = '#0c2a12'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.arc(128, 104, 34, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  // bochechas
  g.fillStyle = 'rgba(255,120,120,.5)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 44, 112, 12, 8, 0, 0, Math.PI * 2); g.fill(); }
  // coroa se for perereca
  if (perereca) {
    g.fillStyle = '#ffd43b';
    g.beginPath();
    g.moveTo(96, 34); g.lineTo(104, 10); g.lineTo(118, 30);
    g.lineTo(128, 6); g.lineTo(138, 30); g.lineTo(152, 10); g.lineTo(160, 34);
    g.closePath(); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _cache.set(key, tex);
  return tex;
}

// ---- BRACO + MAOZINHA do sapo (pra balancar na danca) ------------------
// Desenhado na vertical: ombro embaixo, mao em cima. O pivo fica no ombro.
export function texturaBraco(hue) {
  const key = 'braco-' + Math.round(hue);
  if (_cache.has(key)) return _cache.get(key);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const base = `hsl(${hue}, 65%, 50%)`;
  const escuro = `hsl(${hue}, 60%, 36%)`;
  const claro = `hsl(${hue}, 60%, 66%)`;
  // braco (tubo arredondado)
  g.lineCap = 'round';
  g.strokeStyle = escuro; g.lineWidth = 40;
  g.beginPath(); g.moveTo(64, 236); g.quadraticCurveTo(74, 160, 64, 92); g.stroke();
  g.strokeStyle = base; g.lineWidth = 32;
  g.beginPath(); g.moveTo(64, 236); g.quadraticCurveTo(74, 160, 64, 92); g.stroke();
  // palma
  g.fillStyle = base;
  g.beginPath(); g.ellipse(64, 78, 30, 26, 0, 0, Math.PI * 2); g.fill();
  // dedinhos com pontas redondas (ventosas de sapo)
  const dedos = [-0.75, -0.25, 0.25, 0.75];
  for (const a of dedos) {
    const x2 = 64 + Math.sin(a) * 48, y2 = 70 - Math.cos(a) * 52;
    g.strokeStyle = base; g.lineWidth = 12;
    g.beginPath(); g.moveTo(64, 74); g.lineTo(x2, y2); g.stroke();
    g.fillStyle = claro;
    g.beginPath(); g.arc(x2, y2, 10, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _cache.set(key, tex);
  return tex;
}

// ---- BRILHO redondo (vagalume, lanterna, bokeh) --------------------------
export function texturaBrilho() {
  const key = 'brilho';
  if (_cache.has(key)) return _cache.get(key);
  const c = canvas(128);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.8)');
  grad.addColorStop(0.6, 'rgba(255,255,255,.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  _cache.set(key, tex);
  return tex;
}

// ---- AVATAR redondo (foto do espectador ou fallback com inicial) ---------
export function texturaAvatar({ name = '?', color, url }) {
  const c = canvas(128);
  const g = c.getContext('2d');
  function desenhaFallback() {
    const hue = color != null ? null : corDaString(name);
    g.fillStyle = color || `hsl(${hue},60%,55%)`;
    g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = '700 58px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((name[0] || '?').toUpperCase(), 64, 70);
  }
  desenhaFallback();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // se tem url, tenta carregar por cima (sem quebrar se falhar/CORS)
  if (url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      g.save(); g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.clip();
      g.drawImage(img, 0, 0, 128, 128); g.restore();
      tex.needsUpdate = true;
    };
    img.onerror = () => {};
    img.src = url;
  }
  return tex;
}

// ---- placa de nome + rank -----------------------------------------------
export function texturaNome(texto, rank, cores, dj = false) {
  const c = canvas(512); c.height = 128;
  const g = c.getContext('2d');
  const prefixo = dj ? '🎧 DJ ' : (rank ? `#${String(rank).padStart(2, '0')} ` : '');
  const full = prefixo + texto;
  g.font = '800 44px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(500, g.measureText(full).width + 60);
  const x0 = 256 - w / 2;
  // pilula de vidro colorido (nada de fundo preto)
  const grad = g.createLinearGradient(x0, 0, x0 + w, 0);
  if (dj) { grad.addColorStop(0, 'rgba(255,77,157,.78)'); grad.addColorStop(1, 'rgba(176,124,255,.78)'); }
  else { grad.addColorStop(0, 'rgba(40,150,120,.62)'); grad.addColorStop(1, 'rgba(60,110,170,.62)'); }
  g.fillStyle = grad;
  roundRect(g, x0, 36, w, 56, 28); g.fill();
  g.lineWidth = 3; g.strokeStyle = dj ? 'rgba(255,230,120,.9)' : 'rgba(255,255,255,.45)'; roundRect(g, x0, 36, w, 56, 28); g.stroke();
  g.shadowColor = 'rgba(0,30,20,.7)'; g.shadowBlur = 6;
  const wTexto = g.measureText(texto).width, wPre = g.measureText(prefixo).width;
  if (prefixo) { g.fillStyle = cores.ouro; g.fillText(prefixo, 256 - wTexto / 2, 64); }
  g.fillStyle = '#fff';
  g.fillText(texto, 256 + (prefixo ? wPre / 2 : 0), 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
