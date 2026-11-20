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
export function texturaNome(texto, rank, cores) {
  const c = canvas(512); c.height = 128;
  const g = c.getContext('2d');
  const prefixo = rank ? `#${String(rank).padStart(2, '0')} ` : '';
  const full = prefixo + texto;
  g.font = '700 44px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(500, g.measureText(full).width + 60);
  const x0 = 256 - w / 2;
  // pilula
  g.fillStyle = 'rgba(8,20,16,.78)';
  roundRect(g, x0, 36, w, 56, 28); g.fill();
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.2)'; roundRect(g, x0, 36, w, 56, 28); g.stroke();
  if (rank) { g.fillStyle = cores.ouro; g.fillText(prefixo, 256 - g.measureText(texto).width / 2 - g.measureText(prefixo).width / 2, 64); }
  g.fillStyle = '#fff';
  g.fillText(rank ? texto : full, rank ? 256 + g.measureText(prefixo).width / 2 : 256, 64);
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
