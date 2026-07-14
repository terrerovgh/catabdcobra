"""Slice the original Cat & Cobra logo photo into animatable layers.

Outputs (all on the same 779x779 canvas so they stack full-bleed):
  logo-base   — the artwork with the cobra's neck+head removed and the
                peach circle / cream badge reconstructed behind it
  logo-cobra  — just the neck+head cutout (the layer that sways)
  logo-coil   — a static copy of the coil's top edge that sits on top and
                hides the cutout's bottom edge at the junction
Plus a cleaned full logo for the brand mark / favicons.
"""
from PIL import Image
import numpy as np
from scipy import ndimage

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src/assets/logo-original.png')
OUT = os.environ.get('LOGO_OUT', '/tmp/logo-layers')
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGBA')
a = np.array(im).astype(float)
H, W = a.shape[:2]
rgb, alpha = a[..., :3], a[..., 3]
yy, xx = np.mgrid[0:H, 0:W]

def disk(r):
    d = np.hypot(*np.mgrid[-r:r+1, -r:r+1])
    return d <= r

# ---- clean the badge's outer alpha edge with a smooth circle -------------
bc, br = (389.2, 389.5), 387.0
rbadge = np.hypot(xx - bc[0], yy - bc[1])
badge_alpha = np.clip((br - rbadge) / 2.0 + 0.5, 0, 1) * 255
alpha = np.minimum(alpha, badge_alpha)

# ---- fit the peach circle (needed to redraw its edge behind the head) ----
peach_ref = np.array([213, 159, 131])
peach = np.sqrt(((rgb - peach_ref) ** 2).sum(-1)) < 30
pts = []
for y in range(210, 641):
    xs = np.nonzero(peach[y])[0]
    if len(xs) > 50:
        pts += [(xs.min(), y), (xs.max(), y)]
pts = np.array(pts, float)
# algebraic least-squares circle fit
A = np.c_[2 * pts[:, 0], 2 * pts[:, 1], np.ones(len(pts))]
b = (pts ** 2).sum(1)
cx, cy, c = np.linalg.lstsq(A, b, rcond=None)[0]
pr = np.sqrt(c + cx * cx + cy * cy)
print(f'peach circle: center=({cx:.1f},{cy:.1f}) r={pr:.1f}')
rpeach = np.hypot(xx - cx, yy - cy)

# ---- cobra region: teal body grown over its ink outline, holes filled ----
teal = np.sqrt(((rgb - np.array([152.5, 163.7, 143.0])) ** 2).sum(-1)) < 40
teal &= (rbadge < br - 12) & (alpha > 250)  # keep the badge's AA edge ring out
lab, n = ndimage.label(teal)
sizes = ndimage.sum(teal, lab, range(1, n + 1))
teal = np.isin(lab, np.nonzero(sizes > 500)[0] + 1)  # drop stray speckles
# the neck's cream belly ladder sits left of the teal — pull it in too
# (inside the peach circle only, so badge cream above the head stays out)
belly = (np.sqrt(((rgb - np.array([238, 224, 189])) ** 2).sum(-1)) < 45)
belly &= ndimage.binary_dilation(teal, disk(24)) & (yy < 385) & (rpeach < pr - 12)
core = ndimage.binary_dilation(teal | belly, disk(9))
core = ndimage.binary_fill_holes(core)
core = ndimage.binary_erosion(core, disk(2))

# ---- split: neck+head (moves) vs everything at/below the coil -----------
band = (xx >= 436) & (xx <= 512) & (yy < 422)
neck = core & ((yy < 350) | band)
# the peach circle's edge grazes the head — keep it out of the moving cutout
# (the base redraws that edge), but never carve into the snake itself
snake_tight = ndimage.binary_dilation(teal | belly, disk(5))
neck &= ~((np.abs(rpeach - pr) < 9) & ~snake_tight)

# coil-top outline where the neck slips behind the coil, as y(x)
cutline = np.where(xx < 438, 356.0, np.where(xx > 510, 384.0, 369.0 + 0.44 * (xx - 440)))
box = (xx >= 424) & (xx <= 526) & (yy >= 346) & (yy <= 436)

# ---- inpaint the base behind the neck with row-adaptive flat fills -------
inpaint = ndimage.binary_dilation(neck, disk(6))
# static coil patch: everything below the cutline that the cutout or the
# inpaint touches gets re-covered with original pixels, so the fill never
# shows over the coil or the cat's back
coil_top = (core | inpaint) & box & (yy >= cutline)
far = ~ndimage.binary_dilation(core, disk(6))
cream_ref = np.array([240, 228, 200])
cream = (np.sqrt(((rgb - cream_ref) ** 2).sum(-1)) < 30) & (rpeach > pr + 8) & (rbadge < br - 12) & far
peach_s = peach & (rpeach < pr - 6) & far

def row_means(mask):
    cols = np.zeros((H, 3))
    ok = np.zeros(H, bool)
    for y in range(H):
        m = mask[y]
        if m.sum() > 30:
            cols[y] = rgb[y][m].mean(0)
            ok[y] = True
    idx = np.nonzero(ok)[0]
    for ch in range(3):
        cols[:, ch] = np.interp(np.arange(H), idx, cols[idx, ch])
    for ch in range(3):
        cols[:, ch] = ndimage.uniform_filter1d(cols[:, ch], 21)
    return cols

cream_rows, peach_rows = row_means(cream), row_means(peach_s)
noise_std = rgb[cream][:, 1].std()
print('sampled noise std:', round(noise_std, 2))

t = np.clip((pr - rpeach) / 3.5 + 0.5, 0, 1)[..., None]  # 1 inside peach circle
fill = peach_rows[yy] * t + cream_rows[yy] * (1 - t)

# the circle rim has a faint dark outline — measure its radial profile on the
# clean left/bottom arc and reapply it as an additive correction to the fill
ds = np.arange(-12, 13)
angs = np.deg2rad(np.arange(95, 265, 1.5))
prof = np.zeros((len(ds), 3))
for i, d in enumerate(ds):
    px = (cx + (pr + d) * np.cos(angs)).round().astype(int)
    py = (cy + (pr + d) * np.sin(angs)).round().astype(int)
    prof[i] = np.median(rgb[py, px], 0)
tp = np.clip((-ds) / 3.5 + 0.5, 0, 1)[:, None]
prof_flat = prof[0] * tp + prof[-1] * (1 - tp)  # what the flat blend predicts
correction = prof - prof_flat                    # the outline dip
dpix = np.clip(rpeach - pr, -12, 12)
corr_img = np.zeros_like(rgb)
for ch in range(3):
    corr_img[..., ch] = np.interp(dpix, ds, correction[:, ch])
fill = fill + corr_img
rng = np.random.default_rng(7)
fill += rng.normal(0, noise_std * 0.8, fill.shape)

base_rgb = rgb.copy()
base_rgb[inpaint] = fill[inpaint]

def soft(mask, sigma=1.1):
    return np.clip(ndimage.gaussian_filter(mask.astype(float), sigma), 0, 1)

def save(name, arr_rgb, arr_alpha):
    out = np.dstack([np.clip(arr_rgb, 0, 255), np.clip(arr_alpha, 0, 255)]).astype(np.uint8)
    img = Image.fromarray(out)
    img.save(f'{OUT}/{name}.png')
    img.save(f'{OUT}/{name}.webp', quality=92, method=6)
    return img

save('logo-base', base_rgb, alpha)
save('logo-cobra', rgb, soft(neck) * alpha)
save('logo-coil', rgb, soft(coil_top) * alpha)
full = save('logo-full', rgb, alpha)

# ---- rest-state composite must reproduce the original --------------------
comp = Image.new('RGBA', (W, H))
for layer in ('logo-base', 'logo-cobra', 'logo-coil'):
    comp.alpha_composite(Image.open(f'{OUT}/{layer}.png'))
comp.save(f'{OUT}/check_rest.png')

# ---- swung composites to eyeball seams -----------------------------------
pivot = (467, 385)
for ang in (-2.2, 6, 9):
    c2 = Image.open(f'{OUT}/logo-base.png')
    cobra = Image.open(f'{OUT}/logo-cobra.png').rotate(-ang, center=pivot, resample=Image.BICUBIC)
    c2.alpha_composite(cobra)
    c2.alpha_composite(Image.open(f'{OUT}/logo-coil.png'))
    c2.save(f'{OUT}/check_sway_{ang}.png')

# ---- brand mark + icons ---------------------------------------------------
full.resize((192, 192), Image.LANCZOS).save(f'{OUT}/logo-mark.webp', quality=92, method=6)
for s, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png'), (64, 'favicon.png')]:
    full.resize((s, s), Image.LANCZOS).save(f'{OUT}/{name}')
print('done')
