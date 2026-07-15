#!/usr/bin/env node
/**
 * Scan src/assets/gallery → write worker index + public/gallery assets for admin.
 * Run before build (also wired as prebuild).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src/assets/gallery');
const publicDir = path.join(root, 'public/gallery');
const outJson = path.join(root, 'src/worker/data/gallery-index.json');

const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** design id from slug prefix (same as designs.ts) */
function designFromSlug(slug) {
  const known = [
    'character',
    'portrait',
    'animal',
    'occult',
    'flash',
    'nature',
    'lettering',
    'sleeve',
    'abstract',
    'other',
  ];
  const head = slug.split('-')[0];
  return known.includes(head) ? head : 'other';
}

function stableId(filename) {
  const h = crypto.createHash('sha1').update(filename).digest('hex').slice(0, 16);
  return `static_${h}`;
}

function parseName(filename) {
  const base = filename.replace(/\.[^.]+$/, '');
  const parts = base.split('__');
  if (parts.length !== 4) {
    return {
      artist: null,
      style: null,
      slug: base,
      design: 'other',
      variant: null,
    };
  }
  const [artist, style, slug, variant] = parts;
  return {
    artist: artist || null,
    style: style || null,
    slug: slug || base,
    design: designFromSlug(slug || ''),
    variant: variant === 'fresh' || variant === 'healed' ? variant : null,
  };
}

function ensureLinkOrCopy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    if (fs.existsSync(to)) {
      const a = fs.statSync(from);
      const b = fs.statSync(to);
      if (a.ino === b.ino || (a.size === b.size && a.mtimeMs === b.mtimeMs)) return 'exists';
      fs.unlinkSync(to);
    }
  } catch {
    /* continue */
  }
  try {
    fs.linkSync(from, to);
    return 'link';
  } catch {
    fs.copyFileSync(from, to);
    return 'copy';
  }
}

function walk(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full, base));
      continue;
    }
    const ext = path.extname(name).toLowerCase();
    if (!EXTS.has(ext)) continue;
    const rel = path.relative(base, full).split(path.sep).join('/');
    out.push({ full, rel, name: path.basename(full), size: st.size });
  }
  return out;
}

const files = walk(srcDir).sort((a, b) => a.rel.localeCompare(b.rel));
fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(path.dirname(outJson), { recursive: true });

// prune public/gallery files no longer in source
const wanted = new Set(files.map((f) => f.name));
for (const name of fs.readdirSync(publicDir)) {
  if (!wanted.has(name) && EXTS.has(path.extname(name).toLowerCase())) {
    try {
      fs.unlinkSync(path.join(publicDir, name));
    } catch {
      /* ignore */
    }
  }
}

const pieces = [];
let linked = 0;
let copied = 0;
for (const f of files) {
  // flatten to public/gallery/<basename> (names already unique by convention)
  const dest = path.join(publicDir, f.name);
  const mode = ensureLinkOrCopy(f.full, dest);
  if (mode === 'link') linked++;
  else if (mode === 'copy') copied++;

  const meta = parseName(f.name);
  pieces.push({
    id: stableId(f.name),
    filename: f.name,
    source_path: f.name,
    artist_id: meta.artist,
    style_id: meta.style,
    design_id: meta.design,
    slug: meta.slug,
    variant: meta.variant,
    bytes: f.size,
    content_type:
      f.name.toLowerCase().endsWith('.png')
        ? 'image/png'
        : f.name.toLowerCase().endsWith('.webp')
          ? 'image/webp'
          : f.name.toLowerCase().endsWith('.gif')
            ? 'image/gif'
            : 'image/jpeg',
  });
}

const payload = {
  generatedAt: new Date().toISOString(),
  count: pieces.length,
  pieces,
};

fs.writeFileSync(outJson, JSON.stringify(payload));
console.log(
  `[gallery-index] ${pieces.length} images → public/gallery/ (${linked} hardlink, ${copied} copy) + ${path.relative(root, outJson)}`,
);
