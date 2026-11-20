// server/index.js
// Servidor unico: serve o overlay (pasta /overlay) e repassa os eventos da
// live do TikTok para o overlay via WebSocket. Tem modo demo embutido.
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

// ---- servidor http que serve a pasta /overlay ----------------------------
const OVERLAY_DIR = path.join(__dirname, '..', 'overlay');
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
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(OVERLAY_DIR, path.normalize(urlPath));
  if (!filePath.startsWith(OVERLAY_DIR)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('nao encontrado'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---- WebSocket: canal de eventos pro overlay -----------------------------
const wss = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.send(JSON.stringify({ t: 'hello', mode: MODE, user: USERNAME }));
});

function broadcast(ev) {
  const msg = JSON.stringify(ev);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// Normaliza qualquer evento num formato unico que o overlay entende.
function emit(ev) { broadcast(ev); }

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
  conn.on('social', (d) => emit({ t: 'social', user: user(d), label: d.label || '' }));
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
    { giftName: 'Toboagua', diamond: 199, repeatCount: 1 }
  ];
  const chats = ['curtindo demais', 'sobe meu sapo!', 'vamo perereca', 'top', 'kkkk', 'boa live', 'manda rosa', 'quero virar perereca', '#1 hoje'];

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
    const g = presentes[Math.floor(Math.random() * presentes.length)];
    emit({ t: 'gift', user: u, giftName: g.giftName, diamond: g.diamond, repeatCount: g.repeatCount, image: '' });
  }, d.giftEveryMs);

  setInterval(() => {
    if (!pool.length) return;
    const u = pool[Math.floor(Math.random() * pool.length)];
    emit({ t: 'chat', user: u, comment: chats[Math.floor(Math.random() * chats.length)] });
  }, d.chatEveryMs);

  console.log('[demo] gerando eventos falsos. Abra o overlay pra ver.');
}

// ---- sobe tudo -----------------------------------------------------------
server.listen(PORT, () => {
  console.log('========================================================');
  console.log('  FESTA NA LAGOA — overlay rodando');
  console.log('  Overlay:   http://localhost:' + PORT);
  console.log('  Modo:      ' + MODE + (MODE === 'live' ? '  (@' + USERNAME + ')' : ''));
  console.log('  No OBS:    Browser Source -> http://localhost:' + PORT);
  console.log('========================================================');
  if (MODE === 'live') startLive();
  else startDemo();
});
