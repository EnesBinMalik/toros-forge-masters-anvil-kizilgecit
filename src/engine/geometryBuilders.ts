import * as THREE from 'three';
import { ProceduralMaterialTextures } from './textures';
import { WeaponId } from '../types/game';

export interface ForgeStationRig {
  group: THREE.Group;
  coalsMesh: THREE.Mesh;
  bellowsTop: THREE.Group;
  chimneyTopWorld: THREE.Vector3;
  hearthCenterWorld: THREE.Vector3;
}

export interface AnvilStationRig {
  group: THREE.Group;
  anvilTopWorld: THREE.Vector3;
}

export interface WaterBarrelRig {
  group: THREE.Group;
  waterMesh: THREE.Mesh;
  waterSurfaceWorld: THREE.Vector3;
}

export interface ForgeableBladeRig {
  group: THREE.Group;
  bladeMesh: THREE.Mesh;
  bladeMaterial: THREE.MeshPhysicalMaterial;
  basePositions: Float32Array;
  forgedPositions: Float32Array;
  guardMesh: THREE.Mesh;
  gripMesh: THREE.Mesh;
  pommelMesh: THREE.Mesh;
}

export interface CatapultRig {
  group: THREE.Group;
  armPivot: THREE.Group;
  gearA: THREE.Mesh;
  gearB: THREE.Mesh;
  leverHandle: THREE.Group;
  loadedBoulder: THREE.Mesh;
  leverWorldPos: THREE.Vector3;
  launchOriginWorld: THREE.Vector3;
}

export type EnemyVariant = 'spearman' | 'heavy' | 'crossbowman';

export interface BoulderDropRig {
  group: THREE.Group;
  leverHandle: THREE.Group;
  gearA: THREE.Mesh;
  gearB: THREE.Mesh;
  hatchDoor: THREE.Mesh;
  boulderCluster: THREE.Group;
  leverWorldPos: THREE.Vector3;
  dropOriginWorld: THREE.Vector3;
}

export interface BarricadeRig {
  group: THREE.Group;
  stakesGroup: THREE.Group;
  pos: THREE.Vector3;
  hp: number;
  maxHp: number;
}

export interface ArmoredEnemyRig {
  group: THREE.Group;
  torso: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  shieldMesh: THREE.Mesh | null;
  weaponGroup: THREE.Group;
  armorMat: THREE.MeshStandardMaterial;
}

export interface PlayerViewModelRig {
  root: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  swordGroup: THREE.Group;
  swordBladeMat: THREE.MeshPhysicalMaterial;
  shieldGroup: THREE.Group;
  hammerGroup: THREE.Group;
  axeGroup: THREE.Group;
  tongsGroup: THREE.Group;
}

function makeGearShape(teeth: number, outerR: number, innerR: number, holeR: number): THREE.Shape {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step;
    const a1 = a0 + step * 0.22;
    const a2 = a0 + step * 0.32;
    const a3 = a0 + step * 0.68;
    const a4 = a0 + step * 0.78;
    if (i === 0) {
      shape.moveTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR);
    } else {
      shape.lineTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR);
    }
    shape.lineTo(Math.cos(a1) * innerR, Math.sin(a1) * innerR);
    shape.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
    shape.lineTo(Math.cos(a3) * outerR, Math.sin(a3) * outerR);
    shape.lineTo(Math.cos(a4) * innerR, Math.sin(a4) * innerR);
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return shape;
}

