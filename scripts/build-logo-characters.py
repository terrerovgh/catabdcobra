"""Extract the two standalone characters (cat, cobra) from the original logo.

The cobra (neck+head+coil+scute band) comes out whole — everywhere the cat
overlaps it the shared ink outline closes the shape naturally. The cat needs
its back reconstructed where the coil drapes over it: we fill that region
with the cat's own row-sampled fur color and stroke a smooth ink spline
from the shoulder to the haunch.
"""
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src/assets/logo-original.png')
OUT_LOGO = os.path.join(ROOT, 'public/logo')
OUT_CHECK = os.environ.get('LOGO_CHECK_OUT', '/tmp/logo-characters-check')
for d in (OUT_LOGO, OUT_CHECK):
    os.makedirs(d, exist_ok=True)

im = Image.open(SRC).convert('RGBA')
a = np.array(im).astype(float)
H, W = a.shape[:2]
rgb, alpha = a[..., :3], a[..., 3]
yy, xx = np.mgrid[0:H, 0:W]

def disk(r):
    d = np.hypot(*np.mgrid[-r:r+1, -r:r+1])
    return d <= r

def dist(c):
    return np.sqrt(((rgb - np.array(c)) ** 2).sum(-1))

bc, br = (389.2, 389.5), 387.0
rbadge = np.hypot(xx - bc[0], yy - bc[1])
alpha = np.minimum(alpha, np.clip((br - rbadge) / 2.0 + 0.5, 0, 1) * 255)
solid = alpha > 250
cx, cy, pr = 389.9, 394.6, 255.4
rpeach = np.hypot(xx - cx, yy - cy)

# ---- cobra: teal + enclosed cream scute cells, grown over the ink ---------
teal = (dist((152.5, 163.7, 143.0)) < 40) & (rbadge < br - 12) & solid
lab, n = ndimage.label(teal)
sizes = ndimage.sum(teal, lab, range(1, n + 1))
teal = np.isin(lab, np.nonzero(sizes > 500)[0] + 1)

creamish = (dist((238, 224, 189)) < 48) & solid
lab2, n2 = ndimage.label(creamish)
sizes2 = ndimage.sum(creamish, lab2, range(1, n2 + 1))
small = np.isin(lab2, np.nonzero(sizes2 < 3500)[0] + 1)
cells = small & ndimage.binary_dilation(teal, disk(8))
snake = teal | cells

cobra = ndimage.binary_dilation(snake, disk(9))
cobra = ndimage.binary_fill_holes(cobra)
cobra = ndimage.binary_erosion(cobra, disk(3))

# ---- cat: the big cream component seeded at its chest ---------------------
comp = lab2[500, 300]
cat_core = lab2 == comp

# whiskers poke left past the cheek: keep only horizontal-ish strokes so the
# circle rim's arc (near-vertical there) stays out
dark = dist((120, 95, 65)) < 70
cand = dark & (xx > 65) & (xx < 140) & (yy > 400) & (yy < 485)
wl, wn = ndimage.label(cand)
whisk = np.zeros_like(cand)
for i in range(1, wn + 1):
    ys2, xs2 = np.nonzero(wl == i)
    w, h = xs2.max() - xs2.min() + 1, ys2.max() - ys2.min() + 1
    if w >= 12 and w >= 1.6 * h:
        whisk |= wl == i

cat = ndimage.binary_dilation(cat_core | whisk, disk(9))
cat = ndimage.binary_fill_holes(cat)
cat = ndimage.binary_erosion(cat, disk(3))
cobra_solid = ndimage.binary_fill_holes(ndimage.binary_dilation(snake, disk(7)))
# cut only slightly past the snake so the shared ink line along the scute
# band stays with the cat as its back edge
cobra_tight = ndimage.binary_fill_holes(ndimage.binary_dilation(snake, disk(2)))
cat &= ~cobra_tight

