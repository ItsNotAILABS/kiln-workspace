"""Unique 3D HD Kiln × X repo badge. Seeded per owner/repo/token — not a template."""
from __future__ import annotations

import colorsys
import hashlib
import json
import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "badges"

X_OUTER = [
    (18.244, 2.25),
    (21.552, 2.25),
    (14.325, 10.51),
    (22.827, 21.75),
    (16.17, 21.75),
    (11.456, 15.519),
    (6.055, 21.75),
    (2.744, 21.75),
    (10.471, 12.928),
    (2.002, 2.25),
    (8.08, 2.25),
    (12.333, 7.872),
    (16.856, 2.25),
    (18.244, 2.25),
]
X_INNER = [
    (17.083, 19.77),
    (18.916, 19.77),
    (7.084, 4.126),
    (5.117, 4.126),
]


def font(size: int, bold: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    if mono:
        paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        ]
    else:
        paths = [
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def seed_bytes(meta: dict) -> bytes:
    raw = f"{meta.get('kind')}:{meta.get('owner')}/{meta.get('name')}:{meta.get('token')}:{meta.get('pqAddress')}:{meta.get('isolation')}:{meta.get('milestone')}:{meta.get('height')}"
    return hashlib.sha256(raw.encode("utf-8")).digest()


def hsv(h: float, s: float, v: float, a: int = 255) -> tuple[int, int, int, int]:
    r, g, b = colorsys.hsv_to_rgb((h % 360) / 360.0, max(0, min(1, s)), max(0, min(1, v)))
    return (int(r * 255), int(g * 255), int(b * 255), a)


def palette(seed: bytes) -> dict:
    hue = 164 + (seed[0] / 255.0) * 36
    ice = 188 + (seed[1] / 255.0) * 28
    return {
        "bg0": hsv(hue, 0.42, 0.045),
        "bg1": hsv(hue, 0.38, 0.11),
        "edge": hsv(hue, 0.48, 0.78),
        "face": hsv(hue, 0.40, 0.28, 200),
        "lit": hsv(hue, 0.22, 0.92),
        "ice": hsv(ice, 0.30, 0.88),
        "dim": hsv(hue, 0.25, 0.18, 160),
        "hue": hue,
    }


def rotate(p, ax, ay, az):
    x, y, z = p
    cx, sx = math.cos(ax), math.sin(ax)
    cy, sy = math.cos(ay), math.sin(ay)
    cz, sz = math.cos(az), math.sin(az)
    y, z = y * cx - z * sx, y * sx + z * cx
    x, z = x * cy + z * sy, -x * sy + z * cy
    x, y = x * cz - y * sz, x * sz + y * cz
    return (x, y, z)


def project(p, w, h, ox, oy, scale, cam=3.6):
    x, y, z = p
    z += cam
    if z < 0.2:
        z = 0.2
    f = scale / z
    return (ox + x * f, oy - y * f, z)


def x_mask(wh: tuple[int, int], cx: int, cy: int, span: int) -> Image.Image:
    m = Image.new("L", wh, 0)
    d = ImageDraw.Draw(m)
    s = span / 20.0
    ox = cx - 12 * s
    oy = cy - 12 * s

    def P(pts):
        return [(ox + x * s, oy + y * s) for x, y in pts]

    d.polygon(P(X_OUTER), fill=255)
    d.polygon(P(X_INNER), fill=0)
    return m


def paste_x(base: Image.Image, cx: int, cy: int, span: int, fill=(250, 250, 250, 255)) -> None:
    m = x_mask(base.size, cx, cy, span)
    glow = m.filter(ImageFilter.GaussianBlur(radius=max(3, span // 18)))
    teal = Image.new("RGBA", base.size, (94, 234, 212, 0))
    teal.putalpha(glow.point(lambda p: min(150, p)))
    mark = Image.new("RGBA", base.size, fill)
    mark.putalpha(m)
    base.alpha_composite(teal)
    base.alpha_composite(mark)


def letter_mark(draw, cx, cy, r, letter, fill, ring):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=ring, width=max(2, r // 18))
    draw.text((cx, cy), letter, font=font(int(r * 1.05), True), fill=fill, anchor="mm")


def draw_lattice(layer: Image.Image, seed: bytes, pal: dict, w: int, h: int, focus_right: bool) -> None:
    d = ImageDraw.Draw(layer, "RGBA")
    ax = 0.38 + (seed[2] / 255.0) * 0.35
    ay = 0.55 + (seed[3] / 255.0) * 0.7
    az = (seed[4] / 255.0) * 0.28 - 0.14
    n = 5 + (seed[5] % 3)
    depth = 3 + (seed[6] % 3)
    span = 1.15
    step = (span * 2) / n
    ox = w * (0.72 if focus_right else 0.5)
    oy = h * 0.52
    scale = min(w, h) * (1.05 if focus_right else 1.15)
    cubes = []
    for i in range(n):
        for j in range(n):
            for k in range(depth):
                bit = seed[(i * 11 + j * 7 + k * 3) % 32]
                if bit < 70:
                    continue
                x = -span + i * step
                y = -span + j * step
                z = -0.9 + k * (1.8 / max(1, depth - 1))
                cubes.append((x, y, z, bit))
    cubes.sort(key=lambda c: rotate((c[0], c[1], c[2]), ax, ay, az)[2], reverse=True)
    s = step * 0.44
    for x, y, z, bit in cubes:
        verts = [
            (x - s, y - s, z - s),
            (x + s, y - s, z - s),
            (x + s, y + s, z - s),
            (x - s, y + s, z - s),
            (x - s, y - s, z + s),
            (x + s, y - s, z + s),
            (x + s, y + s, z + s),
            (x - s, y + s, z + s),
        ]
        rv = [rotate(v, ax, ay, az) for v in verts]
        pv = [project(v, w, h, ox, oy, scale) for v in rv]
        faces = (
            (4, 5, 6, 7, 1.0),
            (1, 2, 6, 5, 0.72),
            (2, 3, 7, 6, 0.48),
        )
        hot = bit > 190
        for a, b, c, e, lit in faces:
            pts = [(pv[a][0], pv[a][1]), (pv[b][0], pv[b][1]), (pv[c][0], pv[c][1]), (pv[e][0], pv[e][1])]
            col = pal["lit"] if hot and lit > 0.9 else pal["face"]
            fill = (col[0], col[1], col[2], int(70 + lit * 150))
            d.polygon(pts, fill=fill)
            d.line(pts + [pts[0]], fill=pal["edge"] if hot else pal["dim"], width=1)
    # unique crystal shard
    shard = []
    for i in range(6):
        ang = (i / 6) * math.tau + (seed[7] / 255.0) * 0.8
        r = 0.55 + (seed[(8 + i) % 32] / 255.0) * 0.45
        shard.append(rotate((math.cos(ang) * r, 0.2, math.sin(ang) * r), ax * 0.4, ay, 0))
    sp = [project(p, w, h, ox, oy, scale * 0.55) for p in shard]
    d.polygon([(p[0], p[1]) for p in sp], outline=pal["ice"], width=2)


def scene(meta: dict, w: int, h: int, focus_right: bool = True) -> Image.Image:
    seed = seed_bytes(meta)
    pal = palette(seed)
    img = Image.new("RGB", (w, h), pal["bg0"][:3])
    # vertical wash
    wash = Image.new("RGB", (w, h), pal["bg1"][:3])
    mask = Image.linear_gradient("L").resize((w, h))
    img = Image.composite(wash, img, mask)
    rgba = img.convert("RGBA")
    lattice = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw_lattice(lattice, seed, pal, w, h, focus_right)
    rgba.alpha_composite(lattice)
    # vignette
    vig = Image.new("L", (w, h), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse((int(w * 0.08), int(h * -0.1), int(w * 1.05), int(h * 1.2)), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(radius=max(40, w // 18)))
    shade = Image.new("RGBA", (w, h), (*pal["bg0"][:3], 0))
    shade.putalpha(Image.eval(vig, lambda p: int((255 - p) * 0.55)))
    rgba.alpha_composite(shade)
    # frame
    fr = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fr)
    pad = max(28, w // 48)
    fd.rounded_rectangle((pad, pad, w - pad, h - pad), radius=max(22, w // 48), outline=pal["edge"], width=2)
    fd.rounded_rectangle((pad + 10, pad + 10, w - pad - 10, h - pad - 10), radius=max(16, w // 56), outline=(244, 244, 245, 28), width=1)
    rgba.alpha_composite(fr)
    return rgba


def type_wide(rgba: Image.Image, meta: dict) -> Image.Image:
    if str(meta.get("kind") or "") == "passport":
        return type_passport(rgba, meta, "wide")
    w, h = rgba.size
    owner = str(meta.get("owner") or "kiln")
    name = str(meta.get("name") or "repo")
    height = int(meta.get("height") or 0)
    merkle = str(meta.get("merkle") or meta.get("token") or "")[:16]
    token = str(meta.get("token") or merkle)[:12]
    display = str(meta.get("displayName") or owner)
    lab = str(meta.get("lab") or "")
    vis = str(meta.get("visibility") or "public")
    mile = str(meta.get("milestone") or "")[:56]
    desc = str(meta.get("description") or "")[:72]
    files = int(meta.get("fileCount") or 0)
    paste_x(rgba, 140, 140, 52)
    tlayer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    t = ImageDraw.Draw(tlayer)
    t.text((190, 140), "KILN  ×  X", font=font(36, True), fill=(250, 250, 250, 255), anchor="lm")
    t.text((w - 90, 140), vis.upper(), font=font(22, True), fill=(94, 234, 212, 255), anchor="rm")
    letter_mark(t, 140, 360, 56, (display[:1] or "K").upper(), (250, 250, 250, 255), (94, 234, 212, 200))
    t.text((220, 330), display, font=font(44, True), fill=(250, 250, 250, 255), anchor="lt")
    t.text((220, 390), f"@{owner}" + (f"  ·  {lab}" if lab else ""), font=font(26), fill=(94, 234, 212, 255), anchor="lt")
    t.text((88, 520), f"{owner} /", font=font(32), fill=(161, 161, 170, 255), anchor="lt")
    t.text((88, 590), name[:28], font=font(86, True), fill=(250, 250, 250, 255), anchor="lt")
    y = 690
    if mile:
        t.text((88, y), mile, font=font(32, True), fill=(94, 234, 212, 255), anchor="lt")
        y += 46
    if desc:
        t.text((88, y), desc, font=font(22), fill=(161, 161, 170, 255), anchor="lt")
        y += 36
    t.line((88, y + 8, 780, y + 8), fill=(45, 212, 191, 140), width=2)
    files_bit = f"  ·  {files} FILES" if files else ""
    t.text((88, y + 56), f"MINTED  ·  KILN L1  ·  {height}{files_bit}", font=font(26, True), fill=(212, 212, 216, 255), anchor="lt")
    t.text((88, y + 108), merkle, font=font(22), fill=(113, 113, 122, 255), anchor="lt")
    t.text((88, 980), f"#{token}", font=font(20), fill=(82, 82, 91, 255), anchor="lt")
    return Image.alpha_composite(rgba, tlayer)


def mrz_fill(s: str, n: int = 44) -> str:
    cleaned = []
    for ch in str(s or "").upper():
        cleaned.append(ch if ch.isalnum() else "<")
    body = "".join(cleaned).replace(" ", "<")
    return (body + ("<" * n))[:n]


def draw_chip(t: ImageDraw.ImageDraw, x: int, y: int, w: int = 72, h: int = 52) -> None:
    t.rounded_rectangle((x, y, x + w, y + h), radius=8, outline=(94, 234, 212, 220), width=2)
    t.rounded_rectangle((x + 6, y + 6, x + w - 6, y + h - 6), radius=5, outline=(94, 234, 212, 90), width=1)
    pad_w, pad_h = 10, 8
    gap = 4
    ox = x + 12
    oy = y + 12
    for i in range(3):
        for j in range(2):
            px = ox + i * (pad_w + gap)
            py = oy + j * (pad_h + gap)
            t.rectangle((px, py, px + pad_w, py + pad_h), fill=(94, 234, 212, 70), outline=(212, 212, 216, 80))


def type_passport(rgba: Image.Image, meta: dict, mode: str = "wide") -> Image.Image:
    w, h = rgba.size
    owner = str(meta.get("owner") or "kiln")
    display = str(meta.get("displayName") or owner)
    isolation = str(meta.get("isolation") or f"kiln://{owner}")
    pq = str(meta.get("pqAddress") or meta.get("address") or "")
    scheme = str(meta.get("scheme") or "ml-dsa-65+ml-kem-768")
    height = int(meta.get("height") or 0)
    token = str(meta.get("token") or "")[:12]
    merkle = str(meta.get("claimsMerkle") or meta.get("merkle") or token)
    issued = str(meta.get("issuedAt") or meta.get("mintedAt") or "")[:10].replace("-", "")
    lab = str(meta.get("lab") or "")
    cipher = str(meta.get("cipher") or "AES-256-GCM+ML-KEM-768")
    tlayer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    t = ImageDraw.Draw(tlayer)
    if mode == "square":
        paste_x(rgba, w // 2, int(h * 0.16), 64)
        letter_mark(t, w // 2, int(h * 0.38), 70, (display[:1] or "K").upper(), (250, 250, 250, 255), (94, 234, 212, 220))
        t.text((w // 2, int(h * 0.12)), "KILN PASSPORT", font=font(22, True), fill=(250, 250, 250, 255), anchor="mm")
        t.text((w // 2, int(h * 0.52)), display[:28], font=font(36, True), fill=(250, 250, 250, 255), anchor="mm")
        t.text((w // 2, int(h * 0.58)), f"@{owner}", font=font(20), fill=(94, 234, 212, 255), anchor="mm")
        t.text((w // 2, int(h * 0.66)), isolation[:36], font=font(16, mono=True), fill=(212, 212, 216, 255), anchor="mm")
        t.text((w // 2, int(h * 0.74)), f"L1 {height}  ·  #{token}", font=font(18, True), fill=(212, 212, 216, 255), anchor="mm")
        t.text((w // 2, int(h * 0.82)), (pq or merkle)[:42], font=font(14, mono=True), fill=(113, 113, 122, 255), anchor="mm")
        t.text((w // 2, int(h * 0.90)), "TYPE P  ·  CODE KILN  ·  SEATED", font=font(14, True), fill=(94, 234, 212, 200), anchor="mm")
        return Image.alpha_composite(rgba, tlayer)
    if mode == "card":
        paste_x(rgba, 86, 78, 36)
        t.text((124, 78), "KILN PASSPORT", font=font(22, True), fill=(250, 250, 250, 255), anchor="lm")
        t.text((w - 56, 78), "TYPE P", font=font(16, True), fill=(94, 234, 212, 255), anchor="rm")
        letter_mark(t, 86, 210, 42, (display[:1] or "K").upper(), (250, 250, 250, 255), (94, 234, 212, 220))
        t.text((148, 188), display[:32], font=font(28, True), fill=(250, 250, 250, 255), anchor="lt")
        t.text((148, 228), f"@{owner}" + (f"  ·  {lab}" if lab else ""), font=font(16), fill=(94, 234, 212, 255), anchor="lt")
        t.text((56, 310), isolation[:48], font=font(18, mono=True), fill=(212, 212, 216, 255), anchor="lt")
        t.text((56, 350), (pq or "")[:48] or merkle[:48], font=font(16, mono=True), fill=(161, 161, 170, 255), anchor="lt")
        t.text((56, 430), f"Seated on Kiln L1  ·  height {height}  ·  #{token}", font=font(16, True), fill=(212, 212, 216, 255), anchor="lt")
        t.text((56, 470), scheme[:42], font=font(14, mono=True), fill=(113, 113, 122, 255), anchor="lt")
        band = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        bd = ImageDraw.Draw(band)
        bd.rectangle((0, h - 86, w, h), fill=(9, 9, 11, 200))
        rgba = Image.alpha_composite(rgba, band)
        t2 = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        td = ImageDraw.Draw(t2)
        line1 = mrz_fill(f"P<KILN<<{owner}")
        line2 = mrz_fill(f"{token}<{height}<{issued}<{(pq or merkle)[-16:]}")
        td.text((56, h - 58), line1, font=font(15, mono=True), fill=(212, 212, 216, 255), anchor="lt")
        td.text((56, h - 32), line2, font=font(15, mono=True), fill=(212, 212, 216, 255), anchor="lt")
        return Image.alpha_composite(Image.alpha_composite(rgba, tlayer), t2)

    paste_x(rgba, 132, 118, 48)
    t.text((186, 118), "KILN PASSPORT", font=font(34, True), fill=(250, 250, 250, 255), anchor="lm")
    t.text((w - 96, 108), "TYPE P", font=font(20, True), fill=(94, 234, 212, 255), anchor="rm")
    t.text((w - 96, 140), "CODE KILN", font=font(16, True), fill=(161, 161, 170, 255), anchor="rm")
    letter_mark(t, 120, 288, 44, (display[:1] or "K").upper(), (250, 250, 250, 255), (94, 234, 212, 230))
    draw_chip(t, 84, 356)
    t.text((300, 236), "NAME", font=font(14, True), fill=(113, 113, 122, 255), anchor="lt")
    t.text((300, 270), display[:36], font=font(40, True), fill=(250, 250, 250, 255), anchor="lt")
    t.text((300, 328), "HANDLE", font=font(14, True), fill=(113, 113, 122, 255), anchor="lt")
    t.text((300, 362), f"@{owner}" + (f"  ·  {lab}" if lab else ""), font=font(26), fill=(94, 234, 212, 255), anchor="lt")
    t.text((88, 540), "ISOLATION", font=font(14, True), fill=(113, 113, 122, 255), anchor="lt")
    t.text((88, 576), isolation[:48], font=font(28, True, True), fill=(244, 244, 245, 255), anchor="lt")
    t.text((88, 640), "POST-QUANTUM SEAT", font=font(14, True), fill=(113, 113, 122, 255), anchor="lt")
    t.text((88, 676), (pq or "pending")[:52], font=font(22, mono=True), fill=(94, 234, 212, 255), anchor="lt")
    t.text((88, 716), scheme[:48], font=font(16, mono=True), fill=(161, 161, 170, 255), anchor="lt")
    t.text((88, 770), "VAULT", font=font(14, True), fill=(113, 113, 122, 255), anchor="lt")
    t.text((88, 804), cipher[:48], font=font(18, mono=True), fill=(212, 212, 216, 255), anchor="lt")
    t.text((88, 858), f"ISSUED  ·  KILN L1  ·  {height}  ·  #{token}", font=font(22, True), fill=(212, 212, 216, 255), anchor="lt")
    t.text((88, 896), str(merkle)[:56], font=font(16, mono=True), fill=(113, 113, 122, 255), anchor="lt")
    band = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(band)
    bd.rectangle((48, h - 132, w - 48, h - 48), fill=(9, 9, 11, 210))
    bd.rectangle((48, h - 132, w - 48, h - 48), outline=(94, 234, 212, 90), width=1)
    rgba = Image.alpha_composite(rgba, band)
    t2 = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    td = ImageDraw.Draw(t2)
    line1 = mrz_fill(f"P<KILN<<{owner}")
    line2 = mrz_fill(f"{token}<{height}<{issued}<{(pq or merkle)[-20:]}")
    td.text((72, h - 108), line1, font=font(22, mono=True), fill=(226, 232, 240, 255), anchor="lt")
    td.text((72, h - 74), line2, font=font(22, mono=True), fill=(226, 232, 240, 255), anchor="lt")
    return Image.alpha_composite(Image.alpha_composite(rgba, tlayer), t2)


def render_wide(meta: dict) -> Path:
    token = str(meta.get("token") or "")[:12]
    rgba = scene(meta, 1920, 1080, True)
    out = type_wide(rgba, meta).convert("RGB")
    out = out.filter(ImageFilter.UnsharpMask(radius=1.0, percent=60, threshold=2))
    dest = OUT / f"{token}.jpg"
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "JPEG", quality=93, optimize=True, subsampling=1)
    return dest


def render_square(meta: dict) -> Path:
    token = str(meta.get("token") or meta.get("merkle") or "")[:12]
    size = 1024
    rgba = scene(meta, size, size, False)
    if str(meta.get("kind") or "") == "passport":
        out = type_passport(rgba, meta, "square").convert("RGB")
    else:
        owner = str(meta.get("owner") or "kiln")
        name = str(meta.get("name") or "repo")
        height = int(meta.get("height") or 0)
        merkle = str(meta.get("merkle") or meta.get("token") or "")[:16]
        display = str(meta.get("displayName") or owner)
        mile = str(meta.get("milestone") or "")[:36]
        paste_x(rgba, 512, 210, 72)
        tlayer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        t = ImageDraw.Draw(tlayer)
        t.text((512, 320), display, font=font(32, True), fill=(244, 244, 245, 255), anchor="mm")
        t.text((512, 365), f"@{owner}", font=font(18), fill=(94, 234, 212, 255), anchor="mm")
        t.text((512, 560), name[:22], font=font(52, True), fill=(250, 250, 250, 255), anchor="mm")
        if mile:
            t.text((512, 630), mile, font=font(20, True), fill=(94, 234, 212, 255), anchor="mm")
        t.text((512, 760), f"KILN L1  ·  {height}", font=font(20, True), fill=(212, 212, 216, 255), anchor="mm")
        t.text((512, 810), merkle, font=font(16), fill=(113, 113, 122, 255), anchor="mm")
        t.text((512, 900), f"#{token}", font=font(16), fill=(82, 82, 91, 255), anchor="mm")
        out = Image.alpha_composite(rgba, tlayer).convert("RGB")
    dest_png = OUT / f"{token}.png"
    dest_png.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest_png, "PNG", optimize=True)
    return dest_png


def render_card(meta: dict, token: str) -> Path:
    w, h = 1200, 630
    rgba = scene(meta, w, h, True)
    if str(meta.get("kind") or "") == "passport":
        out = type_passport(rgba, meta, "card").convert("RGB")
    else:
        owner = str(meta.get("owner") or "kiln")
        name = str(meta.get("name") or "repo")
        height = int(meta.get("height") or 0)
        display = str(meta.get("displayName") or owner)
        lab = str(meta.get("lab") or "")
        mile = str(meta.get("milestone") or "")[:48]
        paste_x(rgba, 92, 92, 40)
        tlayer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        t = ImageDraw.Draw(tlayer)
        t.text((128, 92), "KILN  ×  X", font=font(26, True), fill=(250, 250, 250, 255), anchor="lm")
        letter_mark(t, 80, 240, 32, (display[:1] or "K").upper(), (250, 250, 250, 255), (94, 234, 212, 200))
        t.text((128, 220), display, font=font(26, True), fill=(250, 250, 250, 255), anchor="lt")
        t.text((128, 256), f"@{owner}" + (f" · {lab}" if lab else ""), font=font(16), fill=(94, 234, 212, 255), anchor="lt")
        t.text((64, 360), f"{owner} / {name}"[:42], font=font(38, True), fill=(250, 250, 250, 255), anchor="lt")
        if mile:
            t.text((64, 420), mile, font=font(22, True), fill=(94, 234, 212, 255), anchor="lt")
        t.text((64, 520), f"Minted on Kiln L1  ·  height {height}  ·  #{token}", font=font(16), fill=(212, 212, 216, 255), anchor="lt")
        out = Image.alpha_composite(rgba, tlayer).convert("RGB")
    dest = OUT / f"{token}-card.jpg"
    out.save(dest, "JPEG", quality=90, optimize=True)
    return dest


if __name__ == "__main__":
    import sys

    meta = json.loads(sys.argv[1] if len(sys.argv) > 1 else "{}")
    jpg = render_wide(meta)
    png = render_square(meta)
    card = render_card(meta, str(meta.get("token") or "")[:12])
    print(json.dumps({"ok": True, "png": str(png), "jpg": str(jpg), "card": str(card)}))
