import React from 'react';

interface TitleScreenProps {
  onStart: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none">
      {/* Measured contrast scrim preserving clear view of the live 3D forge workshop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(12,9,7,0.84) 0%, rgba(12,9,7,0.52) 48%, rgba(12,9,7,0.16) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col justify-center h-full max-w-2xl px-10 md:px-16 pointer-events-auto">
        <p className="text-xs md:text-sm tracking-[0.22em] text-[#d5a862] font-semibold mb-4">
          ENES ÖZTÜRK SUNAR — KIZILGEÇİT KALESİ VE TOROS GEÇİTLERİ
        </p>

        <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.08] tracking-wide text-[#f6efe2] mb-6">
          TOROS FORGE:
          <span className="block text-[#e5a852] mt-1">THE MASTER&apos;S ANVIL</span>
        </h1>

        <div className="w-24 h-[1px] bg-[#c58e44]/60 mb-6" />

        <p className="text-base md:text-lg leading-relaxed text-[#ded4c4] max-w-xl mb-10">
          Ocağı harla, çeliği örste döv ve su vererek bileyle. Kendi ellerinle dövdüğün
          silahlarla Toros geçitlerini kuşatmaya karşı savun.
        </p>

        <div>
          <button
            type="button"
            onClick={onStart}
            className="font-display px-9 py-4 text-sm md:text-base font-bold tracking-[0.18em] text-[#17110a] bg-gradient-to-b from-[#e4b363] to-[#b97e2f] border border-[#f2d08f]/60 shadow-lg hover:from-[#efc378] hover:to-[#ca8b36] active:scale-[0.98] transition-all cursor-pointer"
          >
            OYUNA BAŞLA
          </button>
        </div>
      </div>
    </div>
  );
};
