// overlay/src/frog.js
// Um sapo = um espectador. Fica numa vitoria-regia, mostra avatar + nome +
// rank, cresce com likes e danca. Billboard (sempre virado pra camera).
import * as THREE from 'three';
import { texturaSapo, texturaAvatar, texturaNome, corDaString } from './assets.js';

export class Sapo {
  constructor(user, cores, config) {
    this.user = user;
    this.cores = cores;
    this.config = config;
    this.likes = 0;
    this.estagioIdx = 0;
    this.rank = null;
    this.slot = null;
    this.fase = Math.random() * Math.PI * 2; // pra dancar fora de sincronia
    this.hue = user.color ? null : corDaString(user.name);
    this.visivel = false;

    this.group = new THREE.Group();

    // sapo
    this.sapoMat = new THREE.SpriteMaterial({ map: this._texSapo(false), transparent: true });
    this.sapoSprite = new THREE.Sprite(this.sapoMat);
    this.sapoSprite.scale.set(3, 3, 1);
    this.sapoSprite.position.y = 1.4;
    this.group.add(this.sapoSprite);

    // avatar (circulo com a foto)
    this.avatarMat = new THREE.SpriteMaterial({ map: texturaAvatar(user), transparent: true });
    this.avatarSprite = new THREE.Sprite(this.avatarMat);
    this.avatarSprite.scale.set(1.1, 1.1, 1);
    this.avatarSprite.position.y = 3.3;
    this.group.add(this.avatarSprite);

    // placa de nome
    this.nomeMat = new THREE.SpriteMaterial({ map: texturaNome(user.name, null, cores), transparent: true });
    this.nomeSprite = new THREE.Sprite(this.nomeMat);
    this.nomeSprite.scale.set(4, 1, 1);
    this.nomeSprite.position.y = 4.3;
    this.group.add(this.nomeSprite);

    this._aplicaEscala();
  }

  _corHue() {
    if (this.hue != null) return this.hue;
    // deriva hue da cor hsl do demo
    const m = /hsl\((\d+)/.exec(this.user.color || '');
    return m ? Number(m[1]) : 120;
  }

  _texSapo(perereca) { return texturaSapo(this._corHue(), perereca); }

  _aplicaEscala() {
    const est = this.config.estagios[this.estagioIdx];
    this._escalaAlvo = est.escala * 3;
  }

  sentar(slot) {
    this.slot = slot;
    slot.ocupadoPor = this.user.id;
    this.group.position.set(slot.x, 0, slot.z);
    this.visivel = true;
  }

  levantar() {
    if (this.slot) { this.slot.ocupadoPor = null; this.slot = null; }
    this.visivel = false;
  }

  addLikes(n) {
    this.likes += n;
    const novo = this._estagioPara(this.likes);
    if (novo > this.estagioIdx) {
      const virouPerereca = this.config.estagios[novo].nome === 'PERERECA'
        && this.config.estagios[this.estagioIdx].nome !== 'PERERECA';
      this.estagioIdx = novo;
      this.sapoMat.map = this._texSapo(this.config.estagios[novo].nome === 'PERERECA');
      this.sapoMat.needsUpdate = true;
      this._aplicaEscala();
      this._pulo = 1; // pulinho de comemoracao
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
    this.nomeMat.map = texturaNome(this.user.name, rank, this.cores);
    this.nomeMat.needsUpdate = true;
  }

  // animacao de danca + crescimento suave
  update(dt, t) {
    this.fase += dt * 4;
    // cresce suave ate a escala alvo
    const atual = this.sapoSprite.scale.x;
    const alvo = this._escalaAlvo + (this._pulo ? this._pulo * 0.8 : 0);
    const k = atual + (alvo - atual) * Math.min(1, dt * 6);
    this.sapoSprite.scale.set(k, k, 1);
    if (this._pulo) this._pulo = Math.max(0, this._pulo - dt * 2);

    // danca: sobe/desce + inclina
    const bob = Math.sin(this.fase) * 0.18;
    this.sapoSprite.position.y = 1.4 + k / 3 + Math.abs(bob);
    this.sapoMat.rotation = Math.sin(this.fase * 0.5) * 0.12;
    // avatar e nome acompanham a altura do sapo
    this.avatarSprite.position.y = 2.1 + k * 0.7;
    this.nomeSprite.position.y = this.avatarSprite.position.y + 1.0;
  }

  destruir() {
    this.levantar();
    this.group.removeFromParent();
    this.sapoMat.dispose();
    this.avatarMat.dispose();
    this.nomeMat.dispose();
  }
}
