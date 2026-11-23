import * as THREE from 'three';

export interface ProceduralMaterialTextures {
  stoneAlbedo: THREE.CanvasTexture;
  stoneNormal: THREE.CanvasTexture;
  stoneRoughness: THREE.CanvasTexture;
  woodAlbedo: THREE.CanvasTexture;
  woodNormal: THREE.CanvasTexture;
  woodRoughness: THREE.CanvasTexture;
  damascusAlbedo: THREE.CanvasTexture;
  damascusNormal: THREE.CanvasTexture;
  damascusRoughness: THREE.CanvasTexture;
  forgedIronAlbedo: THREE.CanvasTexture;
  forgedIronNormal: THREE.CanvasTexture;
  coalAlbedo: THREE.CanvasTexture;
  coalEmissive: THREE.CanvasTexture;
  terrainAlbedo: THREE.CanvasTexture;
  terrainNormal: THREE.CanvasTexture;
  waterNormal: THREE.CanvasTexture;
  parchmentMap: THREE.CanvasTexture;
  softParticle: THREE.CanvasTexture;
  cedarFoliage: THREE.CanvasTexture;
  barkAlbedo: THREE.CanvasTexture;
  barkNormal: THREE.CanvasTexture;
}

function seededNoise(x: number, y: number, seed = 1337): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed = 1337): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = seededNoise(ix, iy, seed);
  const b = seededNoise(ix + 1, iy, seed);
  const c = seededNoise(ix, iy + 1, seed);
  const d = seededNoise(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, octaves = 4, seed = 1337): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq, seed + i * 19);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

