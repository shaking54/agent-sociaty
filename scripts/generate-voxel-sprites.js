// Generates crisp 2.5D Isometric Voxel SVG Game Sprites (Characters, Buildings & Props)
// Styled with dark ink outlines, 3-face isometric voxel shading & neon accents matching foundation-models-6-roles.jpg

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'assets', 'sprites');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Helper to draw an isometric voxel cube in SVG at top-center (cx, cy) with half-width w, half-depth d=w/2, height h
function svgIsoBox(cx, cy, w, h, topCol, leftCol, rightCol, stroke = '#0f172a', strokeW = 1.6) {
  const d = w * 0.5;
  const top = `M ${cx} ${cy - d} L ${cx + w} ${cy} L ${cx} ${cy + d} L ${cx - w} ${cy} Z`;
  const left = `M ${cx - w} ${cy} L ${cx} ${cy + d} L ${cx} ${cy + d + h} L ${cx - w} ${cy + h} Z`;
  const right = `M ${cx} ${cy + d} L ${cx + w} ${cy} L ${cx + w} ${cy + h} L ${cx} ${cy + d + h} Z`;
  return `
    <path d="${left}" fill="${leftCol}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round" />
    <path d="${right}" fill="${rightCol}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round" />
    <path d="${top}" fill="${topCol}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round" />
  `;
}

// 1. Character Voxel Sprite Generator (Farmer, Engineer, Manager, Robot, Ancestor)
function makeCharacterSvg(opts) {
  const {
    hairTop, hairLeft, hairRight,
    skinTop = '#fed7aa', skinLeft = '#fdba74', skinRight = '#f97316',
    shirtTop, shirtLeft, shirtRight,
    pantsTop = '#475569', pantsLeft = '#334155', pantsRight = '#1e293b',
    visorColor = null,
    crown = false,
    heldProp = '',
    opacity = 1.0
  } = opts;

  let body = `<g opacity="${opacity}">`;
  // Ground shadow
  body += `<ellipse cx="64" cy="108" rx="22" ry="11" fill="rgba(0,0,0,0.42)" />`;

  // Left & Right Boots/Legs
  body += svgIsoBox(56, 86, 8, 16, '#1e293b', '#0f172a', '#020617', '#090d16', 1.8);
  body += svgIsoBox(72, 86, 8, 16, '#1e293b', '#0f172a', '#020617', '#090d16', 1.8);
  body += svgIsoBox(56, 74, 8.5, 14, pantsTop, pantsLeft, pantsRight, '#090d16', 1.8);
  body += svgIsoBox(72, 74, 8.5, 14, pantsTop, pantsLeft, pantsRight, '#090d16', 1.8);

  // Voxel Torso
  body += svgIsoBox(64, 52, 16, 24, shirtTop, shirtLeft, shirtRight, '#090d16', 2.0);

  // Left & Right Voxel Arms
  body += svgIsoBox(45, 56, 6.5, 18, shirtTop, shirtLeft, shirtRight, '#090d16', 1.8);
  body += svgIsoBox(45, 72, 6, 6, skinTop, skinLeft, skinRight, '#090d16', 1.6);
  body += svgIsoBox(83, 56, 6.5, 18, shirtTop, shirtLeft, shirtRight, '#090d16', 1.8);
  body += svgIsoBox(83, 72, 6, 6, skinTop, skinLeft, skinRight, '#090d16', 1.6);

  // Held role prop (Crate / Blueprint Tablet / Ledger Scroll)
  body += heldProp;

  // Voxel Head
  body += svgIsoBox(64, 28, 15, 19, skinTop, skinLeft, skinRight, '#090d16', 2.0);

  // Pixel Eyes on front-right / front-left face
  if (visorColor) {
    // Glowing Cyber Visor for Engineer / Robot
    body += `<path d="M 53 34 L 64 39.5 L 76 33.5 L 76 38.5 L 64 44.5 L 53 39 Z" fill="${visorColor}" stroke="#090d16" stroke-width="1.4" />`;
  } else {
    body += `<rect x="55" y="34" width="3.2" height="4.5" rx="1" fill="#0f172a" transform="skewY(25)" />`;
    body += `<rect x="68" y="6" width="3.2" height="4.5" rx="1" fill="#0f172a" transform="skewY(-25)" />`;
  }

  // Voxel Hair / Hat
  body += svgIsoBox(64, 19, 16, 8, hairTop, hairLeft, hairRight, '#090d16', 2.0);

  // Optional Archon Golden Crown
  if (crown) {
    body += svgIsoBox(64, 10, 12, 7, '#fde047', '#eab308', '#ca8a04', '#422006', 1.8);
    body += `<circle cx="64" cy="6" r="3" fill="#38bdf8" stroke="#090d16" stroke-width="1.2" />`;
  }

  body += `</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 124" width="128" height="124">${body}</svg>`;
}

