export type GamePhase = 'title' | 'playing';

export type WeaponId = 1 | 2 | 3;

export type ForgeStage =
  | 'idle'
  | 'heating'
  | 'ready_for_anvil'
  | 'forging'
  | 'ready_for_quench'
  | 'quenched';

export type InteractionTarget =
  | 'forge'
  | 'anvil'
  | 'barrel'
  | 'map_table'
  | 'catapult'
  | 'boulder_lever'
  | 'boulder_drop_lever'
  | 'barricade_gate'
  | 'barricade_bridge'
  | null;

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  subtitle: string;
}

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  1: {
    id: 1,
    name: 'Şam Çeliği Kılıç ve Kalkan',
    subtitle: 'Dengeli Saldırı ve Savunma',
  },
  2: {
    id: 2,
    name: 'Demirci Çekici',
    subtitle: 'Örs Dövme ve Zırh Kırıcı',
  },
  3: {
    id: 3,
    name: 'Ağır Savaş Baltası',
    subtitle: 'Yüksek Yıkıcı Darbe',
  },
};

export interface MapLandmark {
  id: string;
  name: string;
  description: string;
  mapX: number; // SVG 0..1000
  mapY: number; // SVG 0..640
  worldX: number;
  worldZ: number;
}

export const TOROS_LANDMARKS: MapLandmark[] = [
  {
    id: 'kizilgecit',
    name: 'Kızılgeçit Kalesi',
    description: 'Ana üs, demirci atölyesi ve sur savunma hattı.',
    mapX: 255,
    mapY: 225,
    worldX: 0,
    worldZ: 0,
  },
  {
    id: 'kartal_kayasi',
    name: 'Kartal Kayası Gözetleme Kulesi',
    description: 'Batı sırtındaki yüksek gözetleme ve mancınık burcu.',
    mapX: 165,
    mapY: 120,
    worldX: -28,
    worldZ: -18,
  },
  {
    id: 'tas_kopru',
    name: 'Taş Kemer Köprü ve Dere Geçidi',
    description: 'Toros deresini aşan tek kilit taş kemer geçit.',
    mapX: 495,
    mapY: 330,
    worldX: 4,
    worldZ: 46,
  },
  {
    id: 'ikmal_kampi',
    name: 'İkmal Yolu ve Erzak Kampı',
    description: 'Geçit vadisindeki erzak, demir cevheri ve mühimmat menzili.',
    mapX: 680,
    mapY: 425,
    worldX: -16,
    worldZ: 74,
  },
  {
    id: 'ileri_karakol',
    name: 'Toros Geçidi İleri Gözetleme Karakolu',
    description: 'Güney boğazındaki ilk savunma karakolu ve gözetleme noktası.',
    mapX: 830,
    mapY: 505,
    worldX: 18,
    worldZ: 96,
  },
];

export interface HudState {
  phase: GamePhase;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  activeWeapon: WeaponId;
  forgeStage: ForgeStage;
  forgeTemp: number; // 0..1
  forgeHits: number;
  maxForgeHits: number;
  hasMasterworkBlade: boolean;
  interactionTarget: InteractionTarget;
  interactionLabel: string | null;
  isMapOpen: boolean;
  activeMissionIndex: number;
  isCombatActive: boolean;
  isBlocking: boolean;
  pointerLocked: boolean;
  statusBanner: string | null;
  playerDefeated: boolean;
  siegeRepelled: boolean;
}
