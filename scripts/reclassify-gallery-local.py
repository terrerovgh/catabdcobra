#!/usr/bin/env python3
"""
Second-pass local reclassification without RapidAPI.

Uses:
  - Artist already in the filename (trusted)
  - Caption cache when shortcode matches (scripts/.ig-captions-cache.json)
  - ImageMagick HSL saturation to refine style / design
  - Artist-aware defaults for design type

Run after categorize-gallery.py (or alone on an already-named gallery).

  python3 scripts/reclassify-gallery-local.py
  python3 scripts/reclassify-gallery-local.py --dry-run
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GALLERY = ROOT / "src" / "assets" / "gallery"
CACHE = ROOT / "scripts" / ".ig-captions-cache.json"
CATALOG = ROOT / "src" / "data" / "gallery-catalog.json"

VALID_ARTISTS = {
    "doomkitten",
    "flyingsnail",
    "nolandvoid",
    "baphometaphysics",
    "deeziebeezie",
}
VALID_STYLES = {
    "anime",
    "neo-traditional",
    "pop-culture",
    "fantasy",
    "black-gray",
    "horror",
    "realism",
}
VALID_DESIGNS = {
    "character",
    "portrait",
    "animal",
    "occult",
    "flash",
    "nature",
    "lettering",
    "sleeve",
    "abstract",
    "other",
}

ARTIST_STYLES = {
    "doomkitten": ["horror", "neo-traditional", "anime", "pop-culture", "fantasy"],
    "flyingsnail": ["anime", "fantasy", "pop-culture"],
    "nolandvoid": ["black-gray", "realism", "pop-culture"],
    "baphometaphysics": ["horror", "black-gray", "fantasy"],
    "deeziebeezie": ["neo-traditional", "pop-culture", "anime"],
}

ARTIST_DEFAULT_STYLE = {
    "doomkitten": "horror",
    "flyingsnail": "anime",
    "nolandvoid": "black-gray",
    "baphometaphysics": "horror",
    "deeziebeezie": "neo-traditional",
}

ARTIST_DEFAULT_DESIGN = {
    "doomkitten": "occult",
    "flyingsnail": "character",
    "nolandvoid": "character",
    "baphometaphysics": "occult",
    "deeziebeezie": "flash",
}

# Keyword rules (caption text)
STYLE_KW = [
    (["gohan", "goku", "dbz", "dragon ball", "pokemon", "bulbasaur", "anime", "manga", "hunter x", "naruto", "one piece"], "anime"),
    (["spyro", "hollow knight", "zelda", "nintendo", "video game", "gaming", "marvel", "star wars"], "pop-culture"),
    (["skull", "horror", "demon", "occult", "gothic", "jester", "clown", "macabre", "biblically"], "horror"),
    (["neotrad", "neo-trad", "traditional", "bold"], "neo-traditional"),
    (["dragon", "fantasy", "fairy", "phoenix"], "fantasy"),
    (["black and grey", "black & grey", "blackwork", "greywash"], "black-gray"),
    (["realism", "portrait"], "realism"),
]
DESIGN_KW = [
    (["gohan", "goku", "spyro", "bulbasaur", "character", "anime", "cartoon", "pokemon"], "character"),
    (["portrait", "face"], "portrait"),
    (["cat", "snake", "dragon", "bird", "wolf", "animal", "spyro"], "animal"),
    (["skull", "occult", "demon", "baphomet", "jester"], "occult"),
    (["flash", "flat rate", "walk-in", "walkin"], "flash"),
    (["flower", "floral", "rose", "botanical", "mushroom"], "nature"),
    (["sleeve", "back piece", "backpiece"], "sleeve"),
    (["lettering", "script"], "lettering"),
]

# Tokens / substrings that are promo / not tattoos
EXCLUDE_TOKENS = {
    "dvjudo7dfhu",  # convention flyer sample
}


def slugify(s: str, n: int = 48) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return (s or "piece")[:n].strip("-") or "piece"


def parse_name(path: Path) -> tuple[str, str, str, str]:
    """Return artist, style, slug, variant from current filename."""
    stem = path.stem
    parts = stem.split("__")
    if len(parts) != 4:
        return "doomkitten", "horror", path.stem, "fresh"
    return parts[0], parts[1], parts[2], parts[3]


def bare_token(slug: str) -> str:
    """Strip design- prefix and return rest of slug."""
    for d in sorted(VALID_DESIGNS, key=len, reverse=True):
        if slug.startswith(d + "-"):
            return slug[len(d) + 1 :]
        if slug == d:
            return slug
    return slug


def shortcode_guess(token: str) -> str:
    # first segment of token (carousel index after)
    return token.split("-")[0].lower()


def magick_sat(path: Path) -> float | None:
    try:
        out = subprocess.check_output(
            [
                "magick",
                str(path),
                "-resize",
                "48x48!",
                "-colorspace",
                "HSL",
                "-format",
                "%[fx:mean.g]",
                "info:",
            ],
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=15,
        ).strip()
        return float(out)
    except Exception:
        return None


def pick_from_keywords(text: str, rules: list) -> str | None:
    t = text.lower()
    for kws, label in rules:
        if any(k in t for k in kws):
            return label
    return None


def classify(
    path: Path,
    captions: dict,
) -> dict:
    artist, cur_style, slug, _variant = parse_name(path)
    if artist not in VALID_ARTISTS:
        artist = "doomkitten"

    token = bare_token(slug)
    sc = shortcode_guess(token)
    cap_meta = captions.get(sc) or captions.get(token)
    caption = (cap_meta or {}).get("caption") or ""

    # Exclude known non-tattoo promo
    exclude = False
    for bad in EXCLUDE_TOKENS:
        if bad in token.lower() or bad in path.name.lower():
            exclude = True
    # caption-based exclude
    cl = caption.lower()
    if any(
        x in cl
        for x in (
            "sponsored by",
            "convention",
            "artist alley",
            "booth",
            "third coast",
            "available for booking june",
        )
    ):
        exclude = True

    style = None
    design = None

    if caption:
        style = pick_from_keywords(caption, STYLE_KW)
        design = pick_from_keywords(caption, DESIGN_KW)
        # also use cache classification if present
        if not style and cap_meta:
            style = cap_meta.get("style")
        if not design and cap_meta:
            design = cap_meta.get("design")

    sat = magick_sat(path)

    # Artist-aware style refinement
    allowed = ARTIST_STYLES[artist]
    if style not in allowed:
        style = None

    if style is None:
        if artist == "flyingsnail":
            # colorful pop characters → anime; slightly less sat still anime
            style = "anime" if (sat is None or sat >= 0.18) else "fantasy"
        elif artist == "deeziebeezie":
            if sat is not None and sat >= 0.35:
                style = "anime"
            elif sat is not None and sat >= 0.22:
                style = "pop-culture"
            else:
                style = "neo-traditional"
        elif artist == "nolandvoid":
            style = "black-gray" if (sat is None or sat < 0.2) else "pop-culture"
        elif artist == "baphometaphysics":
            style = "horror" if (sat is None or sat < 0.25) else "fantasy"
        elif artist == "doomkitten":
            # high color often neo-trad / anime pieces; low = horror / b&g mood
            if sat is not None and sat >= 0.32:
                style = "anime"
            elif sat is not None and sat >= 0.22:
                style = "neo-traditional"
            else:
                style = "horror"
        else:
            style = ARTIST_DEFAULT_STYLE[artist]

    if style not in allowed:
        style = ARTIST_DEFAULT_STYLE[artist]

    if design not in VALID_DESIGNS:
        design = None

    if design is None:
        if artist == "flyingsnail":
            design = "character" if (sat is None or sat >= 0.15) else "fantasy"
            if design == "fantasy":
                design = "animal"  # dragons etc.
        elif artist == "doomkitten":
            if sat is not None and sat >= 0.3:
                design = "character"
            elif sat is not None and sat < 0.15:
                design = "occult"
            else:
                design = "occult"
            # website untitled flash sheets
            if "untitled-artwork" in token or "artwork" in token:
                design = "flash"
                if sat is not None and sat >= 0.25:
                    style = "anime" if "artwork" in token else style
        elif artist == "deeziebeezie":
            design = "flash" if (sat is None or sat < 0.25) else "character"
        elif artist == "baphometaphysics":
            design = "portrait" if "baphometa" in path.name else "occult"
        else:
            design = ARTIST_DEFAULT_DESIGN.get(artist, "other")

    # selfies / room photos: low-mid sat, but we can't be sure — keep
    return {
        "artist": artist,
        "style": style,
        "design": design,
        "token": token,
        "caption": caption[:240],
        "sat": sat,
        "exclude": exclude,
        "sourceUser": (cap_meta or {}).get("user") or artist,
    }


def main() -> int:
    dry = "--dry-run" in sys.argv
    captions: dict = {}
    if CACHE.exists():
        captions = json.loads(CACHE.read_text())
        print(f"Caption cache: {len(captions)}")

    files = sorted(
        p
        for p in GALLERY.iterdir()
        if p.is_file()
        and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        and "__" in p.name
    )
    print(f"Images: {len(files)}")

    catalog = []
    renames: list[tuple[Path, Path]] = []
    excluded = []
    used: set[str] = set()

    for path in files:
        meta = classify(path, captions)
        if meta["exclude"]:
            excluded.append(path)
            continue

        ext = path.suffix.lower()
        if ext == ".jpeg":
            ext = ".jpg"
        piece = slugify(f"{meta['design']}-{meta['token']}", 50)
        new_name = f"{meta['artist']}__{meta['style']}__{piece}__fresh{ext}"
        n = 2
        base = new_name
        while new_name in used:
            stem = Path(base).stem
            if stem.endswith("__fresh"):
                stem = stem[: -len("__fresh")] + f"-{n}__fresh"
            else:
                stem = f"{stem}-{n}"
            new_name = stem + ext
            n += 1
        used.add(new_name)

        catalog.append(
            {
                "file": new_name,
                "artist": meta["artist"],
                "style": meta["style"],
                "design": meta["design"],
                "slug": piece if n == 2 else Path(new_name).stem.split("__")[2],
                "sourceUser": meta["sourceUser"],
                "caption": meta["caption"],
                "sat": meta["sat"],
                "prev": path.name,
            }
        )
        dest = GALLERY / new_name
        if path.resolve() != dest.resolve():
            renames.append((path, dest))

    print(f"Exclude: {len(excluded)}")
    print(f"Renames: {len(renames)}")
    print("By artist:", dict(Counter(c["artist"] for c in catalog)))
    print("By style:", dict(Counter(c["style"] for c in catalog)))
    print("By design:", dict(Counter(c["design"] for c in catalog)))

    if dry:
        for a, b in renames[:20]:
            print(f"  {a.name}\n  → {b.name}")
        return 0

    # exclude
    if excluded:
        ex = GALLERY / "_excluded"
        ex.mkdir(exist_ok=True)
        for p in excluded:
            if p.exists():
                p.rename(ex / p.name)
                print("excluded", p.name)

    # two-phase rename
    tmp_pairs = []
    for src, dst in renames:
        if not src.exists():
            continue
        tmp = src.with_name(".tmp2-" + src.name)
        src.rename(tmp)
        tmp_pairs.append((tmp, dst))
    for tmp, dst in tmp_pairs:
        if dst.exists():
            dst = dst.with_name(dst.stem + "-x" + dst.suffix)
        tmp.rename(dst)

    CATALOG.write_text(
        json.dumps(
            {
                "generatedBy": "scripts/reclassify-gallery-local.py",
                "counts": {
                    "total": len(catalog),
                    "byArtist": dict(Counter(c["artist"] for c in catalog)),
                    "byStyle": dict(Counter(c["style"] for c in catalog)),
                    "byDesign": dict(Counter(c["design"] for c in catalog)),
                },
                "pieces": sorted(catalog, key=lambda e: e["file"]),
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Wrote {CATALOG.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