# ---- rebuild the cat's back under the coil --------------------------------
# spline from the shoulder (where the back outline enters the coil) to the
# haunch (where its outline re-emerges), sampled as y(x)
P = np.array([(402, 387), (458, 398), (525, 437), (572, 487)], float)
ts = np.linspace(0, 1, 200)
curve = np.array([
    (1 - t) ** 3 * P[0] + 3 * (1 - t) ** 2 * t * P[1] + 3 * (1 - t) * t ** 2 * P[2] + t ** 3 * P[3]
    for t in ts
])
curve_y = np.interp(np.arange(W), curve[:, 0], curve[:, 1], left=1e9, right=1e9)
below = yy > curve_y[None].repeat(H, 0)[0]  # broadcast per column
below = yy > np.tile(curve_y, (H, 1))
fill_mask = cobra_solid & below & (xx >= 400) & (xx <= 580) & (yy <= 560)
# the original had a small peach pocket between coil and haunch — once the
# cobra is gone it must read as fur inside the rebuilt silhouette
pocket = (dist((213, 159, 131)) < 55) & below & (xx >= 540) & (xx <= 584) & (yy >= 480) & (yy <= 536)
fill_mask |= pocket

# row-adaptive fur color sampled from untouched cat pixels
fur = np.zeros((H, 3))
ok = np.zeros(H, bool)
clean_cat = cat_core & ~ndimage.binary_dilation(snake, disk(12))
for y in range(H):
    m = clean_cat[y]
    if m.sum() > 40:
        fur[y] = rgb[y][m].mean(0)
        ok[y] = True
idx = np.nonzero(ok)[0]
for ch in range(3):
    fur[:, ch] = np.interp(np.arange(H), idx, fur[idx, ch])
    fur[:, ch] = ndimage.uniform_filter1d(fur[:, ch], 21)

cat_rgb = rgb.copy()
cat_rgb[fill_mask] = fur[yy[fill_mask]]

# ink stroke along the spline, supersampled for clean antialiasing
SS = 4
stroke = Image.new('L', (W * SS, H * SS), 0)
d = ImageDraw.Draw(stroke)
pts = [(380 * SS, 384 * SS)] + [(x * SS, y * SS) for x, y in curve]
d.line(pts, fill=255, width=7 * SS, joint='curve')
# overlap the haunch outline's tip so the two lines read as one
d.line([(572 * SS, 487 * SS), (580 * SS, 492 * SS)], fill=255, width=5 * SS)
stroke = np.array(stroke.resize((W, H), Image.LANCZOS)).astype(float) / 255
ink = np.array([113, 89, 62], float)
smask = (stroke > 0)[..., None] * stroke[..., None]
cat_rgb = cat_rgb * (1 - smask) + ink * smask

# the stroke IS the back silhouette across the rebuilt span: trim any fur
# poking above it (the coil's under-edge left a ragged soft boundary there)
span = (xx >= 404) & (xx <= 570) & (yy > 340)
above = span & (yy < np.tile(curve_y, (H, 1)) - 2)
cat_full = ((cat | fill_mask) & ~above) | (stroke > 0.4)
cat_full = ndimage.binary_fill_holes(cat_full)  # close any junction slivers

def soft(mask, sigma=0.9):
    # squeeze the semi-transparent fringe so the peachy halo tightens
    return np.clip(ndimage.gaussian_filter(mask.astype(float), sigma), 0, 1) ** 1.4

def save(name, mask, colors):
    out = np.dstack([np.clip(colors, 0, 255), soft(mask) * alpha]).astype(np.uint8)
    img = Image.fromarray(out)
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = xs.min() - 8, xs.max() + 9, ys.min() - 8, ys.max() + 9
    img = img.crop((max(0, x0), max(0, y0), min(W, x1), min(H, y1)))
    img.save(f'{OUT_CHECK}/{name}.png')
    img.save(f'{OUT_LOGO}/{name}.webp', quality=92, method=6)
    al = np.array(img).astype(float)
    comp_v = al[..., :3] * (al[..., 3:] / 255) + 255 * (1 - al[..., 3:] / 255)
    Image.fromarray(comp_v.astype(np.uint8)).save(f'{OUT_CHECK}/{name}_view.png')
    print(name, img.size)
    return img

save('char-cobra', cobra, rgb)
save('char-cat', cat_full, cat_rgb)
print('done')
