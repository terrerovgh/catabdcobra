#!/usr/bin/env python3
"""
Categorize gallery images by artist, tattoo style and design type, then rename
files so the site's drop-in gallery picks them up with correct filters.

Naming:
  <artistId>__<styleId>__<designId>-<piece-slug>__fresh.jpg

Also writes src/data/gallery-catalog.json used by the gallery for richer filters.

Usage:
  python3 scripts/categorize-gallery.py
  python3 scripts/categorize-gallery.py --dry-run
  python3 scripts/categorize-gallery.py --skip-fetch   # only use local captions cache
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
GALLERY = ROOT / "src" / "assets" / "gallery"
CATALOG_PATH = ROOT / "src" / "data" / "gallery-catalog.json"
CACHE_PATH = ROOT / "scripts" / ".ig-captions-cache.json"
ENV_PATH = ROOT / ".env"

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

ARTIST_DEFAULT_STYLE = {
    "doomkitten": "horror",
    "flyingsnail": "anime",
    "nolandvoid": "black-gray",
    "baphometaphysics": "horror",
    "deeziebeezie": "neo-traditional",
}

ARTIST_ALLOWED_STYLES = {
    "doomkitten": ["horror", "neo-traditional", "pop-culture", "anime", "fantasy"],
    "flyingsnail": ["anime", "fantasy", "pop-culture"],
    "nolandvoid": ["black-gray", "realism", "pop-culture"],
    "baphometaphysics": ["horror", "black-gray", "fantasy"],
    "deeziebeezie": ["neo-traditional", "pop-culture", "anime"],
}

# Instagram username → artist id
IG_USER_TO_ARTIST = {
    "catandcobra": "doomkitten",  # default; may reassign from caption tags
    "doomkitten": "doomkitten",
    "flyingsnail.ink": "flyingsnail",
    "nolandvoid_art": "nolandvoid",
    "baphometaphysics": "baphometaphysics",
    "deeziebeezie": "deeziebeezie",
}

# Mentions in caption that reassign artist
MENTION_TO_ARTIST = {
    "doomkitten": "doomkitten",
    "flyingsnail": "flyingsnail",
    "flyingsnail.ink": "flyingsnail",
    "nolandvoid": "nolandvoid",
    "nolandvoid_art": "nolandvoid",
    "baphometaphysics": "baphometaphysics",
    "deeziebeezie": "deeziebeezie",
    "actuallyharli_": "deeziebeezie",
}

# Style keyword rules: (regex or substring list, style_id, weight)
STYLE_RULES: list[tuple[list[str], str, int]] = [
    (
        [
            "anime",
            "manga",
            "dbz",
            "dragon ball",
            "goku",
            "gohan",
            "vegeta",
            "naruto",
            "one piece",
            "luffy",
            "studio ghibli",
            "totoro",
            "pokemon",
            "pokémon",
            "waifu",
            "shonen",
            "cartoon",
            "disney",
            "pixar",
            "jojo",
            "demon slayer",
            "bleach",
            "sailor moon",
            "hello kitty",
            "sanrio",
        ],
        "anime",
        3,
    ),
    (
        [
            "hollow knight",
            "zelda",
            "nintendo",
            "playstation",
            "xbox",
            "video game",
            "videogame",
            "gaming",
            "marvel",
            "dc comic",
            "star wars",
            "harry potter",
            "lotr",
            "lord of the rings",
            "comic",
            "nerd",
            "pop culture",
            "popculture",
            "movie",
            "tv show",
        ],
        "pop-culture",
        3,
    ),
    (
        [
            "horror",
            "skull",
            "gothic",
            "goth",
            "demon",
            "occult",
            "macabre",
            "zombie",
            "death",
            "nightmare",
            "creepy",
            "ghost",
            "witch",
            "satanic",
            "baphomet",
            "dark art",
            "darkart",
        ],
        "horror",
        3,
    ),
    (
        [
            "neotrad",
            "neo-trad",
            "neo traditional",
            "neotraditional",
            "traditional tattoo",
            "trad tattoo",
            "american traditional",
            "bold lines",
        ],
        "neo-traditional",
        3,
    ),
    (
        [
            "black and grey",
            "black & grey",
            "blackandgrey",
            "black and gray",
            "black & gray",
            "blackandgray",
            "bng",
            "greywash",
            "graywash",
            "blackwork",
            "dotwork",
        ],
        "black-gray",
        3,
    ),
    (
        [
            "realism",
            "realistic",
            "photoreal",
            "portrait tattoo",
            "hyperreal",
        ],
        "realism",
        3,
    ),
    (
        [
            "fantasy",
            "dragon",
            "fairy",
            "fae",
            "unicorn",
            "elf",
            "magic",
            "wizard",
            "phoenix",
            "mermaid",
            "mythical",
        ],
        "fantasy",
        2,
    ),
]

DESIGN_RULES: list[tuple[list[str], str, int]] = [
    (
        [
            "goku",
            "gohan",
            "vegeta",
            "naruto",
            "luffy",
            "pikachu",
            "totoro",
            "character",
            "cartoon",
            "anime",
            "mario",
            "sonic",
            "hello kitty",
        ],
        "character",
        3,
    ),
    (["portrait", "face", "self portrait", "likeness"], "portrait", 3),
    (
        [
            "cat",
            "kitten",
            "snake",
            "cobra",
            "wolf",
            "bird",
            "raven",
            "owl",
            "fox",
            "dog",
            "animal",
            "pet",
            "tiger",
            "lion",
            "dragon",
        ],
        "animal",
        2,
    ),
    (
        [
            "occult",
            "baphomet",
            "skull",
            "demon",
            "pentagram",
            "sigil",
            "witch",
            "alchemy",
        ],
        "occult",
        3,
    ),
    (["flash", "walk-in", "walkin", "flat rate", "flatsheet"], "flash", 3),
    (
        [
            "flower",
            "floral",
            "botanical",
            "rose",
            "peony",
            "leaf",
            "plant",
            "nature",
            "mushroom",
        ],
        "nature",
        2,
    ),
    (["lettering", "script", "font", "quote", "typography", "text"], "lettering", 3),
    (["sleeve", "half sleeve", "full sleeve", "leg sleeve"], "sleeve", 3),
    (["abstract", "geometric", "ornamental", "mandala"], "abstract", 2),
]

# Non-tattoo content to exclude from gallery
EXCLUDE_KEYWORDS = [
    "skateboard",
    "sticker pack",
    "merch drop",
    "available for purchase",
    "shop update",
    "convention booth",
    "artist alley",
    "giveaway closed",
]


# ---------------------------------------------------------------------------
# env / http
# ---------------------------------------------------------------------------

def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for path in (ENV_PATH, Path("/home/terrerov/Projects/catabdcobra/.env")):
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
        break
    return env


def rapid_posts(username: str, pages: int = 3, amount: int = 12) -> list[dict[str, Any]]:
    env = load_env()
    key = env.get("INSTAGRAM_RAPIDAPI_KEY", "").strip()
    if not key:
        raise RuntimeError("INSTAGRAM_RAPIDAPI_KEY missing in .env")
    host = env.get(
        "INSTAGRAM_RAPIDAPI_HOST", "instagram-scraper-stable-api.p.rapidapi.com"
    ).strip()
    path = env.get(
        "INSTAGRAM_RAPIDAPI_POSTS_PATH", "/get_ig_user_posts.php"
    ).strip()
    items: list[dict[str, Any]] = []
    token = ""
    for page in range(pages):
        form = {
            "username_or_url": f"https://www.instagram.com/{username}/",
            "amount": str(amount),
            "pagination_token": token,
        }
        body = urllib.parse.urlencode(form).encode()
        req = urllib.request.Request(
            f"https://{host}{path}",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "x-rapidapi-host": host,
                "x-rapidapi-key": key,
                "User-Agent": "catandcobra-gallery/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                data = json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            print(f"  HTTP {e.code} @{username} page {page + 1}: {e.read()[:200]!r}")
            break
        posts = data.get("posts") or []
        for p in posts:
            node = p.get("node") if isinstance(p, dict) else None
            if isinstance(node, dict):
                items.append(node)
            elif isinstance(p, dict):
                items.append(p)
        token = data.get("pagination_token") or ""
        if not token or not posts:
            break
        time.sleep(1.0)
    return items


def caption_text(node: dict[str, Any]) -> str:
    cap = node.get("caption")
    if isinstance(cap, dict):
        return str(cap.get("text") or "")
    if isinstance(cap, str):
        return cap
    return ""


def shortcode(node: dict[str, Any]) -> str:
    return str(node.get("code") or node.get("shortcode") or node.get("pk") or "")


# ---------------------------------------------------------------------------
# classification
# ---------------------------------------------------------------------------

def score_rules(text: str, rules: list[tuple[list[str], str, int]]) -> Counter:
    t = text.lower()
    scores: Counter = Counter()
    for keywords, label, weight in rules:
        for kw in keywords:
            if kw in t:
                scores[label] += weight
                break  # one hit per rule group is enough
    return scores


def classify_style(text: str, artist: str) -> str:
    scores = score_rules(text, STYLE_RULES)
    allowed = ARTIST_ALLOWED_STYLES.get(artist, list(VALID_STYLES))
    # Prefer styles the artist actually offers
    for style, _ in scores.most_common():
        if style in allowed:
            return style
    return ARTIST_DEFAULT_STYLE.get(artist, "pop-culture")


def classify_design(text: str) -> str:
    scores = score_rules(text, DESIGN_RULES)
    if scores:
        return scores.most_common(1)[0][0]
    return "other"


def artist_from_caption(text: str, default: str) -> str:
    t = text.lower()
    # @mentions
    for m in re.findall(r"@([a-z0-9._]+)", t):
        if m in MENTION_TO_ARTIST:
            return MENTION_TO_ARTIST[m]
    return default


def should_exclude(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in EXCLUDE_KEYWORDS)


def slugify(s: str, max_len: int = 40) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return (s or "piece")[:max_len].strip("-") or "piece"


def extract_slug_token(filename: str) -> str | None:
    """
    From doomkitten__horror__studio-dtycuzhgdku__fresh.jpg
    extract shortcode-ish token: dtycuzhgdku
    """
    name = Path(filename).stem
    parts = name.split("__")
    if len(parts) < 3:
        return None
    slug = parts[2]
    # strip design- prefix if already categorized: character-studio-xxx
    # known design prefixes
    for d in VALID_DESIGNS:
        if slug.startswith(d + "-"):
            slug = slug[len(d) + 1 :]
            break
    # studio-CODE or artist-CODE or artist-CODE-1
    m = re.match(
        r"^(?:studio|doomkitten|flyingsnail|nolandvoid|baphometaphysics|deeziebeezie)-(.+)$",
        slug,
    )
    if m:
        return m.group(1).lower()
    # website images: img-5246-1ff615c9 or untitled-artwork-22107a9a
    return slug.lower()


def shortcode_from_slug_token(token: str) -> str | None:
    """Normalize slug token to IG shortcode (first segment, no carousel index)."""
    if not token:
        return None
    # carousel: drixghnejfi-1 or drixghnejfi-759647
    base = token.split("-")[0]
    # IG shortcodes are typically 11 chars alphanumeric _ -
    if re.fullmatch(r"[a-z0-9_-]{5,15}", base, re.I):
        return base.lower()
    return base.lower() if base else None


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def fetch_caption_index(pages: int) -> dict[str, dict[str, Any]]:
    """Map shortcode (lower) → meta with caption, user, artist guess."""
    index: dict[str, dict[str, Any]] = {}
    users = list(IG_USER_TO_ARTIST.keys())
    for i, user in enumerate(users):
        if i:
            time.sleep(1.5)
        print(f"Fetching captions @{user}…")
        try:
            nodes = rapid_posts(user, pages=pages)
        except Exception as e:
            print(f"  FAIL @{user}: {e}")
            continue
        print(f"  {len(nodes)} posts")
        default_artist = IG_USER_TO_ARTIST[user]
        for node in nodes:
            code = shortcode(node).lower()
            if not code:
                continue
            text = caption_text(node)
            artist = (
                default_artist
                if user != "catandcobra"
                else artist_from_caption(text, default_artist)
            )
            # artist posts always stay with their account
            if user != "catandcobra":
                artist = default_artist
            style = classify_style(text, artist)
            design = classify_design(text)
            exclude = should_exclude(text)
            # keep first non-empty caption if duplicate shortcodes
            if code in index and not text:
                continue
            index[code] = {
                "code": code,
                "user": user,
                "artist": artist,
                "style": style,
                "design": design,
                "caption": text[:400],
                "exclude": exclude,
            }
    return index


def infer_from_filename(path: Path) -> dict[str, str]:
    """Fallback classification when no caption is available."""
    name = path.name
    parts = name.split("__")
    artist = parts[0] if parts and parts[0] in VALID_ARTISTS else "doomkitten"
    style = (
        parts[1]
        if len(parts) > 1 and parts[1] in VALID_STYLES
        else ARTIST_DEFAULT_STYLE[artist]
    )
    slug = parts[2] if len(parts) > 2 else path.stem

    # slug prefix → artist
    for prefix, aid in [
        ("studio-", "doomkitten"),
        ("doomkitten-", "doomkitten"),
        ("flyingsnail-", "flyingsnail"),
        ("nolandvoid-", "nolandvoid"),
        ("baphometaphysics-", "baphometaphysics"),
        ("deeziebeezie-", "deeziebeezie"),
        ("baphometa", "baphometaphysics"),
    ]:
        if slug.startswith(prefix) or prefix.rstrip("-") in slug:
            if prefix.startswith("baphometa") or aid != "doomkitten" or prefix != "studio-":
                if "baphometa" in slug:
                    artist = "baphometaphysics"
                elif not slug.startswith("studio-"):
                    artist = aid
            break

    # website baphometa portrait
    if "baphometa" in name.lower():
        artist = "baphometaphysics"
        style = "horror"
        design = "portrait"
    else:
        design = "other"
        # lightly guess design from generic names
        if "artwork" in slug:
            design = "flash"
        style = ARTIST_DEFAULT_STYLE.get(artist, style)

    return {
        "artist": artist,
        "style": style if style in ARTIST_ALLOWED_STYLES.get(artist, [style]) else ARTIST_DEFAULT_STYLE[artist],
        "design": design,
        "caption": "",
        "user": artist,
        "exclude": False,
    }


def build_new_name(
    artist: str,
    style: str,
    design: str,
    token: str,
    ext: str,
) -> str:
    piece = slugify(f"{design}-{token}", max_len=50)
    return f"{artist}__{style}__{piece}__fresh{ext}"


def categorize(dry_run: bool, skip_fetch: bool, pages: int) -> int:
    # load or fetch caption index
    index: dict[str, dict[str, Any]] = {}
    if skip_fetch and CACHE_PATH.exists():
        index = json.loads(CACHE_PATH.read_text())
        print(f"Loaded caption cache: {len(index)} posts")
    elif not skip_fetch:
        index = fetch_caption_index(pages=pages)
        CACHE_PATH.write_text(json.dumps(index, indent=2))
        print(f"Cached {len(index)} posts → {CACHE_PATH.relative_to(ROOT)}")
    elif CACHE_PATH.exists():
        index = json.loads(CACHE_PATH.read_text())

    files = sorted(
        p
        for p in GALLERY.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        and "__" in p.name
    )
    print(f"Gallery images: {len(files)}")

    catalog: list[dict[str, Any]] = []
    renames: list[tuple[Path, Path, dict]] = []
    excluded: list[Path] = []
    unmatched = 0

    used_names: set[str] = set()

    for path in files:
        token = extract_slug_token(path.name) or path.stem
        sc = shortcode_from_slug_token(token) if token else None
        meta = None
        if sc and sc in index:
            meta = index[sc]
        else:
            # try full token in index
            if token and token in index:
                meta = index[token]
            else:
                # try matching any shortcode contained in slug
                for code, m in index.items():
                    if code and code in (token or ""):
                        meta = m
                        break

        if meta:
            artist = meta["artist"]
            style = meta["style"]
            design = meta["design"]
            caption = meta.get("caption") or ""
            user = meta.get("user") or artist
            exclude = bool(meta.get("exclude"))
        else:
            unmatched += 1
            fb = infer_from_filename(path)
            artist = fb["artist"]
            style = fb["style"]
            design = fb["design"]
            caption = ""
            user = fb["user"]
            exclude = False

        # clamp to valid sets
        if artist not in VALID_ARTISTS:
            artist = "doomkitten"
        if style not in VALID_STYLES:
            style = ARTIST_DEFAULT_STYLE[artist]
        if design not in VALID_DESIGNS:
            design = "other"

        # Prefer artist's primary palette if style not in their list
        allowed = ARTIST_ALLOWED_STYLES.get(artist, list(VALID_STYLES))
        if style not in allowed:
            style = ARTIST_DEFAULT_STYLE[artist]

        if exclude:
            excluded.append(path)
            continue

        ext = path.suffix.lower()
        if ext == ".jpeg":
            ext = ".jpg"
        new_name = build_new_name(artist, style, design, token or path.stem, ext)

        # collision handling
        base_new = new_name
        n = 2
        while new_name in used_names or (
            (GALLERY / new_name).exists() and (GALLERY / new_name).resolve() != path.resolve()
        ):
            stem = Path(base_new).stem  # without ext, ends with __fresh
            # insert counter before __fresh
            if stem.endswith("__fresh"):
                stem2 = stem[: -len("__fresh")] + f"-{n}__fresh"
            else:
                stem2 = f"{stem}-{n}"
            new_name = stem2 + ext
            n += 1
        used_names.add(new_name)

        dest = GALLERY / new_name
        entry = {
            "file": new_name,
            "artist": artist,
            "style": style,
            "design": design,
            "slug": new_name.split("__")[2],
            "sourceUser": user,
            "caption": caption[:240],
            "prev": path.name,
        }
        catalog.append(entry)
        if path.name != new_name:
            renames.append((path, dest, entry))
        else:
            renames.append((path, path, entry))  # no-op rename, still in catalog

    print(f"Matched captions: {len(files) - unmatched - len(excluded)} / {len(files)}")
    print(f"Unmatched (filename fallback): {unmatched}")
    print(f"Excluded (non-tattoo): {len(excluded)}")
    print(f"Renames needed: {sum(1 for a,b,_ in renames if a != b)}")

    # stats
    by_artist = Counter(e["artist"] for e in catalog)
    by_style = Counter(e["style"] for e in catalog)
    by_design = Counter(e["design"] for e in catalog)
    print("By artist:", dict(by_artist))
    print("By style:", dict(by_style))
    print("By design:", dict(by_design))

    if dry_run:
        print("\n[dry-run] sample renames:")
        for src, dst, _ in renames[:15]:
            if src != dst:
                print(f"  {src.name}\n    → {dst.name}")
        return 0

    # exclude: move to _excluded/
    if excluded:
        ex_dir = GALLERY / "_excluded"
        ex_dir.mkdir(exist_ok=True)
        for p in excluded:
            target = ex_dir / p.name
            if p.exists():
                p.rename(target)
                print(f"excluded {p.name}")

    # two-phase rename to avoid collisions
    tmp_moves: list[tuple[Path, Path, Path]] = []
    for src, dst, _ in renames:
        if src == dst or not src.exists():
            continue
        tmp = src.with_name(f".tmp-cat-{src.name}")
        src.rename(tmp)
        tmp_moves.append((tmp, dst, src))

    for tmp, dst, _src in tmp_moves:
        if dst.exists():
            # extremely unlikely after collision handling
            dst = dst.with_name(dst.stem + "-x" + dst.suffix)
        tmp.rename(dst)

    # write catalog
    CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_PATH.write_text(
        json.dumps(
            {
                "generatedBy": "scripts/categorize-gallery.py",
                "counts": {
                    "total": len(catalog),
                    "byArtist": dict(by_artist),
                    "byStyle": dict(by_style),
                    "byDesign": dict(by_design),
                },
                "pieces": sorted(catalog, key=lambda e: e["file"]),
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Wrote {CATALOG_PATH.relative_to(ROOT)} ({len(catalog)} pieces)")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-fetch", action="store_true", help="Use cached captions only")
    ap.add_argument("--pages", type=int, default=3, help="IG pages per user to fetch")
    args = ap.parse_args()
    return categorize(dry_run=args.dry_run, skip_fetch=args.skip_fetch, pages=args.pages)


if __name__ == "__main__":
    sys.exit(main())
