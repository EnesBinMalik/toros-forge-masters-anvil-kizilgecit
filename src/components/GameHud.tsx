import React from 'react';
import { Hammer, Shield, Sword, Axe } from 'lucide-react';
import { HudState, WEAPONS, WeaponId } from '../types/game';

interface GameHudProps {
  hud: HudState;
  onSelectWeapon: (id: WeaponId) => void;
  onRestart: () => void;
  onContinue: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  onSelectWeapon,
  onRestart,
  onContinue,
}) => {
  const healthPct = Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100));
  const staminaPct = Math.max(0, Math.min(100, (hud.stamina / hud.maxStamina) * 100));
  const activeWeapon = WEAPONS[hud.activeWeapon];

  const cycleWeapon = () => {
    const next: WeaponId = hud.activeWeapon === 1 ? 2 : hud.activeWeapon === 2 ? 3 : 1;
    onSelectWeapon(next);
  };

  const renderWeaponIcon = () => {
    if (hud.activeWeapon === 1) {
      return (
        <div className="flex items-center gap-1.5 text-[#e6c994]">
          <Sword className="w-5 h-5" strokeWidth={1.75} />
          <Shield className="w-4 h-4 text-[#b79a66]" strokeWidth={1.75} />
        </div>
      );
    }
    if (hud.activeWeapon === 2) {
      return <Hammer className="w-5 h-5 text-[#e6c994]" strokeWidth={1.75} />;
    }
    return <Axe className="w-5 h-5 text-[#e6c994]" strokeWidth={1.75} />;
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Top-Left: Slender Wrought-Iron Framed Health & Stamina Indicator ONLY */}
      <div className="absolute top-6 left-6 w-56">
        <div className="bg-[#14100d]/85 border border-[#4a3d2e] p-1.5 shadow-md">
          <div className="h-2 w-full bg-[#241c17] overflow-hidden mb-1">
            <div
              className="h-full bg-gradient-to-r from-[#7c1d19] to-[#b8322a] transition-all duration-150"
              style={{ width: `${healthPct}%` }}
            />
          </div>
          <div className="h-1 w-full bg-[#241c17] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#8f6c32] to-[#d6a95c] transition-all duration-150"
              style={{ width: `${staminaPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Subtle Center Crosshair */}
      {!hud.isMapOpen && !hud.playerDefeated && !hud.siegeRepelled && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#f4ead8]/80 shadow-[0_0_4px_rgba(0,0,0,0.9)]" />
        </div>
      )}

      {/* Contextual Single-Line Interaction Prompt */}
      {hud.interactionLabel && !hud.isMapOpen && !hud.playerDefeated && (
        <div className="absolute top-[56%] left-1/2 -translate-x-1/2">
          <div className="px-4 py-1.5 bg-[#14100d]/88 border border-[#6e573a] text-[#f2e8d5] text-sm tracking-wide whitespace-nowrap">
            {hud.interactionLabel}
          </div>
        </div>
      )}

      {/* Brief Narrative / Forge Completion Banner */}
      {hud.statusBanner && !hud.isMapOpen && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2">
          <div className="px-5 py-2 bg-[#16110c]/90 border border-[#a1783c] text-[#f3e6ce] font-display text-sm tracking-wider whitespace-nowrap shadow-lg">
            {hud.statusBanner}
          </div>
        </div>
      )}

      {/* Bottom-Right: Clean Selected Weapon Icon & Label ONLY (Zero brackets or counters) */}
      <div className="absolute bottom-6 right-6 pointer-events-auto">
        <button
          type="button"
          onClick={cycleWeapon}
          title={activeWeapon.name}
          className="flex items-center gap-3 px-4 py-2.5 bg-[#14100d]/85 border border-[#4a3d2e] hover:border-[#8e6d3f] transition-colors cursor-pointer"
        >
          {renderWeaponIcon()}
          <span className="text-sm font-medium text-[#ede3d2] whitespace-nowrap">
            {activeWeapon.name}
          </span>
        </button>
      </div>

      {/* Defeat Overlay */}
      {hud.playerDefeated && (
        <div className="fixed inset-0 bg-[#0d0907]/80 flex items-center justify-center pointer-events-auto">
          <div className="max-w-md w-full mx-6 bg-[#17120e] border border-[#685035] p-8 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-[#e5a852] mb-3">
              Kızılgeçit Savunması Düştü
            </h2>
            <p className="text-sm text-[#d4c8b6] mb-6 leading-relaxed">
              Kuşatma öncüleri geçidi aştı. Ocağı yeniden harla ve kaleyi savunmak için ayağa kalk.
            </p>
            <button
              type="button"
              onClick={onRestart}
              className="font-display px-7 py-3 text-sm font-bold tracking-widest text-[#17110a] bg-gradient-to-b from-[#e4b363] to-[#b97e2f] hover:from-[#efc378] hover:to-[#ca8b36] cursor-pointer"
            >
              YENİDEN SAVUN
            </button>
          </div>
        </div>
      )}

      {/* Siege Wave Repelled Overlay */}
      {hud.siegeRepelled && !hud.playerDefeated && (
        <div className="fixed inset-0 bg-[#0d0907]/72 flex items-center justify-center pointer-events-auto">
          <div className="max-w-md w-full mx-6 bg-[#17120e] border border-[#7d623e] p-8 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-[#e5a852] mb-3">
              Kuşatma Püskürtüldü
            </h2>
            <p className="text-sm text-[#d4c8b6] mb-6 leading-relaxed">
              Toros Geçidi ve Kızılgeçit Kalesi düşman öncülerinden temizlendi. Yeni dalga yaklaşıyor.
            </p>
            <button
              type="button"
              onClick={onContinue}
              className="font-display px-7 py-3 text-sm font-bold tracking-widest text-[#17110a] bg-gradient-to-b from-[#e4b363] to-[#b97e2f] hover:from-[#efc378] hover:to-[#ca8b36] cursor-pointer"
            >
              SAVUNMAYA DEVAM ET
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
