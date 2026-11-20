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
import { criarEfeitos } from './efeitos.js';

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
const efeitos = criarEfeitos(scene, CONFIG.festa.luzes);

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

  // efeito pelo tamanho do presente (em moedas)
  const tipo = tierDoPresente(moedas);
  const onde = s.group.position;
  if (tipo === 'medio') {
    efeitos.confete(onde, 140, 1);
    efeitos.destaque(onde, info.cor || '#ffd43b', 1);
    focarPresente(s, { nivel: 3 });
  } else if (tipo === 'epico') {
    ui.epico(ev.user, ev.giftName || 'presente', moedas, info.emoji);
    efeitos.confete(onde, 420, 1.5);
    efeitos.destaque(onde, '#ffd43b', 2);
    setTimeout(() => efeitos.confete(onde, 260, 1.2), 600);
    setTimeout(() => efeitos.destaque(onde, '#ff4d9d', 2.5), 400);
    flash = 1;
    focarPresente(s, { nivel: 8 });
    if (CONFIG.efeitos && CONFIG.efeitos.ligado) audio.efeito('fanfarra', CONFIG.efeitos.arquivoCurtidor, CONFIG.efeitos.volume);
  }
  marcaRanking();
  atualizaMeta();
}

function tierDoPresente(moedas) {
  let tipo = 'pequeno';
  for (const t of (CONFIG.tiersPresente || [])) if (moedas >= t.min) tipo = t.tipo;
  return tipo;
}
let flash = 0; // clarao das luzes no presente epico

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
  // durante o mergulho so presente epico (ou novo DJ) puxa a camera de volta
  if (agora < mergulhoAte) { if (info.nivel < 5) return; mergulhoAte = 0; }
  foco = sapo;
  focoAte = agora + CONFIG.camera.tempoFoco + info.nivel * 0.4;
  livreDeFocoAte = focoAte + 8;
}

// ---- MERGULHO: de vez em quando a camera desce pro fundo do lago ---------
const MG = CONFIG.mergulho || { ligado: false };
const sorteiaMergulho = () => performance.now() / 1000 + MG.acadaSeg[0] + Math.random() * (MG.acadaSeg[1] - MG.acadaSeg[0]);
let proxMergulho = MG.ligado ? sorteiaMergulho() : Infinity;
let mergulhoAte = 0;
let forcarMergulho = false;
let fundoF = 0; // 0..1 (o quanto a camera esta debaixo d'agua)
function girinos() { return [...sapos.values()].filter((s) => s.visivel && s.ehGirino); }

