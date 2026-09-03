from __future__ import annotations

import re
import shutil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def write_if_changed(path: Path, content: str) -> None:
    if path.read_text(encoding="utf-8") != content:
        path.write_text(content, encoding="utf-8", newline="")


def install_image_runtime() -> None:
    runtime = '<script src="../../assets/ui/sjq-image-loader.js"></script>'
    for path in (ROOT / "flowers").rglob("*.html"):
        text = path.read_text(encoding="utf-8")
        text = text.replace(runtime, "")
        text = text.replace("<head>", "<head>" + runtime, 1)
        write_if_changed(path, text)


def install_guihua_composite_runtime() -> None:
    path = ROOT / "flowers" / "guihua" / "index.html"
    text = path.read_text(encoding="utf-8")
    runtime_declaration = "const runtime='<script src=\"../../assets/ui/sjq-image-loader.js\"><'+ '/script>';;"
    if runtime_declaration not in text:
        text = text.replace("const bridge='<script>", runtime_declaration + "const bridge='<script>", 1)
    text = text.replace("normalize+bridge+'</head>'", "normalize+runtime+bridge+'</head>'", 1)
    write_if_changed(path, text)


def cache_bust_shared_header() -> None:
    for path in (ROOT / "flowers").rglob("*.html"):
        text = path.read_text(encoding="utf-8")
        text = re.sub(
            r"sjq-unified-header\.js(?:\?v=[A-Za-z0-9-]+)?",
            "sjq-unified-header.js?v=20260903-2",
            text,
        )
        write_if_changed(path, text)


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
                if not target.exists():
                    with Image.open(source) as image:
                        image.save(
                            target,
                            "WEBP",
                            quality=88,
                            method=6,
                            alpha_quality=100,
                            exact=True,
                        )
                replacements[reference] = str(Path(reference).with_suffix(".webp")).replace("\\", "/")
            for old, new in replacements.items():
                text = text.replace(old, new)
            write_if_changed(html, text)


def recompress_large_referenced_webps() -> None:
    asset_pattern = re.compile(r"[A-Za-z0-9_./%()-]+\.webp", re.IGNORECASE)
    referenced: set[Path] = set()
    for html in (ROOT / "flowers").rglob("*.html"):
        text = html.read_text(encoding="utf-8")
        for reference in set(asset_pattern.findall(text)):
            target = (html.parent / reference).resolve()
            try:
                target.relative_to(ROOT)
            except ValueError:
                continue
            if target.is_file() and target.stat().st_size >= 320 * 1024:
                referenced.add(target)

    saved = 0
    changed = 0
    for target in sorted(referenced):
        source = next(
            (candidate for suffix in (".png", ".jpg", ".jpeg")
             if (candidate := target.with_suffix(suffix)).is_file()),
            None,
        )
        if source is None:
            continue
        temporary = target.with_suffix(".webp.optimized")
        with Image.open(source) as image:
            image.save(
                temporary,
                "WEBP",
                quality=86,
                method=6,
                alpha_quality=100,
                exact=True,
            )
        old_size = target.stat().st_size
        new_size = temporary.stat().st_size
        if new_size <= old_size * 0.9:
            temporary.replace(target)
            saved += old_size - new_size
            changed += 1
        else:
            temporary.unlink()
    print(f"recompressed {changed} images; saved {saved / 1024 / 1024:.2f} MB")


def lazy_load_songhua_chapters() -> None:
    path = ROOT / "flowers" / "songhua" / "index.html"
    text = path.read_text(encoding="utf-8")
    text = text.replace("data-data-srcdoc=", "data-srcdoc=")
    for index in range(1, 5):
        pattern = re.compile(
            rf'(<section class="chapter-panel" data-index="{index}"><iframe\b[^>]*?)(?<!data-)\bsrcdoc=',
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


def main() -> None:
    share_p5_runtime()
    convert_referenced_pngs()
    recompress_large_referenced_webps()
    lazy_load_songhua_chapters()
    install_image_runtime()
    install_guihua_composite_runtime()
    cache_bust_shared_header()
    print("site performance assets generated")


if __name__ == "__main__":
    main()
