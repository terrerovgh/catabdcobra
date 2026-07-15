#!/usr/bin/env python3
"""
Download Instagram posts for Cat & Cobra artists via RapidAPI
(instagram-scraper-stable-api) into src/assets/gallery/:

  <artistId>__<styleId>__<piece-slug>__fresh.jpg

Requires .env (see .env.example):

  INSTAGRAM_RAPIDAPI_KEY=...
  INSTAGRAM_RAPIDAPI_HOST=instagram-scraper-stable-api.p.rapidapi.com
  INSTAGRAM_RAPIDAPI_POSTS_PATH=/get_ig_user_posts.php
  INSTAGRAM_RAPIDAPI_METHOD=POST
  INSTAGRAM_RAPIDAPI_AMOUNT=12

API docs:
  https://rapidapi.com/thetechguy32744/api/instagram-scraper-stable-api

Usage:
  python3 scripts/download-instagram-rapidapi.py
  python3 scripts/download-instagram-rapidapi.py --user doomkitten --max-pages 5
  python3 scripts/download-instagram-rapidapi.py --all --max-posts 40
  python3 scripts/download-instagram-rapidapi.py --dry-run
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
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets" / "gallery"
ENV_PATH = ROOT / ".env"

ARTIST_STYLE = {
    "doomkitten": "horror",
    "flyingsnail": "anime",
    "nolandvoid": "black-gray",
    "baphometaphysics": "horror",
    "deeziebeezie": "neo-traditional",
}

IG_TO_ARTIST = {
    "catandcobra": "doomkitten",  # studio feed → owner
    "doomkitten": "doomkitten",
    "flyingsnail.ink": "flyingsnail",
    "nolandvoid_art": "nolandvoid",
    "baphometaphysics": "baphometaphysics",
    "deeziebeezie": "deeziebeezie",
}

DEFAULT_HOST = "instagram-scraper-stable-api.p.rapidapi.com"
DEFAULT_POSTS_PATH = "/get_ig_user_posts.php"
DEFAULT_METHOD = "POST"
DEFAULT_AMOUNT = 12
UA = "catandcobra-gallery/1.0 (+https://catandcobra.com)"


# ---------------------------------------------------------------------------
# env / http
# ---------------------------------------------------------------------------

def load_env(path: Path = ENV_PATH) -> dict[str, str]:
    env: dict[str, str] = {}
    candidates = [path, Path("/home/terrerov/Projects/catabdcobra/.env")]
    for candidate in candidates:
        if not candidate.exists():
            continue
        for raw in candidate.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if " #" in val:
                val = val.split(" #", 1)[0].rstrip()
            env[key] = val
        break
    return env


def slugify(s: str, max_len: int = 48) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return (s or "piece")[:max_len].strip("-") or "piece"


def http_request(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    form: dict[str, str] | None = None,
    timeout: int = 90,
) -> bytes:
    hdrs = {"User-Agent": UA}
    if headers:
        hdrs.update(headers)
    data = None
    if form is not None:
        data = urllib.parse.urlencode(form).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/x-www-form-urlencoded")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method.upper())
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def download_file(url: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 1000:
        return True
    try:
        data = http_request(
            url,
            headers={"Referer": "https://www.instagram.com/"},
            timeout=60,
        )
        if len(data) < 500:
            print(f"    skip tiny ({len(data)}b)")
            return False
        if data[:15].lstrip().startswith(b"<!DOCTYPE") or data[:5] == b"<html":
            print("    skip HTML response")
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return True
    except Exception as e:
        print(f"    FAIL download: {e}")
        return False


# ---------------------------------------------------------------------------
# RapidAPI client (instagram-scraper-stable-api)
# ---------------------------------------------------------------------------

class RapidInstagram:
    """
    Client for Instagram Scraper Stable API.

    Endpoint used:
      POST /get_ig_user_posts.php
      form: username_or_url, amount, pagination_token

    Response:
      { "posts": [ { "node": { ...media... } } ], "pagination_token": "..." }
    """

    def __init__(
        self,
        api_key: str,
        host: str = DEFAULT_HOST,
        posts_path: str = DEFAULT_POSTS_PATH,
        method: str = DEFAULT_METHOD,
        amount: int = DEFAULT_AMOUNT,
    ):
        self.api_key = api_key
        self.host = host.removeprefix("https://").removeprefix("http://").rstrip("/")
        self.posts_path = posts_path if posts_path.startswith("/") else f"/{posts_path}"
        self.method = method.upper()
        self.amount = amount

    def _headers(self) -> dict[str, str]:
        return {
            "x-rapidapi-key": self.api_key,
            "x-rapidapi-host": self.host,
            "User-Agent": UA,
            "Accept": "application/json",
        }

    def get_posts_page(
        self,
        username: str,
        pagination_token: str | None = None,
    ) -> dict[str, Any]:
        # API accepts bare username or full profile URL
        username_or_url = (
            username
            if username.startswith("http")
            else f"https://www.instagram.com/{username}/"
        )
        form = {
            "username_or_url": username_or_url,
            "amount": str(self.amount),
            "pagination_token": pagination_token or "",
        }
        url = f"https://{self.host}{self.posts_path}"
        try:
            if self.method == "POST":
                raw = http_request(
                    url, method="POST", headers=self._headers(), form=form, timeout=90
                )
            else:
                qs = urllib.parse.urlencode(
                    {
                        "username_or_url": username_or_url,
                        "username_or_id_or_url": username,
                        "amount": str(self.amount),
                        **(
                            {"pagination_token": pagination_token}
                            if pagination_token
                            else {}
                        ),
                    }
                )
                raw = http_request(
                    f"{url}?{qs}", method="GET", headers=self._headers(), timeout=90
                )
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:500]
            raise RuntimeError(
                f"RapidAPI HTTP {e.code} for @{username}: {body}"
            ) from e

        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as e:
            raise RuntimeError(
                f"RapidAPI returned non-JSON for @{username}: {raw[:200]!r}"
            ) from e

        if isinstance(payload, dict) and payload.get("error"):
            raise RuntimeError(
                f"RapidAPI error for @{username}: {payload.get('error')}"
            )
        if isinstance(payload, dict) and payload.get("message") and not extract_items(
            payload
        ):
            # e.g. not subscribed / rate limit messages without items
            msg = payload.get("message")
            if isinstance(msg, str) and len(msg) < 300:
                raise RuntimeError(f"RapidAPI message for @{username}: {msg}")
        return payload

    def iter_posts(
        self,
        username: str,
        max_pages: int = 3,
        max_posts: int | None = None,
        page_delay: float = 1.0,
    ) -> Iterator[dict[str, Any]]:
        token: str | None = None
        seen = 0
        for page in range(max_pages):
            if page and page_delay:
                time.sleep(page_delay)
            data = self.get_posts_page(username, pagination_token=token)
            items = extract_items(data)
            if not items:
                if page == 0:
                    keys = list(data.keys()) if isinstance(data, dict) else type(data)
                    print(f"  warn: no items on page {page + 1}, top keys={keys}")
                break
            print(f"  page {page + 1}: {len(items)} posts")
            for item in items:
                yield normalize_post(item)
                seen += 1
                if max_posts is not None and seen >= max_posts:
                    return
            token = extract_pagination_token(data)
            if not token:
                break


def normalize_post(item: dict[str, Any]) -> dict[str, Any]:
    """Unwrap {node: {...}} wrappers used by the stable API."""
    if isinstance(item, dict) and "node" in item and isinstance(item["node"], dict):
        return item["node"]
    return item


def extract_items(payload: Any) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []

    for key in ("posts", "items", "medias", "reels", "data"):
        val = payload.get(key)
        if isinstance(val, list) and val and isinstance(val[0], dict):
            return val
        if isinstance(val, dict):
            for sub in ("items", "posts", "edges", "medias"):
                inner = val.get(sub)
                if isinstance(inner, list) and inner and isinstance(inner[0], dict):
                    return inner

    # one-level walk
    for v in payload.values():
        if isinstance(v, list) and v and isinstance(v[0], dict):
            sample = v[0].get("node") if "node" in v[0] else v[0]
            if isinstance(sample, dict) and any(
                k in sample
                for k in (
                    "code",
                    "shortcode",
                    "id",
                    "pk",
                    "image_versions2",
                    "image_versions",
                    "carousel_media",
                    "media_type",
                    "display_uri",
                )
            ):
                return v
    return []


def extract_pagination_token(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in (
        "pagination_token",
        "next_page_id",
        "next_max_id",
        "max_id",
        "end_cursor",
    ):
        if payload.get(key):
            return str(payload[key])
    data = payload.get("data")
    if isinstance(data, dict):
        for key in (
            "pagination_token",
            "next_page_id",
            "next_max_id",
            "max_id",
            "end_cursor",
        ):
            if data.get(key):
                return str(data[key])
    return None


def best_image_url(node: dict[str, Any]) -> str | None:
    """Pick largest still image URL from a post / carousel slide."""
    for key in ("image_versions2", "image_versions"):
        block = node.get(key)
        if not isinstance(block, dict):
            continue
        candidates = block.get("candidates") or block.get("items") or []
        if isinstance(candidates, list) and candidates:

            def area(c: dict) -> int:
                return int(c.get("width") or 0) * int(c.get("height") or 0)

            ranked = sorted(
                (c for c in candidates if isinstance(c, dict) and c.get("url")),
                key=area,
                reverse=True,
            )
            if ranked:
                return str(ranked[0]["url"])

    for key in ("display_uri", "display_url", "thumbnail_url", "url", "image_url"):
        if node.get(key):
            return str(node[key])

    media = node.get("media")
    if isinstance(media, dict):
        return best_image_url(media)
    return None


def post_image_urls(post: dict[str, Any]) -> list[tuple[str, str]]:
    """Return list of (suffix, image_url) for a post (handles carousels)."""
    code = str(
        post.get("code")
        or post.get("shortcode")
        or post.get("pk")
        or post.get("id")
        or "post"
    )
    # strip user id suffix from composite ids like "123_456"
    if "_" in code and code.replace("_", "").isdigit():
        code = code.split("_")[0]

    out: list[tuple[str, str]] = []
    carousel = post.get("carousel_media") or post.get("resources") or []
    if isinstance(carousel, list) and carousel:
        for i, item in enumerate(carousel):
            if not isinstance(item, dict):
                continue
            # media_type 2 = video — still grab cover/thumbnail if present
            url = best_image_url(item)
            if url:
                out.append((f"{code}-{i + 1}", url))
        if out:
            return out

    # pure video post: still try image_versions2 (often has cover)
    url = best_image_url(post)
    if url:
        out.append((code, url))
    return out


# ---------------------------------------------------------------------------
# gallery writer
# ---------------------------------------------------------------------------

def save_post_images(
    username: str,
    post: dict[str, Any],
    dry_run: bool = False,
) -> list[dict[str, Any]]:
    artist = IG_TO_ARTIST.get(username, "doomkitten")
    style = ARTIST_STYLE.get(artist, "horror")
    tag = "studio" if username == "catandcobra" else artist
    meta: list[dict[str, Any]] = []

    for suffix, url in post_image_urls(post):
        slug = slugify(f"{tag}-{suffix}")
        name = f"{artist}__{style}__{slug}__fresh.jpg"
        dest = OUT / name
        if dry_run:
            print(f"  [dry-run] {name}")
            meta.append(
                {
                    "source": "instagram-rapidapi",
                    "user": username,
                    "file": name,
                    "url": url,
                    "artist": artist,
                }
            )
            continue
        print(f"  {name}")
        if download_file(url, dest):
            meta.append(
                {
                    "source": "instagram-rapidapi",
                    "user": username,
                    "file": name,
                    "url": url,
                    "artist": artist,
                }
            )
            print(f"    ok ({dest.stat().st_size // 1024}KB)")
        time.sleep(0.15)
    return meta


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument(
        "--user",
        action="append",
        dest="users",
        metavar="USERNAME",
        help="Instagram username (repeatable). Default: all studio + artists.",
    )
    p.add_argument(
        "--all", action="store_true", help="All known studio/artist accounts"
    )
    p.add_argument("--max-pages", type=int, default=3, help="Pages per user (default 3)")
    p.add_argument("--max-posts", type=int, default=None, help="Cap posts per user")
    p.add_argument(
        "--amount",
        type=int,
        default=None,
        help="Posts per API page (default from .env or 12)",
    )
    p.add_argument("--page-delay", type=float, default=1.0, help="Seconds between pages")
    p.add_argument("--user-delay", type=float, default=1.5, help="Seconds between users")
    p.add_argument("--dry-run", action="store_true", help="List only, do not write files")
    p.add_argument("--env", type=Path, default=ENV_PATH, help="Path to .env file")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    env = load_env(args.env)
    api_key = env.get("INSTAGRAM_RAPIDAPI_KEY", "").strip()
    if not api_key:
        print(
            "ERROR: INSTAGRAM_RAPIDAPI_KEY missing.\n"
            f"  Create {args.env} from .env.example and paste your RapidAPI key.\n"
            "  API: https://rapidapi.com/thetechguy32744/api/instagram-scraper-stable-api",
            file=sys.stderr,
        )
        return 1

    host = env.get("INSTAGRAM_RAPIDAPI_HOST", DEFAULT_HOST).strip() or DEFAULT_HOST
    posts_path = (
        env.get("INSTAGRAM_RAPIDAPI_POSTS_PATH", DEFAULT_POSTS_PATH).strip()
        or DEFAULT_POSTS_PATH
    )
    method = (
        env.get("INSTAGRAM_RAPIDAPI_METHOD", DEFAULT_METHOD).strip() or DEFAULT_METHOD
    )
    amount = args.amount
    if amount is None:
        try:
            amount = int(env.get("INSTAGRAM_RAPIDAPI_AMOUNT", DEFAULT_AMOUNT))
        except ValueError:
            amount = DEFAULT_AMOUNT

    users = args.users if args.users else list(IG_TO_ARTIST.keys())

    print(f"RapidAPI host : {host}")
    print(f"Posts path    : {posts_path} ({method})")
    print(f"Amount/page   : {amount}")
    print(f"Users         : {', '.join('@' + u for u in users)}")
    print(f"Output        : {OUT.relative_to(ROOT)}")
    if args.dry_run:
        print("Mode          : dry-run")

    client = RapidInstagram(
        api_key=api_key,
        host=host,
        posts_path=posts_path,
        method=method,
        amount=amount,
    )
    OUT.mkdir(parents=True, exist_ok=True)

    all_meta: list[dict[str, Any]] = []
    errors: list[str] = []

    for i, username in enumerate(users):
        if i and args.user_delay:
            time.sleep(args.user_delay)
        print(f"\n=== @{username} ===")
        try:
            count = 0
            for post in client.iter_posts(
                username,
                max_pages=args.max_pages,
                max_posts=args.max_posts,
                page_delay=args.page_delay,
            ):
                meta = save_post_images(username, post, dry_run=args.dry_run)
                all_meta.extend(meta)
                count += 1
            n_imgs = sum(1 for m in all_meta if m["user"] == username)
            print(f"@{username}: processed {count} posts → {n_imgs} images")
        except Exception as e:
            msg = str(e)
            print(f"ERROR @{username}: {msg}")
            errors.append(f"@{username}: {msg}")
            if "not subscribed" in msg.lower():
                print(
                    "\n→ Suscríbete a la API en RapidAPI:\n"
                    "  https://rapidapi.com/thetechguy32744/api/instagram-scraper-stable-api\n"
                )
                break

    if not args.dry_run:
        manifest_path = OUT / "DOWNLOAD_MANIFEST.json"
        if manifest_path.exists():
            try:
                manifest = json.loads(manifest_path.read_text())
            except json.JSONDecodeError:
                manifest = {}
        else:
            manifest = {}
        prev_ig = [
            x
            for x in manifest.get("instagram", [])
            if x.get("user") not in set(users)
        ]
        manifest["instagram"] = prev_ig + all_meta
        files = [
            p
            for p in OUT.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        ]
        counts = manifest.get("counts") or {}
        counts["instagram_ok"] = len(manifest["instagram"])
        counts["total_files"] = len(files)
        counts["rapidapi_last_run"] = len(all_meta)
        manifest["counts"] = counts
        manifest_path.write_text(json.dumps(manifest, indent=2))

    by_artist: dict[str, int] = defaultdict(int)
    for m in all_meta:
        by_artist[m["artist"]] += 1

    print("\n=== Summary ===")
    print(f"Images saved this run: {len(all_meta)}")
    for artist, n in sorted(by_artist.items()):
        print(f"  {artist}: {n}")
    if errors:
        print(f"Errors: {len(errors)}")
        for e in errors:
            print(f"  - {e[:200]}")
        return 2 if not all_meta else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
