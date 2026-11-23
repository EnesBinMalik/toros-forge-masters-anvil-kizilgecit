/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { ParchmentMapModal } from './components/ParchmentMapModal';
import { TitleScreen } from './components/TitleScreen';
import { TorosEngine } from './engine/TorosEngine';
import { HudState, WeaponId } from './types/game';

const INITIAL_HUD: HudState = {
  phase: 'title',
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  activeWeapon: 1,
  forgeStage: 'idle',
  forgeTemp: 0,
  forgeHits: 0,
  maxForgeHits: 6,
  hasMasterworkBlade: false,
  interactionTarget: null,
  interactionLabel: null,
  isMapOpen: false,
  activeMissionIndex: 3,
  isCombatActive: false,
  isBlocking: false,
  pointerLocked: false,
  statusBanner: null,
  playerDefeated: false,
  siegeRepelled: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TorosEngine | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new TorosEngine(mount, (nextHud) => {
      setHud(nextHud);
    });
    engineRef.current = engine;

    const canvas = mount.querySelector('canvas');
    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => {
      setContextLost(false);
    };

    if (canvas) {
      canvas.addEventListener('webglcontextlost', handleLost);
      canvas.addEventListener('webglcontextrestored', handleRestored);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', handleLost);
        canvas.removeEventListener('webglcontextrestored', handleRestored);
      }
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = () => {
    engineRef.current?.startGame();
  };

  const handleSelectWeapon = (id: WeaponId) => {
    engineRef.current?.selectWeapon(id);
  };

  const handleCloseMap = () => {
    engineRef.current?.toggleMap(false);
  };

  const handleRestart = () => {
    engineRef.current?.restartDefense();
  };

  const handleContinue = () => {
    engineRef.current?.continueDefense();
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0e0c0a]">
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0e0c0a]/95 text-[#ede4d3]">
          <div className="text-center px-6">
            <h2 className="font-display text-2xl font-bold text-[#e5a852] mb-2">
              Görüntü Bağlamı Yenileniyor
            </h2>
            <p className="text-sm text-[#cfc4b2]">
              Kızılgeçit Kalesi sahnesi yeniden yükleniyor, lütfen bekleyin.
            </p>
          </div>
        </div>
      )}

      {hud.phase === 'title' && <TitleScreen onStart={handleStart} />}

      {hud.phase === 'playing' && (
        <GameHud
          hud={hud}
          onSelectWeapon={handleSelectWeapon}
          onRestart={handleRestart}
          onContinue={handleContinue}
        />
      )}

      {hud.phase === 'playing' && hud.isMapOpen && (
        <ParchmentMapModal
          activeMissionIndex={hud.activeMissionIndex}
          onClose={handleCloseMap}
        />
      )}
    </main>
  );
}
