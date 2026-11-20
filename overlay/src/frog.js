// overlay/src/frog.js
// Um sapo = um espectador. Personagem 3D de verdade (esferas com brilho,
// sombra e luz colorida da festa batendo nele), modelado aqui em codigo:
// arte propria. Quem tem poucas curtidas e GIRINO nadando dentro d'agua;
// curtindo mais, pula pra folha como sapo e depois vira PERERECA (coroa).
// O maior doador vira o SAPO DJ (fone de ouvido, la na cabine).
import * as THREE from 'three';
import { texturaAvatar, texturaNome, texturaBrilho, corDaString } from './assets.js';

// ---- geometrias compartilhadas (economiza memoria) ------------------------
const G = {
  esfera: new THREE.SphereGeometry(1, 28, 20),
  esferaBaixa: new THREE.SphereGeometry(1, 14, 10),
  boca: new THREE.TorusGeometry(0.2, 0.028, 8, 24, Math.PI).rotateZ(Math.PI),
  braco: new THREE.CapsuleGeometry(0.075, 0.32, 6, 12).translate(0, 0.23, 0),
  cauda: new THREE.ConeGeometry(0.22, 1.0, 14).rotateX(-Math.PI / 2).translate(0, 0, -0.55),
  coroaBase: new THREE.TorusGeometry(0.22, 0.05, 8, 24).rotateX(Math.PI / 2),
  coroaPonta: new THREE.ConeGeometry(0.06, 0.2, 10),
  aro: new THREE.TorusGeometry(0.5, 0.045, 8, 28, Math.PI),
  concha: new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24).rotateZ(Math.PI / 2),
  anel: new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2),
  sombra: new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2)
};
const M = {
  branco: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15 }),
  pupila: new THREE.MeshStandardMaterial({ color: '#0c1410', roughness: 0.1 }),
  pupilaPerereca: new THREE.MeshStandardMaterial({ color: '#e01e2b', roughness: 0.1, emissive: '#5a0008' }),
  boca: new THREE.MeshStandardMaterial({ color: '#2a0d12', roughness: 0.6 }),
  bochecha: new THREE.MeshStandardMaterial({ color: '#ff7a9a', roughness: 0.7, transparent: true, opacity: 0.75 }),
  ouro: new THREE.MeshStandardMaterial({ color: '#ffd43b', metalness: 0.75, roughness: 0.25, emissive: '#5a3c00' }),
  fone: new THREE.MeshStandardMaterial({ color: '#1d1f2b', metalness: 0.4, roughness: 0.25 }),
  foneNeon: new THREE.MeshStandardMaterial({ color: '#ff4d9d', emissive: '#ff4d9d', emissiveIntensity: 1.4 })
};
const sombraMat = new THREE.MeshBasicMaterial({ map: texturaBrilho(), color: '#000000', transparent: true, opacity: 0.5, depthWrite: false });
const ondaMat = new THREE.MeshBasicMaterial({ color: '#bff6ff', transparent: true, opacity: 0.5, depthWrite: false });

function bola(geo, mat, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy ?? sx, sz ?? sx);
  return m;
}

// passos de danca: cada sapo sorteia um e troca de vez em quando
const PASSOS = ['maosPraCima', 'tchauTchau', 'remexe', 'pulinho'];

