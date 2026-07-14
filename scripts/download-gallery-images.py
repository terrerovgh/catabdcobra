#!/usr/bin/env python3
"""
Download tattoo photos from catandcobra.com (Squarespace) and Instagram
into src/assets/gallery/ using the drop-in naming convention:

  <artistId>__<styleId>__<piece-slug>__fresh.<ext>

Usage:
  python3 scripts/download-gallery-images.py
  python3 scripts/download-gallery-images.py --skip-instagram
  python3 scripts/download-gallery-images.py --instagram-only

Notes:
  - Website images come from the public sitemap + page scrape.
  - Instagram prefers RapidAPI when INSTAGRAM_RAPIDAPI_KEY is set in .env
    (see scripts/download-instagram-rapidapi.py). Falls back to the public
    web_profile_info endpoint if the key is missing (rate-limited).
  - Artist-specific style tags use each artist's primary style from
    src/data/artists.ts — re-tag manually if a piece is a different style.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets" / "gallery"
SITE = "https://www.catandcobra.com"

ARTIST_STYLE = {
    "doomkitten": "horror",
    "flyingsnail": "anime",
    "nolandvoid": "black-gray",
    "baphometaphysics": "horror",
    "deeziebeezie": "neo-traditional",
}

IG_TO_ARTIST = {
    "catandcobra": "doomkitten",  # studio feed → owner bucket
    "doomkitten": "doomkitten",
    "flyingsnail.ink": "flyingsnail",
    "nolandvoid_art": "nolandvoid",
    "baphometaphysics": "baphometaphysics",
    "deeziebeezie": "deeziebeezie",
}

IG_USERS = list(IG_TO_ARTIST.keys())

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def slugify(s: str, max_len: int = 40) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return (s or "piece")[:max_len].strip("-")


def ext_from_url(url: str, default: str = ".jpg") -> str:
    name = unquote(urlparse(url).path.split("/")[-1])
    if "." in name:
        ext = "." + name.rsplit(".", 1)[-1].lower()
        if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
            return ".jpg" if ext == ".jpeg" else ext
    return default


def http_get(url: str, headers: dict | None = None, timeout: int = 60) -> bytes:
    hdrs = {"User-Agent": UA}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def download(url: str, dest: Path, headers: dict | None = None) -> bool:
    if dest.exists() and dest.stat().st_size > 1000:
        return True
    try:
        data = http_get(url, headers=headers)
        if len(data) < 500:
            print(f"  skip tiny ({len(data)}b) {dest.name}")
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return True
    except Exception as e:
        print(f"  FAIL {url[:90]} → {e}")
        return False


def collect_website_urls() -> tuple[list[str], dict[str, str]]:
    """Return (unique_urls, url→artist_id)."""
    xml = http_get(f"{SITE}/sitemap.xml").decode("utf-8", errors="ignore")
    url_artist: dict[str, str] = {}
    all_imgs: set[str] = set()

    for block in re.split(r"<url>", xml)[1:]:
        m = re.search(r"<loc>(https://www\.catandcobra\.com[^<]*)</loc>", block)
        if not m:
            continue
        page = m.group(1)
        default_artist = "doomkitten" if "/doomkitten" in page else "doomkitten"
        for img in re.findall(
            r"<image:loc>(https://images\.squarespace-cdn\.com[^<]+)</image:loc>",
            block,
        ):
            all_imgs.add(img)
            fname = unquote(img.split("/")[-1]).lower()
            if "baphometa" in fname:
                url_artist[img] = "baphometaphysics"
            else:
                url_artist[img] = default_artist

    # Also scrape known pages for extras not in sitemap
    pages = [
        f"{SITE}/home",
        f"{SITE}/doomkitten",
        f"{SITE}/doomkitten/art-in-all-forms",
        f"{SITE}/doomkitten/project-one-f5w4d-z9nem-s3jda-eyssk-a6prr-lmma2",
        f"{SITE}/doomkitten/project-two-ky966-n329z-nnx53-feazs-ajmse-2epc9",
        f"{SITE}/doomkitten/project-three-sng7y-jkgxx-kmlk5-rslaw-j2h5a-8mk6r",
        f"{SITE}/contact",
    ]
    for page in pages:
        try:
            body = http_get(page).decode("utf-8", errors="ignore")
        except Exception as e:
            print(f"  warn scrape {page}: {e}")
            continue
        found = re.findall(
            r"https://images\.squarespace-cdn\.com/content/v1/[^\"\\\s]+", body
        )
        for raw in found:
            img = raw.split("?")[0].rstrip("\\").rstrip(")")
            if any(
                img.lower().endswith(ext)
                for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".JPG", ".JPEG", ".PNG")
            ) or "/content/v1/" in img:
                all_imgs.add(img)
                if img not in url_artist:
                    url_artist[img] = (
                        "doomkitten" if "doomkitten" in page else "doomkitten"
                    )

    return sorted(all_imgs), url_artist


def download_website() -> list[dict]:
    print("=== Website (Squarespace) ===")
    urls, url_artist = collect_website_urls()
    print(f"Found {len(urls)} unique images")
    meta: list[dict] = []
    ok = 0
    for i, url in enumerate(urls, 1):
        artist = url_artist.get(url, "doomkitten")
        fname = unquote(url.split("/")[-1])
        if "baphometa" in fname.lower():
            artist = "baphometaphysics"
        style = ARTIST_STYLE.get(artist, "horror")
        base = slugify(Path(fname).stem) or f"web-{i:03d}"
        content_id = url.rstrip("/").split("/")[-2] if "/" in url else f"{i:03d}"
        slug = f"{base}-{content_id[:8]}"
        ext = ext_from_url(url)
        name = f"{artist}__{style}__{slug}__fresh{ext}"
        dest = OUT / name
        print(f"[{i}/{len(urls)}] {name}")
        if download(url, dest):
            ok += 1
            meta.append(
                {"source": "website", "url": url, "file": name, "artist": artist}
            )
    print(f"Website: {ok}/{len(urls)}")
    return meta


def fetch_ig_user(username: str) -> dict:
    url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
    raw = http_get(
        url,
        headers={
            "X-IG-App-ID": "936619743392459",
            "Accept": "application/json",
            "Referer": f"https://www.instagram.com/{username}/",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    return json.loads(raw.decode())


def ig_items(user: dict, tag: str) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    pp = user.get("profile_pic_url_hd") or user.get("profile_pic_url")
    if pp:
        items.append((pp, f"{tag}-profile"))
    for e in user.get("edge_owner_to_timeline_media", {}).get("edges", []):
        node = e["node"]
        if node.get("is_video"):
            continue
        sc = node.get("shortcode", "x")
        if node.get("display_url"):
            items.append((node["display_url"], f"{tag}-{sc}"))
        side = node.get("edge_sidecar_to_children") or {}
        for c in side.get("edges", []):
            n2 = c["node"]
            if n2.get("is_video") or not n2.get("display_url"):
                continue
            items.append(
                (
                    n2["display_url"],
                    f"{tag}-{sc}-{str(n2.get('id', ''))[-6:]}",
                )
            )
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for url, slug in items:
        if slug in seen:
            continue
        seen.add(slug)
        out.append((url, slug))
    return out


def _load_dotenv() -> dict[str, str]:
    env: dict[str, str] = {}
    for path in (ROOT / ".env", Path("/home/terrerov/Projects/catabdcobra/.env")):
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


def download_instagram_rapidapi(max_pages: int = 3) -> list[dict] | None:
    """Delegate to scripts/download-instagram-rapidapi.py when key is present."""
    env = _load_dotenv()
    if not env.get("INSTAGRAM_RAPIDAPI_KEY", "").strip():
        return None
    print("=== Instagram (RapidAPI) ===")
    import subprocess

    script = ROOT / "scripts" / "download-instagram-rapidapi.py"
    cmd = [
        sys.executable,
        str(script),
        "--max-pages",
        str(max_pages),
    ]
    result = subprocess.run(cmd, cwd=str(ROOT))
    if result.returncode not in (0, 2):
        print(f"  RapidAPI downloader exited {result.returncode}")
    # read back meta from manifest
    mp = OUT / "DOWNLOAD_MANIFEST.json"
    if mp.exists():
        try:
            data = json.loads(mp.read_text())
            return list(data.get("instagram") or [])
        except json.JSONDecodeError:
            pass
    return []


def download_instagram_public(delay: float = 8.0) -> list[dict]:
    """Fallback: public web_profile_info (heavily rate-limited)."""
    print("=== Instagram (public fallback) ===")
    meta: list[dict] = []
    for i, username in enumerate(IG_USERS):
        if i:
            print(f"  sleeping {delay:.0f}s (rate limit)…")
            time.sleep(delay)
        artist = IG_TO_ARTIST[username]
        style = ARTIST_STYLE[artist]
        tag = "studio" if username == "catandcobra" else artist
        try:
            data = fetch_ig_user(username)
            user = data["data"]["user"]
            items = ig_items(user, tag)
            total = user.get("edge_owner_to_timeline_media", {}).get("count")
            print(f"{username}: {len(items)} media (profile has ~{total} posts)")
        except Exception as e:
            print(f"{username}: ERROR {e}")
            continue

        ok = 0
        for url, slug_raw in items:
            slug = slugify(slug_raw)
            name = f"{artist}__{style}__{slug}__fresh.jpg"
            dest = OUT / name
            print(f"  {name}")
            if download(
                url, dest, headers={"Referer": "https://www.instagram.com/"}
            ):
                ok += 1
                meta.append(
                    {
                        "source": "instagram",
                        "user": username,
                        "url": url,
                        "file": name,
                        "artist": artist,
                    }
                )
            time.sleep(0.25)
        print(f"{username}: {ok}/{len(items)}")
    return meta


def download_instagram(delay: float = 8.0, max_pages: int = 3) -> list[dict]:
    rapid = download_instagram_rapidapi(max_pages=max_pages)
    if rapid is not None:
        return rapid
    print("  (no INSTAGRAM_RAPIDAPI_KEY — using public Instagram endpoint)")
    return download_instagram_public(delay=delay)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skip-instagram", action="store_true", help="Only download from website"
    )
    parser.add_argument(
        "--instagram-only", action="store_true", help="Only download from Instagram"
    )
    parser.add_argument(
        "--ig-delay",
        type=float,
        default=8.0,
        help="Seconds between public Instagram profile requests (default 8)",
    )
    parser.add_argument(
        "--ig-pages",
        type=int,
        default=3,
        help="RapidAPI pages per Instagram user (default 3)",
    )
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    web_meta: list[dict] = []
    ig_meta: list[dict] = []

    if not args.instagram_only:
        web_meta = download_website()
    if not args.skip_instagram:
        ig_meta = download_instagram(delay=args.ig_delay, max_pages=args.ig_pages)

    files = [
        p
        for p in OUT.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    ]
    # Preserve website meta if RapidAPI already rewrote the manifest
    mp = OUT / "DOWNLOAD_MANIFEST.json"
    prev = {}
    if mp.exists():
        try:
            prev = json.loads(mp.read_text())
        except json.JSONDecodeError:
            prev = {}
    if web_meta:
        prev["website"] = web_meta
    elif "website" not in prev:
        prev["website"] = []
    if ig_meta is not None:
        # if RapidAPI wrote full ig list, keep it; else use public fallback list
        if not any(x.get("source") == "instagram-rapidapi" for x in (prev.get("instagram") or [])):
            prev["instagram"] = ig_meta
    prev["counts"] = {
        "website_ok": len(prev.get("website") or []),
        "instagram_ok": len(prev.get("instagram") or []),
        "total_files": len(files),
    }
    mp.write_text(json.dumps(prev, indent=2))
    print(f"\nDone. {len(files)} image files in {OUT.relative_to(ROOT)}")
    by_artist: dict[str, int] = defaultdict(int)
    for p in files:
        by_artist[p.name.split("__")[0]] += 1
    for artist, n in sorted(by_artist.items()):
        print(f"  {artist}: {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
