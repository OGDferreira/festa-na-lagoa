// overlay/src/efeitos.js
// Efeitos de presente na cena 3D: chuva de confete (bolinhas e fitinhas
// redondas, nada de quadrado) e um anel de luz subindo no sapo do doador.
import * as THREE from 'three';
import { texturaBrilho } from './assets.js';

export function criarEfeitos(scene, paletaHex) {
  const paleta = paletaHex.map((c) => new THREE.Color(c));
  const MAX = 900;
  const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
  const vel = new Float32Array(MAX * 3), vida = new Float32Array(MAX);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ map: texturaBrilho(), size: 0.75, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pontos = new THREE.Points(geo, mat);
  pontos.frustumCulled = false;
  scene.add(pontos);
  for (let i = 0; i < MAX; i++) pos[i * 3 + 1] = -999;
  let prox = 0;

  // aneis de luz (glow) subindo no sapo
  const aneis = [];
  const anelMat = () => new THREE.MeshBasicMaterial({ map: texturaBrilho(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const anelGeo = new THREE.RingGeometry(0.7, 1, 48).rotateX(-Math.PI / 2);

  // confete explodindo em volta de um ponto
  function confete(centro, qtd = 160, forca = 1) {
    for (let n = 0; n < qtd; n++) {
      const i = prox; prox = (prox + 1) % MAX;
      const a = Math.random() * Math.PI * 2, el = 0.3 + Math.random() * 1.0;
      const v = (5 + Math.random() * 7) * forca;
      pos[i * 3] = centro.x; pos[i * 3 + 1] = centro.y + 1.5; pos[i * 3 + 2] = centro.z;
      vel[i * 3] = Math.cos(a) * Math.cos(el) * v;
      vel[i * 3 + 1] = Math.sin(el) * v + 4;
      vel[i * 3 + 2] = Math.sin(a) * Math.cos(el) * v;
      const c = paleta[Math.floor(Math.random() * paleta.length)];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      vida[i] = 2.2 + Math.random() * 1.5;
    }
  }

  // anel de luz que sobe e abre no sapo
  function destaque(centro, cor = '#ffd43b', escala = 1) {
    const m = new THREE.Mesh(anelGeo, anelMat());
    m.material.color.set(cor);
    m.position.set(centro.x, centro.y + 0.2, centro.z);
    scene.add(m);
    aneis.push({ m, t: 0, escala });
  }

  function update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (vida[i] <= 0) continue;
      vida[i] -= dt;
      vel[i * 3 + 1] -= 9 * dt;                 // gravidade
      vel[i * 3] *= 0.985; vel[i * 3 + 2] *= 0.985;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.1) { pos[i * 3 + 1] = 0.1; vel[i * 3 + 1] *= -0.3; }
      if (vida[i] <= 0) pos[i * 3 + 1] = -999;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    for (let j = aneis.length - 1; j >= 0; j--) {
      const a = aneis[j];
      a.t += dt;
      const f = a.t / 1.6;
      a.m.scale.setScalar((1.5 + f * 7) * a.escala);
      a.m.position.y += dt * 2.5;
      a.m.material.opacity = Math.max(0, 1 - f);
      if (f >= 1) { a.m.removeFromParent(); a.m.material.dispose(); aneis.splice(j, 1); }
    }
  }

  return { confete, destaque, update };
}
