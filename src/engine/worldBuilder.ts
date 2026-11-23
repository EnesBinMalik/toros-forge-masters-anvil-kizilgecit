import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ProceduralMaterialTextures } from './textures';
import {
  AnvilStationRig,
  BarricadeRig,
  BoulderDropRig,
  CatapultRig,
  createAnvilStation,
  createBoulderDropLever,
  createCatapultAndLever,
  createForgeStation,
  createMapTable,
  createSpikedBarricade,
  createTorosCedarParts,
  createWaterBarrel,
  ForgeStationRig,
  WaterBarrelRig,
} from './geometryBuilders';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
}

export interface WorldRefs {
  forge: ForgeStationRig;
  anvil: AnvilStationRig;
  barrel: WaterBarrelRig;
  mapTablePos: THREE.Vector3;
  catapult: CatapultRig;
  boulderLeverPos: THREE.Vector3;
  boulderDrop: BoulderDropRig;
  barricades: { gate: BarricadeRig; bridge: BarricadeRig };
  streamMesh: THREE.Mesh;
  cloudInst: THREE.InstancedMesh;
  cloudBasePositions: Float32Array;
  sunbeamsGroup: THREE.Group;
  colliders: ColliderBox[];
  bridgeBounds: { minX: number; maxX: number; minZ: number; maxZ: number; deckY: number };
  castleFloorBounds: { minX: number; maxX: number; minZ: number; maxZ: number; floorY: number };
  battlementBounds: { minX: number; maxX: number; minZ: number; maxZ: number; deckY: number };
  rampBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export function groundHeightAt(x: number, z: number): number {
  const streamCenterZ = 46 + Math.sin(x * 0.055) * 4.5;
  const distStream = Math.abs(z - streamCenterZ);

  // Smooth pass road profile: 2.0 at castle gate (z=14) -> 1.65 at bridge (z=40..52) -> 1.8 at south outpost
  let base = 2.0;
  if (z > 14 && z < 40.4) {
    const t = (z - 14) / (40.4 - 14);
    base = THREE.MathUtils.lerp(2.0, 1.65, t);
  } else if (z >= 40.4 && z <= 51.6) {
    base = 1.65;
  } else if (z > 51.6) {
    const t = Math.min(1, (z - 51.6) / 55);
    base = THREE.MathUtils.lerp(1.65, 1.85, t);
  }

  // Castle plateau mask
  const castleMask =
    1 -
    THREE.MathUtils.smoothstep(Math.max(Math.abs(x) - 13, Math.abs(z - 1) - 12), 0, 10);

  // Mountain pass road corridor
  const roadCenterX = Math.sin(Math.max(0, z - 12) * 0.035) * 4.5;
  const distRoad = Math.abs(x - roadCenterX);
  const roadFlatten = 1 - THREE.MathUtils.smoothstep(distRoad, 3.8, 12);

  // Bridge approach mask (keeps road ramps at z=38..40.5 and z=51.5..54 flush with bridge deck y=1.65)
  const nearBridgeAbutment =
    Math.abs(x - 2.5) < 4.5 && z > 37.5 && z < 54.5 && Math.abs(z - 46) > 3.6;

  // Mountain ridges rising smoothly on east/west flanks
  const valleyHalfWidth = 23 + Math.sin(z * 0.04) * 3.5;
  const flankDist = Math.max(0, Math.abs(x - roadCenterX) - valleyHalfWidth);
  const mountainNoise =
    Math.sin(x * 0.06) * Math.cos(z * 0.05) * 3.4 +
    Math.sin(x * 0.14 + z * 0.11) * 1.4;
  let ridgeHeight =
    Math.pow(flankDist * 0.095, 1.45) * 14 + Math.max(0, mountainNoise) * (1 - roadFlatten);

  if (z < -24) {
    ridgeHeight += Math.pow((-24 - z) * 0.08, 1.4) * 16;
  }
  if (z > 116) {
    ridgeHeight += Math.pow((z - 116) * 0.08, 1.4) * 14;
  }

  // Western ridge bump for Kartal Kayası watchtower (-28, -18)
  const distWatch = Math.hypot(x + 28, z + 18);
  if (distWatch < 14) {
    const wMask = 1 - THREE.MathUtils.smoothstep(distWatch, 4, 14);
    ridgeHeight = THREE.MathUtils.lerp(ridgeHeight, 8.2, wMask);
  }

  // Stream gorge carve (does not carve the bridge abutment approaches)
  const gorgeFactor = Math.abs(x) < 62 ? 1 - THREE.MathUtils.smoothstep(Math.abs(x), 42, 62) : 0;
  let streamCarve = (1 - THREE.MathUtils.smoothstep(distStream, 2.5, 7.8)) * 3.1 * gorgeFactor;
  if (nearBridgeAbutment) {
    streamCarve *= 0.08;
  }

  let h = base + ridgeHeight * (1 - castleMask) - streamCarve * (1 - castleMask);
  h = THREE.MathUtils.lerp(h, 2.0, castleMask);
  return h;
}

// Depresses terrain mesh vertices cleanly beneath the stone castle slab so zero Z-fighting ever occurs
function terrainMeshHeightAt(x: number, z: number): number {
  const h = groundHeightAt(x, z);
  const underCastle =
    1 -
    THREE.MathUtils.smoothstep(Math.max(Math.abs(x) - 10.6, Math.abs(z - 1.5) - 9.2), 0, 1.8);
  return THREE.MathUtils.lerp(h, 1.35, underCastle);
}

export function surfaceHeightAt(x: number, z: number, refs: WorldRefs): number {
  if (
    x >= refs.bridgeBounds.minX &&
    x <= refs.bridgeBounds.maxX &&
    z >= refs.bridgeBounds.minZ &&
    z <= refs.bridgeBounds.maxZ
  ) {
    const t = (z - refs.bridgeBounds.minZ) / (refs.bridgeBounds.maxZ - refs.bridgeBounds.minZ);
    const archCurve = Math.sin(t * Math.PI) * 1.02;
    return refs.bridgeBounds.deckY + archCurve;
  }

  if (
    x >= refs.rampBounds.minX &&
    x <= refs.rampBounds.maxX &&
    z >= refs.rampBounds.minZ &&
    z <= refs.rampBounds.maxZ
  ) {
    const t = THREE.MathUtils.clamp(
      (z - refs.rampBounds.minZ) / (refs.rampBounds.maxZ - refs.rampBounds.minZ),
      0,
      1
    );
    return THREE.MathUtils.lerp(2.0, refs.battlementBounds.deckY, t);
  }

  if (
    x >= refs.battlementBounds.minX &&
    x <= refs.battlementBounds.maxX &&
    z >= refs.battlementBounds.minZ &&
    z <= refs.battlementBounds.maxZ
  ) {
    return refs.battlementBounds.deckY;
  }

  return groundHeightAt(x, z);
}

function pushTransformedGeo(
  target: THREE.BufferGeometry[],
  geo: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0
): void {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  target.push(g);
}

export function buildTorosWorld(scene: THREE.Scene, tex: ProceduralMaterialTextures): WorldRefs {
  const colliders: ColliderBox[] = [];

  const stoneMat = new THREE.MeshStandardMaterial({
    map: tex.stoneAlbedo,
    normalMap: tex.stoneNormal,
    roughnessMap: tex.stoneRoughness,
    roughness: 0.86,
    metalness: 0.04,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    normalMap: tex.woodNormal,
    roughnessMap: tex.woodRoughness,
    roughness: 0.78,
    metalness: 0.05,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    map: tex.forgedIronAlbedo,
    normalMap: tex.forgedIronNormal,
    color: 0x3b4046,
    roughness: 0.44,
    metalness: 0.85,
  });

  // 1. Sky Dome & Instanced Volumetric-style Clouds & Sunbeams
  const skyGeo = new THREE.SphereGeometry(260, 28, 16);
  const skyPos = skyGeo.attributes.position as THREE.BufferAttribute;
  const skyColors = new Float32Array(skyPos.count * 3);
  const cZenith = new THREE.Color(0x4b77a3);
  const cHorizon = new THREE.Color(0xd9cdb8);
  const tmpCol = new THREE.Color();
  for (let i = 0; i < skyPos.count; i++) {
    const y = skyPos.getY(i);
    const t = THREE.MathUtils.clamp(y / 180, 0, 1);
    tmpCol.copy(cHorizon).lerp(cZenith, Math.pow(t, 0.65));
    skyColors[i * 3] = tmpCol.r;
    skyColors[i * 3 + 1] = tmpCol.g;
    skyColors[i * 3 + 2] = tmpCol.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  const skyDome = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })
  );
  scene.add(skyDome);

  const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf6f1e7,
    roughness: 0.96,
    metalness: 0.0,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const cloudCount = 48;
  const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
  cloudInst.frustumCulled = false;
  const cloudBasePositions = new Float32Array(cloudCount * 3);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const dist = 78 + (i % 4) * 26;
    const cx = Math.cos(angle) * dist;
    const cy = 48 + (i % 3) * 8;
    const cz = Math.sin(angle) * dist + 35;
    for (let p = 0; p < 3; p++) {
      const idx = i * 3 + p;
      const px = cx + (p - 1) * 7.5;
      const py = cy + (p % 2) * 1.4;
      const pz = cz + ((p * 3) % 2 - 0.5) * 3.5;
      cloudBasePositions[idx * 3] = px;
      cloudBasePositions[idx * 3 + 1] = py;
      cloudBasePositions[idx * 3 + 2] = pz;
      const r = 6.5 + p * 1.6;
      dummy.position.set(px, py, pz);
      dummy.scale.set(r * 1.8, r * 0.52, r * 1.2);
      dummy.updateMatrix();
      cloudInst.setMatrixAt(idx, dummy.matrix);
    }
  }
  cloudInst.instanceMatrix.needsUpdate = true;
  scene.add(cloudInst);

  // Sunbeam Shafts
  const sunbeamsGroup = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffdfaa,
    transparent: true,
    opacity: 0.055,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  [
    [8, 22, 30],
    [-12, 24, 52],
    [14, 24, 72],
  ].forEach(([bx, by, bz]) => {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(8.5, 42, 14, 1, true), beamMat);
    beam.position.set(bx, by, bz);
    beam.rotation.z = -0.36;
    beam.rotation.x = 0.22;
    sunbeamsGroup.add(beam);
  });
  scene.add(sunbeamsGroup);

  // 2. Terrain Mesh (Smooth grade, depressed under castle floor to prevent Z-fighting)
  const terrSize = 320;
  const terrSegs = 148;
  const terrGeo = new THREE.PlaneGeometry(terrSize, terrSize, terrSegs, terrSegs);
  terrGeo.rotateX(-Math.PI / 2);
  terrGeo.translate(0, 0, 42);
  const tPos = terrGeo.attributes.position as THREE.BufferAttribute;
  const tColors = new Float32Array(tPos.count * 3);

  const colGrass = new THREE.Color(0x4b5c37);
  const colRoad = new THREE.Color(0x7c684d);
  const colRock = new THREE.Color(0x6e6a64);
  const colSnow = new THREE.Color(0xe9edf2);

  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getZ(i);
    const y = terrainMeshHeightAt(x, z);
    tPos.setY(i, y);

    const roadCenterX = Math.sin(Math.max(0, z - 12) * 0.035) * 4.5;
    const distRoad = Math.abs(x - roadCenterX);
    const onRoad = z > 10 && z < 110 && distRoad < 4.5;

    if (y > 16.5) {
      const snowMix = THREE.MathUtils.smoothstep(y, 16.5, 24);
      tmpCol.copy(colRock).lerp(colSnow, snowMix);
    } else if (y > 8.5) {
      const rockMix = THREE.MathUtils.smoothstep(y, 8.5, 16.5);
      tmpCol.copy(colGrass).lerp(colRock, rockMix);
    } else if (onRoad) {
      const rMix = 1 - THREE.MathUtils.smoothstep(distRoad, 1.5, 4.5);
      tmpCol.copy(colGrass).lerp(colRoad, rMix);
    } else {
      tmpCol.copy(colGrass);
    }
    tColors[i * 3] = tmpCol.r;
    tColors[i * 3 + 1] = tmpCol.g;
    tColors[i * 3 + 2] = tmpCol.b;
  }
  terrGeo.setAttribute('color', new THREE.BufferAttribute(tColors, 3));
  terrGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: tex.terrainAlbedo,
    normalMap: tex.terrainNormal,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // 3. Clear Flowing Mountain Stream (stays strictly inside carved gorge x=-56..56)
  const streamGeo = new THREE.PlaneGeometry(112, 9.5, 48, 6);
  streamGeo.rotateX(-Math.PI / 2);
  const sPos = streamGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < sPos.count; i++) {
    const sx = sPos.getX(i);
    const sz = sPos.getZ(i);
    sPos.setZ(i, sz + 46 + Math.sin(sx * 0.055) * 4.5);
    sPos.setY(i, -0.45);
  }
  streamGeo.computeVertexNormals();

  const streamMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a7d8c,
    normalMap: tex.waterNormal,
    roughness: 0.1,
    metalness: 0.12,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const streamMesh = new THREE.Mesh(streamGeo, streamMat);
  streamMesh.receiveShadow = true;
  scene.add(streamMesh);

  // 4. Merged Static Architecture (Castle + Bridge + Outposts) -> Minimal Draw Calls!
  const staticStoneGeos: THREE.BufferGeometry[] = [];
  const staticWoodGeos: THREE.BufferGeometry[] = [];

  const bridgeX = 2.5;
  const bridgeZ = 46;
  const bridgeDeckY = 1.65;

  // Bridge Stone Abutments & Arched Planks
  [-5.2, 5.2].forEach((az) => {
    pushTransformedGeo(
      staticStoneGeos,
      new THREE.BoxGeometry(5.6, 3.6, 2.8),
      bridgeX,
      0.05,
      bridgeZ + az
    );
  });

  const bridgeSteps = 12;
  for (let i = 0; i < bridgeSteps; i++) {
    const t = (i + 0.5) / bridgeSteps;
    const zLocal = THREE.MathUtils.lerp(-5.6, 5.6, t);
    const archH = Math.sin(t * Math.PI) * 0.95;
    const slope = Math.cos(t * Math.PI) * 0.24;

    pushTransformedGeo(
      staticStoneGeos,
      new THREE.BoxGeometry(5.2, 0.42, 1.05),
      bridgeX,
      bridgeDeckY - 0.28 + archH,
      bridgeZ + zLocal,
      -slope
    );
    pushTransformedGeo(
      staticWoodGeos,
      new THREE.BoxGeometry(4.4, 0.12, 0.96),
      bridgeX,
      bridgeDeckY + 0.01 + archH,
      bridgeZ + zLocal,
      -slope
    );
    [-2.4, 2.4].forEach((px) => {
      pushTransformedGeo(
        staticStoneGeos,
        new THREE.BoxGeometry(0.42, 0.85, 1.02),
        bridgeX + px,
        bridgeDeckY + 0.42 + archH,
        bridgeZ + zLocal
      );
    });
  }

  // Kızılgeçit Kalesi Structure
  const floorY = 2.0;
  // Stone Courtyard & Workshop Floor (top at exact y=2.0, terrain depressed underneath!)
  pushTransformedGeo(staticStoneGeos, new THREE.BoxGeometry(24, 0.45, 23), 0, floorY - 0.225, 0.5);

  // North, West, East Stone Walls
  pushTransformedGeo(staticStoneGeos, new THREE.BoxGeometry(22, 5.2, 1.2), 0, floorY + 2.6, -7.2);
  colliders.push({ minX: -11.5, maxX: 11.5, minZ: -8.0, maxZ: -6.4, maxY: floorY + 5.2 });

  pushTransformedGeo(staticStoneGeos, new THREE.BoxGeometry(1.2, 5.2, 19), -11.4, floorY + 2.6, 2.0);
  colliders.push({ minX: -12.2, maxX: -10.6, minZ: -7.5, maxZ: 11.5, maxY: floorY + 5.2 });

  pushTransformedGeo(staticStoneGeos, new THREE.BoxGeometry(1.2, 5.2, 19), 11.4, floorY + 2.6, 2.0);
  colliders.push({ minX: 10.6, maxX: 12.2, minZ: -7.5, maxZ: 11.5, maxY: floorY + 5.2 });

  // Workshop Timber Posts & Roof
  for (let bx = -9; bx <= 9; bx += 4.5) {
    pushTransformedGeo(staticWoodGeos, new THREE.BoxGeometry(0.32, 4.4, 0.32), bx, floorY + 2.2, 0.8);
  }
  pushTransformedGeo(staticWoodGeos, new THREE.BoxGeometry(22.6, 0.3, 8.8), 0, floorY + 4.85, -3.2, 0.14);

  // South Curtain Wall & Gatehouse Arch (y = 6.2 battlement deck)
  const battlementY = 6.2;
  [-7.5, 7.5].forEach((wx) => {
    pushTransformedGeo(staticStoneGeos, new THREE.BoxGeometry(9.0, 4.4, 3.6), wx, floorY + 2.0, 11.8);
  });
  pushTransformedGeo(staticStoneGeos, new THREE.BoxGeometry(6.2, 1.4, 3.6), 0, floorY + 3.5, 11.8);

  colliders.push({ minX: -12.0, maxX: -2.8, minZ: 10.0, maxZ: 13.6, maxY: floorY + 3.4 });
  colliders.push({ minX: 2.8, maxX: 12.0, minZ: 10.0, maxZ: 13.6, maxY: floorY + 3.4 });

  // Merlons along front battlement parapet
  for (let mx = -11; mx <= 11; mx += 2.2) {
    pushTransformedGeo(
      staticStoneGeos,
      new THREE.BoxGeometry(1.2, 1.1, 0.55),
      mx,
      battlementY + 0.55,
      13.35
    );
  }

  // Stone Ramp on West Courtyard
  const rampSteps = 14;
  for (let i = 0; i < rampSteps; i++) {
    const t = (i + 0.5) / rampSteps;
    const sy = THREE.MathUtils.lerp(floorY, battlementY, t);
    const sz = THREE.MathUtils.lerp(2.0, 10.2, t);
    pushTransformedGeo(
      staticStoneGeos,
      new THREE.BoxGeometry(2.8, sy - floorY + 0.35, 0.72),
      -8.8,
      floorY + (sy - floorY) * 0.5,
      sz
    );
  }

  // Gatehouse Corner Towers
  [-12.2, 12.2].forEach((tx) => {
    pushTransformedGeo(staticStoneGeos, new THREE.BoxGeometry(3.4, 8.8, 3.8), tx, floorY + 4.4, 11.8);
    pushTransformedGeo(
      staticWoodGeos,
      new THREE.ConeGeometry(2.7, 2.2, 4),
      tx,
      floorY + 9.9,
      11.8,
      0,
      Math.PI / 4
    );
  });

  // Kartal Kayası Watchtower (-28, -18)
  const etY = groundHeightAt(-28, -18);
  pushTransformedGeo(staticStoneGeos, new THREE.BoxGeometry(4.4, 11.5, 4.4), -28, etY + 5.75, -18);
  pushTransformedGeo(
    staticWoodGeos,
    new THREE.ConeGeometry(3.4, 2.8, 4),
    -28,
    etY + 12.9,
    -18,
    0,
    Math.PI / 4
  );

  // Outpost & Supply Camp Timber Crates
  const campY = groundHeightAt(-16, 74);
  for (let c = 0; c < 4; c++) {
    pushTransformedGeo(
      staticWoodGeos,
      new THREE.BoxGeometry(0.9, 0.85, 0.9),
      -16.5 + c * 1.1,
      campY + 0.425,
      74 - 2.8 + (c % 2) * 0.9
    );
  }
  const outpostY = groundHeightAt(18, 96);
  pushTransformedGeo(staticStoneGeos, new THREE.BoxGeometry(5.2, 3.6, 3.8), 18, outpostY + 1.8, 96);
  pushTransformedGeo(staticWoodGeos, new THREE.BoxGeometry(7.2, 2.4, 0.45), 13.5, outpostY + 1.2, 97.5, 0, 0.28);

  const mergedStoneGeo = mergeGeometries(staticStoneGeos, false);
  if (mergedStoneGeo) {
    const mergedStoneMesh = new THREE.Mesh(mergedStoneGeo, stoneMat);
    mergedStoneMesh.castShadow = true;
    mergedStoneMesh.receiveShadow = true;
    scene.add(mergedStoneMesh);
  }
  staticStoneGeos.forEach((g) => g.dispose());

  const mergedWoodGeo = mergeGeometries(staticWoodGeos, false);
  if (mergedWoodGeo) {
    const mergedWoodMesh = new THREE.Mesh(mergedWoodGeo, woodMat);
    mergedWoodMesh.castShadow = true;
    mergedWoodMesh.receiveShadow = true;
    scene.add(mergedWoodMesh);
  }
  staticWoodGeos.forEach((g) => g.dispose());

  // Supply Camp Tents (canvas material)
  const tentMat = new THREE.MeshStandardMaterial({ color: 0xc2b08e, roughness: 0.9 });
  [
    [-18.5, 72.5, 0.25],
    [-13.4, 75.8, -0.35],
  ].forEach(([tx, tz, rot]) => {
    const tent = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.0, 4), tentMat);
    tent.rotation.y = Math.PI / 4 + rot;
    tent.position.set(tx, campY + 1.5, tz);
    tent.castShadow = true;
    scene.add(tent);
  });

  // Iron Hanging Torch Sconces in the Workshop
  [-6.2, 6.2].forEach((sx) => {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.65), ironMat);
    bracket.position.set(sx, floorY + 2.8, -6.3);
    scene.add(bracket);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.09, 0.18, 8), ironMat);
    bowl.position.set(sx, floorY + 2.9, -6.0);
    scene.add(bowl);
    const ember = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff8822 })
    );
    ember.position.set(sx, floorY + 3.0, -6.0);
    scene.add(ember);
  });

  // 5. Workshop Interactive Stations
  const forge = createForgeStation(tex, new THREE.Vector3(-4.2, floorY, -4.6));
  scene.add(forge.group);
  colliders.push({ minX: -5.8, maxX: -2.2, minZ: -5.9, maxZ: -3.4, maxY: floorY + 3.0 });

  const anvil = createAnvilStation(tex, new THREE.Vector3(-0.8, floorY, -3.5));
  scene.add(anvil.group);
  colliders.push({ minX: -1.45, maxX: -0.15, minZ: -4.15, maxZ: -2.85, maxY: floorY + 1.5 });

  const barrel = createWaterBarrel(tex, new THREE.Vector3(2.2, floorY, -3.9));
  scene.add(barrel.group);
  colliders.push({ minX: 1.65, maxX: 2.75, minZ: -4.45, maxZ: -3.35, maxY: floorY + 1.2 });

  const mapTablePos = new THREE.Vector3(5.6, floorY, -3.2);
  const mapTable = createMapTable(tex, mapTablePos);
  scene.add(mapTable);
  colliders.push({ minX: 4.55, maxX: 6.65, minZ: -4.0, maxZ: -2.4, maxY: floorY + 1.2 });

  // 6. Battlement Defenses: Catapult & Gatehouse Boulder-Drop Lever & Pass Barricades
  const catapult = createCatapultAndLever(tex, new THREE.Vector3(4.8, battlementY, 11.5), 0);
  scene.add(catapult.group);

  const boulderDrop = createBoulderDropLever(tex, new THREE.Vector3(-0.2, battlementY, 12.6));
  scene.add(boulderDrop.group);

  const gateBarPos = new THREE.Vector3(0.2, groundHeightAt(0.2, 19.5), 19.5);
  const gateBarricade = createSpikedBarricade(tex, gateBarPos);
  scene.add(gateBarricade.group);

  const bridgeBarPos = new THREE.Vector3(2.5, groundHeightAt(2.5, 36.5), 36.5);
  const bridgeBarricade = createSpikedBarricade(tex, bridgeBarPos);
  scene.add(bridgeBarricade.group);

  // 7. Instanced Toros Sediri Groves (42 trees -> 2 InstancedMesh draw calls!)
  const treePositions: [number, number, number][] = [];
  for (let i = 0; i < 42; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -12 + ((i * 3.1) % 125);
    const roadX = Math.sin(Math.max(0, z - 12) * 0.035) * 4.5;
    const x = roadX + side * (16 + ((i * 7.3) % 28));
    if (Math.abs(x) < 15 && z < 16) continue;
    const streamZ = 46 + Math.sin(x * 0.055) * 4.5;
    if (Math.abs(z - streamZ) < 6.5) continue;
    const scale = 0.82 + ((i * 13) % 10) * 0.04;
    treePositions.push([x, z, scale]);
  }

  const cedarParts = createTorosCedarParts(tex);
  const trunkInst = new THREE.InstancedMesh(cedarParts.trunkGeo, cedarParts.barkMat, treePositions.length);
  const foliageInst = new THREE.InstancedMesh(
    cedarParts.foliageGeo,
    cedarParts.foliageMat,
    treePositions.length
  );
  trunkInst.castShadow = true;
  foliageInst.castShadow = true;
  foliageInst.receiveShadow = true;

  const tint = new THREE.Color();
  treePositions.forEach(([tx, tz, sc], idx) => {
    dummy.position.set(tx, groundHeightAt(tx, tz) - 0.15, tz);
    dummy.rotation.set(0, idx * 1.1, 0);
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);
    foliageInst.setMatrixAt(idx, dummy.matrix);
    tint.setHSL(0.32, 0.28, 0.85 + (idx % 5) * 0.05);
    foliageInst.setColorAt(idx, tint);
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  foliageInst.instanceMatrix.needsUpdate = true;
  if (foliageInst.instanceColor) foliageInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  foliageInst.computeBoundingSphere();
  scene.add(trunkInst);
  scene.add(foliageInst);

  // 8. Instanced Limestone Boulders
  const rockGeo = new THREE.DodecahedronGeometry(0.95, 1);
  const rockInst = new THREE.InstancedMesh(rockGeo, stoneMat, 50);
  rockInst.receiveShadow = true;
  for (let i = 0; i < 50; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const rz = 16 + ((i * 1.95) % 95);
    const rx = side * (10 + ((i * 5.7) % 25));
    const ry = groundHeightAt(rx, rz);
    dummy.position.set(rx, ry + 0.12, rz);
    dummy.rotation.set(i * 0.4, i * 1.1, i * 0.2);
    const s = 0.65 + ((i * 17) % 10) * 0.11;
    dummy.scale.set(s * 1.2, s * 0.72, s);
    dummy.updateMatrix();
    rockInst.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.08, 0.08, 0.72 + ((i * 7) % 10) * 0.025);
    rockInst.setColorAt(i, tint);
  }
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  scene.add(rockInst);

  return {
    forge,
    anvil,
    barrel,
    mapTablePos,
    catapult,
    boulderLeverPos: catapult.leverWorldPos,
    boulderDrop,
    barricades: { gate: gateBarricade, bridge: bridgeBarricade },
    streamMesh,
    cloudInst,
    cloudBasePositions,
    sunbeamsGroup,
    colliders,
    bridgeBounds: { minX: -0.2, maxX: 5.2, minZ: 40.4, maxZ: 51.6, deckY: bridgeDeckY },
    castleFloorBounds: { minX: -11.5, maxX: 11.5, minZ: -7.0, maxZ: 11.5, floorY },
    battlementBounds: { minX: -11.5, maxX: 11.5, minZ: 10.0, maxZ: 13.4, deckY: battlementY },
    rampBounds: { minX: -10.4, maxX: -7.2, minZ: 2.0, maxZ: 10.2 },
  };
}
