// overlay/src/pond.js
// Monta a lagoa: agua animada por shader, margem/cenario e as posicoes das
// vitorias-regias (slots onde os sapos sentam).
import * as THREE from 'three';
import { texturaFolha } from './assets.js';

export function criarLagoa(scene, cores) {
  // ----- CEU / FUNDO (gradiente) -----
  scene.background = new THREE.Color(cores.aguaFundo);
  scene.fog = new THREE.Fog(cores.aguaFundo, 28, 70);

  // domo de ceu simples com gradiente verde/azul
  const skyGeo = new THREE.SphereGeometry(80, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topo: { value: new THREE.Color('#2f7d5a') },
      base: { value: new THREE.Color(cores.aguaFundo) }
    },
    vertexShader: `varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `varying float vY; uniform vec3 topo; uniform vec3 base;
      void main(){ float t = clamp(vY*0.8+0.4,0.0,1.0); gl_FragColor = vec4(mix(base,topo,t),1.0);} `
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // ----- AGUA -----
  const waterGeo = new THREE.CircleGeometry(26, 96);
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      t: { value: 0 },
      c1: { value: new THREE.Color(cores.agua1) },
      c2: { value: new THREE.Color(cores.agua2) },
      cfundo: { value: new THREE.Color(cores.aguaFundo) }
    },
    vertexShader: `
      varying vec2 vUv; varying float vWave; uniform float t;
      void main(){
        vUv = uv;
        vec3 p = position;
        float w = sin(p.x*0.6 + t*1.6) * 0.15 + cos(p.y*0.5 - t*1.2) * 0.15;
        p.z += w; vWave = w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv; varying float vWave; uniform float t;
      uniform vec3 c1; uniform vec3 c2; uniform vec3 cfundo;
      void main(){
        vec2 uv = vUv*2.0-1.0;
        float d = length(uv);
        float ripple = sin(d*22.0 - t*2.5)*0.5+0.5;
        vec3 col = mix(c1, c2, ripple*0.6 + vWave*1.2 + 0.3);
        col = mix(col, cfundo, smoothstep(0.75,1.0,d));   // escurece a borda
        float spark = smoothstep(0.985,1.0, sin(uv.x*40.0+t*3.0)*sin(uv.y*40.0-t*2.0));
        col += spark*0.25;
        gl_FragColor = vec4(col, 0.96);
      }`
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  scene.add(water);

  // ----- MARGEM (anel de grama ao redor) -----
  const ringGeo = new THREE.RingGeometry(25.5, 44, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#2f8a46', side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.05;
  scene.add(ring);

  // arvores/arbustos simples na margem (cones/esferas de baixo custo)
  const bushMat = new THREE.MeshBasicMaterial({ color: '#2b7d3f' });
  const bushMat2 = new THREE.MeshBasicMaterial({ color: '#3fae5a' });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = 30 + Math.random() * 10;
    const s = 1.6 + Math.random() * 2.4;
    const bush = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), Math.random() < .5 ? bushMat : bushMat2);
    bush.position.set(Math.cos(a) * r, s * 0.6, Math.sin(a) * r);
    scene.add(bush);
  }

  // bandeirolas de festa (linha de triangulos coloridos no fundo)
  const flagColors = ['#ff4d9d', '#ffd43b', '#9dff3c', '#4dd2ff', '#ff9ed6'];
  for (let i = 0; i < 20; i++) {
    const a = -1.2 + i * 0.13;
    const tri = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 1.1, 3),
      new THREE.MeshBasicMaterial({ color: flagColors[i % flagColors.length] })
    );
    tri.position.set(Math.cos(a) * 24, 10 - Math.sin(i * 0.9) * 0.6, Math.sin(a) * 24 - 6);
    tri.rotation.z = Math.PI;
    scene.add(tri);
  }

  // ----- LUZES -----
  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(10, 20, 10);
  scene.add(sun);

  // ----- SLOTS das vitorias-regias (posicoes em espiral) -----
  const slots = gerarSlots(60);
  const folhaTex = texturaFolha(cores);
  const pads = [];
  for (const s of slots) {
    const padMat = new THREE.MeshBasicMaterial({ map: folhaTex, transparent: true });
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(s.tam, s.tam), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(s.x, 0.02, s.z);
    scene.add(pad);
    pads.push(pad);
  }

  return { water, waterMat, slots, pads };
}

// espiral de slots dentro da lagoa (raio < 24)
function gerarSlots(n) {
  const slots = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = 3 + Math.sqrt(i / n) * 20;
    const a = i * golden;
    slots.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      tam: 3.2 + (1 - r / 24) * 1.4,
      ocupadoPor: null
    });
  }
  return slots;
}
