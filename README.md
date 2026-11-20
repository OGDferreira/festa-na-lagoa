# 🐸 Festa na Lagoa — overlay de minigame pra live do TikTok

Overlay de lagoa 3D **vertical (9:16, 1080x1920)** pra live de celular, que
roda como **Browser Source no OBS**. É uma festa noturna na lagoa:

- Cada espectador vira um bichinho com a foto e o nome dele. Quem curtiu pouco
  é **girino nadando dentro d'água**; curtindo, pula pra folha como **sapo**,
  e depois vira **PERERECA** (de coroa).
- Os sapos são **3D** (volume, brilho, sombra) e **dançam no ritmo da música**
  com as **maozinhas balançando**.
- **Jogo de luzes de festa**: canhões de luz varrendo a lagoa, manchas
  coloridas na água, globo espelhado, cordão de lanternas e vagalumes, tudo
  pulsando com a batida.
- O **maior doador vira o SAPO DJ**: ganha fone de ouvido e assume a cabine no
  meio da lagoa, com o alerta **"🎧 NOVO DJ NA ÁREA!"**.
- Cards de **TOP 5 DOADORES** e **TOP 5 CURTIDORES**, barra de meta, entradas e
  presentes. Tudo em vidro colorido, sem caixa preta.
- **Painel de admin** em `/admin` pra montar a **playlist** e ver o **resumo
  da live**.

Tudo com **arte própria** (os bichos, folhas, cabine e água são modelados por
código, nada copiado) e **fácil de editar** no arquivo `overlay/config.js`.

![preview](preview.png)

---

## 1. O que você precisa

- **Node.js 18+** — baixe em https://nodejs.org (instala em 2 min).
- **OBS Studio** — https://obsproject.com
- Pronto. Não precisa de mais nada pra testar.

## 2. Rodar AGORA no modo demo (sem live, só pra ver funcionando)

Abra o terminal na pasta do projeto e rode:

```bash
npm install
npm run demo
```

Vai aparecer:

```
Overlay:   http://localhost:8080
```

Abra esse endereço no navegador (e o painel em `http://localhost:8080/admin`). O modo demo gera entradas, likes e presentes
falsos sozinho — é só pra você ver a cara do jogo rolando. 🎉

## 3. Ligar na sua live de verdade

1. Abra `server/config.js` e troque `tiktokUsername` pelo **seu @** (sem o @):

   ```js
   tiktokUsername: 'seuusuario',
   ```

2. Rode em modo live:

   ```bash
   npm run live
   ```

   ou direto: `node server/index.js --live --user seuusuario`

3. **Importante:** a sua live tem que estar **no ar** na hora. O servidor
   conecta no WebSocket público da live e começa a receber os eventos
   (entrada, like, presente, comentário). Não existe API oficial da TikTok pra
   isso — a lib `tiktok-live-connector` faz essa ponte.

> Se a conexão com a live falhar muito (a TikTok às vezes exige assinatura de
> request), pegue uma chave grátis em https://www.eulerstream.com e cole em
> `signApiKey` no `server/config.js`.

## 4. Colocar no OBS (vertical)

1. No OBS: **Configurações → Vídeo** → resolução base e de saída **1080x1920**.
2. **Fontes → + → Navegador (Browser Source)**.
3. Em **URL**, coloque: `http://localhost:8080`
4. **Largura 1080 / Altura 1920**.
5. Marque **"Controlar áudio via OBS"** (a música do painel sai por aí) e
   **"Atualizar navegador quando a cena ficar ativa"**.
6. OK. O overlay aparece como camada por cima do que você quiser.

Deixe o `npm run live` (ou `npm run demo`) **rodando no terminal** o tempo todo
enquanto estiver ao vivo — é ele que alimenta o overlay.

> Deixe **só uma** cópia do overlay aberta com som (a do OBS). Se abrir também
> no navegador, as duas tocam a música.

## 4.1 Painel de admin: música e resumo da live

Abra `http://localhost:8080/admin` no navegador do mesmo computador.

- **Playlist**: arraste os arquivos (mp3, ogg, wav ou m4a) pra área de envio.
  Dá pra reordenar, renomear (o nome aparece na live), tocar uma faixa
  específica, apagar, ligar o aleatório e mexer no volume.
- **Batida gerada**: um botão volta pra trilha de festa gerada pelo próprio
  overlay (sem copyright). Ela também toca quando a playlist está vazia.
- **Resumo da live**: viewers agora e pico, curtidas, moedas, presentes,
  entradas, seguidores, comentários e os top 5. Conta desde que o servidor ligou.

Música que está no **celular**: passe o arquivo pro computador (cabo USB, WhatsApp Web, Google Drive...) e arraste no painel.

O painel só abre no próprio computador (não fica exposto na rede).

---

## 5. Deixar com a SUA cara (editar)

Mexa só no arquivo **`overlay/config.js`**. Lá dá pra trocar, sem programar:

| O quê | Onde |
|---|---|
| Nome da marca, nome do jogo, frase que pisca | `brand` |
| Título e recompensa da barra de meta + objetivo | `meta` |
| Títulos dos cards top 5 | `ranking` |
| Tamanho da tela e margens pra interface do TikTok | `tela` |
| BPM da dança, cores e quantidade de luzes | `festa` |
| Som de novo TOP 1 (buzina de DJ / fanfarra, ou arquivo seu) | `efeitos` |
| Cores do tema (água, folha, neon, ouro…) | `cores` |
| Quantos likes pra virar sapo / perereca | `estagios` |
| Quantos sapos na tela ao mesmo tempo | `maxSapos` |
| **Presentes da sua live → efeito** (nome + emoji + tamanho) | `presentes` |
| Câmera girando, zoom no presente | `camera` |

### Combinar os presentes com a sua live
No `presentes`, a **chave** é o nome exato do presente como aparece no TikTok.
Configure os presentes que quiser na sua live e liste eles aqui com o efeito.
Nomes que não estiverem na lista usam o efeito `padrao`.

### Música
A música agora é controlada pelo painel `/admin` (veja 4.1). Música com
direitos autorais pode mutar ou derrubar a live; a batida gerada evita isso.

### Logo e avatar do topo
Em `brand.logo` aponte pra uma imagem sua em `overlay/assets/` (ex:
`'assets/logo.png'`). Vazio = usa o desenho padrão.

---

## 6. Pra live não cair / não travar

- O overlay **reconecta sozinho** se o servidor cair, e o servidor **reconecta
  sozinho** na live se ela oscilar (até ela voltar).
- O Three.js é **local** (pasta `overlay/lib/`), não depende de internet nem de
  CDN — um site fora do ar não derruba o overlay.
- No OBS, o overlay é só uma camada: se precisar, dá **refresh** na Browser
  Source sem cortar a transmissão.
- Rode o terminal numa máquina estável; se usar internet móvel, tenha um plano
  B de conexão. (A estabilidade da *live em si* depende da sua conta e conexão,
  não do overlay.)

---

## Estrutura

```
festa-na-lagoa/
├── admin/
│   └── index.html    painel: playlist + resumo da live
├── server/
│   ├── index.js      servidor: serve o overlay + repassa eventos da live
│   └── config.js     modo (demo/live), usuário, porta
└── overlay/
    ├── index.html
    ├── config.js     <<< A "NOSSA CARA": edite aqui
    ├── style.css
    ├── lib/three.module.js
    └── src/          cena 3D, sapos, câmera, HUD, áudio, eventos
```

Protótipo. Mecânica e código próprios; arte placeholder gerada por código.
