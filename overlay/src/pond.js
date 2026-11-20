// overlay/src/pond.js
// Monta a lagoa a noite em clima de FESTA: agua animada por shader, margem,
// vitorias-regias (slots onde os sapos sentam) e o jogo de luzes:
// canhoes de luz varrendo, manchas coloridas na agua, globo espelhado,
// cordao de lanternas redondas e vagalumes. Tudo pulsa com a batida.
// Nada de quadrado: so circulo, cone e brilho redondo.
import * as THREE from 'three';
import { texturaFolha, texturaBrilho } from './assets.js';

export function criarLagoa(scene, cores, festa) {
  const paleta = festa.luzes.map((c) => new THREE.Color(c));
  const brilhoTex = texturaBrilho();
  const intens = festa.intensidade ?? 1;

  // ----- CEU NOTURNO -----
  scene.background = new THREE.Color('#050b16');
  scene.fog = new THREE.Fog('#071425', 34, 80);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topo: { value: new THREE.Color('#120a2e') },
      meio: { value: new THREE.Color('#0d2a3a') },
      base: { value: new THREE.Color(cores.aguaFundo) }
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `varying vec3 vP; uniform vec3 topo; uniform vec3 meio; uniform vec3 base;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
      void main(){
        float y = vP.y;
        vec3 col = mix(base, meio, smoothstep(-0.1, 0.15, y));
        col = mix(col, topo, smoothstep(0.15, 0.7, y));
        // estrelinhas
        vec3 q = floor(vP * 260.0);
        float s = step(0.996, h(q)) * smoothstep(0.05, 0.4, y);
        col += s * 0.8;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), skyMat));

  // ----- AGUA -----
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      t: { value: 0 },
      batida: { value: 0 },
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
      varying vec2 vUv; varying float vWave; uniform float t; uniform float batida;
      uniform vec3 c1; uniform vec3 c2; uniform vec3 cfundo;
      void main(){
        vec2 uv = vUv*2.0-1.0;
        float d = length(uv);
        float ripple = sin(d*22.0 - t*2.5)*0.5+0.5;
        vec3 col = mix(c1, c2, ripple*0.45 + vWave*1.2 + 0.15) * 0.7;
        col = mix(col, cfundo, smoothstep(0.7,1.0,d));
        float spark = smoothstep(0.985,1.0, sin(uv.x*40.0+t*3.0)*sin(uv.y*40.0-t*2.0));
        col += spark*(0.25 + batida*0.4);
        gl_FragColor = vec4(col, 0.97);
      }`
  });
  waterMat.side = THREE.DoubleSide; // da pra ver a superficie de baixo no mergulho
  const water = new THREE.Mesh(new THREE.CircleGeometry(26, 96), waterMat);
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  // ----- MARGEM -----
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(25.5, 46, 64),
    new THREE.MeshBasicMaterial({ color: '#173d2a', side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.05;
  scene.add(ring);

  const bushMats = ['#14402a', '#1d5634', '#0f3322'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + Math.random() * 0.1;
    const r = 29 + Math.random() * 9;
    const s = 1.6 + Math.random() * 2.6;
    const bush = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), bushMats[i % 3]);
    bush.position.set(Math.cos(a) * r, s * 0.55, Math.sin(a) * r);
    scene.add(bush);
  }

  // ----- VITORIAS-REGIAS (slots em espiral) -----
  const slots = gerarSlots(40);
  const folhaTex = texturaFolha(cores);
  const padMat = new THREE.MeshBasicMaterial({ map: folhaTex, transparent: true, alphaTest: 0.1, color: '#b8c8c0', side: THREE.DoubleSide });
  const pads = [];
  for (const s of slots) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(s.tam, s.tam), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = Math.random() * Math.PI * 2;
    pad.position.set(s.x, 0.02, s.z);
    scene.add(pad);
    pads.push(pad);
  }

  // ===================== JOGO DE LUZES =====================
  const aditivo = (extra = {}) => ({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra });

  // --- canhoes de luz: cone de luz descendo + mancha redonda na agua ---
  const ALTURA_FONTE = 24;
  const feixeMat = () => new THREE.ShaderMaterial({
    ...aditivo({ side: THREE.DoubleSide }),
    uniforms: { cor: { value: new THREE.Color() }, forca: { value: 0.3 } },
    vertexShader: `
      varying float vY; varying float vEdge;
      void main(){
        vY = uv.y;
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vEdge = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vY; varying float vEdge; uniform vec3 cor; uniform float forca;
      void main(){
        float a = forca * mix(0.25, 1.0, vY) * pow(vEdge, 1.6);
        gl_FragColor = vec4(cor * a, a);
      }`
  });
  const canhoes = [];
  for (let i = 0; i < festa.canhoes; i++) {
    const ang = (i / festa.canhoes) * Math.PI * 2;
    const fonte = new THREE.Vector3(Math.cos(ang) * 18, ALTURA_FONTE, Math.sin(ang) * 18);
    // cone aberto com o bico em cima (y=+0.5) e a base embaixo, altura 1
    const geo = new THREE.ConeGeometry(1, 1, 40, 1, true).translate(0, -0.5, 0);
    const mat = feixeMat();
    const feixe = new THREE.Mesh(geo, mat);
    feixe.position.copy(fonte);
    scene.add(feixe);

    const manchaMat = new THREE.MeshBasicMaterial(aditivo({ map: brilhoTex, color: new THREE.Color(), opacity: 0.9 }));
    const mancha = new THREE.Mesh(new THREE.CircleGeometry(1, 48), manchaMat);
    mancha.rotation.x = -Math.PI / 2;
    mancha.position.y = 0.08;
    mancha.renderOrder = 2;
    scene.add(mancha);

    // "cabeca" do canhao: bolinha brilhante
    const cab = new THREE.Sprite(new THREE.SpriteMaterial(aditivo({ map: brilhoTex, color: new THREE.Color() })));
    cab.position.copy(fonte); cab.scale.setScalar(3);
    scene.add(cab);

    canhoes.push({
      fonte, feixe, mat, mancha, manchaMat, cab,
      fase: Math.random() * 10, vel: 0.25 + Math.random() * 0.25,
      corIdx: i % paleta.length, cor: paleta[i % paleta.length].clone(),
      alvo: new THREE.Vector3()
    });
  }

  // --- globo espelhado no alto ---
  const globoMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, batida: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normal; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `varying vec3 vN; varying vec3 vP; uniform float t; uniform float batida;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        // espelhinhos redondos (pontos) que piscam
        vec3 n = normalize(vN);
        float lon = atan(n.z, n.x) + t*0.6; float lat = asin(n.y);
        vec2 g = vec2(lon*9.0, lat*9.0);
        vec2 c = fract(g)-0.5; vec2 id = floor(g);
        float dot_ = smoothstep(0.42, 0.3, length(c));
        float pis = step(0.7, h(id + floor(t*4.0)));
        vec3 base = vec3(0.55,0.6,0.7) * (0.4 + 0.6*dot_);
        base += dot_ * pis * (0.8 + batida);
        gl_FragColor = vec4(base, 1.0);
      }`
  });
  const globo = new THREE.Mesh(new THREE.SphereGeometry(1.8, 32, 20), globoMat);
  globo.position.set(0, 21, 0);
  scene.add(globo);
  const globoHalo = new THREE.Sprite(new THREE.SpriteMaterial(aditivo({ map: brilhoTex, color: '#cfe8ff', opacity: 0.6 })));
  globoHalo.position.copy(globo.position); globoHalo.scale.setScalar(10);
  scene.add(globoHalo);

  // --- cordoes de lanternas redondas em volta da lagoa ---
  const lanternas = [];
  const POSTES = 10, POR_VAO = 7, R_CORDAO = 26.5;
  for (let p = 0; p < POSTES; p++) {
    const a0 = (p / POSTES) * Math.PI * 2, a1 = ((p + 1) / POSTES) * Math.PI * 2;
    for (let j = 1; j < POR_VAO; j++) {
      const f = j / POR_VAO;
      const a = a0 + (a1 - a0) * f;
      const y = 9 - Math.sin(f * Math.PI) * 1.8; // barriguinha do cordao
      const cor = paleta[(p * POR_VAO + j) % paleta.length];
      const bola = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshBasicMaterial({ color: cor }));
      bola.position.set(Math.cos(a) * R_CORDAO, y, Math.sin(a) * R_CORDAO);
      scene.add(bola);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial(aditivo({ map: brilhoTex, color: cor, opacity: 0.7 })));
      halo.position.copy(bola.position); halo.scale.setScalar(2.6);
      scene.add(halo);
      lanternas.push({ halo, fase: (p * POR_VAO + j) * 0.7 });
    }
  }

  // --- vagalumes / bokeh flutuando ---
  const N = festa.vagalumes;
  const vgGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const vgInfo = [];
  for (let i = 0; i < N; i++) {
    const r = Math.sqrt(Math.random()) * 26, a = Math.random() * Math.PI * 2;
    const info = { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 1 + Math.random() * 12, f: Math.random() * 10, v: 0.3 + Math.random() * 0.6 };
    vgInfo.push(info);
    const c = paleta[i % paleta.length].clone().lerp(new THREE.Color('#fff7c2'), 0.5);
    col.set([c.r, c.g, c.b], i * 3);
  }
  vgGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  vgGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const vgMat = new THREE.PointsMaterial(aditivo({ map: brilhoTex, size: 0.9, vertexColors: true, sizeAttenuation: true, opacity: 0.85 }));
  const vagalumes = new THREE.Points(vgGeo, vgMat);
  vagalumes.frustumCulled = false;
  scene.add(vagalumes);

  // --- luzes de verdade (iluminam os sapos 3D) ---
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  scene.add(new THREE.HemisphereLight('#bcd8ff', '#1e4a30', 1.4));
  const chave = new THREE.DirectionalLight('#fff1dd', 2.0);
  chave.position.set(10, 24, 14);
  scene.add(chave);
  // cada canhao tambem joga luz colorida de verdade nos sapos
  for (const c of canhoes) {
    c.luz = new THREE.PointLight(c.cor, 30, 24, 1.3);
    scene.add(c.luz);
  }

  // ===================== FUNDO DO LAGO (vista do mergulho) =====================
  const fundo = criarFundo(scene, paleta);

  // ===================== CABINE DO DJ (no centro) =====================
  const cabine = criarCabine(scene, paleta);

  // ===================== ANIMACAO =====================
  // ritmo = { fase: batidas desde o inicio, batida: 0..1 (pulso) }
  // f: 0 = camera em cima, 1 = camera no fundo do lago
  const corCeu = new THREE.Color('#050b16'), corFundo = new THREE.Color('#0d4f5c');
  const neblinaCima = new THREE.Color('#071425');
  function submerso(f) {
    scene.background.copy(corCeu).lerp(corFundo, f);
    scene.fog.color.copy(neblinaCima).lerp(corFundo, f);
    scene.fog.near = 34 - f * 32;
    scene.fog.far = 80 - f * 50;
    fundo.visivel(f);
  }

  function update(t, dt, ritmo, cam) {
    cabine.update(t, dt, ritmo, cam);
    fundo.update(t, dt);
    const pulso = ritmo.batida;
    waterMat.uniforms.t.value = t;
    waterMat.uniforms.batida.value = pulso;
    globoMat.uniforms.t.value = t;
    globoMat.uniforms.batida.value = pulso;
    globo.rotation.y = t * 0.4;
    globoHalo.material.opacity = (0.35 + pulso * 0.5) * intens;

    const compasso = Math.floor(ritmo.fase / 4); // muda de cor a cada 4 batidas
    for (let i = 0; i < canhoes.length; i++) {
      const c = canhoes[i];
      c.fase += dt * c.vel;
      // alvo andando em curva suave (lissajous) dentro da lagoa
      const r = 6 + Math.sin(c.fase * 0.7 + i) * 8;
      const a = c.fase + i * 1.3;
      c.alvo.set(Math.cos(a) * r, 0, Math.sin(a * 1.3) * r);

      const alvoCor = paleta[(c.corIdx + compasso) % paleta.length];
      c.cor.lerp(alvoCor, Math.min(1, dt * 3));

      // orienta o cone: do bico (fonte) ate a mancha
      const dir = new THREE.Vector3().subVectors(c.alvo, c.fonte);
      const len = dir.length();
      dir.normalize();
      c.feixe.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
      const raio = 3.2 + pulso * 0.8;
      c.feixe.scale.set(raio, len, raio);
      c.mat.uniforms.cor.value.copy(c.cor);
      c.mat.uniforms.forca.value = (0.16 + pulso * 0.22) * intens;

      c.mancha.position.x = c.alvo.x; c.mancha.position.z = c.alvo.z;
      c.mancha.scale.setScalar(raio * 1.5);
      c.manchaMat.color.copy(c.cor);
      c.manchaMat.opacity = (0.45 + pulso * 0.45) * intens;
      c.cab.material.color.copy(c.cor);
      c.luz.color.copy(c.cor);
      c.luz.position.set(c.alvo.x, 5, c.alvo.z);
      c.luz.intensity = (22 + pulso * 40) * intens;
    }

    for (const l of lanternas) {
      const s = 0.55 + 0.45 * Math.sin(t * 2 + l.fase);
      l.halo.material.opacity = (0.35 + s * 0.35 + pulso * 0.3) * intens;
      l.halo.scale.setScalar(2.2 + pulso * 1.2);
    }

    for (let i = 0; i < N; i++) {
      const v = vgInfo[i];
      v.f += dt * v.v;
      pos[i * 3] = v.x + Math.sin(v.f * 0.9) * 1.2;
      pos[i * 3 + 1] = v.y + Math.sin(v.f * 1.7) * 0.8;
      pos[i * 3 + 2] = v.z + Math.cos(v.f * 0.7) * 1.2;
    }
    vgGeo.attributes.position.needsUpdate = true;
    vgMat.size = 0.8 + pulso * 0.5;
  }

  return { water, waterMat, slots, pads, update, submerso, cabine: cabine.lugar };
}

