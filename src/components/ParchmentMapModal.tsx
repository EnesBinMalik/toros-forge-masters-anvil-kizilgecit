import React, { useState } from 'react';
import { X } from 'lucide-react';
import { TOROS_LANDMARKS } from '../types/game';

interface ParchmentMapModalProps {
  activeMissionIndex: number;
  onClose: () => void;
}

export const ParchmentMapModal: React.FC<ParchmentMapModalProps> = ({
  activeMissionIndex,
  onClose,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(activeMissionIndex);
  const activeLandmark = TOROS_LANDMARKS[selectedIdx] ?? TOROS_LANDMARKS[0];
  const missionLandmark = TOROS_LANDMARKS[activeMissionIndex] ?? TOROS_LANDMARKS[0];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0d0a07]/82 p-4 md:p-8">
      <div
        className="relative w-full max-w-5xl border-2 border-[#6e5232] shadow-2xl overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, #ecdcb9 0%, #dbc395 62%, #bfa06c 100%)',
        }}
      >
        {/* Top Parchment Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#6e5232]/40">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-bold tracking-wider text-[#2d1e10]">
              TOROS GEÇİDİ SAVUNMA KROKİSİ
            </h2>
            <p className="text-xs text-[#593f25] mt-0.5">
              Kızılgeçit Kalesi ve Toros Geçitleri Harekat Haritası
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Haritayı Kapat"
            className="p-2 text-[#3a2614] hover:bg-[#5a3e22]/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hand-drawn SVG Topographic Parchment Map */}
        <div className="relative w-full aspect-[1000/560] bg-[#e2cea4]/40">
          <svg
            viewBox="0 0 1000 560"
            className="w-full h-full block"
            role="img"
            aria-label="Toros Geçidi Savunma Krokisi"
          >
            <defs>
              <filter id="inkRough" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" />
              </filter>
            </defs>

            {/* Decorative Ink Double Border */}
            <rect
              x="18"
              y="18"
              width="964"
              height="524"
              fill="none"
              stroke="#5c3e20"
              strokeWidth="2"
              opacity="0.7"
            />
            <rect
              x="25"
              y="25"
              width="950"
              height="510"
              fill="none"
              stroke="#5c3e20"
              strokeWidth="1"
              opacity="0.45"
            />

            {/* Topographic Mountain Ridges (Toros Dağları) */}
            <g stroke="#7a5a38" strokeWidth="1.3" fill="none" opacity="0.48" filter="url(#inkRough)">
              <path d="M 60 120 Q 150 45 250 110 T 430 85 T 640 130 T 870 90" />
              <path d="M 85 155 Q 180 95 280 145 T 490 125 T 710 160 T 920 125" />
              <path d="M 70 430 Q 210 385 360 440 T 620 455 T 890 410" />
              <path d="M 110 470 Q 260 430 410 480 T 690 490 T 930 465" />
            </g>

            {/* Hand-inked Mountain Peak Silhouettes */}
            <g stroke="#4b341d" strokeWidth="1.6" fill="#c7ab78" fillOpacity="0.35">
              <polygon points="110,130 148,72 188,130" />
              <polygon points="165,132 195,86 226,132" />
              <polygon points="620,145 668,78 716,145" />
              <polygon points="220,475 268,408 316,475" />
            </g>

            {/* Clear Mountain Stream (Toros Deresi) */}
            <path
              d="M 40 390 C 210 370, 360 340, 495 330 C 640 320, 780 265, 955 235"
              fill="none"
              stroke="#3b6b7d"
              strokeWidth="9"
              strokeLinecap="round"
              opacity="0.62"
            />
            <path
              d="M 40 390 C 210 370, 360 340, 495 330 C 640 320, 780 265, 955 235"
              fill="none"
              stroke="#244856"
              strokeWidth="1.5"
              strokeDasharray="10 8"
              opacity="0.7"
            />

            {/* Main Mountain Pass Road (Geçit Yolu) */}
            <path
              d="M 165 120 L 255 225 L 495 330 L 680 425 L 830 505"
              fill="none"
              stroke="#4d3219"
              strokeWidth="2.8"
              strokeDasharray="10 7"
              opacity="0.82"
            />

            {/* Compass Rose (Pusula) */}
            <g transform="translate(880, 115)" stroke="#3e2814" fill="none">
              <circle cx="0" cy="0" r="34" strokeWidth="1.2" opacity="0.7" />
              <polygon points="0,-30 6,-6 0,-12 -6,-6" fill="#7c221c" />
              <polygon points="0,30 6,6 0,12 -6,6" fill="#4d3219" opacity="0.6" />
              <line x1="-26" y1="0" x2="26" y2="0" strokeWidth="1.1" />
              <text
                x="0"
                y="-38"
                textAnchor="middle"
                fill="#3e2814"
                fontSize="12"
                fontFamily="Cinzel, serif"
                fontWeight="700"
              >
                K
              </text>
            </g>

            {/* 5 Landmarks & Single Red Wax Seal on Active Mission */}
            {TOROS_LANDMARKS.map((lm, idx) => {
              const isMission = lm.id === missionLandmark.id;
              const isSelected = idx === selectedIdx;

              return (
                <g
                  key={lm.id}
                  transform={`translate(${lm.mapX}, ${lm.mapY})`}
                  onClick={() => setSelectedIdx(idx)}
                  className="cursor-pointer"
                >
                  {/* Clean Ink Marker */}
                  <rect
                    x="-7"
                    y="-7"
                    width="14"
                    height="14"
                    transform="rotate(45)"
                    fill={isSelected ? '#3a2310' : '#d6bb88'}
                    stroke="#3a2310"
                    strokeWidth="2"
                  />

                  {/* Single Elegant Red Wax Seal ONLY on Active Objective */}
                  {isMission && (
                    <g transform="translate(20, -18)">
                      <circle cx="0" cy="0" r="14" fill="#8b1e1a" stroke="#530e0c" strokeWidth="1.8" />
                      <circle cx="0" cy="0" r="9.5" fill="none" stroke="#d8967d" strokeWidth="1" opacity="0.65" />
                      <path d="M -3 -4 L 3 -4 L 0 5 Z" fill="#f1d9c6" opacity="0.9" />
                    </g>
                  )}

                  {/* Landmark Title */}
                  <text
                    x="0"
                    y="26"
                    textAnchor="middle"
                    fill="#2b1c0e"
                    fontSize="13.5"
                    fontFamily="Cinzel, serif"
                    fontWeight="700"
                  >
                    {lm.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Landmark Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 bg-[#d3b986]/55 border-t border-[#6e5232]/40">
          <div>
            <p className="font-display text-base font-bold text-[#2b1b0e]">
              {activeLandmark.name}
            </p>
            <p className="text-sm text-[#4f3720]">{activeLandmark.description}</p>
          </div>
          <div className="text-xs font-medium text-[#7c1d19] whitespace-nowrap">
            Aktif Müdahale Noktası: {missionLandmark.name}
          </div>
        </div>
      </div>
    </div>
  );
};