export function createForgeStation(
  tex: ProceduralMaterialTextures,
  position: THREE.Vector3
): ForgeStationRig {
  const group = new THREE.Group();
  group.position.copy(position);

  const stoneMat = new THREE.MeshStandardMaterial({
    map: tex.stoneAlbedo,
    normalMap: tex.stoneNormal,
    roughnessMap: tex.stoneRoughness,
    roughness: 0.88,
    metalness: 0.04,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    map: tex.forgedIronAlbedo,
    normalMap: tex.forgedIronNormal,
    roughness: 0.48,
    metalness: 0.85,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    normalMap: tex.woodNormal,
    roughnessMap: tex.woodRoughness,
    roughness: 0.78,
    metalness: 0.05,
  });

  // 1. Stone Hearth Pedestal
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.05, 2.1), stoneMat);
  base.position.set(0, 0.525, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 2. Hearth Rim Lip
  const rim = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 2.3), stoneMat);
  rim.position.set(0, 1.1, 0);
  rim.castShadow = true;
  rim.receiveShadow = true;
  group.add(rim);

  // 3. Back Stone Wall & Side Pillars supporting hood
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.2, 0.55), stoneMat);
  backWall.position.set(0, 2.15, -0.75);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  group.add(backWall);

  [-1.08, 1.08].forEach((px) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.3, 1.3), stoneMat);
    pillar.position.set(px, 1.75, -0.2);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
  });

  // 4. Tapered Stone Chimney Hood (4-sided frustum)
  const hoodGeo = new THREE.CylinderGeometry(0.58, 1.45, 2.1, 4);
  hoodGeo.rotateY(Math.PI / 4);
  const hood = new THREE.Mesh(hoodGeo, stoneMat);
  hood.position.set(0, 3.2, -0.35);
  hood.castShadow = true;
  hood.receiveShadow = true;
  group.add(hood);

  // 5. Tall Chimney Stack rising above workshop roof
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.92, 3.8, 0.92), stoneMat);
  chimney.position.set(0, 5.9, -0.4);
  chimney.castShadow = true;
  group.add(chimney);

  const chimneyCrown = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.22, 1.12), stoneMat);
  chimneyCrown.position.set(0, 7.85, -0.4);
  group.add(chimneyCrown);

  // 6. Glowing Charcoal Bed (Kor halinde kömür)
  const coalGeo = new THREE.CylinderGeometry(0.78, 0.88, 0.28, 16);
  const coalMat = new THREE.MeshStandardMaterial({
    map: tex.coalAlbedo,
    emissiveMap: tex.coalEmissive,
    emissive: new THREE.Color(0xff5a14),
    emissiveIntensity: 2.8,
    roughness: 0.92,
    metalness: 0.05,
  });
  const coalsMesh = new THREE.Mesh(coalGeo, coalMat);
  coalsMesh.position.set(0, 1.24, 0.12);
  group.add(coalsMesh);

  // 7. Iron Hearth Grate Bars
  for (let i = -3; i <= 3; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.45, 8), ironMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.2, -0.15 + i * 0.14);
    group.add(bar);
  }

  // 8. Double Leather & Oak Bellows (Körük) on the right side
  const bellowsGroup = new THREE.Group();
  bellowsGroup.position.set(1.75, 1.28, -0.15);
  bellowsGroup.rotation.y = -0.35;

  const bellowsBottom = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.58), woodMat);
  bellowsGroup.add(bellowsBottom);

  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x3b2416,
    roughness: 0.82,
    metalness: 0.05,
  });
  const bellowsChamber = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.34, 8), leatherMat);
  bellowsChamber.position.set(0.05, 0.2, 0);
  bellowsGroup.add(bellowsChamber);

  const bellowsTop = new THREE.Group();
  bellowsTop.position.set(-0.36, 0.38, 0);
  const topBoard = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.58), woodMat);
  topBoard.position.set(0.38, 0, 0);
  bellowsTop.add(topBoard);
  const pumpHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.72, 8), woodMat);
  pumpHandle.rotation.z = Math.PI / 2;
  pumpHandle.position.set(0.95, 0.06, 0);
  bellowsTop.add(pumpHandle);
  bellowsGroup.add(bellowsTop);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.6, 10), ironMat);
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.set(-0.62, 0.1, 0);
  bellowsGroup.add(nozzle);
  group.add(bellowsGroup);

  return {
    group,
    coalsMesh,
    bellowsTop,
    chimneyTopWorld: position.clone().add(new THREE.Vector3(0, 8.0, -0.4)),
    hearthCenterWorld: position.clone().add(new THREE.Vector3(0, 1.38, 0.12)),
  };
}

export function createAnvilStation(
  tex: ProceduralMaterialTextures,
  position: THREE.Vector3
): AnvilStationRig {
  const group = new THREE.Group();
  group.position.copy(position);

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    normalMap: tex.woodNormal,
    roughness: 0.82,
    metalness: 0.05,
  });

  const anvilMat = new THREE.MeshStandardMaterial({
    map: tex.forgedIronAlbedo,
    normalMap: tex.forgedIronNormal,
    color: 0x6b7078,
    roughness: 0.34,
    metalness: 0.9,
  });

  // 1. Heavy Oak Stump
  const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.68, 16), woodMat);
  stump.position.y = 0.34;
  stump.castShadow = true;
  stump.receiveShadow = true;
  group.add(stump);

  // 2. Iron Binding Hoops on Stump
  [0.18, 0.54].forEach((hy) => {
    const hoop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.495, 0.505, 0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.55, metalness: 0.85 })
    );
    hoop.position.y = hy;
    group.add(hoop);
  });

  // 3. Sculpted Anvil Body (ExtrudeGeometry silhouette)
  const anvilShape = new THREE.Shape();
  anvilShape.moveTo(-0.34, 0);
  anvilShape.lineTo(0.34, 0);
  anvilShape.lineTo(0.28, 0.1);
  anvilShape.lineTo(0.16, 0.16);
  anvilShape.lineTo(0.15, 0.32);
  anvilShape.lineTo(0.36, 0.36);
  anvilShape.lineTo(0.36, 0.48); // Heel
  anvilShape.lineTo(-0.28, 0.48);
  anvilShape.lineTo(-0.28, 0.38);
  anvilShape.lineTo(-0.15, 0.32);
  anvilShape.lineTo(-0.16, 0.16);
  anvilShape.lineTo(-0.28, 0.1);
  anvilShape.closePath();

  const anvilGeo = new THREE.ExtrudeGeometry(anvilShape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 3,
  });
  anvilGeo.translate(0, 0, -0.12);
  anvilGeo.computeTangents();

  const anvilBody = new THREE.Mesh(anvilGeo, anvilMat);
  anvilBody.position.y = 0.68;
  anvilBody.castShadow = true;
  anvilBody.receiveShadow = true;
  group.add(anvilBody);

  // 4. Tapered Conical Horn (Boynuz)
  const hornGeo = new THREE.ConeGeometry(0.11, 0.44, 16);
  hornGeo.rotateZ(Math.PI / 2);
  const horn = new THREE.Mesh(hornGeo, anvilMat);
  horn.position.set(-0.46, 1.07, 0);
  horn.castShadow = true;
  group.add(horn);

  return {
    group,
    anvilTopWorld: position.clone().add(new THREE.Vector3(0, 1.19, 0)),
  };
}