// espiral de slots dentro da lagoa (mais juntinho pro formato vertical)
function gerarSlots(n) {
  const slots = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = 7.2 + Math.sqrt(i / n) * 12;
    const a = i * golden;
    slots.push({
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      tam: 3.4 + (1 - r / 19) * 1.2,
      ocupadoPor: null
    });
  }
  return slots;
}

// ---- CABINE DO DJ: palco redondo com neon, mesa arredondada, 2 toca-discos
// e caixas de som que pulsam. A mesa sempre vira pra camera.
function criarCabine(scene, paleta) {
  const grupo = new THREE.Group();
  scene.add(grupo);
  const ALT = 0.8;

  const palcoMat = new THREE.MeshStandardMaterial({ color: '#3a2266', roughness: 0.35, metalness: 0.35 });
  const palco = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, ALT, 56), palcoMat);
  palco.position.y = ALT / 2 - 0.05;
  grupo.add(palco);
  const neonMat = new THREE.MeshStandardMaterial({ color: '#ff4d9d', emissive: '#ff4d9d', emissiveIntensity: 1.6 });
  const neon = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.09, 10, 80), neonMat);
  neon.rotation.x = Math.PI / 2; neon.position.y = ALT - 0.02;
  grupo.add(neon);

  // parte que gira pra camera
  const frente = new THREE.Group();
  grupo.add(frente);
  const mesaMat = new THREE.MeshStandardMaterial({ color: '#25183f', roughness: 0.3, metalness: 0.5 });
  const mesa = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 3.4, 8, 20), mesaMat);
  mesa.rotation.z = Math.PI / 2;
  mesa.position.set(0, ALT + 0.75, 2.9);
  frente.add(mesa);
  const faixaMat = new THREE.MeshStandardMaterial({ color: '#4dd2ff', emissive: '#4dd2ff', emissiveIntensity: 1.3 });
  const faixa = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 3.4, 4, 12), faixaMat);
  faixa.rotation.z = Math.PI / 2;
  faixa.position.set(0, ALT + 0.6, 3.46);
  frente.add(faixa);

  const discos = [];
  for (const l of [-1, 1]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.12, 36), new THREE.MeshStandardMaterial({ color: '#d7d9e6', metalness: 0.8, roughness: 0.25 }));
    base.position.set(l * 1.15, ALT + 1.3, 2.9);
    frente.add(base);
    const disco = new THREE.Group();
    disco.add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.05, 36), new THREE.MeshStandardMaterial({ color: '#15151c', roughness: 0.2, metalness: 0.3 })));
    const selo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24), new THREE.MeshStandardMaterial({ color: paleta[l > 0 ? 0 : 1], emissive: paleta[l > 0 ? 0 : 1], emissiveIntensity: 0.8 }));
    disco.add(selo);
    const risco = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    risco.position.set(0.45, 0.04, 0);
    disco.add(risco);
    disco.position.set(l * 1.15, ALT + 1.38, 2.9);
    frente.add(disco);
    discos.push(disco);
  }

  // caixas de som redondas (cilindros) com alto-falante pulsando
  const falantes = [];
  for (const l of [-1, 1]) {
    const cx = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 3.0, 32), mesaMat);
    cx.position.set(l * 3.3, ALT + 1.5, 0.4);
    frente.add(cx);
    for (const y of [0.9, -0.4]) {
      const f = new THREE.Mesh(new THREE.TorusGeometry(y > 0 ? 0.42 : 0.6, 0.09, 10, 32), new THREE.MeshStandardMaterial({ color: paleta[2], emissive: paleta[2], emissiveIntensity: 1.2 }));
      f.position.set(l * 3.3, ALT + 1.5 + y, 1.33);
      frente.add(f);
      falantes.push(f);
    }
  }

  const luzCabine = new THREE.PointLight('#ffffff', 25, 14, 1.3);
  luzCabine.position.set(0, ALT + 6, 2);
  grupo.add(luzCabine);

  const lugar = { x: 0, y: ALT, z: 0 };
  const cor = new THREE.Color();
  function update(t, dt, ritmo, cam) {
    frente.rotation.y = Math.atan2(cam.position.x, cam.position.z);
    for (const d of discos) d.rotation.y -= dt * 3.5;
    const p = ritmo.batida;
    for (const f of falantes) f.scale.setScalar(1 + p * 0.25);
    cor.copy(paleta[Math.floor(ritmo.fase / 2) % paleta.length]);
    neonMat.color.copy(cor); neonMat.emissive.copy(cor);
    neonMat.emissiveIntensity = 1.1 + p * 1.5;
    luzCabine.color.copy(cor);
    luzCabine.intensity = 15 + p * 30;
  }
  return { lugar, update };
}

