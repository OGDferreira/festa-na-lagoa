// overlay/src/main.js
// Junta tudo: cena 3D, sapos dançando, luzes de festa, camera, HUD, musica
// (controlada pelo painel /admin) e os eventos da live.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { criarLagoa } from './pond.js';
import { Sapo } from './frog.js';
import { criarUI } from './ui.js';
import { criarAudio } from './audio.js';
import { conectarEventos } from './events.js';

const cores = CONFIG.cores;
const palco = document.getElementById('palco');

// ---- renderer / cena / camera -------------------------------------------
const canvas = document.getElementById('cena');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 9 / 16, 0.1, 220);
camera.position.set(0, 26, 22);

function encaixar() {
  const w = palco.clientWidth, h = palco.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', encaixar);
encaixar();

const lagoa = criarLagoa(scene, cores, CONFIG.festa);

// ---- HUD -----------------------------------------------------------------
const ui = criarUI(CONFIG);
ui.brand();

// ---- estado do jogo ------------------------------------------------------
const sapos = new Map();       // id -> Sapo
let metaPontos = 0;
const doadores = new Map();    // id -> { id, user, valor (moedas) }
const curtidores = new Map();  // id -> { id, user, valor (likes) }

function slotLivre() { return lagoa.slots.find((s) => !s.ocupadoPor); }
function seatedSapos() { return [...sapos.values()].filter((s) => s.visivel && !s.dj); }

function entrar(user) {
  if (sapos.has(user.id)) return sapos.get(user.id);
  const s = new Sapo(user, cores, CONFIG);
  sapos.set(user.id, s);
  s.group.visible = false;
  scene.add(s.group);
  const slot = slotLivre();
  if (slot && seatedSapos().length < CONFIG.maxSapos) s.sentar(slot);
  if (sapos.size > 220) podar();
  return s;
}

function podar() {
  const candidatos = [...sapos.values()].filter((s) => !s.visivel).sort((a, b) => a.likes - b.likes);
  for (let i = 0; i < 40 && candidatos.length; i++) {
    const s = candidatos.shift();
    if (s) { s.destruir(); sapos.delete(s.user.id); }
  }
}

// garante lugar na lagoa (tira o sapo mais fraco se precisar)
function garanteLugar(s) {
  if (s.visivel) return;
  const slot = slotLivre();
  if (slot && seatedSapos().length < CONFIG.maxSapos) { s.sentar(slot); return; }
  const fraco = seatedSapos().sort((a, b) => a.likes - b.likes)[0];
  if (fraco && fraco.likes <= s.likes) {
    const sl = fraco.slot; fraco.levantar();
    if (sl) s.sentar(sl);
  }
}

function darLike(user, n) {
  const s = sapos.has(user.id) ? sapos.get(user.id) : entrar(user);
  const r = s.addLikes(n);
  metaPontos += n;
  garanteLugar(s);

  const c = curtidores.get(user.id) || { id: user.id, user, valor: 0 };
  c.valor += n; c.user = user;
  curtidores.set(user.id, c);

  if (r.virouPerereca) ui.perereca(s.user.name);
  marcaRanking();
  atualizaMeta();
}

function presente(ev) {
  const s = sapos.has(ev.user.id) ? sapos.get(ev.user.id) : entrar(ev.user);
  const info = CONFIG.presentes[ev.giftName] || CONFIG.presentes.padrao;
  const moedas = (ev.diamond || 1);
  metaPontos += moedas * 2;

  const d = doadores.get(ev.user.id) || { id: ev.user.id, user: ev.user, valor: 0 };
  d.valor += moedas; d.user = ev.user;
  doadores.set(ev.user.id, d);

  garanteLugar(s);
  if (!s.visivel) { // doador sempre aparece
    const fraco = seatedSapos().sort((a, b) => a.likes - b.likes)[0];
    if (fraco) { const sl = fraco.slot; fraco.levantar(); if (sl) s.sentar(sl); }
  }
  s.addLikes(info.nivel * 8); // presente tambem cresce o sapo

  ui.gift(ev.user, info, ev.giftName);
  checaDJ();
  focarPresente(s, info);
  marcaRanking();
  atualizaMeta();
}

// ---- SAPO DJ: quem mais mandou moedas comanda a cabine --------------------
let dj = null; // Sapo
function checaDJ() {
  const top = [...doadores.values()].sort((a, b) => b.valor - a.valor)[0];
  if (!top || top.valor <= 0) return;
  if (dj && dj.user.id === top.id) return;
  const novo = sapos.get(top.id) || entrar(top.user);
  const antigo = dj;
  dj = novo;
  if (antigo) { antigo.sairDJ(); antigo.atualizaPlaca(); garanteLugar(antigo); }
  novo.virarDJ(lagoa.cabine);
  novo.atualizaPlaca();
  ui.novoDJ(top.user);
  somTop1('doador');
  // camera da um zoom no novo DJ
  focarPresente(novo, { nivel: 5 });
}

// ---- efeito sonoro quando chega um novo TOP 1 ----------------------------
const ultimoSom = { doador: 0, curtidor: 0 };
function somTop1(tipo) {
  const e = CONFIG.efeitos;
  if (!e || !e.ligado) return;
  const agora = performance.now() / 1000;
  if (agora - ultimoSom[tipo] < (e.intervaloMinimo ?? 8)) return;
  ultimoSom[tipo] = agora;
  if (tipo === 'doador') audio.efeito('buzina', e.arquivoDoador, e.volume);
  else audio.efeito('fanfarra', e.arquivoCurtidor, e.volume);
}
let top1Curtidor = null;

// ranking: recalcula no maximo 2x por segundo
let rankingSujo = false;
function marcaRanking() { rankingSujo = true; }
setInterval(() => {
  if (!rankingSujo) return;
  rankingSujo = false;
  ui.ranking('doadores', [...doadores.values()].sort((a, b) => b.valor - a.valor));
  const listaCurt = [...curtidores.values()].sort((a, b) => b.valor - a.valor);
  ui.ranking('curtidores', listaCurt);
  if (listaCurt[0] && listaCurt[0].id !== top1Curtidor) {
    if (top1Curtidor !== null) somTop1('curtidor'); // nao toca no primeiro like da live
    top1Curtidor = listaCurt[0].id;
  }
}, 500);
function atualizaMeta() { ui.meta(metaPontos); }

// rank dos sapos na lagoa (por likes) a cada 1s
setInterval(() => {
  const ordenados = seatedSapos().sort((a, b) => b.likes - a.likes);
  ordenados.forEach((s, i) => s.setRank(i + 1));
}, 1000);

// ---- camera: giro automatico + foco no presente --------------------------
let anguloOrbita = 0;
let foco = null;
let focoAte = 0;
const alvoLook = new THREE.Vector3(0, 0, 0);
const posDesejada = new THREE.Vector3();
const lookDesejado = new THREE.Vector3();

let livreDeFocoAte = 0; // descanso entre um zoom e outro (presente grande fura a fila)
function focarPresente(sapo, info) {
  if (!CONFIG.camera.focarPresente) return;
  const agora = performance.now() / 1000;
  if (agora < livreDeFocoAte && info.nivel < 3) return;
  foco = sapo;
  focoAte = agora + CONFIG.camera.tempoFoco + info.nivel * 0.4;
  livreDeFocoAte = focoAte + 8;
}

function atualizaCamera(dt) {
  const agora = performance.now() / 1000;
  if (foco && agora < focoAte && foco.visivel) {
    const p = foco.group.position;
    const ang = Math.atan2(p.z, p.x);
    const dist = 9 + foco._escala * 2.6;
    posDesejada.set(p.x + Math.cos(ang) * dist, 13, p.z + Math.sin(ang) * dist);
    // olha um pouco pra frente do sapo: ele fica no meio da area livre,
    // abaixo dos cards
    lookDesejado.set(p.x - Math.cos(ang) * 3, 1.0, p.z - Math.sin(ang) * 3);
  } else {
    foco = null;
    if (CONFIG.camera.girarAuto) anguloOrbita += dt * CONFIG.camera.velocidadeGiro;
    // vertical: camera mais alta olhando pra baixo, pra lagoa encher a tela
    const R = 21;
    posDesejada.set(Math.cos(anguloOrbita) * R, 24, Math.sin(anguloOrbita) * R);
    // olha um pouco "atras" do centro: a lagoa desce na tela e sobra
    // espaco em cima pros cards
    lookDesejado.set(-Math.cos(anguloOrbita) * 6, 0, -Math.sin(anguloOrbita) * 6);
  }
  camera.position.lerp(posDesejada, Math.min(1, dt * (foco ? 2.2 : 1.1)));
  alvoLook.lerp(lookDesejado, Math.min(1, dt * 2));
  camera.lookAt(alvoLook);
}

// ---- musica (controlada pelo /admin) -------------------------------------
let rede;
const audio = criarAudio({
  bpm: CONFIG.festa.bpm,
  onTocando: (info) => { ui.tocando(info); rede && rede.enviar({ t: 'tocando', ...info }); },
  onLiberou: () => ui.escondeBotaoSom()
});
function tentaSom() {
  if (!audio.liberar()) ui.botaoSom(() => audio.liberar());
  else ui.escondeBotaoSom();
}
window.addEventListener('pointerdown', () => { if (audio.liberar()) ui.escondeBotaoSom(); });
tentaSom();
// OBS libera o som sozinho; no navegador comum aparece o botao
setTimeout(() => { if (!audio.liberado) ui.botaoSom(() => audio.liberar()); }, 800);

// ---- loop ----------------------------------------------------------------
const clock = new THREE.Clock();
function animar() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const ritmo = audio.ritmo(dt);
  lagoa.update(t, dt, ritmo, camera);
  ui.batida(ritmo.batida);
  atualizaCamera(dt);
  for (const s of sapos.values()) if (s.visivel) s.update(dt, t, ritmo, camera);
  renderer.render(scene, camera);
  requestAnimationFrame(animar);
}
animar();

// ---- eventos da live + comandos do admin ---------------------------------
rede = conectarEventos(CONFIG.ws, {
  hello: (ev) => ui.status(`modo ${ev.mode}${ev.user ? ' · @' + ev.user : ''}`),
  status: (ev) => ui.status(ev.connected ? `🟢 ao vivo${ev.user ? ' @' + ev.user : ''}` : (ev.ended ? '⚪ live encerrada' : '🟡 reconectando...')),
  join: (ev) => { entrar(ev.user); ui.join(ev.user); },
  like: (ev) => darLike(ev.user, ev.count || 1),
  gift: (ev) => presente(ev),
  chat: () => { /* reservado: balao de chat, se quiser depois */ },
  viewers: (ev) => ui.viewers(ev.count),
  social: () => { },
  playlist: (ev) => audio.setEstado(ev.estado),
  player: (ev) => audio.comando(ev.acao, ev.idx)
}, (st) => { if (!st.conectado) ui.status('🟡 reconectando...'); });
