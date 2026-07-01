// Run once: node scripts/fetch-pubs.mjs
// Fetches free Open Pubs data for central London boroughs, filters to the
// Scotland Yard board bounding box, and writes the result to
// apps/frontend-pixi/public/data/london-pubs.json

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Scotland Yard board bounding box (from london-coords.ts)
const LAT_MIN = 51.483;
const LAT_MAX = 51.535;
const LNG_MIN = -0.195;
const LNG_MAX = -0.055;

const BOROUGHS = [
  'westminster',
  'city-of-london',
  'camden',
  'islington',
  'southwark',
  'tower-hamlets',
  'hackney',
  'lambeth',
  'wandsworth',
  'kensington-and-chelsea',
];

async function fetchBorough(borough) {
  const url = `https://download.getthedata.com/downloads/open_pubs_${borough}.csv`;
  console.log(`Fetching ${borough}...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ${borough}: HTTP ${res.status} — skipping`);
    return [];
  }
  const text = await res.text();
  const lines = text.trim().split('\n');
  const pubs = [];
  for (const line of lines) {
    // CSV format (no header): id,"name","address","postcode",easting,northing,lat,lng,borough
    // Parse properly respecting quoted fields that may contain commas
    const cols = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur);
    if (cols.length < 8) continue;
    const lat = parseFloat(cols[6]);
    const lng = parseFloat(cols[7]);
    if (isNaN(lat) || isNaN(lng)) continue;
    if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) continue;
    if (lat === 0 || lng === 0) continue;
    pubs.push({
      name: cols[1].trim(),
      address: cols[2].trim(),
      lat,
      lng,
    });
  }
  console.log(`  ${borough}: ${pubs.length} pubs in bounding box`);
  return pubs;
}

const all = [];
for (const borough of BOROUGHS) {
  const pubs = await fetchBorough(borough);
  all.push(...pubs);
}

// Deduplicate by name+rounded coords (some pubs appear in multiple borough files)
const seen = new Set();
const deduped = all.filter(p => {
  const key = `${p.name}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

deduped.sort((a, b) => a.name.localeCompare(b.name));

const outDir = join(__dirname, '../apps/frontend-pixi/public/data');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'london-pubs.json');
writeFileSync(outPath, JSON.stringify(deduped, null, 2));

console.log(`\nDone: ${deduped.length} unique pubs saved to ${outPath}`);
