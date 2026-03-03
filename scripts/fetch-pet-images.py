#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import random
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT_DIR = Path(__file__).resolve().parent.parent
PETS_DIR = ROOT_DIR / "assets" / "pets"
CATS_DIR = PETS_DIR / "cats"
DOGS_DIR = PETS_DIR / "dogs"
FALLBACK_DIR = PETS_DIR / "fallback"

DEFAULT_SIZE = 840
DEFAULT_CAT_COUNT = 10
DEFAULT_DOG_COUNT = 10


def log(message: str) -> None:
    print(message, file=sys.stderr)


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def http_get(url: str, timeout_seconds: int = 25) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": "feed-forward-network-image-fetcher/1.0",
            "Accept": "image/*,*/*;q=0.8",
        },
    )
    with urlopen(request, timeout=timeout_seconds) as response:
        return response.read()


def http_get_json(url: str, timeout_seconds: int = 25) -> dict:
    request = Request(
        url,
        headers={
            "User-Agent": "feed-forward-network-image-fetcher/1.0",
            "Accept": "application/json",
        },
    )
    with urlopen(request, timeout=timeout_seconds) as response:
        return json.loads(response.read().decode("utf-8"))


def sniff_extension(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    return None


def write_bytes_atomic(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    tmp_path.write_bytes(payload)
    tmp_path.replace(path)


def magick_normalize_to_jpg(source_path: Path, dest_path: Path, size: int) -> bool:
    if not command_exists("magick"):
        return False
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [
                "magick",
                str(source_path),
                "-auto-orient",
                "-resize",
                f"{size}x{size}^",
                "-gravity",
                "center",
                "-extent",
                f"{size}x{size}",
                "-strip",
                "-quality",
                "85",
                str(dest_path),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return False
    return dest_path.exists()


def ensure_fallback_images(size: int) -> None:
    FALLBACK_DIR.mkdir(parents=True, exist_ok=True)
    if not command_exists("magick"):
        log("Warning: ImageMagick not found (magick). Fallback images may be missing.")
        return

    palette = {
        "cat": ["#f97316", "#fb923c", "#fdba74"],
        "dog": ["#2563eb", "#60a5fa", "#1e40af"],
    }
    for kind, colors in palette.items():
        for index, color in enumerate(colors, start=1):
            dest = FALLBACK_DIR / f"{kind}-fallback-{index:02d}.jpg"
            if dest.exists():
                continue
            label = kind.upper()
            subprocess.run(
                [
                    "magick",
                    "-size",
                    f"{size}x{size}",
                    f"xc:{color}",
                    "-gravity",
                    "center",
                    "-fill",
                    "#ffffff",
                    "-pointsize",
                    "120",
                    "-annotate",
                    "0",
                    label,
                    "-strip",
                    "-quality",
                    "85",
                    str(dest),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )


def pick_random_fallback(kind: str) -> Path | None:
    candidates = sorted(FALLBACK_DIR.glob(f"{kind}-fallback-*.jpg"))
    if not candidates:
        return None
    return random.choice(candidates)


def download_with_retries(url_factory, attempts: int) -> tuple[bytes | None, str | None, str | None]:
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            url = url_factory()
        except Exception as exc:  # noqa: BLE001
            last_error = f"{type(exc).__name__}: {exc}"
            log(f"Fetch failed (attempt {attempt}/{attempts}): (url factory) ({last_error})")
            continue
        try:
            payload = http_get(url)
        except (HTTPError, URLError, TimeoutError) as exc:
            last_error = f"{type(exc).__name__}: {exc}"
            log(f"Fetch failed (attempt {attempt}/{attempts}): {url} ({last_error})")
            continue
        ext = sniff_extension(payload)
        if not ext:
            last_error = "Unknown content type"
            log(f"Fetch failed (attempt {attempt}/{attempts}): {url} (not an image)")
            continue
        return payload, ext, url
    return None, None, last_error


def fetch_cats(count: int, size: int, attempts: int) -> list[dict]:
    items: list[dict] = []
    for index in range(1, count + 1):
        timestamp = int(time.time() * 1000)

        def url_factory() -> str:
            cache_bust = f"{timestamp}-{index}-{random.randint(0, 999999)}"
            return f"https://cataas.com/cat?width={size}&height={size}&ts={cache_bust}"

        payload, ext, source_url_or_error = download_with_retries(url_factory, attempts=attempts)
        dest = CATS_DIR / f"cat-{index:02d}.jpg"
        used_fallback = False

        if payload and ext:
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_dir_path = Path(tmp_dir)
                tmp_source = tmp_dir_path / f"cat-src{ext}"
                tmp_source.write_bytes(payload)
                normalized = magick_normalize_to_jpg(tmp_source, dest, size=size)
                if not normalized:
                    write_bytes_atomic(dest, payload)
        else:
            fallback = pick_random_fallback("cat")
            if fallback:
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(fallback, dest)
                used_fallback = True
            else:
                raise RuntimeError("No cat fallback images available and fetch failed.")

        items.append(
            {
                "kind": "cat",
                "path": str(dest.relative_to(ROOT_DIR)).replace("\\", "/"),
                "source": None if used_fallback else source_url_or_error,
                "fallback": used_fallback,
            }
        )
        log(f"Saved {dest.relative_to(ROOT_DIR)}")
    return items


def fetch_dogs(count: int, size: int, attempts: int) -> list[dict]:
    items: list[dict] = []
    for index in range(1, count + 1):
        def url_factory() -> str:
            cache_bust = f"{int(time.time() * 1000)}-{index}-{random.randint(0, 999999)}"
            dog_api_data = http_get_json(f"https://dog.ceo/api/breeds/image/random?ts={cache_bust}")
            image_url = dog_api_data.get("message")
            if not isinstance(image_url, str) or not image_url.startswith("http"):
                raise RuntimeError("Dog API did not return an image URL.")
            return image_url

        payload, ext, source_url_or_error = download_with_retries(url_factory, attempts=attempts)
        dest = DOGS_DIR / f"dog-{index:02d}.jpg"
        used_fallback = False

        if payload and ext:
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_dir_path = Path(tmp_dir)
                tmp_source = tmp_dir_path / f"dog-src{ext}"
                tmp_source.write_bytes(payload)
                normalized = magick_normalize_to_jpg(tmp_source, dest, size=size)
                if not normalized:
                    write_bytes_atomic(dest, payload)
        else:
            fallback = pick_random_fallback("dog")
            if fallback:
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(fallback, dest)
                used_fallback = True
            else:
                raise RuntimeError("No dog fallback images available and fetch failed.")

        items.append(
            {
                "kind": "dog",
                "path": str(dest.relative_to(ROOT_DIR)).replace("\\", "/"),
                "source": None if used_fallback else source_url_or_error,
                "fallback": used_fallback,
            }
        )
        log(f"Saved {dest.relative_to(ROOT_DIR)}")
    return items


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch and store local cat/dog images for the demo.")
    parser.add_argument("--cats", type=int, default=DEFAULT_CAT_COUNT, help="Number of cat images to fetch.")
    parser.add_argument("--dogs", type=int, default=DEFAULT_DOG_COUNT, help="Number of dog images to fetch.")
    parser.add_argument("--size", type=int, default=DEFAULT_SIZE, help="Square size in pixels for output images.")
    parser.add_argument("--attempts", type=int, default=3, help="Fetch retry attempts per image.")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for fallback selection.")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    ensure_fallback_images(size=args.size)

    log(f"Fetching {args.cats} cats and {args.dogs} dogs…")
    cats = fetch_cats(count=args.cats, size=args.size, attempts=args.attempts)
    dogs = fetch_dogs(count=args.dogs, size=args.size, attempts=args.attempts)

    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "size": args.size,
        "cats": cats,
        "dogs": dogs,
    }
    write_bytes_atomic(PETS_DIR / "manifest.json", json.dumps(manifest, indent=2).encode("utf-8") + b"\n")
    log(f"Wrote {PETS_DIR.relative_to(ROOT_DIR) / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
