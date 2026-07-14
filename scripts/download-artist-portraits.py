#!/usr/bin/env python3
"""
Download Instagram profile photos for Cat & Cobra artists into
src/assets/artists/<artistId>.jpg

Uses headless Chromium to read the public profile page (og:image),
because the Instagram API rate-limits aggressively.

Usage:
  python3 scripts/download-artist-portraits.py
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets" / "artists"

ARTISTS = {
    "doomkitten": "doomkitten",
    "flyingsnail": "flyingsnail.ink",
    "nolandvoid": "nolandvoid_art",
    "baphometaphysics": "baphometaphysics",
    "deeziebeezie": "deeziebeezie",
}


def chromium_dom(url: str) -> str:
    cmd = [
        "chromium",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--virtual-time-budget=12000",
        "--dump-dom",
        url,
    ]
    r = subprocess.run(cmd, capture_output=True, timeout=90)
    return (r.stdout or b"").decode("utf-8", errors="ignore")


def extract_pic(html: str) -> str | None:
    m = re.search(r'property="og:image"\s+content="([^"]+)"', html)
    if not m:
        m = re.search(r'content="([^"]+)"\s+property="og:image"', html)
    if m:
        return m.group(1).replace("&amp;", "&")
    for pat in (
        r'"profile_pic_url_hd"\s*:\s*"((?:\\.|[^"\\])*)"',
        r'"profile_pic_url"\s*:\s*"((?:\\.|[^"\\])*)"',
    ):
        m = re.search(pat, html)
        if m:
            return (
                m.group(1)
                .encode()
                .decode("unicode_escape")
                .replace("\\u0026", "&")
                .replace("\\/", "/")
            )
    return None


def download(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.instagram.com/",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    meta: dict = {}
    for i, (aid, ig) in enumerate(ARTISTS.items()):
        if i:
            time.sleep(2)
        print(f"=== @{ig} ({aid}) ===")
        try:
            html = chromium_dom(f"https://www.instagram.com/{ig}/")
            pic = extract_pic(html)
            if not pic:
                print("  no profile image found")
                continue
            img = download(pic)
            dest = OUT / f"{aid}.jpg"
            dest.write_bytes(img)
            meta[aid] = {
                "instagram": ig,
                "file": dest.name,
                "bytes": len(img),
                "source": pic[:160],
            }
            print(f"  saved {dest.relative_to(ROOT)} ({len(img) // 1024}KB)")
        except Exception as e:
            print(f"  ERROR {e}")
    (OUT / "SOURCES.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"Done — {len(meta)}/{len(ARTISTS)} portraits")
    return 0 if meta else 1


if __name__ == "__main__":
    sys.exit(main())
