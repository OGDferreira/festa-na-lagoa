// server/index.js
// Servidor unico: serve o overlay (pasta /overlay), o painel de admin
// (pasta /admin, em /admin) e repassa os eventos da live do TikTok para o
// overlay via WebSocket. Tem modo demo embutido.
//
// Uso:
//   npm run demo                      (eventos falsos)
//   npm run live                      (conecta no usuario do config.js)
//   node server/index.js --live --user seuusuario --port 8080

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const config = require('./config');

// ---- argumentos de linha de comando -------------------------------------
const argv = process.argv.slice(2);
function flag(name) { return argv.includes('--' + name); }
function opt(name, fallback) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

let MODE = config.mode;
if (flag('demo')) MODE = 'demo';
if (flag('live')) MODE = 'live';
const USERNAME = opt('user', config.tiktokUsername).replace(/^@/, '');
const PORT = Number(opt('port', config.port));

// ---- pastas ---------------------------------------------------------------
const OVERLAY_DIR = path.join(__dirname, '..', 'overlay');
const ADMIN_DIR = path.join(__dirname, '..', 'admin');
const MUSICA_DIR = path.join(OVERLAY_DIR, 'assets', 'musica');
const DATA_DIR = path.join(__dirname, 'data');
const PLAYLIST_FILE = path.join(DATA_DIR, 'playlist.json');
fs.mkdirSync(MUSICA_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2'
};
const EXT_MUSICA = ['.mp3', '.ogg', '.wav', '.m4a'];

// ---- PLAYLIST (controlada pelo painel /admin) -----------------------------
// faixas: [{ arquivo, titulo }]   modo: 'playlist' | 'gerada'
let playlist = { faixas: [], modo: 'gerada', volume: 0.6, aleatorio: false, tocando: true };
let tocandoAgora = null; // o que o overlay disse que esta tocando

function tituloDe(arquivo) {
  return arquivo.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
}
function carregaPlaylist() {
  try { playlist = { ...playlist, ...JSON.parse(fs.readFileSync(PLAYLIST_FILE, 'utf8')) }; } catch {}
  sincronizaPasta();
}
// arquivos jogados direto na pasta entram no fim; os apagados saem
function sincronizaPasta() {
  const naPasta = fs.readdirSync(MUSICA_DIR).filter((f) => EXT_MUSICA.includes(path.extname(f).toLowerCase()));
  playlist.faixas = playlist.faixas.filter((f) => naPasta.includes(f.arquivo));
  for (const f of naPasta) {
    if (!playlist.faixas.some((x) => x.arquivo === f)) playlist.faixas.push({ arquivo: f, titulo: tituloDe(f) });
  }
}
function gravaPlaylist() { fs.writeFile(PLAYLIST_FILE, JSON.stringify(playlist, null, 2), () => {}); }
function salvaPlaylist() {
  gravaPlaylist();
  broadcast({ t: 'playlist', estado: playlist });
}

// ---- PEDIDOS DE MUSICA (!musica no chat) ---------------------------------
const pedidos = []; // { id, user: {id,name,avatar}, musica, quando }
let micAberto = false;
// aceita "!musica" e "!música" (com ou sem acento), maiusculo ou minusculo
const COMANDO = (config.comandoMusica || '!musica').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function talvezComando(txt) {
  const limpo = String(txt || '').trim();
  const cabeca = limpo.split(/\s+/)[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (cabeca !== COMANDO) return null;
  const resto = limpo.slice(limpo.split(/\s+/)[0].length).trim();
  return resto || null;
}
function talvezPedido(ev) {
  const pedido = talvezComando(ev.comment);
  if (!pedido) return;
  const musica = pedido.slice(0, 80);
  // cada pessoa so tem 1 pedido na fila (o novo substitui o antigo)
  const i = pedidos.findIndex((p) => p.user.id === ev.user.id);
  if (i >= 0) pedidos.splice(i, 1);
  const ped = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), user: ev.user, musica, quando: Date.now() };
  pedidos.push(ped);
  if (pedidos.length > 60) pedidos.shift();
  broadcast({ t: 'pedido', ...ped });
  broadcast({ t: 'pedidos', lista: pedidos });
}