function heightFieldToNormalCanvas(
  heights: Float32Array,
  size: number,
  strength: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const sample = (x: number, y: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    return heights[wy * size + wx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dX = tr + 2 * r + br - (tl + 2 * l + bl);
      const dY = bl + 2 * b + br - (tl + 2 * t + tr);

      let nx = -dX * strength;
      let ny = -dY * strength;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralMaterialTextures {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // 1. Cut Ashlar Stone (Kesme Taş Duvar)
  const stoneSize = 256;
  const stoneHeights = new Float32Array(stoneSize * stoneSize);
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = stoneSize;
  stoneCanvas.height = stoneSize;
  const sCtx = stoneCanvas.getContext('2d')!;
  const sImg = sCtx.createImageData(stoneSize, stoneSize);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = stoneSize;
  roughCanvas.height = stoneSize;
  const srCtx = roughCanvas.getContext('2d')!;
  const srImg = srCtx.createImageData(stoneSize, stoneSize);

  const rows = 4;
  const cols = 3;
  const rowH = stoneSize / rows;
  const colW = stoneSize / cols;

  for (let y = 0; y < stoneSize; y++) {
    const row = Math.floor(y / rowH);
    const localY = y - row * rowH;
    const xOffset = (row % 2) * (colW * 0.5);

    for (let x = 0; x < stoneSize; x++) {
      const shiftedX = (x + xOffset) % stoneSize;
      const col = Math.floor(shiftedX / colW);
      const localX = shiftedX - col * colW;

      const mortarX = Math.min(localX, colW - localX);
      const mortarY = Math.min(localY, rowH - localY);
      const mortarDist = Math.min(mortarX, mortarY);
      const isMortar = mortarDist < 3.5;

      const blockSeed = row * 17 + col * 31;
      const blockTint = (seededNoise(col, row, 42) - 0.5) * 18;
      const n = fbm(x * 0.06, y * 0.06, 4, blockSeed);
      const micro = fbm(x * 0.25, y * 0.25, 2, 99);

      const bevel = Math.min(1, Math.max(0, (mortarDist - 2.5) / 6));
      const h = isMortar ? 0.15 + micro * 0.08 : 0.45 + bevel * 0.35 + n * 0.22 + micro * 0.08;
      stoneHeights[y * stoneSize + x] = h;

      const idx = (y * stoneSize + x) * 4;
      if (isMortar) {
        const m = 64 + micro * 22;
        sImg.data[idx] = m * 0.96;
        sImg.data[idx + 1] = m * 0.92;
        sImg.data[idx + 2] = m * 0.85;
        srImg.data[idx] = srImg.data[idx + 1] = srImg.data[idx + 2] = 240;
      } else {
        // Warm Taurus limestone & weathered granite tones
        const base = 108 + blockTint + n * 38 + micro * 16;
        sImg.data[idx] = Math.min(255, Math.max(0, base * 1.03));
        sImg.data[idx + 1] = Math.min(255, Math.max(0, base * 0.97));
        sImg.data[idx + 2] = Math.min(255, Math.max(0, base * 0.88));
        const rough = Math.round(180 + (1 - n) * 60);
        srImg.data[idx] = srImg.data[idx + 1] = srImg.data[idx + 2] = rough;
      }
      sImg.data[idx + 3] = 255;
      srImg.data[idx + 3] = 255;
    }
  }
  sCtx.putImageData(sImg, 0, 0);
  srCtx.putImageData(srImg, 0, 0);

  const stoneAlbedo = finalizeTexture(stoneCanvas, true, aniso, 2, 2);
  const stoneNormal = finalizeTexture(
    heightFieldToNormalCanvas(stoneHeights, stoneSize, 3.2),
    false,
    aniso,
    2,
    2
  );
  const stoneRoughness = finalizeTexture(roughCanvas, false, aniso, 2, 2);

  // 2. Oak Timber Planks (Ahşap)
  const woodSize = 256;
  const woodHeights = new Float32Array(woodSize * woodSize);
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = woodSize;
  woodCanvas.height = woodSize;
  const wCtx = woodCanvas.getContext('2d')!;
  const wImg = wCtx.createImageData(woodSize, woodSize);

  const woodRoughCanvas = document.createElement('canvas');
  woodRoughCanvas.width = woodSize;
  woodRoughCanvas.height = woodSize;
  const wrCtx = woodRoughCanvas.getContext('2d')!;
  const wrImg = wrCtx.createImageData(woodSize, woodSize);

  const plankCount = 4;
  const plankW = woodSize / plankCount;
  for (let y = 0; y < woodSize; y++) {
    for (let x = 0; x < woodSize; x++) {
      const plankIdx = Math.floor(x / plankW);
      const lx = x - plankIdx * plankW;
      const seam = Math.min(lx, plankW - lx) < 2.2;
      const grain = Math.sin(
        (x * 0.45 + fbm(x * 0.04, y * 0.015, 3, plankIdx * 13) * 18) * 0.9
      );
      const streak = fbm(x * 0.25, y * 0.03, 3, plankIdx * 29 + 7);
      const plankShift = (seededNoise(plankIdx, 3, 55) - 0.5) * 18;
      const h = seam ? 0.1 : 0.6 + grain * 0.14 + streak * 0.2;
      woodHeights[y * woodSize + x] = h;

      const idx = (y * woodSize + x) * 4;
      if (seam) {
        wImg.data[idx] = 28;
        wImg.data[idx + 1] = 19;
        wImg.data[idx + 2] = 12;
        wrImg.data[idx] = wrImg.data[idx + 1] = wrImg.data[idx + 2] = 235;
      } else {
        const tone = 88 + plankShift + grain * 14 + streak * 24;
        wImg.data[idx] = Math.min(255, Math.max(0, tone * 1.15));
        wImg.data[idx + 1] = Math.min(255, Math.max(0, tone * 0.78));
        wImg.data[idx + 2] = Math.min(255, Math.max(0, tone * 0.48));
        const rVal = Math.round(165 + (1 - streak) * 55);
        wrImg.data[idx] = wrImg.data[idx + 1] = wrImg.data[idx + 2] = rVal;
      }
      wImg.data[idx + 3] = 255;
      wrImg.data[idx + 3] = 255;
    }
  }
  wCtx.putImageData(wImg, 0, 0);
  wrCtx.putImageData(wrImg, 0, 0);

  const woodAlbedo = finalizeTexture(woodCanvas, true, aniso, 1, 1);
  const woodNormal = finalizeTexture(
    heightFieldToNormalCanvas(woodHeights, woodSize, 2.5),
    false,
    aniso,
    1,
    1
  );
  const woodRoughness = finalizeTexture(woodRoughCanvas, false, aniso, 1, 1);

  // 3. Damascus Watered Steel (Şam Çeliği Deseni)
  const damSize = 256;
  const damHeights = new Float32Array(damSize * damSize);
  const damCanvas = document.createElement('canvas');
  damCanvas.width = damSize;
  damCanvas.height = damSize;
  const dCtx = damCanvas.getContext('2d')!;
  const dImg = dCtx.createImageData(damSize, damSize);

  const damRoughCanvas = document.createElement('canvas');
  damRoughCanvas.width = damSize;
  damRoughCanvas.height = damSize;
  const drCtx = damRoughCanvas.getContext('2d')!;
  const drImg = drCtx.createImageData(damSize, damSize);

  for (let y = 0; y < damSize; y++) {
    for (let x = 0; x < damSize; x++) {
      const warp = fbm(x * 0.035, y * 0.025, 4, 777) * 26;
      const swirl = Math.sin((x * 0.22 + warp) * 0.65) * Math.cos((y * 0.08 + warp * 0.4) * 0.6);
      const bands = Math.sin(x * 0.35 + warp * 1.35 + swirl * 3.2);
      const fold = bands * 0.5 + 0.5;
      const crisp = Math.pow(fold, 1.4);
      damHeights[y * damSize + x] = crisp * 0.5 + 0.25;

      const idx = (y * damSize + x) * 4;
      const steelShade = 128 + crisp * 98;
      dImg.data[idx] = Math.round(steelShade * 0.94);
      dImg.data[idx + 1] = Math.round(steelShade * 0.97);
      dImg.data[idx + 2] = Math.min(255, Math.round(steelShade * 1.03));
      dImg.data[idx + 3] = 255;

      const r = Math.round(45 + (1 - crisp) * 85);
      drImg.data[idx] = drImg.data[idx + 1] = drImg.data[idx + 2] = r;
      drImg.data[idx + 3] = 255;
    }
  }
  dCtx.putImageData(dImg, 0, 0);
  drCtx.putImageData(drImg, 0, 0);

  const damascusAlbedo = finalizeTexture(damCanvas, true, aniso, 1, 2);
  const damascusNormal = finalizeTexture(
    heightFieldToNormalCanvas(damHeights, damSize, 1.8),
    false,
    aniso,
    1,
    2
  );
  const damascusRoughness = finalizeTexture(damRoughCanvas, false, aniso, 1, 2);

  // 4. Hammered Forged Iron (Dövme Demir)
  const ironSize = 256;
  const ironHeights = new Float32Array(ironSize * ironSize);
  const ironCanvas = document.createElement('canvas');
  ironCanvas.width = ironSize;
  ironCanvas.height = ironSize;
  const iCtx = ironCanvas.getContext('2d')!;
  const iImg = iCtx.createImageData(ironSize, ironSize);

  for (let y = 0; y < ironSize; y++) {
    for (let x = 0; x < ironSize; x++) {
      const dimple = fbm(x * 0.14, y * 0.14, 3, 512);
      const scale = fbm(x * 0.05, y * 0.05, 3, 811);
      ironHeights[y * ironSize + x] = dimple * 0.65 + scale * 0.35;
      const idx = (y * ironSize + x) * 4;
      const v = 54 + dimple * 36 + scale * 18;
      iImg.data[idx] = v;
      iImg.data[idx + 1] = v * 1.01;
      iImg.data[idx + 2] = v * 1.05;
      iImg.data[idx + 3] = 255;
    }
  }
  iCtx.putImageData(iImg, 0, 0);
  const forgedIronAlbedo = finalizeTexture(ironCanvas, true, aniso, 1, 1);
  const forgedIronNormal = finalizeTexture(
    heightFieldToNormalCanvas(ironHeights, ironSize, 2.4),
    false,
    aniso,
    1,
    1
  );

  // 5. Glowing Hearth Coals (Kor Halinde Odun Kömürü)
  const coalSize = 256;
  const coalCanvas = document.createElement('canvas');
  coalCanvas.width = coalSize;
  coalCanvas.height = coalSize;
  const cCtx = coalCanvas.getContext('2d')!;
  const cImg = cCtx.createImageData(coalSize, coalSize);

  const coalEmCanvas = document.createElement('canvas');
  coalEmCanvas.width = coalSize;
  coalEmCanvas.height = coalSize;
  const ceCtx = coalEmCanvas.getContext('2d')!;
  const ceImg = ceCtx.createImageData(coalSize, coalSize);

  for (let y = 0; y < coalSize; y++) {
    for (let x = 0; x < coalSize; x++) {
      const n1 = fbm(x * 0.08, y * 0.08, 4, 211);
      const n2 = fbm(x * 0.18, y * 0.18, 2, 303);
      const crack = Math.max(0, 1 - Math.abs(n1 - 0.5) * 9.5);
      const radial = Math.max(0, 1 - Math.hypot(x - 128, y - 128) / 132);
      const glow = Math.min(1, (crack * 0.85 + n2 * 0.25) * (0.35 + radial * 0.95));

      const idx = (y * coalSize + x) * 4;
      cImg.data[idx] = Math.round(24 + glow * 90);
      cImg.data[idx + 1] = Math.round(20 + glow * 26);
      cImg.data[idx + 2] = Math.round(18 + glow * 8);
      cImg.data[idx + 3] = 255;

      ceImg.data[idx] = Math.round(glow * 255);
      ceImg.data[idx + 1] = Math.round(Math.pow(glow, 1.55) * 165);
      ceImg.data[idx + 2] = Math.round(Math.pow(glow, 2.8) * 55);
      ceImg.data[idx + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  ceCtx.putImageData(ceImg, 0, 0);
  const coalAlbedo = finalizeTexture(coalCanvas, true, aniso, 1, 1);
  const coalEmissive = finalizeTexture(coalEmCanvas, true, aniso, 1, 1);

  // 6. Terrain Rock & Alpine Soil
  const terrSize = 256;
  const terrHeights = new Float32Array(terrSize * terrSize);
  const terrCanvas = document.createElement('canvas');
  terrCanvas.width = terrSize;
  terrCanvas.height = terrSize;
  const tCtx = terrCanvas.getContext('2d')!;
  const tImg = tCtx.createImageData(terrSize, terrSize);

  for (let y = 0; y < terrSize; y++) {
    for (let x = 0; x < terrSize; x++) {
      const n = fbm(x * 0.06, y * 0.06, 4, 909);
      const pebble = fbm(x * 0.24, y * 0.24, 2, 111);
      terrHeights[y * terrSize + x] = n * 0.65 + pebble * 0.35;
      const idx = (y * terrSize + x) * 4;
      const v = 90 + n * 48 + pebble * 24;
      tImg.data[idx] = Math.min(255, Math.round(v * 1.02));
      tImg.data[idx + 1] = Math.min(255, Math.round(v * 0.98));
      tImg.data[idx + 2] = Math.min(255, Math.round(v * 0.88));
      tImg.data[idx + 3] = 255;
    }
  }
  tCtx.putImageData(tImg, 0, 0);
  const terrainAlbedo = finalizeTexture(terrCanvas, true, aniso, 24, 24);
  const terrainNormal = finalizeTexture(
    heightFieldToNormalCanvas(terrHeights, terrSize, 2.8),
    false,
    aniso,
    24,
    24
  );

  // 7. Flowing Mountain Stream Normal Map
  const watSize = 256;
  const watHeights = new Float32Array(watSize * watSize);
  for (let y = 0; y < watSize; y++) {
    for (let x = 0; x < watSize; x++) {
      const w1 = Math.sin((x / watSize) * Math.PI * 8 + fbm(x * 0.05, y * 0.05, 3, 62) * 3);
      const w2 = Math.cos((y / watSize) * Math.PI * 10 + fbm(x * 0.08, y * 0.08, 2, 84) * 2.5);
      watHeights[y * watSize + x] = 0.5 + w1 * 0.25 + w2 * 0.25;
    }
  }
  const waterNormal = finalizeTexture(
    heightFieldToNormalCanvas(watHeights, watSize, 1.8),
    false,
    aniso,
    3,
    14
  );

  // 8. Parchment Map Texture for 3D Wooden Table
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = 512;
  mapCanvas.height = 384;
  const mCtx = mapCanvas.getContext('2d')!;
  const grad = mCtx.createRadialGradient(256, 192, 40, 256, 192, 320);
  grad.addColorStop(0, '#e5d4b0');
  grad.addColorStop(1, '#c3a877');
  mCtx.fillStyle = grad;
  mCtx.fillRect(0, 0, 512, 384);
  mCtx.strokeStyle = '#5a3d24';
  mCtx.lineWidth = 3;
  mCtx.strokeRect(18, 18, 476, 348);
  // Ink contour river & pass line
  mCtx.strokeStyle = '#3b6478';
  mCtx.lineWidth = 4;
  mCtx.beginPath();
  mCtx.moveTo(40, 280);
  mCtx.bezierCurveTo(180, 250, 290, 180, 470, 120);
  mCtx.stroke();
  mCtx.strokeStyle = '#4e331c';
  mCtx.setLineDash([8, 6]);
  mCtx.lineWidth = 2.5;
  mCtx.beginPath();
  mCtx.moveTo(110, 95);
  mCtx.lineTo(255, 210);
  mCtx.lineTo(410, 310);
  mCtx.stroke();
  mCtx.setLineDash([]);
  // Wax seal
  mCtx.fillStyle = '#991b1b';
  mCtx.beginPath();
  mCtx.arc(255, 210, 16, 0, Math.PI * 2);
  mCtx.fill();
  const parchmentMap = finalizeTexture(mapCanvas, true, aniso, 1, 1);
  parchmentMap.wrapS = THREE.ClampToEdgeWrapping;
  parchmentMap.wrapT = THREE.ClampToEdgeWrapping;

  // 9. Soft Radial Particle Sprite (Sparks / Smoke / Steam)
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 128;
  pCanvas.height = 128;
  const pCtx = pCanvas.getContext('2d')!;
  const pGrad = pCtx.createRadialGradient(64, 64, 2, 64, 64, 62);
  pGrad.addColorStop(0, 'rgba(255,255,255,1)');
  pGrad.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  pGrad.addColorStop(1, 'rgba(255,255,255,0)');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 128, 128);
  const softParticle = new THREE.CanvasTexture(pCanvas);
  softParticle.colorSpace = THREE.SRGBColorSpace;
  softParticle.needsUpdate = true;

  // 10. Taurus Cedar Foliage Texture
  const folCanvas = document.createElement('canvas');
  folCanvas.width = 256;
  folCanvas.height = 256;
  const fCtx = folCanvas.getContext('2d')!;
  fCtx.fillStyle = '#223622';
  fCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 650; i++) {
    const x = seededNoise(i, 1, 11) * 256;
    const y = seededNoise(i, 2, 22) * 256;
    const len = 8 + seededNoise(i, 3, 33) * 14;
    const ang = seededNoise(i, 4, 44) * Math.PI * 2;
    const g = 55 + Math.floor(seededNoise(i, 5, 55) * 44);
    fCtx.strokeStyle = `rgb(${Math.round(g * 0.45)}, ${g}, ${Math.round(g * 0.48)})`;
    fCtx.lineWidth = 2;
    fCtx.beginPath();
    fCtx.moveTo(x, y);
    fCtx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    fCtx.stroke();
  }
  const cedarFoliage = finalizeTexture(folCanvas, true, aniso, 2, 2);

  // 11. Cedar Bark
  const barkSize = 128;
  const barkHeights = new Float32Array(barkSize * barkSize);
  const barkCanvas = document.createElement('canvas');
  barkCanvas.width = barkSize;
  barkCanvas.height = barkSize;
  const bCtx = barkCanvas.getContext('2d')!;
  const bImg = bCtx.createImageData(barkSize, barkSize);
  for (let y = 0; y < barkSize; y++) {
    for (let x = 0; x < barkSize; x++) {
      const furrow = Math.sin(x * 0.45 + fbm(x * 0.1, y * 0.04, 3, 66) * 6);
      const rough = fbm(x * 0.2, y * 0.08, 3, 77);
      barkHeights[y * barkSize + x] = furrow * 0.4 + rough * 0.6;
      const idx = (y * barkSize + x) * 4;
      const c = 56 + furrow * 14 + rough * 22;
      bImg.data[idx] = Math.max(0, Math.round(c * 1.15));
      bImg.data[idx + 1] = Math.max(0, Math.round(c * 0.85));
      bImg.data[idx + 2] = Math.max(0, Math.round(c * 0.68));
      bImg.data[idx + 3] = 255;
    }
  }
  bCtx.putImageData(bImg, 0, 0);
  const barkAlbedo = finalizeTexture(barkCanvas, true, aniso, 2, 3);
  const barkNormal = finalizeTexture(
    heightFieldToNormalCanvas(barkHeights, barkSize, 2.5),
    false,
    aniso,
    2,
    3
  );

  return {
    stoneAlbedo,
    stoneNormal,
    stoneRoughness,
    woodAlbedo,
    woodNormal,
    woodRoughness,
    damascusAlbedo,
    damascusNormal,
    damascusRoughness,
    forgedIronAlbedo,
    forgedIronNormal,
    coalAlbedo,
    coalEmissive,
    terrainAlbedo,
    terrainNormal,
    waterNormal,
    parchmentMap,
    softParticle,
    cedarFoliage,
    barkAlbedo,
    barkNormal,
  };
}
