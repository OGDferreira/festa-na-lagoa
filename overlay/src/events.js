// overlay/src/events.js
// Cliente WebSocket: recebe os eventos do servidor (join/like/gift/chat e os
// comandos do painel de admin) e permite mandar coisas de volta (ex: qual
// musica esta tocando). Reconecta sozinho se cair.
export function conectarEventos(url, handlers, onStatus) {
  let ws;
  let tentativas = 0;

  function abrir() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      tentativas = 0;
      enviar({ t: 'sou', papel: 'overlay' });
      onStatus && onStatus({ conectado: true });
    };

    ws.onmessage = (msg) => {
      let ev;
      try { ev = JSON.parse(msg.data); } catch { return; }
      const fn = handlers[ev.t];
      if (fn) fn(ev);
    };

    ws.onclose = () => {
      onStatus && onStatus({ conectado: false });
      const delay = Math.min(5000, 500 * Math.pow(1.6, tentativas++));
      setTimeout(abrir, delay);
    };

    ws.onerror = () => { try { ws.close(); } catch {} };
  }

  function enviar(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  abrir();
  return { enviar, fechar: () => { try { ws.close(); } catch {} } };
}