// ---- ESTATISTICAS da live (resumo pro painel) -----------------------------
const stats = {
  inicio: Date.now(), likes: 0, presentes: 0, moedas: 0, entradas: 0,
  comentarios: 0, seguidores: 0, compartilhamentos: 0, viewers: 0, picoViewers: 0,
  doadores: {}, curtidores: {}, porPresente: {}
};
function contabiliza(ev) {
  const soma = (mapa, u, n) => {
    const r = mapa[u.id] || (mapa[u.id] = { name: u.name, valor: 0 });
    r.name = u.name; r.valor += n;
  };
  if (ev.t === 'like') { stats.likes += ev.count || 1; soma(stats.curtidores, ev.user, ev.count || 1); }
  else if (ev.t === 'gift') {
    stats.presentes++; stats.moedas += ev.diamond || 0; soma(stats.doadores, ev.user, ev.diamond || 0);
    // lista dos presentes que chegaram (nome, quantas vezes, moedas de cada)
    const nome = ev.giftName || 'presente';
    const g = stats.porPresente[nome] || (stats.porPresente[nome] = { nome, vezes: 0, moedas: 0, unidade: 0, imagem: '' });
    g.vezes += ev.repeatCount || 1; g.moedas += ev.diamond || 0;
    g.unidade = Math.round((ev.diamond || 0) / (ev.repeatCount || 1));
    if (ev.image) g.imagem = ev.image;
  }
  else if (ev.t === 'join') stats.entradas++;
  else if (ev.t === 'chat') { stats.comentarios++; talvezPedido(ev); }
  else if (ev.t === 'viewers') { stats.viewers = ev.count; stats.picoViewers = Math.max(stats.picoViewers, ev.count); }
  else if (ev.t === 'social') { if (ev.tipo === 'follow') stats.seguidores++; else if (ev.tipo === 'share') stats.compartilhamentos++; }
}
function resumoStats() {
  const top5 = (m) => Object.values(m).sort((a, b) => b.valor - a.valor).slice(0, 5);
  const presentes = Object.values(stats.porPresente).sort((a, b) => b.moedas - a.moedas);
  return { ...stats, porPresente: presentes, doadores: top5(stats.doadores), curtidores: top5(stats.curtidores), minutos: Math.round((Date.now() - stats.inicio) / 60000) };
}

