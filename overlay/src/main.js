// overlay/src/main.js
// Junta tudo: cena 3D, sapos, camera, HUD, audio e os eventos da live.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { criarLagoa } from './pond.js';
import { Sapo } from './frog.js';
import { criarUI } from './ui.js';
import { criarAudio } from './audio.js';
import { conectarEventos } from './events.js';

const cores = CONFIG.cores;

// ---- renderer / cena / camera -------------------------------------------
const canvas = document.getElementById('cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 12, 24);

const lagoa = criarLagoa(scene, cores);

// ---- HUD e audio ---------------------------------------------------------
const ui = criarUI(CONFIG);
ui.brand();
const audio = criarAudio(CONFIG.audio);

function tentaSom() {
  const ok = audio.start();
  audio.resume();
  if (!ok || !audio.started) ui.botaoSom(() => { audio.start(); audio.resume(); });
}
// tenta tocar (OBS permite autoplay); no navegador comum, mostra botao
window.addEventListener('pointerdown', () => { audio.resume(); ui.escondeBotaoSom(); }, { once: false });
tentaSom();
setTimeout(() => { if (!audio.started) ui.botaoSom(() => audio.start()); }, 1200);

// ---- estado do jogo ------------------------------------------------------
const sapos = new Map();     // id -> Sapo
let metaPontos = 0;
const doadores = new Map();  // id -> { name, pontos }

function slotLivre() { return lagoa.slots.find(s => !s.ocupadoPor); }
function seatedSapos() { return [...sapos.values()].filter(s => s.visivel); }

function entrar(user) {
  if (sapos.has(user.id)) return sapos.get(user.id);
  const s = new Sapo(user, cores, CONFIG);
  sapos.set(user.id, s);
  scene.add(s.group);
  const slot = slotLivre();
  if (slot && seatedSapos().length < CONFIG.maxSapos) s.sentar(slot);
  // limpa sapos antigos sem like se o mapa crescer demais
  if (sapos.size > 220) podar();
  return s;
}

function podar() {
  const candidatos = [...sapos.values()].filter(s => !s.visivel).sort((a, b) => a.likes - b.likes);
  for (let i = 0; i < 40 && candidatos.length; i++) {
    const s = candidatos.shift();
    if (s) { s.destruir(); sapos.delete(s.user.id); }
  }
}

function darLike(user, n) {
  const s = sapos.has(user.id) ? sapos.get(user.id) : entrar(user);
  const r = s.addLikes(n);
  metaPontos += n;

  // se nao esta sentado mas ja curtiu mais que o mais fraco sentado, troca
  if (!s.visivel) {
    const slot = slotLivre();
    if (slot && seatedSapos().length < CONFIG.maxSapos) {
      s.sentar(slot);
    } else {
      const fraco = seatedSapos().sort((a, b) => a.likes - b.likes)[0];
      if (fraco && fraco.likes < s.likes) {
        const sl = fraco.slot; fraco.levantar();
        if (sl) s.sentar(sl);
      }
    }
  }

  if (r.virouPerereca) ui.perereca(s.user.name);
  atualizaMeta();
}

function presente(ev) {
  const s = sapos.has(ev.user.id) ? sapos.get(ev.user.id) : entrar(ev.user);
  const info = CONFIG.presentes[ev.giftName] || CONFIG.presentes.padrao;
  const pts = (ev.diamond || 1) * 2;
  metaPontos += pts;

  // soma no ranking de doadores
  const d = doadores.get(ev.user.id) || { name: ev.user.name, pontos: 0 };
  d.pontos += (ev.diamond || 1) * (ev.repeatCount || 1);
  d.name = ev.user.name;
  doadores.set(ev.user.id, d);

  // garante que o doador aparece e sobe um pouco
  if (!s.visivel) {
    const slot = slotLivre();
    if (slot) s.sentar(slot);
    else { const fraco = seatedSapos().sort((a, b) => a.likes - b.likes)[0]; if (fraco) { const sl = fraco.slot; fraco.levantar(); if (sl) s.sentar(sl); } }
  }
  s.addLikes(info.nivel * 8); // presente tambem cresce o sapo

  ui.gift(ev.user, info, ev.giftName);
  focarPresente(s, info);
  atualizaRanking();
  atualizaMeta();
}

function atualizaRanking() {
  const lista = [...doadores.values()].sort((a, b) => b.pontos - a.pontos);
  ui.ranking(lista);
}
function atualizaMeta() { ui.meta(metaPontos); }

// recalcula rank dos sapos (posicao por likes) a cada 1s
setInterval(() => {
  const ordenados = seatedSapos().sort((a, b) => b.likes - a.likes);
  ordenados.forEach((s, i) => s.setRank(i + 1));
}, 1000);

// ---- camera: giro automatico + foco no presente --------------------------
let anguloOrbita = 0;
let foco = null;      // Sapo em foco
let focoAte = 0;
const alvoLook = new THREE.Vector3(0, 1, 0);

function focarPresente(sapo, info) {
  if (!CONFIG.camera.focarPresente) return;
  foco = sapo;
  focoAte = performance.now() / 1000 + CONFIG.camera.tempoFoco + info.nivel * 0.4;
}

function atualizaCamera(dt, t) {
  let posDesejada = new THREE.Vector3();
  let lookDesejado = new THREE.Vector3();

  if (foco && t < focoAte && foco.visivel) {
    const p = foco.group.position;
    const ang = Math.atan2(p.z, p.x);
    const dist = 7 + foco.sapoSprite.scale.x;
    posDesejada.set(p.x + Math.cos(ang) * dist, 5.5, p.z + Math.sin(ang) * dist);
    lookDesejado.set(p.x, 2.2, p.z);
  } else {
    foco = null;
    if (CONFIG.camera.girarAuto) anguloOrbita += dt * CONFIG.camera.velocidadeGiro;
    const R = 23;
    posDesejada.set(Math.cos(anguloOrbita) * R, 11, Math.sin(anguloOrbita) * R);
    lookDesejado.set(0, 1.5, 0);
  }

  camera.position.lerp(posDesejada, Math.min(1, dt * (foco ? 2.2 : 1.1)));
  alvoLook.lerp(lookDesejado, Math.min(1, dt * 2));
  camera.lookAt(alvoLook);
}

// ---- loop ----------------------------------------------------------------
const clock = new THREE.Clock();
function animar() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  lagoa.waterMat.uniforms.t.value = t;
  for (const s of sapos.values()) if (s.visivel) s.update(dt, t);
  atualizaCamera(dt, t);
  renderer.render(scene, camera);
  requestAnimationFrame(animar);
}
animar();

// ---- eventos da live -----------------------------------------------------
conectarEventos(CONFIG.ws, {
  hello: (ev) => ui.status(`modo ${ev.mode}${ev.user ? ' · @' + ev.user : ''}`),
  status: (ev) => ui.status(ev.connected ? `🟢 ao vivo${ev.user ? ' @' + ev.user : ''}` : (ev.ended ? '⚪ live encerrada' : '🟡 reconectando...')),
  join: (ev) => { entrar(ev.user); ui.join(ev.user); },
  like: (ev) => darLike(ev.user, ev.count || 1),
  gift: (ev) => presente(ev),
  chat: (ev) => { /* reservado: balao de chat, se quiser depois */ },
  viewers: (ev) => ui.viewers(ev.count),
  social: (ev) => { }
}, (st) => { if (!st.conectado) ui.status('🟡 reconectando...'); });

// ---- resize --------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