export function createForgeableBlade(tex: ProceduralMaterialTextures): ForgeableBladeRig {
  const group = new THREE.Group();

  // Subdivided rectangular billet that morphs cleanly into a tapered, diamond-cross-section Damascus blade
  const segX = 6;
  const segY = 22;
  const segZ = 4;
  const geo = new THREE.BoxGeometry(0.12, 0.92, 0.042, segX, segY, segZ);
  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  const basePositions = new Float32Array(posAttr.array.length);
  const forgedPositions = new Float32Array(posAttr.array.length);

  for (let i = 0; i < posAttr.count; i++) {
    const bx = posAttr.getX(i);
    const by = posAttr.getY(i);
    const bz = posAttr.getZ(i);

    basePositions[i * 3] = bx;
    basePositions[i * 3 + 1] = by;
    basePositions[i * 3 + 2] = bz;

    // Normalized height along blade (-0.46 to +0.46 -> 0 to 1)
    const t = (by + 0.46) / 0.92;
    const tipTaper = t > 0.78 ? Math.max(0.06, 1 - (t - 0.78) / 0.23) : 1 - t * 0.22;
    const fx = bx * 0.72 * tipTaper;
    const fy = by * 1.18 + 0.08;
    // Diamond edge bevel (sharp edges at +-X, thicker spine at X=0)
    const edgeFactor = Math.max(0.12, 1 - Math.abs(bx) / 0.062);
    // Subtle fuller groove along center
    const fuller = Math.abs(bx) < 0.018 && t < 0.72 ? 0.58 : 1.0;
    const fz = bz * 0.34 * edgeFactor * fuller;

    forgedPositions[i * 3] = fx;
    forgedPositions[i * 3 + 1] = fy;
    forgedPositions[i * 3 + 2] = fz;
  }

  const bladeMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x52565e),
    map: null,
    normalMap: tex.forgedIronNormal,
    roughness: 0.42,
    metalness: 0.92,
    anisotropy: 0.7,
    emissive: new THREE.Color(0xff4500),
    emissiveIntensity: 0,
  });

  const bladeMesh = new THREE.Mesh(geo, bladeMaterial);
  bladeMesh.castShadow = true;
  group.add(bladeMesh);

  // Brass/Steel Crossguard, Leather Grip & Pommel (appear as blade is forged/quenched)
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xb68b46,
    roughness: 0.32,
    metalness: 0.88,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x3b2214,
    roughness: 0.8,
    metalness: 0.05,
  });

  const guardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.032, 0.052), brassMat);
  guardMesh.position.y = -0.45;
  guardMesh.visible = false;
  group.add(guardMesh);

  const gripMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.22, 12), leatherMat);
  gripMesh.position.y = -0.57;
  gripMesh.visible = false;
  group.add(gripMesh);

  const pommelMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 1), brassMat);
  pommelMesh.position.y = -0.7;
  pommelMesh.visible = false;
  group.add(pommelMesh);

  return {
    group,
    bladeMesh,
    bladeMaterial,
    basePositions,
    forgedPositions,
    guardMesh,
    gripMesh,
    pommelMesh,
  };
}

const _tempGlowColor = new THREE.Color();

export function updateForgeableBladeHeat(rig: ForgeableBladeRig, heatTemp: number): void {
  const t = THREE.MathUtils.clamp(heatTemp, 0, 1);
  if (t < 0.15) {
    rig.bladeMaterial.emissiveIntensity = 0;
  } else {
    if (t < 0.55) {
      _tempGlowColor.setRGB(1.0, THREE.MathUtils.lerp(0.08, 0.28, (t - 0.15) / 0.4), 0.01);
    } else {
      const u = (t - 0.55) / 0.45;
      _tempGlowColor.setRGB(1.0, THREE.MathUtils.lerp(0.28, 0.78, u), THREE.MathUtils.lerp(0.01, 0.28, u));
    }
    rig.bladeMaterial.emissive.copy(_tempGlowColor);
    rig.bladeMaterial.emissiveIntensity = Math.pow(t, 1.35) * 3.8;
  }
}

export function updateForgeableBladeState(
  rig: ForgeableBladeRig,
  tex: ProceduralMaterialTextures,
  forgeProgress: number,
  heatTemp: number,
  quenched: boolean
): void {
  const p = THREE.MathUtils.clamp(forgeProgress, 0, 1);
  const posAttr = rig.bladeMesh.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < posAttr.count; i++) {
    const bx = rig.basePositions[i * 3];
    const by = rig.basePositions[i * 3 + 1];
    const bz = rig.basePositions[i * 3 + 2];
    const fx = rig.forgedPositions[i * 3];
    const fy = rig.forgedPositions[i * 3 + 1];
    const fz = rig.forgedPositions[i * 3 + 2];

    posAttr.setXYZ(
      i,
      THREE.MathUtils.lerp(bx, fx, p),
      THREE.MathUtils.lerp(by, fy, p),
      THREE.MathUtils.lerp(bz, fz, p)
    );
  }
  posAttr.needsUpdate = true;
  rig.bladeMesh.geometry.computeVertexNormals();

  updateForgeableBladeHeat(rig, heatTemp);

  if (quenched) {
    if (rig.bladeMaterial.map !== tex.damascusAlbedo) {
      rig.bladeMaterial.map = tex.damascusAlbedo;
      rig.bladeMaterial.normalMap = tex.damascusNormal;
      rig.bladeMaterial.roughnessMap = tex.damascusRoughness;
      rig.bladeMaterial.color.setHex(0xd8e0ea);
      rig.bladeMaterial.roughness = 0.26;
      rig.bladeMaterial.metalness = 0.96;
      rig.bladeMaterial.needsUpdate = true;
    }
    rig.guardMesh.visible = true;
    rig.gripMesh.visible = true;
    rig.pommelMesh.visible = true;
  } else {
    if (rig.bladeMaterial.map !== null) {
      rig.bladeMaterial.map = null;
      rig.bladeMaterial.normalMap = tex.forgedIronNormal;
      rig.bladeMaterial.roughnessMap = null;
      rig.bladeMaterial.color.setHex(0x52565e);
      rig.bladeMaterial.roughness = 0.42;
      rig.bladeMaterial.needsUpdate = true;
    }
    rig.guardMesh.visible = p > 0.75;
    rig.gripMesh.visible = p > 0.85;
    rig.pommelMesh.visible = p > 0.9;
  }
}