// ---- HTTP ------------------------------------------------------------------
// O painel e a API so respondem pra quem esta no proprio computador,
// ou, se ADMIN_PASSWORD estiver definida, pra quem passa a senha (Basic Auth).
function local(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}
// Senha do painel (env ADMIN_PASSWORD). Vazio = painel so no localhost.
// Com senha definida, libera /admin, /monitor e /api pra fora via Basic Auth.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
function authed(req) {
  if (local(req)) return true;
  if (!ADMIN_PASSWORD) return false;
  const h = req.headers['authorization'] || '';
  const m = /^Basic\s+(.+)$/i.exec(h);
  if (!m) return false;
  let pass = '';
  try { pass = Buffer.from(m[1], 'base64').toString('utf8').split(':').slice(1).join(':'); } catch { return false; }
  return pass === ADMIN_PASSWORD;
}
function pedeSenha(res, txt) {
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="festa-na-lagoa"', 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(txt || 'precisa de senha');
}
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function lerCorpo(req, limite, cb) {
  const partes = []; let tam = 0, estourou = false;
  req.on('data', (c) => { tam += c.length; if (tam > limite) { estourou = true; req.destroy(); } else partes.push(c); });
  req.on('end', () => { if (!estourou) cb(Buffer.concat(partes)); });
}
function lerJson(req, res, cb) {
  lerCorpo(req, 1024 * 1024, (buf) => {
    let obj; try { obj = JSON.parse(buf.toString('utf8')); } catch { return json(res, 400, { erro: 'json invalido' }); }
    cb(obj || {});
  });
}
function servirArquivo(res, base, urlPath) {
  const filePath = path.join(base, path.normalize(urlPath));
  if (!filePath.startsWith(base)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('nao encontrado'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

function api(req, res, urlPath) {
  if (!authed(req)) { return pedeSenha(res, 'painel protegido por senha'); }

  if (req.method === 'GET' && urlPath === '/api/estado') {
    return json(res, 200, { playlist, tocando: tocandoAgora, stats: resumoStats(), pedidos, mic: micAberto, modo: MODE, usuario: USERNAME });
  }

  // upload de musica: corpo = bytes do arquivo, nome no header X-Arquivo
  if (req.method === 'POST' && urlPath === '/api/musicas') {
    let nome = '';
    try { nome = decodeURIComponent(req.headers['x-arquivo'] || ''); } catch {}
    nome = path.basename(nome).replace(/[^\w.\- ()À-ú]/g, '_').slice(0, 120);
    const ext = path.extname(nome).toLowerCase();
    if (!nome || !EXT_MUSICA.includes(ext)) return json(res, 400, { erro: 'formato nao suportado (use mp3, ogg, wav ou m4a)' });
    return lerCorpo(req, 60 * 1024 * 1024, (buf) => {
      fs.writeFile(path.join(MUSICA_DIR, nome), buf, (err) => {
        if (err) return json(res, 500, { erro: err.message });
        if (!playlist.faixas.some((f) => f.arquivo === nome)) playlist.faixas.push({ arquivo: nome, titulo: tituloDe(nome) });
        salvaPlaylist();
        json(res, 200, { ok: true, playlist });
      });
    });
  }

  // apaga a musica (arquivo + playlist)
  if (req.method === 'DELETE' && urlPath.startsWith('/api/musicas/')) {
    const nome = path.basename(urlPath.slice('/api/musicas/'.length));
    playlist.faixas = playlist.faixas.filter((f) => f.arquivo !== nome);
    fs.unlink(path.join(MUSICA_DIR, nome), () => {});
    salvaPlaylist();
    return json(res, 200, { ok: true, playlist });
  }

  // atualiza ordem / titulos / modo / volume / aleatorio
  if (req.method === 'POST' && urlPath === '/api/playlist') {
    return lerJson(req, res, (novo) => {
      if (Array.isArray(novo.faixas)) {
        const existentes = new Map(playlist.faixas.map((f) => [f.arquivo, f]));
        playlist.faixas = novo.faixas
          .filter((f) => f && existentes.has(f.arquivo))
          .map((f) => ({ arquivo: f.arquivo, titulo: String(f.titulo || existentes.get(f.arquivo).titulo).slice(0, 120) }));
      }
      if (novo.modo === 'playlist' || novo.modo === 'gerada') playlist.modo = novo.modo;
      if (typeof novo.volume === 'number') playlist.volume = Math.max(0, Math.min(1, novo.volume));
      if (typeof novo.aleatorio === 'boolean') playlist.aleatorio = novo.aleatorio;
      salvaPlaylist();
      json(res, 200, { ok: true, playlist });
    });
  }

  // comandos do player: tocar / pausar / proxima / anterior (+ idx opcional)
  if (req.method === 'POST' && urlPath === '/api/player') {
    return lerJson(req, res, (cmd) => {
      if (!['tocar', 'pausar', 'proxima', 'anterior'].includes(cmd.acao)) return json(res, 400, { erro: 'acao invalida' });
      playlist.tocando = cmd.acao !== 'pausar';
      const idx = typeof cmd.idx === 'number' ? cmd.idx : undefined;
      if (idx !== undefined) playlist.modo = 'playlist';
      gravaPlaylist();
      broadcast({ t: 'player', acao: cmd.acao, idx });
      json(res, 200, { ok: true });
    });
  }

  // tira um pedido da fila (tocado ou recusado)
  if (req.method === 'DELETE' && urlPath.startsWith('/api/pedidos/')) {
    const id = urlPath.slice('/api/pedidos/'.length);
    const i = pedidos.findIndex((p) => p.id === id);
    if (i >= 0) pedidos.splice(i, 1);
    broadcast({ t: 'pedidos', lista: pedidos });
    return json(res, 200, { ok: true, pedidos });
  }

  // botoes de teste do painel (simulam eventos pra ver os efeitos)
  if (req.method === 'POST' && urlPath === '/api/teste') {
    return lerJson(req, res, (b) => {
      const u = { id: 'teste-admin', name: 'Teste do Admin', avatar: '', color: 'hsl(45,80%,55%)' };
      if (b.tipo === 'mergulho') broadcast({ t: 'mergulhar' });
      else if (b.tipo === 'epico') { broadcast({ t: 'join', user: u }); emit({ t: 'gift', user: u, giftName: 'Galáxia', diamond: 1000, repeatCount: 1, image: '' }); }
      else if (b.tipo === 'medio') { broadcast({ t: 'join', user: u }); emit({ t: 'gift', user: u, giftName: 'Toboagua', diamond: 199, repeatCount: 1, image: '' }); }
      else if (b.tipo === 'comentario') { broadcast({ t: 'join', user: u }); emit({ t: 'like', user: u, count: 12 }); setTimeout(() => emit({ t: 'chat', user: u, comment: 'Oi galera! Bora festa na lagoa 🐸' }), 300); }
      else if (b.tipo === 'pedido') emit({ t: 'chat', user: u, comment: '!musica Música de teste' });
      else return json(res, 400, { erro: 'tipo invalido' });
      json(res, 200, { ok: true });
    });
  }

  // mic do admin: abre = musica abaixa; fecha = volta
  if (req.method === 'POST' && urlPath === '/api/mic') {
    return lerJson(req, res, (b) => {
      micAberto = !!b.aberto;
      broadcast({ t: 'mic', aberto: micAberto });
      json(res, 200, { ok: true, aberto: micAberto });
    });
  }

  json(res, 404, { erro: 'rota nao encontrada' });
}

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (urlPath.startsWith('/api/')) return api(req, res, urlPath);
  if (urlPath === '/monitor') {
    if (!authed(req)) return pedeSenha(res, 'monitor protegido por senha');
    return servirArquivo(res, ADMIN_DIR, '/monitor.html');
  }
  if (urlPath === '/admin' || urlPath.startsWith('/admin/')) {
    if (!authed(req)) return pedeSenha(res, 'painel protegido por senha');
    let sub = urlPath.slice('/admin'.length) || '/';
    if (sub === '/') sub = '/index.html';
    return servirArquivo(res, ADMIN_DIR, sub);
  }
  if (urlPath === '/') urlPath = '/index.html';
  servirArquivo(res, OVERLAY_DIR, urlPath);
});

// ---- WebSocket: canal de eventos pro overlay e pro painel ----------------
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws, req) => {
  clients.add(ws);
  const ehLocal = local(req);
  ws.on('close', () => clients.delete(ws));
  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    // o overlay conta o que esta tocando; repassa pro painel
    if (msg.t === 'tocando' && ehLocal) {
      tocandoAgora = { titulo: String(msg.titulo || ''), idx: msg.idx, modo: msg.modo, tocando: !!msg.tocando, liberado: !!msg.liberado };
      broadcast({ t: 'tocando', ...tocandoAgora });
    }
  });
  ws.send(JSON.stringify({ t: 'hello', mode: MODE, user: USERNAME }));
  ws.send(JSON.stringify({ t: 'playlist', estado: playlist }));
  ws.send(JSON.stringify({ t: 'pedidos', lista: pedidos }));
  if (micAberto) ws.send(JSON.stringify({ t: 'mic', aberto: true }));
});