// ---- FUNDO DO LAGO: areia com luz dancando (caustica), algas balancando e
// bolhas subindo. So aparece quando a camera mergulha.
function criarFundo(scene, paleta) {
  const grupo = new THREE.Group();
  grupo.visible = false;
  scene.add(grupo);
  const PROF = -5;

  const chaoMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `varying vec2 vP; uniform float t;
      void main(){
        vec2 p = vP * 0.35;
        float c = 0.0;
        for (int i = 0; i < 3; i++) {
          float fi = float(i);
          c += abs(sin(p.x * (1.3 + fi*0.4) + t * (0.6 + fi*0.2) + sin(p.y*1.7 + t*0.5)) * cos(p.y * (1.1 + fi*0.3) - t*0.7));
        }
        c = pow(c / 3.0, 3.0) * 1.6;
        vec3 areia = mix(vec3(0.08,0.24,0.22), vec3(0.18,0.36,0.30), smoothstep(26.0, 0.0, length(vP)));
        gl_FragColor = vec4(areia + vec3(0.45,0.8,0.75) * c, 1.0);
      }`
  });
  const chao = new THREE.Mesh(new THREE.CircleGeometry(30, 64), chaoMat);
  chao.rotation.x = -Math.PI / 2; chao.position.y = PROF;
  grupo.add(chao);

  // pedrinhas redondas
  const pedraMat = new THREE.MeshStandardMaterial({ color: '#33554a', roughness: 0.8 });
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 20, sz = 0.4 + Math.random() * 1.1;
    const m = new THREE.Mesh(new THREE.SphereGeometry(sz, 12, 8), pedraMat);
    m.scale.y = 0.5; m.position.set(Math.cos(a) * r, PROF + sz * 0.2, Math.sin(a) * r);
    grupo.add(m);
  }

  // algas: corrente de capsulas balancando
  const algas = [];
  const algaMats = ['#1f8a4c', '#2fae5f', '#3ccf74'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, emissive: '#06301a' }));
  const gomo = new THREE.CapsuleGeometry(0.16, 0.55, 4, 8);
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2, r = 5 + Math.random() * 19;
    let pai = new THREE.Group();
    pai.position.set(Math.cos(a) * r, PROF, Math.sin(a) * r);
    grupo.add(pai);
    const segs = 4 + Math.floor(Math.random() * 4);
    const cadeia = [];
    let atual = pai;
    for (let j = 0; j < segs; j++) {
      const g = new THREE.Group();
      g.position.y = j === 0 ? 0 : 0.7;
      const m = new THREE.Mesh(gomo, algaMats[i % 3]);
      m.position.y = 0.35;
      g.add(m);
      atual.add(g);
      cadeia.push(g);
      atual = g;
    }
    algas.push({ cadeia, fase: Math.random() * 6 });
  }

  // bolhas subindo
  const N = 120;
  const bpos = new Float32Array(N * 3);
  const binfo = [];
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 22;
    binfo.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: PROF + Math.random() * 5, v: 0.6 + Math.random() * 1.2, f: Math.random() * 6 });
  }
  const bgeo = new THREE.BufferGeometry();
  bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3));
  const bolhas = new THREE.Points(bgeo, new THREE.PointsMaterial({ map: texturaBrilho(), size: 0.35, color: '#d8fbff', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  bolhas.frustumCulled = false;
  grupo.add(bolhas);

  // raios de luz entrando pela superficie
  const raioMat = new THREE.MeshBasicMaterial({ map: texturaBrilho(), color: '#9ff3ff', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const raios = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7, 24, 1, true), raioMat);
    const a = (i / 7) * Math.PI * 2, r = 6 + (i % 3) * 5;
    m.position.set(Math.cos(a) * r, -2.5, Math.sin(a) * r);
    m.rotation.z = 0.2;
    grupo.add(m);
    raios.push(m);
  }

  const luz = new THREE.PointLight('#7fe6ff', 40, 30, 1.2);
  luz.position.set(0, -1, 0);
  grupo.add(luz);

  let ligado = 0;
  function visivel(f) { ligado = f; grupo.visible = f > 0.02; raioMat.opacity = 0.12 * f; }
  function update(t, dt) {
    if (!grupo.visible) return;
    chaoMat.uniforms.t.value = t;
    for (const a of algas) a.cadeia.forEach((g, j) => { g.rotation.z = Math.sin(t * 1.3 + a.fase + j * 0.6) * 0.18; g.rotation.x = Math.cos(t * 1.1 + a.fase + j * 0.5) * 0.12; });
    for (let i = 0; i < N; i++) {
      const b = binfo[i];
      b.y += dt * b.v; b.f += dt * 3;
      if (b.y > -0.2) b.y = PROF;
      bpos[i * 3] = b.x + Math.sin(b.f) * 0.2; bpos[i * 3 + 1] = b.y; bpos[i * 3 + 2] = b.z;
    }
    bgeo.attributes.position.needsUpdate = true;
    raios.forEach((m, i) => { m.rotation.y = t * 0.1 + i; });
  }
  return { visivel, update, PROF };
}
