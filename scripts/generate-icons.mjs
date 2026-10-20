// Génère les icônes PWA de Comora (public/icons/) à partir du logo vectoriel :
// l'arche sable et sa porte corail sur fond vert profond.
// Usage : npm run icons
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const INK = "#16241f";
const SAND = "#efece3";
const CORAL = "#e2693c";

/** Logo carré ; `inset` réduit l'arche (zone de sécurité des icônes « maskable »). */
function svg({ rounded, inset = 0 }) {
  const scale = 1 - inset;
  const offset = (100 * inset) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${rounded ? 22 : 0}" fill="${INK}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M34 70V48a16 16 0 0 1 32 0v22z" fill="${SAND}"/>
    <path d="M44 70V54a6 6 0 0 1 12 0v16z" fill="${CORAL}"/>
  </g>
</svg>`;
}

const outputs = [
  { file: "public/icons/icon-192.png", size: 192, rounded: true },
  { file: "public/icons/icon-512.png", size: 512, rounded: true },
  { file: "public/icons/maskable-512.png", size: 512, rounded: false, inset: 0.2 },
  { file: "public/icons/apple-touch-icon.png", size: 180, rounded: false },
];

mkdirSync("public/icons", { recursive: true });
for (const { file, size, ...opts } of outputs) {
  await sharp(Buffer.from(svg(opts))).resize(size, size).png().toFile(file);
  console.log(`✓ ${file}`);
}
