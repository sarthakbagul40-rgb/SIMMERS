import React from 'react';
import './Mascot.css';

export type MascotState = 'idle' | 'happy' | 'celebrate' | 'hurt' | 'sad';
export type MascotOutfit = 'none' | 'chef' | 'crown' | 'astronaut' | 'forest';

interface MascotProps {
  state: MascotState;
  health: number; // 0 to 100
  level: number;
  xp: number;
  outfit: MascotOutfit;
  name: string;
  rankTitle?: string;
  rankIcon?: string;
}

export const Mascot: React.FC<MascotProps> = ({ state, health, level, xp, name, rankTitle, rankIcon }) => {

  // Convert 0-100 health into 5 hearts count
  const filledHeartsCount = Math.round((health / 100) * 5);

  return (
    <div className="mascot-hero-section">
      {/* Big Pastel Blue Backdrop Circle */}
      <div className="mascot-circle-backdrop">
        {/* Sproutling Eco-Dragon SVG Artwork */}
        <svg
          className={`mascot-svg-stitch mascot-state-${state}`}
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Dragon Body Emerald Gradient */}
            <linearGradient id="dragonBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="60%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Belly Tummy Soft Gradient */}
            <linearGradient id="dragonBellyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ecfdf5" />
              <stop offset="100%" stopColor="#a7f3d0" />
            </linearGradient>

            {/* Leaf Wings Gradient */}
            <linearGradient id="leafWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a3e635" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>

            {/* Gold Crown Gradient */}
            <linearGradient id="goldCrownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>

            {/* Soft Shadow */}
            <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#065f46" floodOpacity="0.25" />
            </filter>
          </defs>

          <g transform="translate(0, 8)" filter="url(#softGlow)">
            {/* Ground Shadow Glow */}
            <ellipse cx="100" cy="168" rx="46" ry="10" fill="rgba(6, 95, 70, 0.25)" />

            {/* Cute Leaf Tail */}
            <path
              d="M 125,142 C 145,145 158,135 162,120 C 160,118 152,118 145,125 C 138,132 130,138 125,142 Z"
              fill="url(#leafWingGrad)"
              stroke="#065f46"
              strokeWidth="2"
            />
            {/* Tail Sprout Leaf Tip */}
            <path
              d="M 162,120 C 168,110 178,112 172,124 C 166,132 162,122 162,120 Z"
              fill="#facc15"
              stroke="#854d0e"
              strokeWidth="1.5"
            />

            {/* Left Leaf Wing */}
            <path
              d="M 68,105 C 40,85 28,105 38,125 C 48,135 68,120 70,115 Z"
              fill="url(#leafWingGrad)"
              stroke="#065f46"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Left Wing Vein */}
            <path d="M 45,108 Q 55,115 65,114" stroke="#047857" strokeWidth="1.5" fill="none" strokeLinecap="round" />

            {/* Right Leaf Wing */}
            <path
              d="M 132,105 C 160,85 172,105 162,125 C 152,135 132,120 130,115 Z"
              fill="url(#leafWingGrad)"
              stroke="#065f46"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Right Wing Vein */}
            <path d="M 155,108 Q 145,115 135,114" stroke="#047857" strokeWidth="1.5" fill="none" strokeLinecap="round" />

            {/* Stubby Dragon Feet */}
            <ellipse cx="80" cy="162" rx="14" ry="9" fill="#10b981" stroke="#065f46" strokeWidth="2.5" />
            <ellipse cx="120" cy="162" rx="14" ry="9" fill="#10b981" stroke="#065f46" strokeWidth="2.5" />
            {/* Toe Claws */}
            <circle cx="74" cy="166" r="2" fill="#ecfdf5" />
            <circle cx="80" cy="167" r="2" fill="#ecfdf5" />
            <circle cx="86" cy="166" r="2" fill="#ecfdf5" />
            <circle cx="114" cy="166" r="2" fill="#ecfdf5" />
            <circle cx="120" cy="167" r="2" fill="#ecfdf5" />
            <circle cx="126" cy="166" r="2" fill="#ecfdf5" />

            {/* Main Dragon Body (Chubby Pear Shape) */}
            <path
              d="M 100,42 C 130,42 144,68 142,105 C 140,140 132,160 100,160 C 68,160 60,140 58,105 C 56,68 70,42 100,42 Z"
              fill="url(#dragonBodyGrad)"
              stroke="#065f46"
              strokeWidth="3"
            />

            {/* Cute Cream Tummy / Belly */}
            <path
              d="M 100,95 C 118,95 125,112 123,138 C 121,154 114,157 100,157 C 86,157 79,154 77,138 C 75,112 82,95 100,95 Z"
              fill="url(#dragonBellyGrad)"
              stroke="#047857"
              strokeWidth="1.5"
            />
            {/* Belly Texture Ribs */}
            <path d="M 86,112 Q 100,117 114,112" stroke="#6ee7b7" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M 84,126 Q 100,131 116,126" stroke="#6ee7b7" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M 85,140 Q 100,145 115,140" stroke="#6ee7b7" strokeWidth="1.5" fill="none" strokeLinecap="round" />

            {/* Cute Rosy Cheeks */}
            <ellipse cx="74" cy="80" rx="7" ry="4" fill="#f43f5e" opacity="0.45" />
            <ellipse cx="126" cy="80" rx="7" ry="4" fill="#f43f5e" opacity="0.45" />

            {/* Dynamic Expressions */}
            {state === 'sad' ? (
              // Sad / Teary Expression 🥺
              <g>
                <circle cx="82" cy="74" r="7" fill="#065f46" />
                <circle cx="118" cy="74" r="7" fill="#065f46" />
                {/* Tear drops */}
                <ellipse cx="76" cy="82" rx="3" ry="5" fill="#38bdf8" />
                <ellipse cx="124" cy="82" rx="3" ry="5" fill="#38bdf8" />
                {/* Sad mouth */}
                <path d="M 93,88 Q 100,81 107,88" stroke="#065f46" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </g>
            ) : state === 'hurt' ? (
              // Hurt Dizzy Expression 😵‍💫
              <g stroke="#065f46" strokeWidth="2.5" strokeLinecap="round" fill="none">
                <path d="M 76,70 L 88,78 M 76,78 L 88,70" />
                <path d="M 112,70 L 124,78 M 112,78 L 124,70" />
                <path d="M 94,88 Q 100,82 106,88" fill="none" />
                <circle cx="100" cy="85" r="2.5" fill="#ef4444" stroke="#065f46" strokeWidth="1" />
              </g>
            ) : state === 'celebrate' || state === 'happy' ? (
              // Super Happy Anime Star Eyes ✨
              <g>
                {/* Happy Eye Arcs */}
                <path d="M 75,74 Q 82,64 89,74" stroke="#065f46" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                <path d="M 111,74 Q 118,64 125,74" stroke="#065f46" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                {/* Joyful open mouth */}
                <path d="M 91,80 Q 100,94 109,80 Z" fill="#f43f5e" stroke="#065f46" strokeWidth="2" />
                <path d="M 95,87 Q 100,83 105,87" fill="#fda4af" />
              </g>
            ) : (
              // Idle / Default Cute Eyes & Smile 🐉
              <g className="mascot-eyes-group">
                {/* Anime Eyes with Lifelike Natural Blink */}
                <g className="mascot-eye-blink">
                  <circle cx="82" cy="73" r="7.5" fill="#065f46" />
                  <circle cx="80" cy="70" r="2.5" fill="#ffffff" />
                  <circle cx="84" cy="75" r="1.2" fill="#ffffff" />

                  <circle cx="118" cy="73" r="7.5" fill="#065f46" />
                  <circle cx="116" cy="70" r="2.5" fill="#ffffff" />
                  <circle cx="120" cy="75" r="1.2" fill="#ffffff" />
                </g>

                {/* Cute W-Smile */}
                <path d="M 92,82 Q 96,87 100,82 Q 104,87 108,82" stroke="#065f46" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </g>
            )}


            {/* Chubby Arms */}
            <path
              d="M 60,110 C 48,112 46,126 60,128"
              fill="#10b981"
              stroke="#065f46"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 140,110 C 152,112 154,126 140,128"
              fill="#10b981"
              stroke="#065f46"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Head Sprout Leaf Antenna / Crown Horn */}
            <g transform="translate(100, 38)">
              {/* Sprout Stem */}
              <path d="M 0,4 Q -4,-12 -12,-20" stroke="#047857" strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M 0,4 Q 4,-12 12,-20" stroke="#047857" strokeWidth="3" fill="none" strokeLinecap="round" />

              {/* Left Sprout Leaf */}
              <path d="M -12,-20 C -25,-25 -22,-5 -10,-12 Z" fill="#a3e635" stroke="#047857" strokeWidth="1.5" />
              {/* Right Sprout Leaf */}
              <path d="M 12,-20 C 25,-25 22,-5 10,-12 Z" fill="#a3e635" stroke="#047857" strokeWidth="1.5" />
              {/* Glowing Sprout Gem */}
              <circle cx="0" cy="-6" r="4.5" fill="#facc15" stroke="#854d0e" strokeWidth="1.5" />
            </g>

            {/* Hero Crown Outfit */}
            <g transform="translate(68, 16) rotate(-8)">
              <polygon
                points="10,24 16,8 26,18 36,4 46,18 56,8 62,24"
                fill="url(#goldCrownGrad)"
                stroke="#854d0e"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="10" y="22" width="52" height="4" fill="#d97706" stroke="#854d0e" strokeWidth="1.5" />
              <circle cx="36" cy="13" r="2.5" fill="#ef4444" />
            </g>
          </g>
        </svg>


        {/* Mascot Name Label & Rank Badge Container */}
        <div className="mascot-name-container">
          <div className="mascot-name-label">{name}</div>
          {rankIcon && rankTitle ? (
            <div className="mascot-rank-sublabel">
              <span>{rankIcon}</span>
              <span>{rankTitle}</span>
            </div>
          ) : null}
        </div>
      </div>


      {/* Floating Overlapping Stats Card */}
      <div className="mascot-stats-card">
        {/* LVL Circle */}
        <div className="lvl-badge-circle">
          <span className="lvl-sub">LVL</span>
          <span className="lvl-val">{level < 10 ? `0${level}` : level}</span>
        </div>

        {/* XP Section */}
        <div className="xp-section">
          <div className="xp-header">
            <span>XP</span>
            <span>({xp}/100)</span>
          </div>
          <div className="xp-track">
            <div className="xp-fill" style={{ width: `${xp}%` }}></div>
          </div>
        </div>

        {/* Health Hearts Section */}
        <div className="health-section">
          <div className="health-title">Health</div>
          <div className="hearts-row">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} className="heart-icon" viewBox="0 0 24 24">
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill={i < filledHeartsCount ? '#c2410c' : '#ffffff'}
                  stroke="#1e293b"
                  strokeWidth="2"
                />
              </svg>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
