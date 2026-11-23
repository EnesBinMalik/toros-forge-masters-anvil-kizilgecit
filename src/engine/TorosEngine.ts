import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TorosAudioEngine, SurfaceType } from './audio';
import {
  ArmoredEnemyRig,
  BarricadeRig,
  createArmoredEnemy,
  createForgeableBlade,
  createPlayerViewModel,
  EnemyVariant,
  ForgeableBladeRig,
  PlayerViewModelRig,
  setActiveViewModelWeapon,
  updateForgeableBladeHeat,
  updateForgeableBladeState,
} from './geometryBuilders';
import { createProceduralTextures, ProceduralMaterialTextures } from './textures';
import { buildTorosWorld, surfaceHeightAt, WorldRefs } from './worldBuilder';
import {
  ForgeStage,
  GamePhase,
  HudState,
  InteractionTarget,
  TOROS_LANDMARKS,
  WeaponId,
} from '../types/game';

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  kind: 'spark' | 'smoke' | 'steam' | 'dust';
  color: THREE.Color;
}

interface EnemyActor {
  id: number;
  variant: EnemyVariant;
  rig: ArmoredEnemyRig;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  hp: number;
  maxHp: number;
  attackCooldown: number;
  attackAnim: number;
  staggerTimer: number;
  walkCycle: number;
  alive: boolean;
  deathTimer: number;
}

interface BoulderProjectile {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  active: boolean;
  blastRadius: number;
  damage: number;
}

interface BoltProjectile {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  fromEnemy: boolean;
  life: number;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _vec3D = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export class TorosEngine {
  private container: HTMLElement;
  private onHudChange: (state: HudState) => void;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private tex!: ProceduralMaterialTextures;
  private world!: WorldRefs;
  public audio = new TorosAudioEngine();

  private forgeLight!: THREE.PointLight;
  private forgeBlade!: ForgeableBladeRig;
  private viewModel!: PlayerViewModelRig;

  // Shared Geometries & Materials for Projectiles (zero leak / zero compile hitch)
  private boulderGeo!: THREE.BufferGeometry;
  private boulderMat!: THREE.MeshStandardMaterial;
  private boltGeo!: THREE.BufferGeometry;
  private boltEnemyMat!: THREE.MeshStandardMaterial;
  private boltAllyMat!: THREE.MeshStandardMaterial;

  // Particle System
  private particles: Particle[] = [];
  private particlePositions!: Float32Array;
  private particleColors!: Float32Array;
  private particleGeo!: THREE.BufferGeometry;
  private particlePoints!: THREE.Points;
  private readonly maxParticles = 240;

  // Gameplay & State
  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();
  private elapsed = 0;

  private phase: GamePhase = 'title';
  private transitionAlpha = 0;
  private transitioningToPlay = false;

  // Player Physics & Controls
  private playerPos = new THREE.Vector3(-1.2, 2.0, -0.5);
  private playerVel = new THREE.Vector3();
  private playerYaw = Math.PI * 0.96;
  private playerPitch = -0.06;
  private isGrounded = true;
  private health = 100;
  private maxHealth = 100;
  private stamina = 100;
  private maxStamina = 100;
  private activeWeapon: WeaponId = 1;
  private isBlocking = false;
  private swingTimer = 0;
  private swingDuration = 0.34;
  private swingDidHit = false;
  private hitStopTimer = 0;
  private footstepAccum = 0;

  // Blacksmithing State
  private forgeStage: ForgeStage = 'idle';
  private forgeTemp = 0.0;
  private forgeHits = 0;
  private readonly maxForgeHits = 6;
  private hasMasterworkBlade = false;
  private isHeatingNow = false;
  private towerSupportTimer = 0;

  // Defenses: Catapult, Gatehouse Boulder Drop, Barricades
  private catapultState: 'ready' | 'firing' | 'reloading' = 'ready';
  private catapultTimer = 0;
  private dropState: 'ready' | 'dropping' | 'reloading' = 'ready';
  private dropTimer = 0;
  private projectiles: BoulderProjectile[] = [];
  private bolts: BoltProjectile[] = [];

  // Enemies & Wave Progression
  private enemies: EnemyActor[] = [];
  private nextEnemyId = 1;
  private activeMissionIndex = 2; // Taş Kemer Köprü
  private waveCooldown = 4.0;
  private wavesCleared = 0;
  private playerDefeated = false;
  private siegeRepelled = false;
  private statusBanner: string | null = null;
  private statusBannerTimer = 0;

  // Input State
  private keys: Record<string, boolean> = {};
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private isMapOpen = false;
  private lastHudEmit = 0;
  private interactionTarget: InteractionTarget = null;
  private interactionLabel: string | null = null;
  private smokeAccum = 0;
  private cloudShift = 0;

  constructor(container: HTMLElement, onHudChange: (state: HudState) => void) {
    this.container = container;
    this.onHudChange = onHudChange;
    this.initScene();
    this.bindEvents();
    this.spawnInitialPatrol();
    this.emitHud(true);
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  }

  private initScene(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !this.isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    this.container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcabca4);
    scene.fog = new THREE.FogExp2(0xcabca4, 0.0085);
    this.scene = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 300);
    this.camera = camera;