export function createWaterBarrel(
  tex: ProceduralMaterialTextures,
  position: THREE.Vector3
): WaterBarrelRig {
  const group = new THREE.Group();
  group.position.copy(position);

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    normalMap: tex.woodNormal,
    roughness: 0.78,
    metalness: 0.04,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x26292d,
    roughness: 0.48,
    metalness: 0.86,
  });

  // Barrel Lathe silhouette (hollow top lip)
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.4, 0.0),
    new THREE.Vector2(0.47, 0.45),
    new THREE.Vector2(0.44, 0.96),
    new THREE.Vector2(0.39, 0.96),
    new THREE.Vector2(0.42, 0.45),
    new THREE.Vector2(0.36, 0.08),
    new THREE.Vector2(0.0, 0.08),
  ];
  const barrelGeo = new THREE.LatheGeometry(pts, 20);
  const barrelMesh = new THREE.Mesh(barrelGeo, woodMat);
  barrelMesh.castShadow = true;
  barrelMesh.receiveShadow = true;
  group.add(barrelMesh);

  // Two wrought-iron barrel hoops
  [0.24, 0.76].forEach((y) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.455, 0.022, 8, 24), ironMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y;
    group.add(hoop);
  });

  // Water surface inside barrel
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x22556e,
    normalMap: tex.waterNormal,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.88,
  });
  const waterMesh = new THREE.Mesh(new THREE.CircleGeometry(0.39, 20), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = 0.84;
  group.add(waterMesh);

  return {
    group,
    waterMesh,
    waterSurfaceWorld: position.clone().add(new THREE.Vector3(0, 0.9, 0)),
  };
}

export function createMapTable(
  tex: ProceduralMaterialTextures,
  position: THREE.Vector3
): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(position);

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    normalMap: tex.woodNormal,
    roughness: 0.74,
    metalness: 0.05,
  });

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.1, 1.25), woodMat);
  top.position.y = 0.92;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  // 4 sturdy oak legs + cross stretcher
  [
    [-0.78, -0.48],
    [0.78, -0.48],
    [-0.78, 0.48],
    [0.78, 0.48],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.9, 0.11), woodMat);
    leg.position.set(lx, 0.45, lz);
    leg.castShadow = true;
    group.add(leg);
  });

  const stretcher = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.1), woodMat);
  stretcher.position.y = 0.25;
  group.add(stretcher);

  // Parchment Defense Map laid flat on the table (polygonOffset avoids z-fighting)
  const mapMat = new THREE.MeshStandardMaterial({
    map: tex.parchmentMap,
    roughness: 0.88,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mapSheet = new THREE.Mesh(new THREE.PlaneGeometry(1.32, 0.94), mapMat);
  mapSheet.rotation.x = -Math.PI / 2;
  mapSheet.position.set(-0.06, 0.975, 0.02);
  mapSheet.receiveShadow = true;
  group.add(mapSheet);

  // Rolled scrolls & candle lantern
  const scrollMat = new THREE.MeshStandardMaterial({ color: 0xcab180, roughness: 0.85 });
  const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.48, 12), scrollMat);
  scroll.rotation.z = Math.PI / 2;
  scroll.rotation.y = 0.28;
  scroll.position.set(0.55, 1.01, -0.34);
  group.add(scroll);

  const lanternBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 0.06, 8),
    new THREE.MeshStandardMaterial({ color: 0x3b352c, roughness: 0.5, metalness: 0.8 })
  );
  lanternBase.position.set(0.68, 1.0, 0.35);
  group.add(lanternBase);

  const candle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.14, 10),
    new THREE.MeshStandardMaterial({ color: 0xe6dcc5, roughness: 0.7 })
  );
  candle.position.set(0.68, 1.08, 0.35);
  group.add(candle);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.018, 0.05, 8),
    new THREE.MeshBasicMaterial({ color: 0xffaa33 })
  );
  flame.position.set(0.68, 1.17, 0.35);
  group.add(flame);

  return group;
}

export function createCatapultAndLever(
  tex: ProceduralMaterialTextures,
  position: THREE.Vector3,
  rotationY: number
): CatapultRig {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rotationY;

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    normalMap: tex.woodNormal,
    roughness: 0.78,
    metalness: 0.05,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    map: tex.forgedIronAlbedo,
    normalMap: tex.forgedIronNormal,
    color: 0x3d4248,
    roughness: 0.42,
    metalness: 0.88,
  });

  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0x8a7048,
    roughness: 0.92,
    metalness: 0.0,
  });

  // Heavy Timber Base Rails
  [-1.05, 1.05].forEach((sx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 3.6), woodMat);
    rail.position.set(sx, 0.25, 0);
    rail.castShadow = true;
    group.add(rail);

    // Upright A-frame posts
    const postF = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.75, 0.24), woodMat);
    postF.position.set(sx, 1.05, 0.35);
    postF.rotation.x = 0.22;
    postF.castShadow = true;
    group.add(postF);

    const postB = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.75, 0.24), woodMat);
    postB.position.set(sx, 1.05, -0.35);
    postB.rotation.x = -0.22;
    postB.castShadow = true;
    group.add(postB);
  });

  // Crossbar Stop Beam (with padded leather stop)
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.24, 0.28), woodMat);
  topBeam.position.set(0, 1.85, 0.0);
  topBeam.castShadow = true;
  group.add(topBeam);

  // Torsion Rope Skein Cylinder
  const skein = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.35, 14), ropeMat);
  skein.rotation.z = Math.PI / 2;
  skein.position.set(0, 0.56, 0.9);
  group.add(skein);

  // Throwing Arm Pivot
  const armPivot = new THREE.Group();
  armPivot.position.set(0, 0.56, 0.9);
  armPivot.rotation.x = -0.65; // Cocked back ready to fire

  const armShaft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 0.18), woodMat);
  armShaft.position.set(0, 1.15, 0);
  armShaft.castShadow = true;
  armPivot.add(armShaft);

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.22, 0.22, 14),
    ironMat
  );
  cup.position.set(0, 2.32, -0.08);
  cup.rotation.x = Math.PI / 2;
  armPivot.add(cup);

  const loadedBoulder = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.29, 1),
    new THREE.MeshStandardMaterial({
      map: tex.stoneAlbedo,
      roughness: 0.9,
      metalness: 0.04,
    })
  );
  loadedBoulder.position.set(0, 2.32, -0.22);
  loadedBoulder.castShadow = true;
  armPivot.add(loadedBoulder);
  group.add(armPivot);

  // Interlocking Mechanical Gears & Release Lever (Dişliler ve Levye)
  const gearShapeA = makeGearShape(12, 0.34, 0.25, 0.07);
  const gearGeoA = new THREE.ExtrudeGeometry(gearShapeA, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  gearGeoA.rotateY(Math.PI / 2);

  const gearA = new THREE.Mesh(gearGeoA, ironMat);
  gearA.position.set(1.26, 0.72, -0.55);
  gearA.castShadow = true;
  group.add(gearA);

  const gearShapeB = makeGearShape(8, 0.22, 0.15, 0.05);
  const gearGeoB = new THREE.ExtrudeGeometry(gearShapeB, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  gearGeoB.rotateY(Math.PI / 2);

  const gearB = new THREE.Mesh(gearGeoB, ironMat);
  gearB.position.set(1.26, 0.72, -1.04);
  gearB.castShadow = true;
  group.add(gearB);

  const leverHandle = new THREE.Group();
  leverHandle.position.set(1.34, 0.72, -1.04);
  const leverBar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.95, 10), ironMat);
  leverBar.position.y = 0.45;
  leverHandle.add(leverBar);
  const leverGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.24, 10), woodMat);
  leverGrip.position.y = 0.88;
  leverHandle.add(leverGrip);
  group.add(leverHandle);

  const localLever = new THREE.Vector3(1.34, 0.9, -1.04).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    rotationY
  );
  const localLaunch = new THREE.Vector3(0, 2.8, 0.9).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    rotationY
  );

  return {
    group,
    armPivot,
    gearA,
    gearB,
    leverHandle,
    loadedBoulder,
    leverWorldPos: position.clone().add(localLever),
    launchOriginWorld: position.clone().add(localLaunch),
  };
}

export function createBoulderDropLever(
  tex: ProceduralMaterialTextures,
  position: THREE.Vector3
): BoulderDropRig {
  const group = new THREE.Group();
  group.position.copy(position);

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    normalMap: tex.woodNormal,
    roughness: 0.78,
    metalness: 0.05,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    map: tex.forgedIronAlbedo,
    normalMap: tex.forgedIronNormal,
    color: 0x3b4047,
    roughness: 0.42,
    metalness: 0.88,
  });

  const stoneMat = new THREE.MeshStandardMaterial({
    map: tex.stoneAlbedo,
    roughness: 0.9,
    metalness: 0.04,
  });

  // Hopper Frame overlooking the gatehouse front
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 1.2), woodMat);
  frameL.position.set(-0.7, 0.5, 0.35);
  group.add(frameL);
  const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 1.2), woodMat);
  frameR.position.set(0.7, 0.5, 0.35);
  group.add(frameR);

  // Hatch Door (swings open when lever is pulled)
  const hatchDoor = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.1, 0.95), woodMat);
  hatchDoor.position.set(0, 0.18, 0.48);
  group.add(hatchDoor);

  // Visible Boulder Cluster loaded inside the gatehouse hopper
  const boulderCluster = new THREE.Group();
  boulderCluster.position.set(0, 0.45, 0.48);
  [
    [-0.25, 0.0, 0.0],
    [0.24, 0.02, -0.08],
    [0.0, 0.24, 0.1],
  ].forEach(([bx, by, bz]) => {
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 1), stoneMat);
    b.position.set(bx, by, bz);
    boulderCluster.add(b);
  });
  group.add(boulderCluster);

  // Mechanical Gears & Lever
  const gearShapeA = makeGearShape(10, 0.26, 0.18, 0.05);
  const gearGeoA = new THREE.ExtrudeGeometry(gearShapeA, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  gearGeoA.rotateY(Math.PI / 2);
  const gearA = new THREE.Mesh(gearGeoA, ironMat);
  gearA.position.set(0.84, 0.58, 0.05);
  group.add(gearA);

  const gearShapeB = makeGearShape(8, 0.18, 0.12, 0.04);
  const gearGeoB = new THREE.ExtrudeGeometry(gearShapeB, {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  gearGeoB.rotateY(Math.PI / 2);
  const gearB = new THREE.Mesh(gearGeoB, ironMat);
  gearB.position.set(0.84, 0.58, -0.35);
  group.add(gearB);

  const leverHandle = new THREE.Group();
  leverHandle.position.set(0.92, 0.58, -0.35);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.85, 8), ironMat);
  bar.position.y = 0.4;
  leverHandle.add(bar);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.2, 8), woodMat);
  grip.position.y = 0.78;
  leverHandle.add(grip);
  group.add(leverHandle);

  return {
    group,
    leverHandle,
    gearA,
    gearB,
    hatchDoor,
    boulderCluster,
    leverWorldPos: position.clone().add(new THREE.Vector3(0.9, 0.8, -0.35)),
    dropOriginWorld: position.clone().add(new THREE.Vector3(0, 0.1, 1.35)),
  };
}

export function createSpikedBarricade(
  tex: ProceduralMaterialTextures,
  position: THREE.Vector3
): BarricadeRig {
  const group = new THREE.Group();
  group.position.copy(position);

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    normalMap: tex.woodNormal,
    roughness: 0.82,
    metalness: 0.05,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    map: tex.forgedIronAlbedo,
    color: 0x454a52,
    roughness: 0.45,
    metalness: 0.86,
  });

  const stakesGroup = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 0.18), woodMat);
  beam.position.y = 0.42;
  beam.castShadow = true;
  stakesGroup.add(beam);

  for (let i = -3; i <= 3; i++) {
    const x = i * 0.62;
    // Crossed timber stakes with forged iron spear tips
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.35, 8), woodMat);
    s1.position.set(x, 0.48, 0);
    s1.rotation.x = 0.68;
    s1.castShadow = true;
    stakesGroup.add(s1);

    const tip1 = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.22, 4), ironMat);
    tip1.position.set(x, 0.95, 0.45);
    tip1.rotation.x = 0.68;
    stakesGroup.add(tip1);

    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.25, 8), woodMat);
    s2.position.set(x + 0.18, 0.44, 0);
    s2.rotation.x = -0.68;
    stakesGroup.add(s2);
  }
  group.add(stakesGroup);

  return {
    group,
    stakesGroup,
    pos: position.clone(),
    hp: 100,
    maxHp: 100,
  };
}

export function createTorosCedarParts(tex: ProceduralMaterialTextures): {
  trunkGeo: THREE.BufferGeometry;
  barkMat: THREE.MeshStandardMaterial;
  foliageGeo: THREE.BufferGeometry;
  foliageMat: THREE.MeshStandardMaterial;
} {
  const barkMat = new THREE.MeshStandardMaterial({
    map: tex.barkAlbedo,
    normalMap: tex.barkNormal,
    roughness: 0.92,
    metalness: 0.02,
  });

  const foliageMat = new THREE.MeshStandardMaterial({
    map: tex.cedarFoliage,
    color: 0x314f2e,
    roughness: 0.84,
    metalness: 0.02,
  });

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.46, 7.6, 8);
  trunkGeo.translate(0, 3.8, 0);

  // Build 1 composite cedar bough crown geometry manually so 42 trees = 2 InstancedMeshes!
  const tiers = [
    { y: 3.4, r: 2.8, h: 0.65, ox: 0.22, oz: 0.08 },
    { y: 4.5, r: 2.55, h: 0.62, ox: -0.18, oz: 0.16 },
    { y: 5.5, r: 2.25, h: 0.58, ox: 0.12, oz: -0.18 },
    { y: 6.45, r: 1.85, h: 0.52, ox: -0.08, oz: 0.06 },
    { y: 7.35, r: 1.35, h: 0.46, ox: 0.04, oz: -0.04 },
  ];

  // Combine tier cylinders into one single indexed/non-indexed BufferGeometry
  const parts: THREE.BufferGeometry[] = tiers.map((t, idx) => {
    const g = new THREE.CylinderGeometry(t.r * 0.65, t.r, t.h, 8).toNonIndexed();
    g.rotateY(idx * 0.85);
    g.translate(t.ox, t.y, t.oz);
    return g;
  });

  let totalVerts = 0;
  parts.forEach((g) => {
    totalVerts += g.attributes.position.count;
  });
  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);
  const uvArr = new Float32Array(totalVerts * 2);

  let offset = 0;
  parts.forEach((g) => {
    const p = g.attributes.position.array as Float32Array;
    const n = g.attributes.normal.array as Float32Array;
    const u = g.attributes.uv.array as Float32Array;
    posArr.set(p, offset * 3);
    normArr.set(n, offset * 3);
    uvArr.set(u, offset * 2);
    offset += g.attributes.position.count;
    g.dispose();
  });

  const foliageGeo = new THREE.BufferGeometry();
  foliageGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  foliageGeo.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  foliageGeo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));

  return { trunkGeo, barkMat, foliageGeo, foliageMat };
}