// 2. Building: Granary Castle (modeled on GAME DESIGN castle in foundation-models-6-roles.jpg)
function makeGranaryCastleSvg() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 190" width="220" height="190">`;
  // Main stone keep
  s += svgIsoBox(110, 78, 56, 48, '#cbd5e1', '#94a3b8', '#64748b', '#0f172a', 2.2);
  // Arched wooden gate on front-right wall
  s += `<path d="M 122 118 L 142 108 L 142 132 L 122 142 Z" fill="#78350f" stroke="#0f172a" stroke-width="2" />`;
  // 4 Corner Towers with Red Peaked Roofs
  const towers = [
    { x: 110, y: 42 }, // Back tower
    { x: 62, y: 68 },  // Left tower
    { x: 158, y: 68 }, // Right tower
    { x: 110, y: 96 }  // Front tower
  ];
  towers.forEach((t) => {
    s += svgIsoBox(t.x, t.y, 18, 46, '#e2e8f0', '#94a3b8', '#475569', '#0f172a', 2.0);
    s += svgIsoBox(t.x, t.y - 10, 20, 10, '#f87171', '#ef4444', '#b91c1c', '#0f172a', 1.8);
    s += svgIsoBox(t.x, t.y - 17, 12, 7, '#fca5a5', '#f87171', '#dc2626', '#0f172a', 1.6);
    // Red flag on top
    s += `<line x1="${t.x}" y1="${t.y - 20}" x2="${t.x}" y2="${t.y - 34}" stroke="#0f172a" stroke-width="2" />`;
    s += `<polygon points="${t.x},${t.y - 34} ${t.x + 11},${t.y - 30} ${t.x},${t.y - 25}" fill="#ef4444" stroke="#0f172a" stroke-width="1.2" />`;
  });
  s += `</svg>`;
  return s;
}

// 3. Building: Dual Code Monitors & Voxel Modules (modeled on CODE BUILDING in foundation-models-6-roles.jpg)
function makeCodeLabSvg() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 180" width="220" height="180">`;
  // Left giant angled monitor
  s += `<g transform="translate(68, 72) skewY(-26.5)">
    <rect x="-48" y="-42" width="92" height="68" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="3" />
    <rect x="-42" y="-36" width="80" height="56" fill="#020617" />
    <rect x="-36" y="-28" width="38" height="4" fill="#34d399" />
    <rect x="-36" y="-20" width="54" height="4" fill="#38bdf8" />
    <rect x="-28" y="-12" width="46" height="4" fill="#f472b6" />
    <rect x="-28" y="-4" width="60" height="4" fill="#fbbf24" />
    <rect x="-36" y="4" width="42" height="4" fill="#a855f7" />
    <rect x="-28" y="12" width="50" height="4" fill="#22d3ee" />
  </g>`;
  // Right giant angled monitor
  s += `<g transform="translate(152, 72) skewY(26.5)">
    <rect x="-44" y="-42" width="92" height="68" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="3" />
    <rect x="-38" y="-36" width="80" height="56" fill="#020617" />
    <rect x="-32" y="-28" width="48" height="4" fill="#fbbf24" />
    <rect x="-24" y="-20" width="56" height="4" fill="#22d3ee" />
    <rect x="-24" y="-12" width="40" height="4" fill="#34d399" />
    <rect x="-32" y="-4" width="62" height="4" fill="#f472b6" />
    <rect x="-24" y="4" width="46" height="4" fill="#38bdf8" />
    <rect x="-32" y="12" width="34" height="4" fill="#c084fc" />
  </g>`;
  // Glowing syntax/blueprint pill blocks in foreground (just like CODE BUILDING!)
  s += svgIsoBox(78, 128, 18, 8, '#fde047', '#eab308', '#ca8a04', '#0f172a', 1.8);
  s += svgIsoBox(108, 142, 18, 8, '#67e8f9', '#06b6d4', '#0e7490', '#0f172a', 1.8);
  s += svgIsoBox(138, 128, 18, 8, '#f472b6', '#db2777', '#9d174d', '#0f172a', 1.8);
  s += svgIsoBox(108, 114, 18, 8, '#4ade80', '#16a34a', '#14532d', '#0f172a', 1.8);
  s += `</svg>`;
  return s;
}

