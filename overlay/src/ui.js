// overlay/src/ui.js
// Controla a camada de interface (HUD): marca, barra de meta, cards de
// ranking, toasts de entrada, popups de presente e o "VIROU PERERECA!".
import { corDaString } from './assets.js';

export function criarUI(config) {
  const cores = config.cores;
  const $ = (s) => document.querySelector(s);
  const el = {
    logo: $('#logo'),
    ranking: $('#ranking-topo'),
    toasts: $('#toasts'),
    gift: $('#gift-popup'),
    viewers: $('#viewers'),
    metaFill: $('#meta-fill'),
    metaFaltam: $('#meta-faltam'),
    status: $('#status-bar'),
    btnSom: $('#btn-som')
  };

  // ---- preenche textos de marca ----
  function brand() {
    document.querySelectorAll('[data-brand-nome]').forEach(n => n.textContent = config.brand.nome);
    document.querySelectorAll('[data-brand-chamada]').forEach(n => n.textContent = config.brand.chamada);
    document.querySelectorAll('[data-meta-titulo]').forEach(n => n.textContent = config.meta.titulo);
    document.querySelectorAll('[data-meta-recompensa]').forEach(n => n.textContent = config.meta.recompensa);
    document.documentElement.style.setProperty('--destaque', cores.destaque);
    document.documentElement.style.setProperty('--ouro', cores.ouro);
    document.documentElement.style.setProperty('--rosa', cores.rosa);
    if (config.brand.logo) el.logo.style.backgroundImage = `url('${config.brand.logo}')`;
  }

  function avatarHTML(user, size) {
    if (user.avatar) return `<img src="${user.avatar}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'av',textContent:'${(user.name[0] || '?').toUpperCase()}',style:'background:${user.color || `hsl(${corDaString(user.name)},60%,55%)`}'}))" />`;
    const bg = user.color || `hsl(${corDaString(user.name)},60%,55%)`;
    return `<span class="av" style="background:${bg}">${(user.name[0] || '?').toUpperCase()}</span>`;
  }

  // ---- toast de entrada ----
  function join(user) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.innerHTML = `${avatarHTML(user)}<span>🐸 <b>${esc(user.name)}</b> entrou na lagoa</span>`;
    el.toasts.appendChild(d);
    if (el.toasts.children.length > 6) el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 4200);
  }

  // ---- popup de presente ----
  function gift(user, giftInfo, nome) {
    const d = document.createElement('div');
    d.className = 'gift';
    d.style.boxShadow = `0 0 24px ${giftInfo.cor}`;
    d.innerHTML = `<span class="av" style="background:${user.color || `hsl(${corDaString(user.name)},60%,55%)`}">${avatarInner(user)}</span>
      <span class="gift-emoji">${giftInfo.emoji}</span>
      <span class="gift-txt"><b>${esc(user.name)}</b> ${esc(giftInfo.label)}</span>`;
    el.gift.appendChild(d);
    if (el.gift.children.length > 3) el.gift.firstChild.remove();
    setTimeout(() => d.remove(), 4800);
  }
  function avatarInner(user) {
    if (user.avatar) return `<img src="${user.avatar}" onerror="this.remove()"/>`;
    return (user.name[0] || '?').toUpperCase();
  }

  // ---- ranking (podio dos doadores) ----
  function ranking(lista) {
    const top = lista.slice(0, config.ranking.podio);
    let html = `<div class="rank-titulo">🔥 ${esc(config.ranking.tituloTopo)}</div>`;
    top.forEach((u, i) => {
      html += `<div class="rank-card rank-${i + 1}">
        <div class="rank-medal">${i + 1}</div>
        <div>
          <div class="rank-nome">${esc(u.name)}</div>
          <div class="rank-pts">🪙 ${u.pontos}</div>
        </div>
      </div>`;
    });
    el.ranking.innerHTML = html;
  }

  // ---- meta / barra ----
  function meta(pontos) {
    const obj = config.meta.objetivo;
    const pct = Math.min(100, (pontos / obj) * 100);
    el.metaFill.style.width = pct + '%';
    el.metaFaltam.textContent = Math.max(0, obj - pontos);
  }

  function viewers(n) { el.viewers.textContent = n; }

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

  return { brand, join, gift, ranking, meta, viewers, perereca, status, botaoSom, escondeBotaoSom };
}

function esc(s) { return String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }
