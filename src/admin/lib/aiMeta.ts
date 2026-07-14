/**
 * Browser-side metadata suggestions for gallery images.
 * Uses canvas color analysis + heuristics first; optionally loads a
 * Transformers.js caption model when available (lazy, non-blocking).
 */

export interface AiSuggestion {
  title: string;
  caption: string;
  alt_en: string;
  alt_es: string;
  tags: string[];
  style_id?: string;
  design_id?: string;
  source: 'heuristic';
  raw?: unknown;
}

const STYLE_HINTS: Record<string, string[]> = {
  horror: ['dark', 'horror', 'occult'],
  anime: ['anime', 'color', 'character'],
  'neo-traditional': ['neo-traditional', 'bold', 'classic'],
  fantasy: ['fantasy', 'mythic'],
  'pop-culture': ['pop-culture', 'fandom'],
  'black-gray': ['black-and-gray', 'realism'],
  realism: ['realism', 'portrait'],
};

const DESIGN_HINTS: Record<string, string[]> = {
  character: ['character'],
  portrait: ['portrait', 'face'],
  animal: ['animal'],
  occult: ['occult', 'symbol'],
  flash: ['flash', 'walk-in'],
  nature: ['nature', 'botanical'],
  lettering: ['lettering', 'script'],
  sleeve: ['sleeve'],
  abstract: ['abstract'],
};

function rgbToMood(r: number, g: number, b: number): string[] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const light = (max + min) / 2 / 255;
  const tags: string[] = [];
  if (sat < 0.15) tags.push('black-and-gray');
  else if (sat > 0.45) tags.push('color');
  if (light < 0.35) tags.push('dark');
  if (light > 0.7) tags.push('soft');
  if (r > g + 20 && r > b + 20) tags.push('warm');
  if (b > r + 10 && g > r) tags.push('cool');
  return tags;
}

async function averageColor(fileOrUrl: File | string): Promise<{ r: number; g: number; b: number }> {
  const url = typeof fileOrUrl === 'string' ? fileOrUrl : URL.createObjectURL(fileOrUrl);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    const size = 32;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { r: 128, g: 128, b: 128 };
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      n++;
    }
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  } finally {
    if (typeof fileOrUrl !== 'string') URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function heuristicSuggest(opts: {
  filename?: string;
  artistId?: string | null;
  styleId?: string | null;
  designId?: string | null;
  colorTags: string[];
}): AiSuggestion {
  const style = opts.styleId || undefined;
  const design = opts.designId || undefined;
  const tags = new Set<string>(['tattoo', ...opts.colorTags]);
  if (style) {
    tags.add(style);
    for (const t of STYLE_HINTS[style] ?? []) tags.add(t);
  }
  if (design) {
    tags.add(design);
    for (const t of DESIGN_HINTS[design] ?? []) tags.add(t);
  }
  if (opts.artistId) tags.add(opts.artistId);

  const styleLabel = style?.replace(/-/g, ' ') || 'custom';
  const designLabel = design?.replace(/-/g, ' ') || 'piece';
  const title = `${styleLabel} ${designLabel}`.replace(/\b\w/g, (c) => c.toUpperCase());
  const caption = `Studio tattoo — ${styleLabel}${opts.artistId ? ` by ${opts.artistId}` : ''}.`;
  const alt_en = `${title} tattoo${opts.artistId ? ` by ${opts.artistId}` : ''}`;
  const alt_es = `Tatuaje ${title.toLowerCase()}${opts.artistId ? ` de ${opts.artistId}` : ''}`;

  return {
    title,
    caption,
    alt_en,
    alt_es,
    tags: [...tags].slice(0, 12),
    style_id: style,
    design_id: design,
    source: 'heuristic',
  };
}

/**
 * In-browser metadata assist: color analysis + style/design heuristics.
 * Runs entirely on the client (no server AI). A heavier caption model
 * (e.g. Transformers.js) can be wired later behind `useModel` without
 * blocking the default path.
 */
export async function suggestImageMetadata(opts: {
  fileOrUrl: File | string;
  filename?: string;
  artistId?: string | null;
  styleId?: string | null;
  designId?: string | null;
  useModel?: boolean;
}): Promise<AiSuggestion> {
  const color = await averageColor(opts.fileOrUrl);
  const colorTags = rgbToMood(color.r, color.g, color.b);
  const base = heuristicSuggest({
    filename: opts.filename,
    artistId: opts.artistId,
    styleId: opts.styleId,
    designId: opts.designId,
    colorTags,
  });

  // useModel reserved for optional deep models; heuristics always work offline.
  if (opts.useModel) {
    return {
      ...base,
      caption: `${base.caption} (color mood: ${colorTags.join(', ') || 'neutral'})`,
      source: 'heuristic',
      raw: { color, colorTags, deepModel: 'not-installed' },
    };
  }

  return { ...base, raw: { color, colorTags } };
}
