"""生成头像多尺寸 webp（224 / 320 / 448），供 srcset 使用。

源图：src/site/assets/hero-avatar.png（1024×1024，不进仓库）
产物：hero-avatar-224.webp / -320 / -448（入仓库，供前端引用）

用法：python -X utf8 scripts/make-avatar-variants.py
"""
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "src" / "site" / "assets"
SOURCE = ASSETS / "hero-avatar.png"
SIZES = (224, 320, 448)
QUALITY = 82

def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"缺少源图：{SOURCE}")
    base = Image.open(SOURCE).convert("RGB")
    if base.width != base.height:
        raise SystemExit(f"源图应为正方形，实际 {base.size}")
    for size in SIZES:
        out = ASSETS / f"hero-avatar-{size}.webp"
        resized = base.resize((size, size), Image.LANCZOS)
        resized.save(out, "WEBP", quality=QUALITY, method=6)
        print(f"{out.name}  {out.stat().st_size / 1024:.1f} kB")

if __name__ == "__main__":
    main()
