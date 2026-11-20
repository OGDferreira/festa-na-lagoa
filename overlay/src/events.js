// overlay/src/events.js
// Cliente WebSocket: recebe os eventos do servidor (join/like/gift/chat).
// Reconecta sozinho se cair (importante pra live nao "morrer" visualmente).
export function conectarEventos(url, handlers, onStatus) {
  let ws;
  let tentativas = 0;

  function abrir() {
    ws = new WebSocket(url);

    ws.onopen = () => { tentativas = 0; onStatus && onStatus({ conectado: true }); };

    ws.onmessage = (msg) => {
      let ev;
      try { ev = JSON.parse(msg.data); } catch { return; }
      const fn = handlers[ev.t];
      if (fn) fn(ev);
    };

    ws.onclose = () => {
      onStatus && onStatus({ conectado: false });
      // backoff ate 5s
      const delay = Math.min(5000, 500 * Math.pow(1.6, tentativas++));
      setTimeout(abrir, delay);
    };

    ws.onerror = () => { try { ws.close(); } catch {} };
  }

  abrir();
  return { fechar: () => { try { ws.close(); } catch {} } };
}
