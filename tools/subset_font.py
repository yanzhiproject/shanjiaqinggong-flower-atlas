from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "ui" / "sjq-wenyue-guti-fangsong.otf"
OUTPUT = ROOT / "assets" / "ui" / "sjq-wenyue-guti-fangsong.woff2"


def collect_characters() -> set[int]:
    characters = set(range(0x20, 0x7F))
    for pattern in ("*.html", "*.css", "*.js", "*.md"):
        for path in ROOT.rglob(pattern):
            try:
                characters.update(map(ord, path.read_text(encoding="utf-8")))
            except UnicodeDecodeError:
                continue
    return characters


font = TTFont(SOURCE)
options = subset.Options()
options.flavor = "woff2"
options.layout_features = ["*"]
options.name_IDs = [0, 1, 2, 3, 4, 5, 6]
options.name_legacy = True
options.name_languages = [0x409, 0x804]

subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=collect_characters())
subsetter.subset(font)
font.flavor = "woff2"
font.save(OUTPUT)

print(f"created {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size / 1024 / 1024:.2f} MB)")
