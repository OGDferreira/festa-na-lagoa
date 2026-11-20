// overlay/config.js
// =========================================================================
//  AQUI E A "NOSSA CARA". Mexa so neste arquivo pra mudar marca, cores,
//  textos, regras de crescimento, presentes e meta. Nao precisa saber
//  programar — e so trocar os valores entre aspas e os numeros.
// =========================================================================

export const CONFIG = {

  // ---- MARCA / TEXTOS ----------------------------------------------------
  brand: {
    nome: 'SUA LIVE',                       // nome do canal/marca (topo)
    jogo: 'FESTA NA LAGOA',                 // nome do minigame
    chamada: 'CURTA PARA CRESCER SEU SAPO', // frase que pisca embaixo
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

  // ---- CARDS DE RANKING DO TOPO (os 3 doadores do dia) -------------------
  // O texto dos cards se atualiza sozinho conforme chegam presentes.
  // Aqui voce so define o titulo da secao.
  ranking: {
    tituloTopo: 'RANKING DIARIO',
    // quantos lugares de podio mostrar (3 = ouro/prata/bronze)
    podio: 3
  },

  // ---- CORES DO TEMA -----------------------------------------------------
  cores: {
    agua1: '#1f7a8c',
    agua2: '#2fb5a8',
    aguaFundo: '#0b3b46',
    folha: '#3fae5a',
    folhaBorda: '#2b7d3f',
    destaque: '#9dff3c',     // verde neon da marca
    rosa: '#ff4d9d',
    ouro: '#ffd43b'
  },

  // ---- ESTAGIOS DO SAPO (crescimento por likes) --------------------------
  // Cada espectador comeca como girino. Acumulando likes, sobe de estagio.
  // "min" = quantos likes precisa pra chegar naquele estagio.
  estagios: [
    { nome: 'girino',   min: 0,   escala: 0.55 },
    { nome: 'sapo',     min: 10,  escala: 0.85 },
    { nome: 'sapo jovem', min: 40, escala: 1.1 },
    { nome: 'PERERECA', min: 100, escala: 1.5 }   // o topo: vira PERERECA
  ],

  // quantos sapos ficam visiveis na lagoa ao mesmo tempo (os que mais curtiram)
  maxSapos: 50,

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
    velocidadeGiro: 0.06,     // rad/s
    focarPresente: true,      // da zoom no sapo de quem manda presente
    tempoFoco: 4.2            // segundos focando antes de voltar
  },

  // ---- MUSICA ------------------------------------------------------------
  audio: {
    ligado: true,
    volume: 0.5,
    // Deixe a lista vazia [] pra usar a trilha ambiente gerada (royalty-free,
    // sem risco de copyright). Pra usar SUA playlist, coloque os arquivos em
    // overlay/assets/musica/ e liste aqui, ex:
    //   playlist: ['assets/musica/faixa1.mp3', 'assets/musica/faixa2.mp3']
    playlist: []
  },

  // ---- CONEXAO -----------------------------------------------------------
  // De onde o overlay recebe os eventos. Deixe automatico.
  ws: (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
};