    const hemi = new THREE.HemisphereLight(0x9bc0e0, 0x5c4732, 0.85);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0d4, 2.05);
    sun.position.set(36, 56, 26);
    sun.castShadow = !this.isSoftwareGl;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 6;
    sun.shadow.camera.far = 140;
    sun.shadow.camera.left = -38;
    sun.shadow.camera.right = 38;
    sun.shadow.camera.top = 38;
    sun.shadow.camera.bottom = -38;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);

    const rim = new THREE.DirectionalLight(0xa3c2db, 0.5);
    rim.position.set(-40, 25, -45);
    scene.add(rim);

    this.tex = createProceduralTextures(renderer);
    this.world = buildTorosWorld(scene, this.tex);

    // Shared projectile resources
    this.boulderGeo = new THREE.DodecahedronGeometry(0.42, 1);
    this.boulderMat = new THREE.MeshStandardMaterial({
      map: this.tex.stoneAlbedo,
      roughness: 0.9,
      metalness: 0.04,
    });
    this.boltGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.72, 6);
    this.boltGeo.rotateX(Math.PI / 2);
    this.boltEnemyMat = new THREE.MeshStandardMaterial({ color: 0x3b3f47, metalness: 0.85, roughness: 0.35 });
    this.boltAllyMat = new THREE.MeshStandardMaterial({ color: 0xd4a44e, metalness: 0.7, roughness: 0.35 });

    // Warm Forge Fire PointLight
    this.forgeLight = new THREE.PointLight(0xff6b1a, 6.2, 15, 1.8);
    this.forgeLight.position.copy(this.world.forge.hearthCenterWorld).add(new THREE.Vector3(0, 0.45, 0.25));
    scene.add(this.forgeLight);

    // Hand-forged Sword resting on Anvil during Title Screen
    this.forgeBlade = createForgeableBlade(this.tex);
    this.forgeBlade.group.position.copy(this.world.anvil.anvilTopWorld).add(new THREE.Vector3(0, 0.06, 0));
    this.forgeBlade.group.rotation.set(Math.PI / 2, 0.35, Math.PI / 2);
    updateForgeableBladeState(this.forgeBlade, this.tex, 1.0, 0.32, true);
    scene.add(this.forgeBlade.group);

    this.viewModel = createPlayerViewModel(this.tex);
    this.viewModel.root.visible = false;
    camera.add(this.viewModel.root);
    scene.add(camera);

    this.initParticles();

    if (!this.isSoftwareGl) {
      renderer.compile(scene, camera);
    }
  }

  private initParticles(): void {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        kind: 'spark',
        color: new THREE.Color(1, 0.5, 0.1),
      });
    }
    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleColors = new Float32Array(this.maxParticles * 3);
    this.particleGeo = new THREE.BufferGeometry();
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.46,
      map: this.tex.softParticle,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.particlePoints = new THREE.Points(this.particleGeo, mat);
    this.particlePoints.frustumCulled = false;
    this.scene.add(this.particlePoints);
  }

  private spawnParticle(
    origin: THREE.Vector3,
    vx: number,
    vy: number,
    vz: number,
    kind: Particle['kind'],
    maxLife: number,
    colorHex: number
  ): void {
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.pos.copy(origin);
        p.vel.set(vx, vy, vz);
        p.kind = kind;
        p.life = 0;
        p.maxLife = maxLife;
        p.color.setHex(colorHex);
        return;
      }
    }
  }

  private spawnBurst(origin: THREE.Vector3, count: number, kind: Particle['kind'], speed = 4.5): void {
    for (let i = 0; i < count; i++) {
      const vx = (Math.random() - 0.5) * speed;
      const vy =
        kind === 'steam' || kind === 'smoke'
          ? 1.4 + Math.random() * 2.2
          : 1.5 + Math.random() * speed * 0.9;
      const vz = (Math.random() - 0.5) * speed;
      const color =
        kind === 'spark'
          ? Math.random() > 0.4
            ? 0xffaa33
            : 0xff5511
          : kind === 'steam'
          ? 0xf2f6fa
          : kind === 'dust'
          ? 0xb8a890
          : 0x6b6763;
      this.spawnParticle(
        origin,
        vx,
        vy,
        vz,
        kind,
        kind === 'spark' ? 0.45 + Math.random() * 0.4 : 1.0 + Math.random() * 1.0,
        color
      );
    }
  }

  // --- PUBLIC ACTIONS ---

  public startGame(): void {
    if (this.phase === 'playing') return;
    this.audio.init();
    this.audio.resume();
    this.phase = 'playing';
    this.transitioningToPlay = true;
    this.transitionAlpha = 0;

    this.forgeStage = 'idle';
    this.forgeTemp = 0.0;
    this.forgeHits = 0;
    this.forgeBlade.group.visible = false;
    updateForgeableBladeState(this.forgeBlade, this.tex, 0, 0, false);

    this.audio.playSwordUnsheathe();
    this.emitHud(true);

    try {
      this.renderer.domElement.requestPointerLock();
    } catch {
      // Drag-look fallback handles environments without pointer lock
    }
  }

  public selectWeapon(id: WeaponId): void {
    if (this.activeWeapon === id) return;
    this.activeWeapon = id;
    this.isBlocking = false;
    setActiveViewModelWeapon(this.viewModel, id);
    this.audio.playSwordUnsheathe();
    this.emitHud(true);
  }

  public toggleMap(open?: boolean): void {
    if (this.phase !== 'playing') return;
    const next = open !== undefined ? open : !this.isMapOpen;
    this.isMapOpen = next;
    if (next && document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.emitHud(true);
  }

  public restartDefense(): void {
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.playerDefeated = false;
    this.siegeRepelled = false;
    this.playerPos.set(-1.2, 2.0, -0.5);
    this.playerVel.set(0, 0, 0);
    this.wavesCleared = 0;
    this.activeMissionIndex = 2;

    this.repairBarricade(this.world.barricades.gate, true);
    this.repairBarricade(this.world.barricades.bridge, true);

    this.enemies.forEach((e) => this.scene.remove(e.rig.group));
    this.enemies = [];
    this.bolts.forEach((b) => this.scene.remove(b.mesh));
    this.bolts = [];

    this.spawnInitialPatrol();
    this.emitHud(true);
  }

  public continueDefense(): void {
    this.siegeRepelled = false;
    this.health = Math.min(this.maxHealth, this.health + 40);
    this.spawnSiegeWave(4 + this.wavesCleared);
    this.emitHud(true);
  }

  // --- ENEMY SPAWNING ---

  private spawnInitialPatrol(): void {
    this.spawnEnemyAt(new THREE.Vector3(2.2, 0, 54), 'spearman');
    this.spawnEnemyAt(new THREE.Vector3(4.2, 0, 60), 'heavy');
    this.spawnEnemyAt(new THREE.Vector3(-1.5, 0, 64), 'crossbowman');
  }

  private spawnSiegeWave(count: number): void {
    const variants: EnemyVariant[] = ['spearman', 'heavy', 'crossbowman'];
    for (let i = 0; i < count; i++) {
      const z = 54 + i * 5.2;
      const roadX = Math.sin(Math.max(0, z - 12) * 0.035) * 4.5;
      const x = roadX + (Math.random() - 0.5) * 6.5;
      const variant = variants[i % variants.length];
      this.spawnEnemyAt(new THREE.Vector3(x, 0, z), variant);
    }
    this.activeMissionIndex = 2; // Taş Kemer Köprü ve Dere Geçidi
    this.showBanner('Kuşatma Öncüleri ve Arbaletçiler geçide ilerliyor!');
  }

  private spawnEnemyAt(pos: THREE.Vector3, variant: EnemyVariant): void {
    const rig = createArmoredEnemy(this.tex, variant);
    pos.y = surfaceHeightAt(pos.x, pos.z, this.world);
    rig.group.position.copy(pos);
    this.scene.add(rig.group);
    const maxHp = variant === 'heavy' ? 140 : variant === 'crossbowman' ? 65 : 90;
    this.enemies.push({
      id: this.nextEnemyId++,
      variant,
      rig,
      pos: pos.clone(),
      vel: new THREE.Vector3(),
      yaw: Math.PI,
      hp: maxHp,
      maxHp,
      attackCooldown: 1.0 + Math.random() * 0.7,
      attackAnim: 0,
      staggerTimer: 0,
      walkCycle: Math.random() * Math.PI * 2,
      alive: true,
      deathTimer: 0,
    });
  }

  private showBanner(msg: string): void {
    this.statusBanner = msg;
    this.statusBannerTimer = 3.4;
    this.emitHud(true);
  }

  // --- INPUT & EVENTS ---

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    if (this.phase !== 'playing') return;

    if (e.code === 'KeyM') {
      this.toggleMap();
      return;
    }
    if (e.code === 'Escape' && this.isMapOpen) {
      this.toggleMap(false);
      return;
    }
    if (this.isMapOpen) return;

    if (e.code === 'Digit1') this.selectWeapon(1);
    if (e.code === 'Digit2') this.selectWeapon(2);
    if (e.code === 'Digit3') this.selectWeapon(3);

    if (e.code === 'KeyE') {
      this.handlePrimaryInteraction();
    }
    if (e.code === 'KeyF' && this.activeWeapon === 1) {
      this.isBlocking = true;
      this.emitHud(true);
    }
    if (e.code === 'Space' && this.isGrounded) {
      this.playerVel.y = 6.8;
      this.isGrounded = false;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
    if (e.code === 'KeyF') {
      this.isBlocking = false;
      this.emitHud(true);
    }
    if (e.code === 'KeyE') {
      this.isHeatingNow = false;
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing' || this.isMapOpen || this.playerDefeated) return;
    this.audio.init();
    this.audio.resume();

    if (e.button === 0) {
      if (!this.pointerLocked && e.target === this.renderer.domElement) {
        this.isDraggingLook = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        try {
          this.renderer.domElement.requestPointerLock();
        } catch {
          // Ignore
        }
      }

      if (
        this.interactionTarget === 'anvil' &&
        (this.forgeStage === 'ready_for_anvil' || this.forgeStage === 'forging')
      ) {
        this.performAnvilStrike();
      } else if (
        this.interactionTarget === 'forge' &&
        (this.forgeStage === 'idle' || this.forgeStage === 'heating' || this.forgeStage === 'forging')
      ) {
        this.startHeatingAtForge();
      } else if (
        this.interactionTarget === 'barrel' &&
        this.forgeStage === 'ready_for_quench'
      ) {
        this.quenchInBarrel();
      } else {
        this.performCombatSwing();
      }
    } else if (e.button === 2 && this.activeWeapon === 1) {
      this.isBlocking = true;
      this.emitHud(true);
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.isDraggingLook = false;
      this.isHeatingNow = false;
    }
    if (e.button === 2) {
      this.isBlocking = false;
      this.emitHud(true);
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing' || this.isMapOpen || this.playerDefeated) return;
    if (this.pointerLocked) {
      this.playerYaw -= e.movementX * 0.0022;
      this.playerPitch = THREE.MathUtils.clamp(
        this.playerPitch - e.movementY * 0.002,
        -1.15,
        1.15
      );
    } else if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.playerYaw -= dx * 0.0038;
      this.playerPitch = THREE.MathUtils.clamp(this.playerPitch - dy * 0.0034, -1.15, 1.15);
    }
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.emitHud(true);
  };

  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  // --- INTERACTION & BLACKSMITHING ---

  private updateInteractionTarget(): void {
    if (this.phase !== 'playing') {
      this.interactionTarget = null;
      this.interactionLabel = null;
      return;
    }

    const p = this.playerPos;
    const dForge = p.distanceTo(this.world.forge.hearthCenterWorld);
    const dAnvil = p.distanceTo(this.world.anvil.anvilTopWorld);
    const dBarrel = p.distanceTo(this.world.barrel.waterSurfaceWorld);
    const dMap = p.distanceTo(this.world.mapTablePos);
    const dLever = p.distanceTo(this.world.boulderLeverPos);
    const dDrop = p.distanceTo(this.world.boulderDrop.leverWorldPos);
    const dGateBar = p.distanceTo(this.world.barricades.gate.pos);
    const dBridgeBar = p.distanceTo(this.world.barricades.bridge.pos);

    let nextTarget: InteractionTarget = null;
    let nextLabel: string | null = null;

    if (dForge < 3.4) {
      nextTarget = 'forge';
      if (this.forgeStage === 'idle' || this.forgeStage === 'quenched') {
        nextLabel = 'Ocakta Isıt (E)';
      } else if (this.forgeStage === 'heating') {
        nextLabel = 'Külçe Isınıyor (Basılı Tut)';
      } else if (this.forgeStage === 'forging' && this.forgeTemp < 0.35) {
        nextLabel = 'Çeliği Tekrar Isıt (E)';
      } else if (this.forgeStage === 'ready_for_anvil') {
        nextLabel = 'Örse Götür';
      }
    } else if (dAnvil < 3.1) {
      nextTarget = 'anvil';
      if (this.forgeStage === 'ready_for_anvil' || this.forgeStage === 'forging') {
        nextLabel =
          this.forgeTemp < 0.25 ? 'Çelik Soğudu — Ocakta Isıt' : 'Örste Döv (Sol Tık / E)';
      } else if (this.forgeStage === 'ready_for_quench') {
        nextLabel = 'Su Fıçısına Daldır';
      }
    } else if (dBarrel < 3.0) {
      nextTarget = 'barrel';
      if (this.forgeStage === 'ready_for_quench') {
        nextLabel = 'Suya Daldır ve Su Ver (E)';
      }
    } else if (dMap < 3.0) {
      nextTarget = 'map_table';
      nextLabel = 'Toros Geçidi Krokisini İncele (E / M)';
    } else if (dLever < 3.5) {
      nextTarget = 'boulder_lever';
      nextLabel =
        this.catapultState === 'ready' ? 'Mancınık Kolunu Çek (E)' : 'Mancınık Kuruluyor';
    } else if (dDrop < 3.3) {
      nextTarget = 'boulder_drop_lever';
      nextLabel =
        this.dropState === 'ready'
          ? 'Kapı Üstü Kaya Düzeneğini Bırak (E)'
          : 'Kaya Haznesi Dolduruluyor';
    } else if (dGateBar < 3.6 && this.world.barricades.gate.hp < 100) {
      nextTarget = 'barricade_gate';
      nextLabel = 'Kapı Önü Kazık Barikatını Onar (E)';
    } else if (dBridgeBar < 3.6 && this.world.barricades.bridge.hp < 100) {
      nextTarget = 'barricade_bridge';
      nextLabel = 'Köprübaşı Kazık Barikatını Onar (E)';
    }

    this.interactionTarget = nextTarget;
    this.interactionLabel = nextLabel;
  }

  private handlePrimaryInteraction(): void {
    if (this.interactionTarget === 'forge') {
      this.startHeatingAtForge();
    } else if (this.interactionTarget === 'anvil') {
      if (this.forgeStage === 'ready_for_anvil' || this.forgeStage === 'forging') {
        this.performAnvilStrike();
      }
    } else if (this.interactionTarget === 'barrel') {
      if (this.forgeStage === 'ready_for_quench') {
        this.quenchInBarrel();
      }
    } else if (this.interactionTarget === 'map_table') {
      this.toggleMap(true);
    } else if (this.interactionTarget === 'boulder_lever') {
      this.fireCatapult();
    } else if (this.interactionTarget === 'boulder_drop_lever') {
      this.triggerGateBoulderDrop();
    } else if (this.interactionTarget === 'barricade_gate') {
      this.repairBarricade(this.world.barricades.gate, false);
    } else if (this.interactionTarget === 'barricade_bridge') {
      this.repairBarricade(this.world.barricades.bridge, false);
    }
  }

  private repairBarricade(bar: BarricadeRig, silent: boolean): void {
    bar.hp = bar.maxHp;
    bar.stakesGroup.visible = true;
    bar.stakesGroup.scale.setScalar(1);
    if (!silent) {
      this.audio.playBarricadeBuild();
      this.showBanner('Kazık barikatı güçlendirildi!');
    }
  }

  private startHeatingAtForge(): void {
    if (this.forgeStage === 'idle' || this.forgeStage === 'quenched') {
      this.forgeStage = 'heating';
      this.forgeHits = 0;
      this.forgeTemp = 0.15;
    }
    this.isHeatingNow = true;
    this.forgeBlade.group.visible = true;
    this.forgeBlade.group.position.copy(this.world.forge.hearthCenterWorld).add(_vec3D.set(0, 0.18, 0.1));
    this.forgeBlade.group.rotation.set(Math.PI / 2.2, 0.2, Math.PI / 2.5);
    this.audio.playForgeBellows();
    this.spawnBurst(this.world.forge.hearthCenterWorld, 16, 'spark', 4.2);
    this.emitHud(true);
  }

  private performAnvilStrike(): void {
    if (this.forgeTemp < 0.25) {
      this.showBanner('Çelik soğudu! Şekil vermek için tekrar ocağa tut.');
      return;
    }
    if (this.swingTimer > 0) return;

    if (this.activeWeapon !== 2) {
      this.selectWeapon(2);
    }
    this.swingTimer = 0.28;
    this.swingDuration = 0.28;

    this.forgeStage = 'forging';
    this.forgeBlade.group.visible = true;
    this.forgeBlade.group.position.copy(this.world.anvil.anvilTopWorld).add(_vec3D.set(0, 0.05, 0));
    this.forgeBlade.group.rotation.set(Math.PI / 2, 0.25, Math.PI / 2);

    this.forgeHits = Math.min(this.maxForgeHits, this.forgeHits + 1);
    const progress = this.forgeHits / this.maxForgeHits;
    updateForgeableBladeState(this.forgeBlade, this.tex, progress, this.forgeTemp, false);

    this.audio.playHammerAnvil(this.forgeTemp);
    this.spawnBurst(this.world.anvil.anvilTopWorld, 22, 'spark', 5.8);

    if (this.forgeHits >= this.maxForgeHits) {
      this.forgeStage = 'ready_for_quench';
      this.showBanner('Kılıç şekillendi! Su fıçısına daldırarak temperle.');
    }
    this.emitHud(true);
  }

  private quenchInBarrel(): void {
    this.forgeStage = 'quenched';
    this.forgeBlade.group.visible = true;
    this.forgeBlade.group.position.copy(this.world.barrel.waterSurfaceWorld).add(_vec3D.set(0, -0.05, 0));
    this.forgeBlade.group.rotation.set(Math.PI, 0, 0);
    this.forgeTemp = 0.05;
    updateForgeableBladeState(this.forgeBlade, this.tex, 1.0, 0.0, true);

    this.audio.playWaterQuench();
    this.spawnBurst(this.world.barrel.waterSurfaceWorld, 36, 'steam', 2.4);

    this.hasMasterworkBlade = true;
    this.selectWeapon(1);
    this.showBanner('Şam Çeliği Kılıç dövüldü! Sur okçuları da desteğe hazır.');
    this.emitHud(true);
  }

  // --- COMBAT & DEFENSES ---

  private performCombatSwing(): void {
    if (this.swingTimer > 0 || this.stamina < 12) return;
    this.isBlocking = false;
    this.stamina = Math.max(0, this.stamina - (this.activeWeapon === 3 ? 20 : 12));
    this.swingDuration = this.activeWeapon === 3 ? 0.46 : 0.32;
    this.swingTimer = this.swingDuration;
    this.swingDidHit = false;
    this.audio.playWeaponSwing(this.activeWeapon === 3);
  }

  private checkMeleeHit(): void {
    if (this.swingDidHit) return;
    const progress = 1 - this.swingTimer / this.swingDuration;
    if (progress < 0.35 || progress > 0.65) return;

    const forward = _vec3A.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw)).normalize();
    const reach = this.activeWeapon === 3 ? 3.5 : 3.0;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      _vec3B.subVectors(enemy.pos, this.playerPos);
      const dist = _vec3B.length();
      if (dist > reach) continue;
      _vec3B.y = 0;
      _vec3B.normalize();
      if (forward.dot(_vec3B) < 0.35) continue;

      this.swingDidHit = true;

      let dmg =
        this.activeWeapon === 1
          ? this.hasMasterworkBlade
            ? 52
            : 34
          : this.activeWeapon === 2
          ? 36
          : 60;

      // Hammer & Heavy Battleaxe deal bonus armor-shattering damage against Heavy Vanguard!
      if (enemy.variant === 'heavy' && (this.activeWeapon === 2 || this.activeWeapon === 3)) {
        dmg *= 1.45;
      }

      enemy.hp -= dmg;
      enemy.staggerTimer = 0.38;
      enemy.vel.addScaledVector(_vec3B, this.activeWeapon === 3 ? 7.5 : 5.0);

      this.hitStopTimer = this.activeWeapon === 3 ? 0.075 : 0.05;
      this.audio.playArmorHit(this.activeWeapon === 3);
      _vec3D.copy(enemy.pos).add(_vec3C.set(0, 1.3, 0));
      this.spawnBurst(_vec3D, 16, 'spark', 4.8);

      if (enemy.hp <= 0) {
        enemy.alive = false;
        enemy.deathTimer = 0;
      }
      break;
    }
  }

  private fireCatapult(): void {
    if (this.catapultState !== 'ready') return;
    this.catapultState = 'firing';
    this.catapultTimer = 0;
    this.audio.playCatapultLaunch();
  }

  private triggerGateBoulderDrop(): void {
    if (this.dropState !== 'ready') return;
    this.dropState = 'dropping';
    this.dropTimer = 0;
    this.audio.playCatapultLaunch();
  }

  private spawnCatapultBoulder(startPos: THREE.Vector3, vel: THREE.Vector3, blastRadius: number, damage: number): void {
    const mesh = new THREE.Mesh(this.boulderGeo, this.boulderMat);
    mesh.castShadow = !this.isSoftwareGl;
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      pos: startPos.clone(),
      vel: vel.clone(),
      active: true,
      blastRadius,
      damage,
    });
  }

  private spawnBolt(origin: THREE.Vector3, target: THREE.Vector3, fromEnemy: boolean): void {
    const mesh = new THREE.Mesh(this.boltGeo, fromEnemy ? this.boltEnemyMat : this.boltAllyMat);
    mesh.position.copy(origin);
    _vec3D.subVectors(target, origin).normalize();
    mesh.lookAt(target);
    this.scene.add(mesh);

    this.bolts.push({
      mesh,
      pos: origin.clone(),
      vel: _vec3D.clone().multiplyScalar(fromEnemy ? 26 : 32),
      fromEnemy,
      life: 2.2,
    });
    this.audio.playCrossbowSnap();
  }

  // --- MAIN LOOP ---

  private startLoop(): void {
    this.clock.start();
    const tick = () => {
      if (this.disposed) return;
      const rawDt = Math.min(0.05, this.clock.getDelta());

      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= rawDt;
      } else {
        this.update(rawDt);
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number): void {
    this.elapsed += dt;

    // 1. Instanced Cloud Drift & Flowing Stream Normals
    this.cloudShift = (this.cloudShift + dt * 0.45) % 240;
    for (let i = 0; i < 48; i++) {
      const bx = this.world.cloudBasePositions[i * 3];
      const by = this.world.cloudBasePositions[i * 3 + 1];
      const bz = this.world.cloudBasePositions[i * 3 + 2];
      const rx = ((bx + this.cloudShift + 140) % 280) - 140;
      const p = i % 3;
      const r = 6.5 + p * 1.6;
      _vec3A.set(rx, by, bz);
      _scale.set(r * 1.8, r * 0.52, r * 1.2);
      _mat4.compose(_vec3A, _quat.identity(), _scale);
      this.world.cloudInst.setMatrixAt(i, _mat4);
    }
    this.world.cloudInst.instanceMatrix.needsUpdate = true;

    this.tex.waterNormal.offset.x += dt * 0.18;
    this.tex.waterNormal.offset.y += dt * 0.08;

    this.forgeLight.intensity =
      (this.isHeatingNow ? 9.2 : 6.0) +
      Math.sin(this.elapsed * 14) * 0.8 +
      Math.cos(this.elapsed * 23) * 0.4;

    // Chimney smoke & hearth sparks
    this.smokeAccum += dt;
    if (this.smokeAccum > 0.18) {
      this.smokeAccum = 0;
      this.spawnParticle(
        this.world.forge.chimneyTopWorld,
        (Math.random() - 0.5) * 0.4,
        1.5 + Math.random() * 0.8,
        (Math.random() - 0.5) * 0.4,
        'smoke',
        2.4,
        0x8a857e
      );
      if (Math.random() < 0.6) {
        this.spawnParticle(
          this.world.forge.hearthCenterWorld,
          (Math.random() - 0.5) * 0.7,
          1.3 + Math.random() * 1.4,
          (Math.random() - 0.5) * 0.7,
          'spark',
          0.7,
          0xff7722
        );
      }
    }

    // Fast heat-only updates (no per-frame geometry vertex normal recomputation!)
    if (this.phase === 'playing' && this.forgeStage === 'heating') {
      this.world.forge.bellowsTop.rotation.z = Math.sin(this.elapsed * 6.5) * 0.18;
      if (this.isHeatingNow || this.playerPos.distanceTo(this.world.forge.hearthCenterWorld) < 3.4) {
        this.forgeTemp = Math.min(1.0, this.forgeTemp + dt * 0.34);
        updateForgeableBladeHeat(this.forgeBlade, this.forgeTemp);
        if (this.forgeTemp >= 0.85) {
          this.forgeStage = 'ready_for_anvil';
          this.isHeatingNow = false;
          this.showBanner('Çelik tavına geldi! Örse götür ve çekiçle döv.');
          this.emitHud(true);
        }
      }
    } else if (this.forgeStage === 'forging' || this.forgeStage === 'ready_for_anvil') {
      this.forgeTemp = Math.max(0.1, this.forgeTemp - dt * 0.015);
      updateForgeableBladeHeat(this.forgeBlade, this.forgeTemp);
    }

    // 2. Camera Choreography
    if (this.phase === 'title') {
      const orbitA = Math.sin(this.elapsed * 0.22) * 0.35;
      _vec3A.set(-2.3 + Math.sin(orbitA) * 1.8, 3.65, -0.4 + Math.cos(orbitA) * 1.1);
      _vec3B.set(-2.1, 2.95, -3.9);
      this.camera.position.copy(_vec3A);
      this.camera.lookAt(_vec3B);
    } else {
      if (!this.isMapOpen && !this.playerDefeated) {
        this.updatePlayerMovement(dt);
      }
      _vec3A.set(this.playerPos.x, this.playerPos.y + 1.66, this.playerPos.z);
      if (this.transitioningToPlay) {
        this.transitionAlpha = THREE.MathUtils.damp(this.transitionAlpha, 1, 3.8, dt);
        this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _vec3A.x, 4.5, dt);
        this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _vec3A.y, 4.5, dt);
        this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _vec3A.z, 4.5, dt);
        if (this.camera.position.distanceTo(_vec3A) < 0.06) {
          this.transitioningToPlay = false;
          this.viewModel.root.visible = true;
        }
      } else {
        this.camera.position.copy(_vec3A);
        this.viewModel.root.visible = true;
      }

      _euler.set(this.playerPitch, this.playerYaw, 0, 'YXZ');
      this.camera.quaternion.setFromEuler(_euler);
      this.updateViewModel(dt);
    }

    // 3. Defenses (Catapult + Gatehouse Boulder Drop + Tower Archers + Projectiles)
    this.updateDefensesAndProjectiles(dt);

    // 4. Enemies AI & Combat
    if (this.phase === 'playing' && !this.playerDefeated) {
      this.updateEnemies(dt);
      this.updateInteractionTarget();
    }

    // 5. Particles
    this.updateParticles(dt);

    // 6. Audio Spatial Mix
    const distForge = this.playerPos.distanceTo(this.world.forge.hearthCenterWorld);
    const streamZ = 46 + Math.sin(this.playerPos.x * 0.055) * 4.5;
    const distStream = Math.abs(this.playerPos.z - streamZ);
    const isOutdoor = this.playerPos.z > 5;
    let nearestEnemy = 999;
    for (let i = 0; i < this.enemies.length; i++) {
      if (!this.enemies[i].alive) continue;
      const d = this.enemies[i].pos.distanceTo(this.playerPos);
      if (d < nearestEnemy) nearestEnemy = d;
    }
    this.audio.update(dt, distForge, distStream, isOutdoor, this.phase === 'playing' && nearestEnemy < 36);

    if (this.statusBannerTimer > 0) {
      this.statusBannerTimer -= dt;
      if (this.statusBannerTimer <= 0) {
        this.statusBanner = null;
        this.emitHud(true);
      }
    }
    if (this.elapsed - this.lastHudEmit > 0.1) {
      this.emitHud(false);
    }
  }

  private updatePlayerMovement(dt: number): void {
    const moveDir = _vec3A.set(0, 0, 0);
    const forwardX = -Math.sin(this.playerYaw);
    const forwardZ = -Math.cos(this.playerYaw);
    const rightX = Math.cos(this.playerYaw);
    const rightZ = -Math.sin(this.playerYaw);

    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      moveDir.x += forwardX;
      moveDir.z += forwardZ;
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      moveDir.x -= forwardX;
      moveDir.z -= forwardZ;
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      moveDir.x += rightX;
      moveDir.z += rightZ;
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      moveDir.x -= rightX;
      moveDir.z -= rightZ;
    }

    const isMoving = moveDir.lengthSq() > 0.001;
    const sprinting =
      (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && this.stamina > 5 && isMoving;
    const speed = sprinting ? 7.6 : 4.9;

    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * 16);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + dt * 18);
    }

    if (isMoving) {
      moveDir.normalize().multiplyScalar(speed);
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, moveDir.x, 12, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, moveDir.z, 12, dt);
    } else {
      this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, 0, 12, dt);
      this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, 0, 12, dt);
    }

    this.playerVel.y -= 18.5 * dt;

    const nextX = THREE.MathUtils.clamp(this.playerPos.x + this.playerVel.x * dt, -48, 48);
    const nextZ = THREE.MathUtils.clamp(this.playerPos.z + this.playerVel.z * dt, -9, 108);

    let blockedX = false;
    let blockedZ = false;
    const radius = 0.48;
    for (const c of this.world.colliders) {
      if (this.playerPos.y > c.maxY - 0.3) continue;
      if (
        nextX + radius > c.minX &&
        nextX - radius < c.maxX &&
        this.playerPos.z + radius > c.minZ &&
        this.playerPos.z - radius < c.maxZ
      ) {
        blockedX = true;
      }
      if (
        this.playerPos.x + radius > c.minX &&
        this.playerPos.x - radius < c.maxX &&
        nextZ + radius > c.minZ &&
        nextZ - radius < c.maxZ
      ) {
        blockedZ = true;
      }
    }

    if (!blockedX) this.playerPos.x = nextX;
    if (!blockedZ) this.playerPos.z = nextZ;

    this.playerPos.y += this.playerVel.y * dt;
    const floorH = surfaceHeightAt(this.playerPos.x, this.playerPos.z, this.world);
    if (this.playerPos.y <= floorH) {
      this.playerPos.y = floorH;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.isGrounded && horizSpeed > 1.2) {
      this.footstepAccum += horizSpeed * dt;
      if (this.footstepAccum > 2.15) {
        this.footstepAccum = 0;
        let surf: SurfaceType = 'earth';
        if (
          this.playerPos.x >= this.world.bridgeBounds.minX &&
          this.playerPos.x <= this.world.bridgeBounds.maxX &&
          this.playerPos.z >= this.world.bridgeBounds.minZ &&
          this.playerPos.z <= this.world.bridgeBounds.maxZ
        ) {
          surf = 'wood';
        } else if (this.playerPos.z <= 13.8 && Math.abs(this.playerPos.x) <= 12) {
          surf = 'stone';
        }
        this.audio.playFootstep(surf);
      }
    }
  }

  private updateViewModel(dt: number): void {
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    const bobY = this.isGrounded
      ? Math.sin(this.elapsed * 8.5) * Math.min(1, horizSpeed / 5) * 0.018
      : 0;
    const bobX = this.isGrounded
      ? Math.cos(this.elapsed * 4.25) * Math.min(1, horizSpeed / 5) * 0.012
      : 0;

    let swingRotX = 0;
    let swingRotY = 0;
    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      const t = 1 - this.swingTimer / this.swingDuration;
      const curve = Math.sin(t * Math.PI);
      swingRotX = -curve * 1.35;
      swingRotY = (this.activeWeapon === 2 ? 0.15 : 0.75) * curve;
      if (this.interactionTarget !== 'anvil') {
        this.checkMeleeHit();
      }
    }

    this.viewModel.rightArm.position.set(0.32 + bobX, -0.28 + bobY, -0.44);
    this.viewModel.rightArm.rotation.set(swingRotX, swingRotY, 0);

    const targetShieldZ = this.isBlocking ? -0.3 : -0.42;
    const targetShieldX = this.isBlocking ? -0.14 : -0.34;
    const targetShieldY = this.isBlocking ? -0.16 : -0.3 + bobY;
    this.viewModel.leftArm.position.x = THREE.MathUtils.damp(
      this.viewModel.leftArm.position.x,
      targetShieldX,
      16,
      dt
    );
    this.viewModel.leftArm.position.y = THREE.MathUtils.damp(
      this.viewModel.leftArm.position.y,
      targetShieldY,
      16,
      dt
    );
    this.viewModel.leftArm.position.z = THREE.MathUtils.damp(
      this.viewModel.leftArm.position.z,
      targetShieldZ,
      16,
      dt
    );

    this.viewModel.tongsGroup.visible = this.forgeStage === 'heating';
    if (this.forgeStage === 'heating') {
      this.viewModel.shieldGroup.visible = false;
    } else if (this.activeWeapon === 1) {
      this.viewModel.shieldGroup.visible = true;
    }
  }

  private updateDefensesAndProjectiles(dt: number): void {
    // 1. Battlement Catapult
    const cat = this.world.catapult;
    if (this.catapultState === 'firing') {
      this.catapultTimer += dt;
      cat.gearA.rotation.x += dt * 7.5;
      cat.gearB.rotation.x -= dt * 11.25;
      cat.leverHandle.rotation.x = THREE.MathUtils.damp(cat.leverHandle.rotation.x, 0.75, 12, dt);

      if (this.catapultTimer >= 0.32 && this.catapultTimer < 0.55) {
        cat.armPivot.rotation.x = THREE.MathUtils.damp(cat.armPivot.rotation.x, 0.55, 24, dt);
        if (cat.loadedBoulder.visible) {
          cat.loadedBoulder.visible = false;
          this.spawnCatapultBoulder(
            _vec3C.copy(cat.launchOriginWorld).add(_vec3D.set(0, 1.6, 1.2)),
            _vec3B.set(-1.1, 11.2, 22.0),
            7.4,
            95
          );
        }
      } else if (this.catapultTimer >= 0.55) {
        this.catapultState = 'reloading';
        this.catapultTimer = 0;
      }
    } else if (this.catapultState === 'reloading') {
      this.catapultTimer += dt;
      cat.gearA.rotation.x -= dt * 2.2;
      cat.gearB.rotation.x += dt * 3.3;
      cat.armPivot.rotation.x = THREE.MathUtils.damp(cat.armPivot.rotation.x, -0.65, 3.5, dt);
      cat.leverHandle.rotation.x = THREE.MathUtils.damp(cat.leverHandle.rotation.x, 0, 5, dt);
      if (this.catapultTimer > 2.4) {
        this.catapultState = 'ready';
        cat.loadedBoulder.visible = true;
      }
    }

    // 2. Gatehouse Boulder-Drop Hopper
    const drop = this.world.boulderDrop;
    if (this.dropState === 'dropping') {
      this.dropTimer += dt;
      drop.gearA.rotation.x += dt * 8.0;
      drop.gearB.rotation.x -= dt * 12.0;
      drop.leverHandle.rotation.x = THREE.MathUtils.damp(drop.leverHandle.rotation.x, 0.75, 14, dt);
      drop.hatchDoor.rotation.x = THREE.MathUtils.damp(drop.hatchDoor.rotation.x, 1.15, 16, dt);

      if (this.dropTimer >= 0.2 && drop.boulderCluster.visible) {
        drop.boulderCluster.visible = false;
        for (let k = -1; k <= 1; k++) {
          this.spawnCatapultBoulder(
            _vec3C.copy(drop.dropOriginWorld).add(_vec3D.set(k * 0.9, -0.2, 1.2 + Math.abs(k) * 0.4)),
            _vec3B.set(k * 1.2, -1.5, 3.2),
            5.2,
            85
          );
        }
      }
      if (this.dropTimer > 0.65) {
        this.dropState = 'reloading';
        this.dropTimer = 0;
      }
    } else if (this.dropState === 'reloading') {
      this.dropTimer += dt;
      drop.hatchDoor.rotation.x = THREE.MathUtils.damp(drop.hatchDoor.rotation.x, 0, 5, dt);
      drop.leverHandle.rotation.x = THREE.MathUtils.damp(drop.leverHandle.rotation.x, 0, 5, dt);
      if (this.dropTimer > 3.2) {
        this.dropState = 'ready';
        drop.boulderCluster.visible = true;
      }
    }

    // 3. Tower Garrison Archers (activated after forging Şam Çeliği Kılıç)
    if (this.phase === 'playing' && this.hasMasterworkBlade) {
      this.towerSupportTimer -= dt;
      if (this.towerSupportTimer <= 0) {
        this.towerSupportTimer = 2.6;
        let target: EnemyActor | null = null;
        let bestDist = 42;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const d = Math.hypot(e.pos.x, e.pos.z - 12);
          if (d < bestDist) {
            bestDist = d;
            target = e;
          }
        }
        if (target) {
          const towerX = target.pos.x < 0 ? -11.5 : 11.5;
          this.spawnBolt(
            _vec3C.set(towerX, 9.2, 12.2),
            _vec3D.set(target.pos.x, target.pos.y + 1.2, target.pos.z),
            false
          );
        }
      }
    }

    // 4. Boulder Physics
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const b = this.projectiles[i];
      if (!b.active) continue;
      b.vel.y -= 16.5 * dt;
      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.x += dt * 4.2;

      const groundY = surfaceHeightAt(b.pos.x, b.pos.z, this.world);
      if (b.pos.y <= groundY + 0.35) {
        b.active = false;
        this.audio.playBoulderImpact();
        this.spawnBurst(b.pos, 26, 'dust', 7.2);
        this.spawnBurst(b.pos, 10, 'spark', 5.0);

        let hits = 0;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (e.pos.distanceTo(b.pos) < b.blastRadius) {
            e.hp -= b.damage;
            e.staggerTimer = 0.8;
            if (e.hp <= 0) {
              e.alive = false;
              e.deathTimer = 0;
            }
            hits++;
          }
        }
        if (hits > 0) {
          this.showBanner(`Savunma ateşi ${hits} Kuşatma Öncüsünü dağıttı!`);
        }

        this.scene.remove(b.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // 5. Crossbow Bolts & Tower Support Arrows
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bolt = this.bolts[i];
      bolt.life -= dt;
      bolt.vel.y -= 2.5 * dt;
      bolt.pos.addScaledVector(bolt.vel, dt);
      bolt.mesh.position.copy(bolt.pos);

      let remove = bolt.life <= 0 || bolt.pos.y < surfaceHeightAt(bolt.pos.x, bolt.pos.z, this.world);

      if (!remove && bolt.fromEnemy) {
        _vec3C.set(this.playerPos.x, this.playerPos.y + 1.25, this.playerPos.z);
        if (bolt.pos.distanceTo(_vec3C) < 1.05) {
          if (this.isBlocking && this.activeWeapon === 1) {
            this.audio.playShieldBlock();
            this.spawnBurst(bolt.pos, 12, 'spark', 4.0);
          } else {
            this.health = Math.max(0, this.health - 12);
            this.audio.playArmorHit(false);
            if (this.health <= 0) {
              this.playerDefeated = true;
              if (document.pointerLockElement) document.exitPointerLock();
              this.emitHud(true);
            }
          }
          remove = true;
        }
      } else if (!remove && !bolt.fromEnemy) {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          _vec3C.set(e.pos.x, e.pos.y + 1.15, e.pos.z);
          if (bolt.pos.distanceTo(_vec3C) < 1.1) {
            e.hp -= 28;
            e.staggerTimer = 0.25;
            this.spawnBurst(bolt.pos, 8, 'spark', 3.2);
            if (e.hp <= 0) {
              e.alive = false;
              e.deathTimer = 0;
            }
            remove = true;
            break;
          }
        }
      }

      if (remove) {
        this.scene.remove(bolt.mesh);
        this.bolts.splice(i, 1);
      }
    }
  }

  private updateEnemies(dt: number): void {
    let aliveCount = 0;
    const bars = [this.world.barricades.gate, this.world.barricades.bridge];

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) {
        e.deathTimer += dt;
        e.rig.group.rotation.x = THREE.MathUtils.damp(e.rig.group.rotation.x, -Math.PI / 2, 7, dt);
        if (e.deathTimer > 5.0) {
          this.scene.remove(e.rig.group);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      aliveCount++;
      if (e.staggerTimer > 0) {
        e.staggerTimer -= dt;
        e.pos.addScaledVector(e.vel, dt);
        e.vel.multiplyScalar(0.88);
        e.pos.y = surfaceHeightAt(e.pos.x, e.pos.z, this.world);
        e.rig.group.position.copy(e.pos);
        e.rig.torso.rotation.x = -0.22;
        continue;
      }
      e.rig.torso.rotation.x = THREE.MathUtils.damp(e.rig.torso.rotation.x, 0, 8, dt);

      const distToPlayer = e.pos.distanceTo(this.playerPos);
      let targetPos: THREE.Vector3;
      if (e.pos.z > 13.6 && this.playerPos.z < 13.2) {
        targetPos = _vec3C.set(0, 2, 12.2);
      } else if (distToPlayer < 26) {
        targetPos = this.playerPos;
      } else {
        targetPos = _vec3C.set(0, 2, 15);
      }
      const dx = targetPos.x - e.pos.x;
      const dz = targetPos.z - e.pos.z;
      const distTarget = Math.hypot(dx, dz);

      e.yaw = Math.atan2(dx, dz);
      e.rig.group.rotation.y = e.yaw;

      // Crossbowman ranged behavior
      if (e.variant === 'crossbowman' && distToPlayer < 25 && distToPlayer > 7.5) {
        e.attackCooldown -= dt;
        if (e.attackCooldown <= 0) {
          e.attackCooldown = 2.6 + Math.random() * 0.6;
          this.spawnBolt(
            _vec3D.set(e.pos.x, e.pos.y + 1.35, e.pos.z),
            _vec3A.set(this.playerPos.x, this.playerPos.y + 1.35, this.playerPos.z),
            true
          );
        }
        e.pos.y = surfaceHeightAt(e.pos.x, e.pos.z, this.world);
        e.rig.group.position.copy(e.pos);
        continue;
      }

      // Check Spiked Barricade Collision (slows + damages enemies)
      let slowedByBarricade = false;
      for (const bar of bars) {
        if (bar.hp <= 0) continue;
        if (Math.abs(e.pos.x - bar.pos.x) < 2.6 && Math.abs(e.pos.z - bar.pos.z) < 1.35) {
          slowedByBarricade = true;
          const barDmg = e.variant === 'heavy' ? 18 : 10;
          bar.hp = Math.max(0, bar.hp - barDmg * dt);
          e.hp -= 14 * dt;
          if (bar.hp <= 0) {
            bar.stakesGroup.visible = false;
            this.showBanner('Kazık barikatı kırıldı!');
          }
          if (e.hp <= 0) {
            e.alive = false;
            e.deathTimer = 0;
          }
          break;
        }
      }

      if (distToPlayer < 2.35) {
        e.attackCooldown -= dt;
        if (e.attackCooldown <= 0) {
          e.attackCooldown = e.variant === 'heavy' ? 2.0 : 1.65;
          e.attackAnim = 0.38;

          const incomingDmg = e.variant === 'heavy' ? 24 : 15;
          if (this.isBlocking && this.activeWeapon === 1) {
            this.audio.playShieldBlock();
            this.stamina = Math.max(0, this.stamina - (e.variant === 'heavy' ? 20 : 12));
            this.health = Math.max(0, this.health - (e.variant === 'heavy' ? 5 : 2));
            _vec3D.copy(this.playerPos).add(_vec3A.set(0, 1.3, 0));
            this.spawnBurst(_vec3D, 14, 'spark', 4.5);
          } else {
            this.health = Math.max(0, this.health - incomingDmg);
            this.audio.playArmorHit(e.variant === 'heavy');
            if (this.health <= 0) {
              this.playerDefeated = true;
              if (document.pointerLockElement) document.exitPointerLock();
              this.emitHud(true);
            }
          }
        }
      } else if (distTarget > 1.8) {
        const baseSpeed = e.variant === 'heavy' ? 2.4 : distToPlayer < 26 ? 3.2 : 2.15;
        const moveSpeed = slowedByBarricade ? baseSpeed * 0.35 : baseSpeed;
        const nextEx = e.pos.x + (dx / distTarget) * moveSpeed * dt;
        const nextEz = e.pos.z + (dz / distTarget) * moveSpeed * dt;
        let blockedEx = false;
        let blockedEz = false;
        const eRad = 0.44;
        for (const c of this.world.colliders) {
          if (e.pos.y > c.maxY - 0.3) continue;
          if (
            nextEx + eRad > c.minX &&
            nextEx - eRad < c.maxX &&
            e.pos.z + eRad > c.minZ &&
            e.pos.z - eRad < c.maxZ
          ) {
            blockedEx = true;
          }
          if (
            e.pos.x + eRad > c.minX &&
            e.pos.x - eRad < c.maxX &&
            nextEz + eRad > c.minZ &&
            nextEz - eRad < c.maxZ
          ) {
            blockedEz = true;
          }
        }
        if (!blockedEx) e.pos.x = nextEx;
        if (!blockedEz) e.pos.z = nextEz;
        e.walkCycle += dt * moveSpeed * 2.4;
        e.rig.leftLeg.rotation.x = Math.sin(e.walkCycle) * 0.55;
        e.rig.rightLeg.rotation.x = -Math.sin(e.walkCycle) * 0.55;
      }

      if (e.attackAnim > 0) {
        e.attackAnim -= dt;
        const thrust = Math.sin((1 - e.attackAnim / 0.38) * Math.PI);
        e.rig.rightArm.rotation.x = -0.8 - thrust * 0.85;
      } else {
        e.rig.rightArm.rotation.x = THREE.MathUtils.damp(e.rig.rightArm.rotation.x, -0.35, 10, dt);
      }

      e.pos.y = surfaceHeightAt(e.pos.x, e.pos.z, this.world);
      e.rig.group.position.copy(e.pos);
    }

    if (aliveCount === 0 && !this.siegeRepelled) {
      this.waveCooldown -= dt;
      if (this.waveCooldown <= 0) {
        this.wavesCleared++;
        this.siegeRepelled = true;
        this.activeMissionIndex = 0;
        this.waveCooldown = 6.0;
        if (document.pointerLockElement) document.exitPointerLock();
        this.emitHud(true);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      const idx = i * 3;
      if (!p.active) {
        this.particlePositions[idx] = 0;
        this.particlePositions[idx + 1] = -999;
        this.particlePositions[idx + 2] = 0;
        continue;
      }

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.particlePositions[idx + 1] = -999;
        continue;
      }

      if (p.kind === 'spark') {
        p.vel.y -= 9.8 * dt;
        if (p.pos.y < 2.02 && Math.abs(p.pos.x) < 11 && p.pos.z < 11) {
          p.pos.y = 2.02;
          p.vel.y = Math.abs(p.vel.y) * 0.35;
        }
      } else if (p.kind === 'steam' || p.kind === 'smoke') {
        p.vel.x += (Math.random() - 0.5) * 0.5 * dt;
        p.vel.z += (Math.random() - 0.5) * 0.5 * dt;
      } else if (p.kind === 'dust') {
        p.vel.y -= 3.2 * dt;
      }

      p.pos.addScaledVector(p.vel, dt);
      const fade = 1 - p.life / p.maxLife;
      this.particlePositions[idx] = p.pos.x;
      this.particlePositions[idx + 1] = p.pos.y;
      this.particlePositions[idx + 2] = p.pos.z;
      this.particleColors[idx] = p.color.r * fade;
      this.particleColors[idx + 1] = p.color.g * fade;
      this.particleColors[idx + 2] = p.color.b * fade;
    }
    (this.particleGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.particleGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  private emitHud(force: boolean): void {
    if (!force && this.elapsed - this.lastHudEmit < 0.08) return;
    this.lastHudEmit = this.elapsed;

    let nearest = 999;
    for (let i = 0; i < this.enemies.length; i++) {
      if (!this.enemies[i].alive) continue;
      const d = this.enemies[i].pos.distanceTo(this.playerPos);
      if (d < nearest) nearest = d;
    }

    this.onHudChange({
      phase: this.phase,
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      stamina: Math.round(this.stamina),
      maxStamina: this.maxStamina,
      activeWeapon: this.activeWeapon,
      forgeStage: this.forgeStage,
      forgeTemp: this.forgeTemp,
      forgeHits: this.forgeHits,
      maxForgeHits: this.maxForgeHits,
      hasMasterworkBlade: this.hasMasterworkBlade,
      interactionTarget: this.interactionTarget,
      interactionLabel: this.interactionLabel,
      isMapOpen: this.isMapOpen,
      activeMissionIndex: Math.min(this.activeMissionIndex, TOROS_LANDMARKS.length - 1),
      isCombatActive: this.phase === 'playing' && nearest < 36,
      isBlocking: this.isBlocking,
      pointerLocked: this.pointerLocked,
      statusBanner: this.statusBanner,
      playerDefeated: this.playerDefeated,
      siegeRepelled: this.siegeRepelled,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    dom.removeEventListener('contextmenu', this.onContextMenu);

    this.boulderGeo.dispose();
    this.boulderMat.dispose();
    this.boltGeo.dispose();
    this.boltEnemyMat.dispose();
    this.boltAllyMat.dispose();
    this.particleGeo.dispose();
    this.audio.dispose();
    this.renderer.dispose();
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  }
}
