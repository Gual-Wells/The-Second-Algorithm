"""Build the native series icon from one geometry and the verified edge alpha."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, PngImagePlugin

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "web/icons"
REFERENCE = ROOT / "design/reference-icons"
BLUE, PAPER = "#3469e6", "#f4f6fa"
# The branch diagram is this application's glyph. No reference-app glyph is reused.
RECTANGLES = [(184, 88, 328, 208, 14), (72, 296, 216, 416, 14),
              (296, 296, 440, 416, 14)]
BRANCHES = [((256, 208), (256, 248)), ((144, 248), (368, 248)),
            ((144, 248), (144, 296)), ((368, 248), (368, 296))]
LINES = [((224, 148), (288, 148)), ((112, 356), (176, 356)),
         ((336, 356), (400, 356))]


def svg_source():
    rectangles = "".join(
        f'<rect x="{x1}" y="{y1}" width="{x2-x1}" height="{y2-y1}" rx="{radius}"/>'
        for x1, y1, x2, y2, radius in RECTANGLES)
    segments = lambda items: "".join(
        f'<path d="M{x1} {y1}H{x2}"/>' if y1 == y2 else
        f'<path d="M{x1} {y1}V{y2}"/>'
        for (x1, y1), (x2, y2) in items)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" '
            'role="img" aria-label="第二算法">\n'
            f'  <rect width="512" height="512" fill="{PAPER}"/>\n'
            f'  <g fill="{BLUE}">{rectangles}</g>\n'
            f'  <g fill="none" stroke="{BLUE}" stroke-width="24" '
            f'stroke-linecap="round">{segments(BRANCHES)}</g>\n'
            f'  <g fill="none" stroke="{PAPER}" stroke-width="13" '
            f'stroke-linecap="round">{segments(LINES)}</g>\n</svg>\n')


def render(size):
    scale = size * 4 / 512
    im = Image.new("RGB", (size * 4, size * 4), PAPER)
    draw = ImageDraw.Draw(im)
    for x1, y1, x2, y2, radius in RECTANGLES:
        draw.rounded_rectangle(tuple(round(v * scale) for v in (x1, y1, x2, y2)),
                               radius=round(radius * scale), fill=BLUE)
    for segments, width, color in [(BRANCHES, 24, BLUE), (LINES, 13, PAPER)]:
        stroke = round(width * scale)
        for a, b in segments:
            points = [tuple(round(v * scale) for v in point) for point in (a, b)]
            draw.line(points, fill=color, width=stroke)
            for x, y in points:
                radius = stroke / 2
                draw.ellipse((round(x-radius), round(y-radius),
                              round(x+radius), round(y+radius)), fill=color)
    return im.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = json.loads((REFERENCE / "SOURCE.json").read_text(encoding="utf-8"))
    svg = svg_source()
    (OUTPUT / "icon.svg").write_bytes(svg.encode("utf-8"))
    rows = []
    for size, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"),
                       (512, "icon-512.png")]:
        reference = Image.open(REFERENCE / name).convert("RGBA")
        assert reference.size == (size, size)
        alpha = reference.getchannel("A")
        assert alpha.crop((1, 1, size-1, size-1)).getextrema() == (255, 255)
        actual_alpha = hashlib.sha256(alpha.tobytes()).hexdigest()
        assert actual_alpha == source["files"][name]["alpha_sha256"]
        im = render(size)
        im.putalpha(alpha)
        info = PngImagePlugin.PngInfo()
        info.add(b"sRGB", b"\0")
        im.save(OUTPUT / name, pnginfo=info)
        assert Image.open(OUTPUT / name).getchannel("A").tobytes() == alpha.tobytes()
        if size == 180:
            im.save(OUTPUT / "apple-touch-icon-series1.png", pnginfo=info)
        rows.append({"name": name, "size": size, "mode": "RGBA",
                     "alpha_sha256": actual_alpha,
                     "sha256": hashlib.sha256((OUTPUT / name).read_bytes()).hexdigest()})
    (OUTPUT / "build.json").write_bytes((json.dumps({
        "series": 1, "geometry_source": "scripts/make-carrier-icons.py",
        "geometry_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "svg_sha256": hashlib.sha256(svg.encode()).hexdigest(),
        "reference_repository": source["repository"], "reference_commit": source["commit"],
        "files": rows
    }, indent=2) + "\n").encode("utf-8"))
    print("Second Algorithm series icon built: 180 / 192 / 512; exact verified edge alpha.")


if __name__ == "__main__":
    main()