export function createArmoredEnemy(
  tex: ProceduralMaterialTextures,
  variant: EnemyVariant = 'spearman'
): ArmoredEnemyRig {
  const group = new THREE.Group();

  const armorMat = new THREE.MeshStandardMaterial({
    map: tex.forgedIronAlbedo,
    normalMap: tex.forgedIronNormal,
    color: variant === 'heavy' ? 0x454b54 : variant === 'crossbowman' ? 0x737a84 : 0x626973,
    roughness: variant === 'heavy' ? 0.3 : 0.36,
    metalness: 0.86,
  });

  const tunicMat = new THREE.MeshStandardMaterial({
    color: variant === 'heavy' ? 0x341111 : variant === 'crossbowman' ? 0x3b3526 : 0x4b1d1b,
    roughness: 0.85,
    metalness: 0.04,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    roughness: 0.78,
    metalness: 0.05,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xb98c6e,
    roughness: 0.72,
    metalness: 0.02,
  });

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0.82, 0);
  const lThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.44, 8), tunicMat);
  lThigh.position.y = -0.22;
  leftLeg.add(lThigh);
  const lGreave = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.068, 0.42, 8), armorMat);
  lGreave.position.y = -0.62;
  leftLeg.add(lGreave);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.82, 0);
  const rThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.44, 8), tunicMat);
  rThigh.position.y = -0.22;
  rightLeg.add(rThigh);
  const rGreave = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.068, 0.42, 8), armorMat);
  rGreave.position.y = -0.62;
  rightLeg.add(rGreave);
  group.add(rightLeg);

  const torso = new THREE.Group();
  torso.position.y = 0.86;

  const surcoat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.36, 10), tunicMat);
  surcoat.position.y = 0.06;
  torso.add(surcoat);

  const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.46, 10), armorMat);
  cuirass.position.y = 0.36;
  cuirass.castShadow = true;
  torso.add(cuirass);

  const neckMail = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.18, 10), armorMat);
  neckMail.position.y = 0.66;
  torso.add(neckMail);

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 8), skinMat);
  face.position.y = 0.78;
  torso.add(face);

  const helmDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.148, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
    armorMat
  );
  helmDome.position.y = 0.79;
  helmDome.castShadow = true;
  torso.add(helmDome);

  if (variant === 'crossbowman') {
    // Kettle hat brim
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 12), armorMat);
    brim.position.y = 0.8;
    torso.add(brim);
  } else {
    const nasalGuard = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.11, 0.03), armorMat);
    nasalGuard.position.set(0, 0.78, 0.138);
    torso.add(nasalGuard);
  }

  if (variant === 'heavy') {
    // Steel crest ridge on heavy vanguard helmet
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.26), armorMat);
    crest.position.set(0, 0.94, 0);
    torso.add(crest);
  }

  // Left Arm (+ Shield for spearman/heavy)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.31, 0.54, 0);
  const lPauldron = new THREE.Mesh(new THREE.SphereGeometry(variant === 'heavy' ? 0.14 : 0.11, 8, 6), armorMat);
  leftArm.add(lPauldron);
  const lArmLimb = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.48, 8), armorMat);
  lArmLimb.position.y = -0.24;
  leftArm.add(lArmLimb);

  let shieldMesh: THREE.Mesh | null = null;
  if (variant !== 'crossbowman') {
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(-0.26, 0.34);
    shieldShape.lineTo(0.26, 0.34);
    shieldShape.lineTo(0.24, -0.08);
    shieldShape.lineTo(0, -0.42);
    shieldShape.lineTo(-0.24, -0.08);
    shieldShape.closePath();
    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, {
      depth: 0.035,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    shieldMesh = new THREE.Mesh(shieldGeo, armorMat);
    shieldMesh.position.set(-0.08, -0.28, 0.18);
    shieldMesh.rotation.y = -0.45;
    leftArm.add(shieldMesh);
  }
  torso.add(leftArm);

  // Right Arm + Variant Weapon
  const rightArm = new THREE.Group();
  rightArm.position.set(0.31, 0.54, 0);
  const rPauldron = new THREE.Mesh(new THREE.SphereGeometry(variant === 'heavy' ? 0.14 : 0.11, 8, 6), armorMat);
  rightArm.add(rPauldron);
  const rArmLimb = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.48, 8), armorMat);
  rArmLimb.position.y = -0.24;
  rightArm.add(rArmLimb);

  const weaponGroup = new THREE.Group();
  if (variant === 'spearman') {
    weaponGroup.position.set(0.02, -0.42, 0.14);
    weaponGroup.rotation.x = Math.PI * 0.42;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 2.05, 8), woodMat);
    weaponGroup.add(shaft);
    const spearHead = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 4), armorMat);
    spearHead.position.y = 1.14;
    weaponGroup.add(spearHead);
  } else if (variant === 'heavy') {
    // Heavy Two-Handed Flanged War Mace
    weaponGroup.position.set(0.02, -0.4, 0.12);
    weaponGroup.rotation.x = Math.PI * 0.38;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 1.35, 8), woodMat);
    weaponGroup.add(shaft);
    const maceHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), armorMat);
    maceHead.position.y = 0.72;
    weaponGroup.add(maceHead);
  } else {
    // Steel-prod Siege Crossbow (Arbalet)
    weaponGroup.position.set(-0.08, -0.32, 0.32);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.72), woodMat);
    weaponGroup.add(stock);
    const prod = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.05), armorMat);
    prod.position.z = 0.34;
    weaponGroup.add(prod);
  }
  rightArm.add(weaponGroup);
  torso.add(rightArm);

  group.add(torso);
  if (variant === 'heavy') {
    group.scale.setScalar(1.14);
  }

  return {
    group,
    torso,
    rightArm,
    leftArm,
    leftLeg,
    rightLeg,
    shieldMesh,
    weaponGroup,
    armorMat,
  };
}