function broadcast(ev) {
  const msg = JSON.stringify(ev);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// Todo evento da live passa aqui: conta no resumo e vai pro overlay.
function emit(ev) { contabiliza(ev); broadcast(ev); }

// ---- conexao com a live do TikTok ----------------------------------------
function startLive() {
  const { WebcastPushConnection } = require('tiktok-live-connector');
  const opts = { enableExtendedGiftInfo: true };
  if (config.signApiKey) opts.signProviderOptions = { params: { apiKey: config.signApiKey } };

  const conn = new WebcastPushConnection(USERNAME, opts);

  function user(data) {
    return {
      id: String(data.userId || data.uniqueId || data.nickname || Math.random()),
      name: data.nickname || data.uniqueId || 'alguem',
      avatar: (data.profilePictureUrl)
        || (data.user && data.user.profilePicture && data.user.profilePicture.urls && data.user.profilePicture.urls[0])
        || ''
    };
  }

  function connect() {
    conn.connect().then((state) => {
      console.log(`[live] conectado em @${USERNAME} (roomId ${state.roomId})`);
      emit({ t: 'status', connected: true, user: USERNAME });
    }).catch((err) => {
      console.error('[live] falha ao conectar:', err.message);
      emit({ t: 'status', connected: false, error: err.message });
      // tenta de novo em 10s (live offline, etc.)
      setTimeout(connect, 10000);
    });
  }

  conn.on('member', (d) => emit({ t: 'join', user: user(d) }));
  conn.on('like', (d) => emit({ t: 'like', user: user(d), count: d.likeCount || 1, total: d.totalLikeCount || 0 }));
  conn.on('chat', (d) => emit({ t: 'chat', user: user(d), comment: d.comment || '' }));
  conn.on('follow', (d) => emit({ t: 'social', user: user(d), tipo: 'follow' }));
  conn.on('share', (d) => emit({ t: 'social', user: user(d), tipo: 'share' }));
  conn.on('roomUser', (d) => emit({ t: 'viewers', count: d.viewerCount || 0 }));
  conn.on('gift', (d) => {
    // Em presentes que ficam somando (streak), so conta quando termina.
    if (d.giftType === 1 && !d.repeatEnd) return;
    emit({
      t: 'gift',
      user: user(d),
      giftId: d.giftId,
      giftName: d.giftName || 'presente',
      repeatCount: d.repeatCount || 1,
      diamond: (d.diamondCount || 0) * (d.repeatCount || 1),
      image: (d.giftPictureUrl) || (d.extendedGiftInfo && d.extendedGiftInfo.image && d.extendedGiftInfo.image.url_list && d.extendedGiftInfo.image.url_list[0]) || ''
    });
  });

  conn.on('streamEnd', () => { emit({ t: 'status', connected: false, ended: true }); setTimeout(connect, 15000); });
  conn.on('disconnected', () => { emit({ t: 'status', connected: false }); setTimeout(connect, 10000); });

  connect();
}

// ---- gerador de eventos falsos (modo demo) -------------------------------
function startDemo() {
  const d = config.demo;
  const nomes = ['duda', 'yan', 'camis', 'Nealy', 'Rafael', 'ohh lokoo', 'bela', 'Pietra',
    'la plaga', 'Maria Santos', 'Tami', 'Angelica', 'guilherme', 'DF_g', 'julia',
    'Deivid', 'Gleici', 'vitto', 'Paulinha', 'MELHORES CORTES', 'Joao P', 'Lari',
    'thiago br', 'Nega', 'zeca', 'bibi', 'lucas', 'rute', 'aninha', 'vini'];
  const presentes = [
    { giftName: 'Rosa', diamond: 1, repeatCount: 1 },
    { giftName: 'Virar sapo', diamond: 5, repeatCount: 1 },
    { giftName: 'Construir ponte', diamond: 20, repeatCount: 1 },
    { giftName: 'Sapo Boi Gigante', diamond: 99, repeatCount: 1 },
    { giftName: 'Toboagua', diamond: 199, repeatCount: 1 },
    { giftName: 'Galáxia', diamond: 1000, repeatCount: 1 }
  ];
  const chats = ['curtindo demais', 'sobe meu sapo!', 'vamo perereca', 'top', 'kkkk', 'boa live', 'manda rosa', 'quero virar perereca', '#1 hoje',
    'que festa linda 😍', 'DJ solta o som!', 'meu girino ta nadando kkkk', 'olha eu ali!'];
  const pedidosDemo = ['!musica Batida da Lagoa', '!musica algo animado', '!música funk do sapo', '!musica eletronica', '!musica pagode'];

  const pool = []; // espectadores "vivos" pra dar like/gift
  let viewers = 0;

  function cor(seed) { const h = (seed * 47) % 360; return `hsl(${h},70%,60%)`; }
  function novoUser() {
    const name = nomes[Math.floor(Math.random() * nomes.length)] + (Math.random() < 0.3 ? ' ' + (Math.floor(Math.random() * 90) + 10) : '');
    return { id: 'demo-' + Math.random().toString(36).slice(2, 9), name, avatar: '', color: cor(name.length + name.charCodeAt(0)) };
  }

  setInterval(() => {
    if (pool.length > 80) return;
    const u = novoUser();
    pool.push(u);
    viewers = Math.min(d.maxFakeViewers, viewers + 1 + Math.floor(Math.random() * 3));
    emit({ t: 'join', user: u });
    emit({ t: 'viewers', count: viewers });
  }, d.joinEveryMs);

  setInterval(() => {
    if (!pool.length) return;
    // quem ja esta na lagoa curte; alguns curtem muito (viram perereca)
    const u = pool[Math.floor(Math.random() * pool.length)];
    const count = Math.random() < 0.15 ? 15 + Math.floor(Math.random() * 25) : 1 + Math.floor(Math.random() * 4);
    emit({ t: 'like', user: u, count });
  }, d.likeEveryMs);

  setInterval(() => {
    if (!pool.length) return;
    const u = pool[Math.floor(Math.random() * pool.length)];
    // presente grande e raro, os pequenos sao comuns
    const r = Math.random();
    const g = r < 0.06 ? presentes[5] : presentes[Math.floor(Math.random() * 5)];
    emit({ t: 'gift', user: u, giftName: g.giftName, diamond: g.diamond, repeatCount: g.repeatCount, image: '' });
  }, d.giftEveryMs);

  setInterval(() => {
    if (!pool.length) return;
    const u = pool[Math.floor(Math.random() * pool.length)];
    const txt = Math.random() < 0.18 ? pedidosDemo[Math.floor(Math.random() * pedidosDemo.length)] : chats[Math.floor(Math.random() * chats.length)];
    emit({ t: 'chat', user: u, comment: txt });
  }, d.chatEveryMs);

  setInterval(() => {
    if (!pool.length || Math.random() < 0.5) return;
    const u = pool[Math.floor(Math.random() * pool.length)];
    emit({ t: 'social', user: u, tipo: Math.random() < 0.6 ? 'follow' : 'share' });
  }, 9000);

  console.log('[demo] gerando eventos falsos. Abra o overlay pra ver.');
}

// ---- sobe tudo -----------------------------------------------------------
carregaPlaylist();
server.listen(PORT, () => {
  console.log('========================================================');
  console.log('  FESTA NA LAGOA — overlay rodando');
  console.log('  Overlay:   http://localhost:' + PORT);
  console.log('  Painel:    http://localhost:' + PORT + '/admin   (musica e resumo da live)');
  console.log('  Monitor:   http://localhost:' + PORT + '/monitor (live + painel lado a lado)');
  console.log('  Modo:      ' + MODE + (MODE === 'live' ? '  (@' + USERNAME + ')' : ''));
  console.log('  No OBS:    Browser Source 1080x1920 -> http://localhost:' + PORT);
  console.log('========================================================');
  if (MODE === 'live') startLive();
  else startDemo();
});