// 4. Building: Red Suspension Bridge (modeled on TESTING in foundation-models-6-roles.jpg)
function makeRedBridgeSvg() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 170" width="220" height="170">`;
  // Bridge Deck
  s += svgIsoBox(110, 102, 68, 10, '#f87171', '#dc2626', '#991b1b', '#0f172a', 2.0);
  // Two Tall Red Suspension Pylons
  s += svgIsoBox(76, 52, 9, 56, '#ef4444', '#b91c1c', '#7f1d1d', '#0f172a', 2.0);
  s += svgIsoBox(144, 52, 9, 56, '#ef4444', '#b91c1c', '#7f1d1d', '#0f172a', 2.0);
  // Suspension Cables
  s += `<path d="M 42 98 Q 76 62 76 52 Q 110 86 144 52 Q 144 62 178 98" fill="none" stroke="#fca5a5" stroke-width="2.5" />`;
  // Golden GCOIN Crates
  s += svgIsoBox(54, 122, 14, 14, '#fde047', '#eab308', '#a16207', '#0f172a', 1.8);
  s += svgIsoBox(166, 122, 14, 14, '#fde047', '#eab308', '#a16207', '#0f172a', 1.8);
  s += `</svg>`;
  return s;
}

// 5. Building: Voxel Tree (modeled on AUTONOMOUS AGENTS trees in foundation-models-6-roles.jpg)
function makeVoxelTreeSvg() {
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 120" width="96" height="120">`;
  s += `<ellipse cx="48" cy="104" rx="18" ry="9" fill="rgba(0,0,0,0.35)" />`;
  s += svgIsoBox(48, 76, 8, 24, '#92400e', '#78350f', '#451a03', '#0f172a', 2.0);
  s += svgIsoBox(48, 48, 24, 24, '#4ade80', '#22c55e', '#15803d', '#0f172a', 2.0);
  s += svgIsoBox(48, 30, 17, 16, '#86efac', '#4ade80', '#16a34a', '#0f172a', 2.0);
  s += `</svg>`;
  return s;
}

// Write all sprites
const sprites = {
  'char-farmer.svg': makeCharacterSvg({
    hairTop: '#92400e', hairLeft: '#78350f', hairRight: '#451a03',
    shirtTop: '#34d399', shirtLeft: '#10b981', shirtRight: '#047857',
    heldProp: svgIsoBox(88, 66, 9, 9, '#fde047', '#eab308', '#a16207', '#090d16', 1.5)
  }),
  'char-engineer.svg': makeCharacterSvg({
    hairTop: '#1e293b', hairLeft: '#0f172a', hairRight: '#020617',
    shirtTop: '#38bdf8', shirtLeft: '#0284c7', shirtRight: '#0369a1',
    visorColor: '#22d3ee',
    heldProp: svgIsoBox(88, 66, 8, 4, '#67e8f9', '#06b6d4', '#0891b2', '#090d16', 1.4)
  }),
  'char-manager.svg': makeCharacterSvg({
    hairTop: '#b45309', hairLeft: '#92400e', hairRight: '#78350f',
    shirtTop: '#a855f7', shirtLeft: '#9333ea', shirtRight: '#6b21a8',
    heldProp: svgIsoBox(88, 66, 7, 10, '#f472b6', '#db2777', '#9d174d', '#090d16', 1.4)
  }),
  'char-archon.svg': makeCharacterSvg({
    hairTop: '#1e293b', hairLeft: '#0f172a', hairRight: '#020617',
    shirtTop: '#f472b6', shirtLeft: '#db2777', shirtRight: '#9d174d',
    crown: true,
    heldProp: svgIsoBox(88, 64, 9, 11, '#fde047', '#eab308', '#ca8a04', '#090d16', 1.6)
  }),
  'char-bot.svg': makeCharacterSvg({
    hairTop: '#e2e8f0', hairLeft: '#cbd5e1', hairRight: '#94a3b8',
    skinTop: '#f8fafc', skinLeft: '#cbd5e1', skinRight: '#94a3b8',
    shirtTop: '#e2e8f0', shirtLeft: '#94a3b8', shirtRight: '#64748b',
    visorColor: '#38bdf8'
  }),
  'char-ancestor.svg': makeCharacterSvg({
    hairTop: '#c084fc', hairLeft: '#a855f7', hairRight: '#7e22ce',
    skinTop: '#e9d5ff', skinLeft: '#d8b4fe', skinRight: '#c084fc',
    shirtTop: '#a855f7', shirtLeft: '#9333ea', shirtRight: '#6b21a8',
    opacity: 0.82
  }),
  'bldg-granary-castle.svg': makeGranaryCastleSvg(),
  'bldg-code-monitors.svg': makeCodeLabSvg(),
  'bldg-red-bridge.svg': makeRedBridgeSvg(),
  'bldg-voxel-tree.svg': makeVoxelTreeSvg()
};

Object.entries(sprites).forEach(([filename, content]) => {
  fs.writeFileSync(path.join(OUT_DIR, filename), content, 'utf8');
});

console.log(`Generated ${Object.keys(sprites).length} 2.5D Isometric Voxel SVG sprites in ${OUT_DIR}`);