function atualizaCamera(dt) {
  const agora = performance.now() / 1000;
  // comeca um mergulho?
  if ((MG.ligado || forcarMergulho) && !foco && agora >= proxMergulho && mergulhoAte < agora) {
    if (forcarMergulho || girinos().length >= (MG.minimoGirinos || 1)) { mergulhoAte = agora + MG.duracaoSeg; ui.mergulho(true); }
    proxMergulho = sorteiaMergulho();
    forcarMergulho = false;
  }
  const mergulhando = agora < mergulhoAte && !foco;
  if (!mergulhando) ui.mergulho(false);
  const alvoF = mergulhando ? 1 : 0;
  fundoF += (alvoF - fundoF) * Math.min(1, dt * 1.2);
  Sapo.profundidade = fundoF;
  lagoa.submerso(fundoF);

  if (mergulhando) {
    // nada devagar em volta, la embaixo, olhando os girinos
    anguloOrbita += dt * CONFIG.camera.velocidadeGiro * 1.5;
    const R = 14;
    posDesejada.set(Math.cos(anguloOrbita) * R, -3.2, Math.sin(anguloOrbita) * R);
    lookDesejado.set(-Math.cos(anguloOrbita) * 4, -2.2, -Math.sin(anguloOrbita) * 4);
  } else if (foco && agora < focoAte && foco.visivel) {
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
  camera.position.lerp(posDesejada, Math.min(1, dt * (foco ? 2.2 : (mergulhando || fundoF > 0.05 ? 0.9 : 1.1))));
  alvoLook.lerp(lookDesejado, Math.min(1, dt * 2));
  camera.lookAt(alvoLook);
}

// ---- musica (controlada pelo /admin) -------------------------------------
let rede;
const audio = criarAudio({
  bpm: CONFIG.festa.bpm,
  onTocando: (info) => { ui.tocando(info); if (!MUDO) rede && rede.enviar({ t: 'tocando', ...info }); },
  onLiberou: () => ui.escondeBotaoSom()
});
function tentaSom() {
  if (!audio.liberar()) ui.botaoSom(() => audio.liberar());
  else ui.escondeBotaoSom();
}
// ?mudo=1 = copia so pra assistir (tela /monitor): nao toca som nenhum,
// pra nao dobrar a musica com o OBS. A danca segue no ritmo do bpm.
const MUDO = new URLSearchParams(location.search).has('mudo');
if (!MUDO) {
  window.addEventListener('pointerdown', () => { if (audio.liberar()) ui.escondeBotaoSom(); });
  tentaSom();
  setTimeout(() => { if (!audio.liberado) ui.botaoSom(() => audio.liberar()); }, 800);
}

// ---- loop ----------------------------------------------------------------
const clock = new THREE.Clock();
function animar() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const ritmo = audio.ritmo(dt);
  lagoa.update(t, dt, ritmo, camera);
  ui.batida(ritmo.batida);
  atualizaCamera(dt);
  efeitos.update(dt);
  if (flash > 0) { flash = Math.max(0, flash - dt * 0.35); ritmo.batida = Math.max(ritmo.batida, flash); }
  for (const s of sapos.values()) {
    if (!s.visivel) continue;
    // no fundo do lago so os girinos aparecem
    s.group.visible = fundoF < 0.5 || s.ehGirino;
    s.update(dt, t, ritmo, camera);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animar);
}
animar();
// pra depurar no console do navegador
window.__festa = { camera, scene, sapos };

// ---- eventos da live + comandos do admin ---------------------------------
rede = conectarEventos(CONFIG.ws, {
  hello: (ev) => ui.status(`modo ${ev.mode}${ev.user ? ' · @' + ev.user : ''}`),
  status: (ev) => ui.status(ev.connected ? `🟢 ao vivo${ev.user ? ' @' + ev.user : ''}` : (ev.ended ? '⚪ live encerrada' : '🟡 reconectando...')),
  join: (ev) => { entrar(ev.user); ui.join(ev.user); },
  like: (ev) => darLike(ev.user, ev.count || 1),
  gift: (ev) => presente(ev),
  chat: (ev) => {
    if (!CONFIG.comentarios || !CONFIG.comentarios.ligado) return;
    const txt = String(ev.comment || '').trim();
    if (!txt || txt.startsWith('!')) return; // comandos (ex: !musica) nao viram balao
    const s = sapos.get(ev.user.id);
    if (s && s.visivel) s.falar(txt.slice(0, CONFIG.comentarios.maxCaracteres || 70), CONFIG.comentarios.segundos || 6);
  },
  pedido: (ev) => ui.pedido(ev.user, ev.musica),
  mic: (ev) => audio.abaixar(!!ev.aberto),
  // botao de teste no painel: mergulha agora
  mergulhar: () => { foco = null; proxMergulho = 0; forcarMergulho = true; },
  viewers: (ev) => ui.viewers(ev.count),
  social: () => { },
  playlist: (ev) => audio.setEstado(ev.estado),
  player: (ev) => audio.comando(ev.acao, ev.idx),
  // na copia muda, mostra o que esta tocando la no OBS
  tocando: (ev) => { if (MUDO) ui.tocando(ev); }
}, (st) => { if (!st.conectado) ui.status('🟡 reconectando...'); });
