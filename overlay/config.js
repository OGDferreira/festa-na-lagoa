// overlay/config.js
// =========================================================================
//  AQUI E A "NOSSA CARA". Mexa so neste arquivo pra mudar marca, cores,
//  textos, regras de crescimento, presentes e meta. Nao precisa saber
//  programar — e so trocar os valores entre aspas e os numeros.
//
//  A MUSICA nao fica mais aqui: ela e controlada pelo painel de admin
//  em http://localhost:8080/admin
// =========================================================================

export const CONFIG = {

  // ---- TELA (live de celular = vertical 9:16) -----------------------------
  // O overlay e desenhado em 1080x1920 e encaixa em qualquer janela.
  // No OBS use Browser Source com Largura 1080 / Altura 1920.
  tela: {
    largura: 1080,
    altura: 1920,
    // espaco livre no topo e embaixo pra nao ficar atras da interface do
    // TikTok (nome do host, contador, comentarios, botoes)
    margemTopo: 130,
    margemBaixo: 420
  },

  // ---- MARCA / TEXTOS ----------------------------------------------------
  brand: {
    nome: 'SUA LIVE',                       // nome do canal/marca (topo)
    jogo: 'FESTA NA LAGOA',                 // nome do minigame
    chamada: 'CURTA PARA FAZER SEU SAPO DANÇAR', // frase que pisca embaixo
    // avatar/logo do topo: deixe '' pra usar o desenho padrao, ou aponte
    // pra uma imagem sua em overlay/assets/, ex: 'assets/logo.png'
    logo: ''
  },

  // ---- META (a barra de progresso, estilo "O Baile do Luar") -------------
  meta: {
    titulo: 'A LAGOA ENCANTADA',
    recompensa: 'O BAILE DO LUAR',
    // de quantos "pontos" precisa pra encher a barra (soma de likes + gifts)
    objetivo: 8000
  },

  // ---- CARDS DE RANKING (top 5 doadores e top 5 curtidores) --------------
  ranking: {
    tituloDoadores: 'TOP 5 DOADORES',
    tituloCurtidores: 'TOP 5 CURTIDORES',
    quantos: 5
  },

  // ---- CORES DO TEMA -----------------------------------------------------
  cores: {
    agua1: '#155e6e',
    agua2: '#2fb5a8',
    aguaFundo: '#061d2a',
    folha: '#3fae5a',
    folhaBorda: '#2b7d3f',
    destaque: '#9dff3c',     // verde neon da marca
    rosa: '#ff4d9d',
    ouro: '#ffd43b'
  },

  // ---- FESTA (luzes e danca) ---------------------------------------------
  festa: {
    // batidas por minuto da danca dos sapos (a trilha gerada usa o mesmo)
    bpm: 120,
    // cores que as luzes vao alternando
    luzes: ['#ff4d9d', '#9dff3c', '#4dd2ff', '#ffd43b', '#b07cff', '#ff8a3d'],
    // quantos canhoes de luz varrendo a lagoa
    canhoes: 5,
    // vagalumes/brilhos flutuando
    vagalumes: 140,
    // intensidade geral das luzes (0 a 1.5)
    intensidade: 1
  },

  // ---- ESTAGIOS DO SAPO (crescimento por likes) --------------------------
  // Cada espectador comeca como girino. Acumulando likes, sobe de estagio.
  // "min" = quantos likes precisa pra chegar naquele estagio.
  estagios: [
    { nome: 'girino',   min: 0,   escala: 0.6 },
    { nome: 'sapo',     min: 10,  escala: 0.85 },
    { nome: 'sapo jovem', min: 40, escala: 1.05 },
    { nome: 'PERERECA', min: 100, escala: 1.35 }   // o topo: vira PERERECA
  ],

  // quantos sapos ficam visiveis na lagoa ao mesmo tempo (os que mais curtiram)
  maxSapos: 34,

  // ---- PRESENTES (gift) -> EFEITO ----------------------------------------
  // Liga o nome do presente do TikTok a um efeito na tela. "nivel" controla
  // o tamanho do efeito. Nomes que nao estiverem aqui usam o efeito padrao.
  // Combine com os nomes REAIS dos presentes que voce configurar na sua live.
  presentes: {
    padrao:            { nivel: 1, cor: '#ff4d9d', emoji: '🌹', label: 'mandou um presente' },
    'Rosa':            { nivel: 1, cor: '#ffffff', emoji: '🌹', label: 'enviou Rosa' },
    'Virar sapo':      { nivel: 2, cor: '#9dff3c', emoji: '🐸', label: 'virou sapo na hora' },
    'Virar sapa':      { nivel: 2, cor: '#ff9ed6', emoji: '🐸', label: 'virou sapa na hora' },
    'Construir ponte': { nivel: 2, cor: '#ffb86b', emoji: '🤝', label: 'construiu a ponte' },
    'Sapo Boi Gigante':{ nivel: 3, cor: '#6bd36b', emoji: '🐸', label: 'SOLTOU O SAPO BOI GIGANTE' },
    'Toboagua':        { nivel: 4, cor: '#4dd2ff', emoji: '🌊', label: 'ABRIU O TOBOAGUA' }
  },

  // ---- CAMERA ------------------------------------------------------------
  camera: {
    girarAuto: true,          // camera girando sozinha pela lagoa
    velocidadeGiro: 0.05,     // rad/s
    focarPresente: true,      // da zoom no sapo de quem manda presente
    tempoFoco: 4.2            // segundos focando antes de voltar
  },

  // ---- CONEXAO -----------------------------------------------------------
  // De onde o overlay recebe os eventos. Deixe automatico.
  ws: (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
};
