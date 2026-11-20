// server/config.js
// Configuracao do servidor. Edite aqui (ou use variaveis de ambiente / flags).
//
// Como escolher o modo:
//   npm run demo   -> eventos falsos, nao conecta no TikTok (pra ver rodando agora)
//   npm run live   -> conecta na live do @TIKTOK_USERNAME abaixo
//   npm start      -> usa o campo "mode" daqui embaixo
//
// Voce tambem pode passar o usuario na linha de comando:
//   node server/index.js --live --user seuusuario

module.exports = {
  // "demo" | "live"
  mode: process.env.MODE || 'demo',

  // Username da sua live no TikTok (sem o @). So e usado no modo live.
  tiktokUsername: process.env.TIKTOK_USERNAME || 'seuusuario',

  // Porta do servidor. O overlay e o WebSocket rodam na mesma porta.
  port: Number(process.env.PORT || 8080),

  // Ritmo dos eventos no modo demo (ms). Menor = mais agitado.
  demo: {
    joinEveryMs: 2600,
    likeEveryMs: 700,
    giftEveryMs: 7000,
    chatEveryMs: 3500,
    maxFakeViewers: 240
  },

  // Chave de assinatura (Euler/SignServer). Normalmente nao precisa.
  // Se a conexao com a live falhar muito, gere uma chave gratis em
  // https://www.eulerstream.com e cole aqui.
  signApiKey: process.env.SIGN_API_KEY || ''
};