export class Sapo {
  constructor(user, cores, config) {
    this.user = user;
    this.cores = cores;
    this.config = config;
    this.likes = 0;
    this.estagioIdx = 0;
    this.rank = null;
    this.slot = null;
    this.visivel = false;
    this.dj = false;
    this.lugarDJ = null;
    this.atraso = (Math.random() - 0.5) * 0.25;
    this.passo = PASSOS[Math.floor(Math.random() * PASSOS.length)];
    this.trocaPassoEm = 6 + Math.random() * 10;
    this._pulo = 0;
    this._empolgacao = 0;
    this._nado = Math.random() * Math.PI * 2;
    this._onda = Math.random();

    const hue = this._corHue();
    this.pele = new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${hue}, 62%, 46%)`), roughness: 0.38, metalness: 0.05 });
    this.barriga = new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${hue}, 50%, 80%)`), roughness: 0.5 });
    this.peleGirino = new THREE.MeshStandardMaterial({ color: new THREE.Color(`hsl(${hue}, 45%, 30%)`), roughness: 0.25, metalness: 0.1 });

    this.group = new THREE.Group();   // posicao no mundo
    this.modelo = new THREE.Group();  // gira pra olhar a camera
    this.group.add(this.modelo);

    this._montaSapo();
    this._montaGirino();

    // sombra no chao
    this.sombra = new THREE.Mesh(G.sombra, sombraMat);
    this.sombra.position.y = 0.06;
    this.group.add(this.sombra);

    // avatar + nome (sprites, sempre de frente pra tela)
    this.avatarMat = new THREE.SpriteMaterial({ map: texturaAvatar(user), depthWrite: false });
    this.avatar = new THREE.Sprite(this.avatarMat);
    this.avatar.scale.set(1.15, 1.15, 1);
    this.group.add(this.avatar);
    this.nomeMat = new THREE.SpriteMaterial({ map: texturaNome(user.name, null, cores), depthWrite: false });
    this.nome = new THREE.Sprite(this.nomeMat);
    this.nome.scale.set(4, 1, 1);
    this.group.add(this.nome);

    this._escala = 0.01;
    this._aplicaEstagio();
  }

  // ---------------- modelos 3D ----------------
  _montaSapo() {
    const s = this.sapo = new THREE.Group();
    const corpo = this.corpo = new THREE.Group();
    s.add(corpo);
    const P = this.pele, B = this.barriga;
    corpo.add(bola(G.esfera, P, 0, 0.45, 0, 0.55, 0.46, 0.5));          // corpo
    corpo.add(bola(G.esfera, B, 0, 0.4, 0.22, 0.4, 0.34, 0.3));          // barriga
    corpo.add(bola(G.esfera, P, 0, 0.86, 0.05, 0.52, 0.34, 0.44));       // cabeca
    for (const l of [-1, 1]) {
      corpo.add(bola(G.esfera, P, l * 0.25, 1.1, 0.1, 0.19));             // calombo do olho
      corpo.add(bola(G.esfera, M.branco, l * 0.25, 1.13, 0.2, 0.15));     // olho
      const pup = bola(G.esfera, M.pupila, l * 0.25, 1.14, 0.33, 0.075);
      corpo.add(pup);
      (this.pupilas ||= []).push(pup);
      corpo.add(bola(G.esferaBaixa, M.branco, l * 0.22, 1.19, 0.37, 0.025)); // brilho do olho
      corpo.add(bola(G.esferaBaixa, M.bochecha, l * 0.33, 0.8, 0.36, 0.08, 0.05, 0.03));
      corpo.add(bola(G.esfera, P, l * 0.34, 0.07, 0.22, 0.26, 0.09, 0.26)); // pe
    }
    const boca = new THREE.Mesh(G.boca, M.boca);
    boca.position.set(0, 0.87, 0.46);
    corpo.add(boca);

    // bracinhos com maozinha (pivo no ombro)
    this.bracos = [-1, 1].map((l) => {
      const pivo = new THREE.Group();
      pivo.position.set(l * 0.44, 0.6, 0.12);
      pivo.add(new THREE.Mesh(G.braco, P));
      pivo.add(bola(G.esfera, P, 0, 0.52, 0, 0.11, 0.1, 0.07));          // mao
      for (const d of [-1, 0, 1]) pivo.add(bola(G.esferaBaixa, B, d * 0.075, 0.63 - Math.abs(d) * 0.03, 0.02, 0.045)); // dedinhos
      corpo.add(pivo);
      return pivo;
    });

    // coroa (perereca)
    const coroa = this.coroa = new THREE.Group();
    coroa.add(new THREE.Mesh(G.coroaBase, M.ouro));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = new THREE.Mesh(G.coroaPonta, M.ouro);
      p.position.set(Math.cos(a) * 0.22, 0.11, Math.sin(a) * 0.22);
      coroa.add(p);
    }
    coroa.position.set(0, 1.26, 0.02);
    coroa.visible = false;
    corpo.add(coroa);

    // fone de ouvido (DJ)
    const fone = this.fone = new THREE.Group();
    fone.add(new THREE.Mesh(G.aro, M.fone));
    for (const l of [-1, 1]) {
      fone.add(bola(G.concha, M.fone, l * 0.5, 0, 0, 1));
      const neon = new THREE.Mesh(G.coroaBase, M.foneNeon);
      neon.rotation.z = Math.PI / 2; neon.rotation.x = 0;
      neon.position.set(l * 0.57, 0, 0); neon.scale.setScalar(0.55);
      fone.add(neon);
    }
    fone.position.set(0, 0.88, 0.0);
    fone.scale.set(1.08, 1.0, 1);
    fone.visible = false;
    corpo.add(fone);

    this.modelo.add(s);
  }

  _montaGirino() {
    const g = this.girino = new THREE.Group();
    const P = this.peleGirino;
    g.add(bola(G.esfera, P, 0, 0, 0.1, 0.36, 0.26, 0.42));                // cabecao
    for (const l of [-1, 1]) {
      g.add(bola(G.esferaBaixa, M.branco, l * 0.17, 0.15, 0.36, 0.09));
      g.add(bola(G.esferaBaixa, M.pupila, l * 0.17, 0.17, 0.43, 0.045));
    }
    this.cauda = new THREE.Mesh(G.cauda, P);
    this.cauda.scale.set(1, 0.35, 1);
    this.cauda.position.z = -0.15;
    g.add(this.cauda);
    // marolinha em volta (meio afundado na agua)
    this.onda = new THREE.Mesh(G.anel, ondaMat.clone());
    this.onda.position.y = 0.04;
    this.group.add(this.onda);
    g.position.y = -0.04; // so o topo da cabeca e os olhos ficam pra fora d'agua
    this.modelo.add(g);
  }

  _corHue() {
    if (this.user.color) {
      const m = /hsl\((\d+)/.exec(this.user.color);
      if (m) return Number(m[1]);
    }
    return corDaString(this.user.name);
  }

  get ehGirino() { return this.estagioIdx === 0 && !this.dj; }

  _aplicaEstagio() {
    const est = this.config.estagios[this.estagioIdx];
    const perereca = est.nome === 'PERERECA';
    this._escalaAlvo = (this.dj ? Math.max(1.4, est.escala) : est.escala) * 3;
    this.sapo.visible = !this.ehGirino;
    this.girino.visible = this.ehGirino;
    this.onda.visible = this.ehGirino;
    this.sombra.visible = !this.ehGirino;
    this.coroa.visible = perereca && !this.dj;
    this.fone.visible = this.dj;
    for (const p of this.pupilas) p.material = perereca ? M.pupilaPerereca : M.pupila;
  }

  // ---------------- lugar na lagoa ----------------
  sentar(slot) {
    this.slot = slot;
    slot.ocupadoPor = this.user.id;
    this.group.position.set(slot.x, 0, slot.z);
    this.group.visible = true;
    this.visivel = true;
  }

  levantar() {
    if (this.slot) { this.slot.ocupadoPor = null; this.slot = null; }
    if (!this.dj) { this.group.visible = false; this.visivel = false; }
  }

  // vira DJ (vai pra cabine) ou deixa de ser
  virarDJ(lugar) {
    if (this.slot) { this.slot.ocupadoPor = null; this.slot = null; }
    this.dj = true;
    this.lugarDJ = lugar;
    this.group.position.set(lugar.x, lugar.y, lugar.z);
    this.group.visible = true;
    this.visivel = true;
    this._pulo = 1;
    this._aplicaEstagio();
  }
  sairDJ() {
    this.dj = false;
    this.lugarDJ = null;
    this.group.position.y = 0;
    this.group.visible = false;
    this.visivel = false;
    this._aplicaEstagio();
  }

  addLikes(n) {
    this.likes += n;
    this._empolgacao = Math.min(1, this._empolgacao + 0.15 + n * 0.03);
    const novo = this._estagioPara(this.likes);
    if (novo > this.estagioIdx) {
      const virouPerereca = this.config.estagios[novo].nome === 'PERERECA'
        && this.config.estagios[this.estagioIdx].nome !== 'PERERECA';
      this.estagioIdx = novo;
      this._aplicaEstagio();
      this._pulo = 1; // pulinho de comemoracao (girino pula pra folha!)
      return { subiu: true, virouPerereca, estagio: this.config.estagios[novo].nome };
    }
    return { subiu: false };
  }

  _estagioPara(likes) {
    let idx = 0;
    for (let i = 0; i < this.config.estagios.length; i++) {
      if (likes >= this.config.estagios[i].min) idx = i;
    }
    return idx;
  }

  setRank(rank) {
    if (rank === this.rank) return;
    this.rank = rank;
    this.nomeMat.map = texturaNome(this.user.name, rank, this.cores, this.dj);
    this.nomeMat.needsUpdate = true;
  }
  atualizaPlaca() {
    this.nomeMat.map = texturaNome(this.user.name, this.rank, this.cores, this.dj);
    this.nomeMat.needsUpdate = true;
  }

  // ---------------- animacao ----------------
  // ritmo = { fase (batidas), batida (0..1) }
  update(dt, t, ritmo, cam) {
    // corpo 3D olha pra camera (so no eixo Y)
    const gp = this.group.position;
    this.modelo.rotation.y = Math.atan2(cam.position.x - gp.x, cam.position.z - gp.z);

    const alvo = this._escalaAlvo * (1 + this._pulo * 0.25);
    this._escala += (alvo - this._escala) * Math.min(1, dt * 6);
    if (this._pulo) this._pulo = Math.max(0, this._pulo - dt * 2);
    this._empolgacao = Math.max(0, this._empolgacao - dt * 0.12);
    const k = this._escala;
    this.modelo.scale.setScalar(k);

    const b = ritmo.fase + this.atraso;
    const ang = b * Math.PI;
    const forca = 0.75 + this._empolgacao * 0.5 + ritmo.batida * 0.25;

    if (this.ehGirino) return this._updateGirino(dt, t, ang, k);

    this.trocaPassoEm -= dt;
    if (this.trocaPassoEm <= 0) {
      this.passo = PASSOS[Math.floor(Math.random() * PASSOS.length)];
      this.trocaPassoEm = 6 + Math.random() * 10;
    }

    const quique = Math.abs(Math.sin(ang));
    let sobe = quique * 0.12 * forca;
    let ginga = Math.sin(ang) * 0.14 * forca;
    let estica = 1 + (quique - 0.5) * 0.1 * forca;
    let bracoE, bracoD, cabeca = 0, frenteD = 0;

    const passo = this.dj ? 'dj' : this.passo;
    switch (passo) {
      case 'dj': {
        // uma mao no fone, a outra "arranhando" o disco; cabeca balancando
        bracoE = 0.28 + Math.sin(ang * 2) * 0.05;
        bracoD = -0.45 + Math.sin(ang * 2) * 0.3;
        frenteD = 1.15 + Math.sin(ang * 2) * 0.2;
        cabeca = Math.sin(ang) * 0.12;
        ginga *= 0.5;
        break;
      }
      case 'maosPraCima': { const s = Math.sin(ang) * 0.55; bracoE = 0.35 + s; bracoD = -0.35 + s; break; }
      case 'tchauTchau': { const s = Math.sin(ang * 2) * 0.6; bracoE = 0.5 + s; bracoD = -1.6 + Math.sin(ang) * 0.3; break; }
      case 'remexe': { bracoE = 0.5 + Math.sin(ang) * 0.9; bracoD = -0.5 + Math.sin(ang) * 0.9; ginga *= 1.6; break; }
      default: { // pulinho
        sobe = Math.max(0, Math.sin(ang)) * 0.3 * forca;
        bracoE = 0.9 + quique * 0.6; bracoD = -0.9 - quique * 0.6;
        estica = 1 + Math.sin(ang) * 0.1;
        break;
      }
    }

    this.corpo.scale.set(1 / Math.sqrt(estica), estica, 1 / Math.sqrt(estica));
    this.corpo.position.y = sobe + this._pulo * 0.35;
    this.corpo.rotation.z = ginga;
    this.corpo.rotation.x = cabeca;
    this.bracos[0].rotation.z = bracoE;
    this.bracos[1].rotation.z = bracoD;
    this.bracos[1].rotation.x = frenteD;

    // sombra encolhe quando o sapo pula
    const alt = this.corpo.position.y;
    this.sombra.scale.setScalar(k * (0.6 - alt * 0.25));
    sombraMat.opacity = 0.5;

    const topo = (this.corpo.position.y + 1.45) * k;
    this.avatar.position.y = topo + 0.65;
    this.nome.position.y = this.avatar.position.y + 1.0;
  }

  _updateGirino(dt, t, ang, k) {
    // nada em volta da folha, rebolando o rabinho
    this._nado += dt * 0.6;
    const r = (this.slot ? this.slot.tam * 0.55 : 1.5) + 0.3;
    const cx = this.slot ? this.slot.x : this.group.position.x;
    const cz = this.slot ? this.slot.z : this.group.position.z;
    const x = cx + Math.cos(this._nado) * r, z = cz + Math.sin(this._nado) * r;
    this.group.position.set(x, 0, z);
    // girino olha pra onde nada, mas meio virado pra camera
    this.girino.rotation.y = 0;
    this.cauda.rotation.y = Math.sin(t * 9 + this._nado) * 0.45;
    this.girino.position.y = -0.04 + Math.sin(ang) * 0.025;
    // marolinha pulsando
    this._onda = (this._onda + dt * 0.7) % 1;
    this.onda.scale.setScalar(k * (0.35 + this._onda * 0.45));
    this.onda.material.opacity = 0.5 * (1 - this._onda);

    this.avatar.position.y = k * 0.45 + 0.5;
    this.nome.position.y = this.avatar.position.y + 0.95;
  }

  destruir() {
    this.dj = false;
    this.levantar();
    this.group.removeFromParent();
    this.pele.dispose(); this.barriga.dispose(); this.peleGirino.dispose();
    this.onda.material.dispose();
    this.avatarMat.dispose();
    this.nomeMat.dispose();
  }
}
