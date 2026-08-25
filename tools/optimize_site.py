from __future__ import annotations

import re
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def write_if_changed(path: Path, content: str) -> None:
    if path.read_text(encoding="utf-8") != content:
        path.write_text(content, encoding="utf-8", newline="")


def share_p5_runtime() -> None:
    vendor = ROOT / "assets" / "vendor"
    vendor.mkdir(parents=True, exist_ok=True)
    shared = vendor / "p5-2.3.2.min.js"
    shutil.copyfile(ROOT / "flowers" / "guihua" / "p5.min.js", shared)

    for relative in ("flowers/guihua/index.html", "flowers/mudan/identify.html"):
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        text = text.replace('src="p5.min.js"', 'src="../../assets/vendor/p5-2.3.2.min.js"')
        write_if_changed(path, text)

    path = ROOT / "flowers" / "juhua" / "identify.html"
    text = path.read_text(encoding="utf-8")
    marker = "/* p5.js 2.3.2 · embedded for offline use */"
    if marker in text:
        marker_index = text.index(marker)
        script_start = text.rfind("<script", 0, marker_index)
        script_end = text.index("</script>", marker_index) + len("</script>")
        text = (
            text[:script_start]
            + '<script src="../../assets/vendor/p5-2.3.2.min.js"></script>'
            + text[script_end:]
        )
        write_if_changed(path, text)


def convert_referenced_pngs() -> None:
    asset_pattern = re.compile(r"[A-Za-z0-9_./%-]+\.png", re.IGNORECASE)
    for flower in ("songhua", "meihua"):
        folder = ROOT / "flowers" / flower
        for html in folder.glob("*.html"):
            text = html.read_text(encoding="utf-8")
            replacements: dict[str, str] = {}
            for reference in set(asset_pattern.findall(text)):
                source = (html.parent / reference).resolve()
                try:
                    source.relative_to(ROOT)
                except ValueError:
                    continue
                if not source.is_file():
                    continue
                target = source.with_suffix(".webp")
                with Image.open(source) as image:
                    image.save(
                        target,
                        "WEBP",
                        quality=95,
                        method=6,
                        alpha_quality=100,
                        exact=True,
                    )
                replacements[reference] = str(Path(reference).with_suffix(".webp")).replace("\\", "/")
            for old, new in replacements.items():
                text = text.replace(old, new)
            write_if_changed(html, text)


def lazy_load_songhua_chapters() -> None:
    path = ROOT / "flowers" / "songhua" / "index.html"
    text = path.read_text(encoding="utf-8")
    for index in range(1, 5):
        pattern = re.compile(
            rf'(<section class="chapter-panel" data-index="{index}"><iframe\b[^>]*?)\bsrcdoc=',
            re.DOTALL,
        )
        text, count = pattern.subn(r"\1data-srcdoc=", text, count=1)
        already_deferred = re.search(
            rf'data-index="{index}"><iframe\b[^>]*\bdata-srcdoc=', text, re.DOTALL
        )
        if count != 1 and not already_deferred:
            raise RuntimeError(f"could not defer Songhua chapter {index}")

    old = """  function show(index){
    current=Math.max(0,Math.min(4,index));
    panels.forEach((panel,i)=>panel.classList.toggle('active',i===current));"""
    new = """  function show(index){
    current=Math.max(0,Math.min(4,index));
    const currentFrame=panels[current].querySelector('.chapter-frame');
    if(currentFrame?.dataset.srcdoc&&!currentFrame.hasAttribute('srcdoc')){
      currentFrame.srcdoc=currentFrame.dataset.srcdoc;
      currentFrame.removeAttribute('data-srcdoc');
    }
    panels.forEach((panel,i)=>panel.classList.toggle('active',i===current));"""
    if old in text:
        text = text.replace(old, new, 1)
    elif "const currentFrame=panels[current].querySelector('.chapter-frame');" not in text:
        raise RuntimeError("could not install Songhua lazy chapter loader")
    write_if_changed(path, text)


share_p5_runtime()
convert_referenced_pngs()
lazy_load_songhua_chapters()
print("site performance assets generated")
