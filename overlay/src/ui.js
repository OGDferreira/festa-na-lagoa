// overlay/src/ui.js
// Controla a camada de interface (HUD): marca, barra de meta, cards top 5
// (doadores e curtidores), musica tocando, toasts de entrada, popups de
// presente e o "VIROU PERERECA!".
import { corDaString } from './assets.js';

export function criarUI(config) {
  const cores = config.cores;
  const $ = (s) => document.querySelector(s);
  const el = {
    palco: $('#palco'),
    doadores: $('#lista-doadores'),
    curtidores: $('#lista-curtidores'),
    toasts: $('#toasts'),
    gift: $('#gift-popup'),
    chamada: $('#chamada'),
    epico: $('#epico'),
    mergulho: $('#mergulho'),
    metaFill: $('#meta-fill'),
    metaFaltam: $('#meta-faltam'),
    tocando: $('#tocando'),
    tocandoTxt: $('#tocando-txt'),
    status: $('#status-bar'),
    btnSom: $('#btn-som')
  };
  const raiz = document.documentElement.style;

  // ---- escala o HUD de 1080x1920 pro tamanho real do palco ----
  function encaixar() {
    const w = el.palco.clientWidth;
    raiz.setProperty('--escala', w / config.tela.largura);
  }
  window.addEventListener('resize', encaixar);
  encaixar();

  // ---- preenche textos de marca ----
  function brand() {
    const set = (sel, txt) => document.querySelectorAll(sel).forEach((n) => n.textContent = txt);
    set('[data-meta-recompensa]', config.meta.recompensa);
    set('[data-titulo-doadores]', config.ranking.tituloDoadores);
    set('[data-titulo-curtidores]', config.ranking.tituloCurtidores);
    raiz.setProperty('--destaque', cores.destaque);
    raiz.setProperty('--ouro', cores.ouro);
    raiz.setProperty('--rosa', cores.rosa);
    raiz.setProperty('--mt', config.tela.margemTopo + 'px');
    raiz.setProperty('--mb', config.tela.margemBaixo + 'px');
    iniciaChamadas();
    ranking('doadores', []);
    ranking('curtidores', []);
  }

  const corUser = (user) => user.color || `hsl(${corDaString(user.name)},60%,55%)`;
  const inicial = (user) => esc((user.name[0] || '?').toUpperCase());
  function avatar(user) {
    const img = user.avatar ? `<img src="${escAttr(user.avatar)}" onerror="this.remove()"/>` : '';
    return `<span class="av" style="background:${corUser(user)}">${img || inicial(user)}</span>`;
  }

  // ---- toast de entrada ----
  function join(user) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.innerHTML = `${avatar(user)}<span>🐸 <b>${esc(user.name)}</b> entrou na festa</span>`;
    el.toasts.appendChild(d);
    if (el.toasts.children.length > 4) el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 4200);
  }

  // ---- popup de presente ----
  function gift(user, giftInfo) {
    const d = document.createElement('div');
    d.className = 'gift';
    d.style.boxShadow = `0 0 34px ${giftInfo.cor}`;
    d.innerHTML = `${avatar(user)}
      <span class="gift-emoji">${giftInfo.emoji}</span>
      <span class="gift-txt"><b>${esc(user.name)}</b> ${esc(giftInfo.label)}</span>`;
    el.gift.appendChild(d);
    if (el.gift.children.length > 2) el.gift.firstChild.remove();
    setTimeout(() => d.remove(), 4800);
  }

  // ---- cards top 5 ----
  // lista = [{ id, user, valor }] ja ordenada
  const posAnterior = { doadores: new Map(), curtidores: new Map() };
  function ranking(qual, lista) {
    const alvo = qual === 'doadores' ? el.doadores : el.curtidores;
    const n = config.ranking.quantos;
    const top = lista.slice(0, n);
    const antes = posAnterior[qual];
    const agora = new Map();
    let html = '';
    for (let i = 0; i < n; i++) {
      const it = top[i];
      if (!it) {
        html += `<li class="card-item vazio pos-${i + 1}"><span class="medalha">${i + 1}</span><span class="card-nome">—</span></li>`;
        continue;
      }
      agora.set(it.id, i);
      const subiu = !antes.has(it.id) || antes.get(it.id) > i;
      const valor = qual === 'doadores' ? `🪙 ${fmt(it.valor)}` : `❤ ${fmt(it.valor)}`;
      html += `<li class="card-item pos-${i + 1}${subiu ? ' subiu' : ''}">
        <span class="medalha">${i + 1}</span>${avatar(it.user)}
        <span class="card-nome">${esc(it.user.name)}</span>
        <span class="card-valor">${valor}</span></li>`;
    }
    // so redesenha se mudou algo (evita piscar)
    if (alvo.dataset.ultimo !== html) { alvo.innerHTML = html; alvo.dataset.ultimo = html; }
    posAnterior[qual] = agora;
  }

  // ---- meta / barra ----
  function meta(pontos) {
    const obj = config.meta.objetivo;
    const pct = Math.min(100, (pontos / obj) * 100);
    el.metaFill.style.width = pct + '%';
    el.metaFaltam.textContent = fmt(Math.max(0, obj - pontos));
  }

  function viewers() { /* o TikTok ja mostra quantos estao assistindo */ }

  // ---- chamada de baixo: alterna curtir / seguir / pedir musica ----
  function iniciaChamadas() {
    const frases = (config.brand.chamadas && config.brand.chamadas.length) ? config.brand.chamadas : [config.brand.chamada];
    let i = 0;
    const mostra = () => {
      el.chamada.classList.add('trocando');
      setTimeout(() => {
        el.chamada.textContent = frases[i % frases.length];
        el.chamada.classList.remove('trocando');
        i++;
      }, 350);
    };
    mostra();
    if (frases.length > 1) setInterval(mostra, (config.brand.trocaChamadaSeg || 7) * 1000);
  }

  // ---- pedido de musica (!musica no chat) ----
  function pedido(user, musica) {
    const d = document.createElement('div');
    d.className = 'toast toast-pedido';
    d.innerHTML = `${avatar(user)}<span>🎵 <b>${esc(user.name)}</b> pediu: <i>${esc(musica)}</i></span>`;
    el.toasts.appendChild(d);
    if (el.toasts.children.length > 4) el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 6200);
  }

  // ---- PRESENTE EPICO: explosao de luz + texto grande ----
  function epico(user, nomePresente, moedas, emoji) {
    el.epico.innerHTML = `<div class="epico-luz"></div>
      <div class="epico-caixa">
        <div class="epico-topo">🎁 PRESENTE ÉPICO! 🎁</div>
        <div class="epico-user">${avatar(user)}<span>${esc(user.name)}</span></div>
        <div class="epico-presente">${emoji || '💎'} ${esc(nomePresente)} · 🪙 ${fmt(moedas)}</div>
      </div>`;
    el.epico.classList.remove('ativo'); void el.epico.offsetWidth; el.epico.classList.add('ativo');
    clearTimeout(epico._t);
    epico._t = setTimeout(() => { el.epico.classList.remove('ativo'); el.epico.innerHTML = ''; }, 5000);
  }

  // ---- aviso da vista subaquatica ----
  function mergulho(on) { el.mergulho.hidden = !on; }

  // ---- musica tocando ----
  function tocando(info) {
    el.tocando.hidden = !info || !info.tocando;
    if (info) el.tocandoTxt.textContent = info.titulo;
  }

  // ---- batida: faz o HUD pulsar junto ----
  function batida(v) { raiz.setProperty('--batida', v.toFixed(3)); }

  // ---- NOVO DJ NA AREA ----
  let alertaDJ = null;
  function novoDJ(user) {
    if (alertaDJ) alertaDJ.remove();
    const d = alertaDJ = document.createElement('div');
    d.className = 'alerta-dj';
    d.innerHTML = `<div class="dj-topo">🎧 NOVO DJ NA ÁREA! 🎧</div>
      <div class="dj-user">${avatar(user)}<span>${esc(user.name)}</span></div>
      <div class="dj-sub">assumiu as pick-ups da lagoa</div>`;
    document.getElementById('hud').appendChild(d);
    setTimeout(() => { d.remove(); if (alertaDJ === d) alertaDJ = null; }, 5200);
  }

  // ---- VIROU PERERECA ----
  function perereca(nome) {
    const b = document.createElement('div');
    b.className = 'perereca-burst';
    b.innerHTML = `${esc(nome)}<br>VIROU PERERECA!`;
    document.getElementById('hud').appendChild(b);
    setTimeout(() => b.remove(), 1600);
  }

  function status(txt) { el.status.textContent = txt; }

  function botaoSom(onClick) {
    el.btnSom.hidden = false;
    el.btnSom.onclick = () => { el.btnSom.hidden = true; onClick(); };
  }
  function escondeBotaoSom() { el.btnSom.hidden = true; }

  return { brand, join, gift, novoDJ, pedido, epico, mergulho, ranking, meta, viewers, tocando, batida, perereca, status, botaoSom, escondeBotaoSom };
}

function fmt(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace('.0', '') + 'k';
  return n.toLocaleString('pt-BR');
}
function esc(s) { return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c])); }
function escAttr(s) { return esc(s); }