export function createPlayerViewModel(tex: ProceduralMaterialTextures): PlayerViewModelRig {
  const root = new THREE.Group();

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x3b2b1e,
    roughness: 0.85,
    metalness: 0.05,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x2c1b10,
    roughness: 0.78,
    metalness: 0.08,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.woodAlbedo,
    normalMap: tex.woodNormal,
    roughness: 0.74,
    metalness: 0.05,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    map: tex.forgedIronAlbedo,
    normalMap: tex.forgedIronNormal,
    color: 0x9aa2ad,
    roughness: 0.28,
    metalness: 0.92,
  });

  // Right Arm
  const rightArm = new THREE.Group();
  rightArm.position.set(0.32, -0.28, -0.44);
  const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.42, 10), sleeveMat);
  rForearm.rotation.x = Math.PI / 2.2;
  rForearm.position.set(0, -0.02, 0.14);
  rightArm.add(rForearm);
  const rGauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.085, 0.12), leatherMat);
  rGauntlet.position.set(0, 0.02, -0.04);
  rightArm.add(rGauntlet);

  // [1] Damascus Sword (Şam Çeliği Kılıç)
  const swordGroup = new THREE.Group();
  swordGroup.position.set(0, 0.04, -0.07);
  swordGroup.rotation.x = -0.35;

  const swordBladeMat = new THREE.MeshPhysicalMaterial({
    map: tex.damascusAlbedo,
    normalMap: tex.damascusNormal,
    roughnessMap: tex.damascusRoughness,
    color: 0xd9e2ec,
    roughness: 0.22,
    metalness: 0.96,
    anisotropy: 0.8,
  });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.78, 0.012), swordBladeMat);
  blade.position.y = 0.44;
  swordGroup.add(blade);
  const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.14, 4), swordBladeMat);
  bladeTip.scale.set(1, 1, 0.25);
  bladeTip.position.y = 0.9;
  swordGroup.add(bladeTip);
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.026, 0.042),
    new THREE.MeshStandardMaterial({ color: 0xb98d44, roughness: 0.3, metalness: 0.9 })
  );
  guard.position.y = 0.05;
  swordGroup.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.16, 10), leatherMat);
  grip.position.y = -0.04;
  swordGroup.add(grip);
  rightArm.add(swordGroup);

  // [2] Blacksmith Hammer (Demirci Çekici)
  const hammerGroup = new THREE.Group();
  hammerGroup.position.set(0, 0.04, -0.07);
  hammerGroup.rotation.x = -0.35;
  const hShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.48, 10), woodMat);
  hShaft.position.y = 0.2;
  hammerGroup.add(hShaft);
  const hHead = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.085, 0.19), steelMat);
  hHead.position.y = 0.43;
  hammerGroup.add(hHead);
  hammerGroup.visible = false;
  rightArm.add(hammerGroup);

  // [3] Heavy Battleaxe (Ağır Savaş Baltası)
  const axeGroup = new THREE.Group();
  axeGroup.position.set(0, 0.04, -0.07);
  axeGroup.rotation.x = -0.35;
  const aShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.85, 10), woodMat);
  aShaft.position.y = 0.35;
  axeGroup.add(aShaft);
  const axeHeadShape = new THREE.Shape();
  axeHeadShape.moveTo(0, -0.06);
  axeHeadShape.lineTo(0.2, -0.14);
  axeHeadShape.quadraticCurveTo(0.25, 0.0, 0.2, 0.15);
  axeHeadShape.lineTo(0, 0.06);
  axeHeadShape.closePath();
  const axeHeadGeo = new THREE.ExtrudeGeometry(axeHeadShape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  axeHeadGeo.translate(0, 0, -0.012);
  const aHead = new THREE.Mesh(axeHeadGeo, steelMat);
  aHead.position.set(0.01, 0.68, 0);
  aHead.rotation.y = Math.PI / 2;
  axeGroup.add(aHead);
  axeGroup.visible = false;
  rightArm.add(axeGroup);

  root.add(rightArm);

  // Left Arm (Shield + Tongs)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.34, -0.3, -0.42);
  const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.4, 10), sleeveMat);
  lForearm.rotation.x = Math.PI / 2.2;
  lForearm.position.set(0, -0.02, 0.12);
  leftArm.add(lForearm);

  // Shield (Kalkan)
  const shieldGroup = new THREE.Group();
  shieldGroup.position.set(0.06, 0.06, -0.12);
  shieldGroup.rotation.set(0.1, 0.55, 0);
  const sDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.028, 18), woodMat);
  sDisc.rotation.x = Math.PI / 2;
  shieldGroup.add(sDisc);
  const sRim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.02, 8, 22), steelMat);
  shieldGroup.add(sRim);
  const sBoss = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), steelMat);
  sBoss.position.z = 0.02;
  shieldGroup.add(sBoss);
  leftArm.add(shieldGroup);

  // Blacksmith Tongs (Maşa)
  const tongsGroup = new THREE.Group();
  tongsGroup.position.set(0.08, 0.02, -0.2);
  tongsGroup.rotation.x = Math.PI / 2;
  [-0.015, 0.015].forEach((ox) => {
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.42, 0.014), steelMat);
    jaw.position.x = ox;
    tongsGroup.add(jaw);
  });
  tongsGroup.visible = false;
  leftArm.add(tongsGroup);

  root.add(leftArm);

  return {
    root,
    rightArm,
    leftArm,
    swordGroup,
    swordBladeMat,
    shieldGroup,
    hammerGroup,
    axeGroup,
    tongsGroup,
  };
}

export function setActiveViewModelWeapon(rig: PlayerViewModelRig, weaponId: WeaponId): void {
  rig.swordGroup.visible = weaponId === 1;
  rig.shieldGroup.visible = weaponId === 1;
  rig.hammerGroup.visible = weaponId === 2;
  rig.axeGroup.visible = weaponId === 3;
}
