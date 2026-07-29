#!/usr/bin/env python3
"""Generate the PWA icon set (PWA-1).

Run from the frontend/ directory:

    python3 scripts/generate-icons.py

Writes into public/icons/. Re-running is safe and byte-for-byte reproducible.

Why a script instead of committed art: this machine has no ImageMagick, no
Pillow and no cairosvg, and app icons are the one asset you cannot hand-edit
later without redoing the export. Keeping the generator means the icons stay
in sync with the brand tokens in src/index.css — change PRIMARY/PRIMARY_HOVER
below when those change, re-run, done.

The mark is the same one the app already draws in CSS as `.logo-box`: a white
"L" on a 135-degree indigo gradient, rounded square.

Standard library only — PNGs are written by hand (zlib + a CRC32 per chunk).
"""

import os
import struct
import zlib

# --- brand tokens, mirroring :root in src/index.css --------------------------
PRIMARY = (0x63, 0x66, 0xF1)        # --primary-color, indigo
PRIMARY_HOVER = (0x4F, 0x46, 0xE5)  # --primary-hover
WHITE = (0xFF, 0xFF, 0xFF)

# Antialiasing: render this many times oversized, then box-downsample. 4x is
# well past the point where the edges stop looking stair-stepped.
SS = 4

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'icons')


def rounded_rect_coverage(x, y, left, top, right, bottom, radius):
    """True when (x, y) is inside a rounded rectangle. Corners are quarter-circles."""
    if x < left or x >= right or y < top or y >= bottom:
        return False
    if radius <= 0:
        return True

    # Only the four corner boxes need the distance check.
    cx = None
    if x < left + radius:
        cx = left + radius
    elif x >= right - radius:
        cx = right - radius - 1
    cy = None
    if y < top + radius:
        cy = top + radius
    elif y >= bottom - radius:
        cy = bottom - radius - 1

    if cx is None or cy is None:
        return True
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= radius * radius


def render(size, full_bleed, glyph_scale=1.0):
    """Render one icon at `size` px, returning straight-alpha RGBA bytes.

    full_bleed: fill the whole square (iOS and Android maskable both apply
                their own mask and render transparency as black).
    glyph_scale: shrink the "L" so it survives an aggressive platform mask.
                 Android's maskable safe zone is the middle 80%.
    """
    s = size * SS
    span = 2 * (s - 1)  # a 135-degree gradient runs corner to corner

    # Rounded-square radius. 22.5% is close to the iOS squircle without needing
    # the actual superellipse.
    radius = 0 if full_bleed else int(s * 0.225)

    # Glyph geometry, all relative to the canvas so every size matches.
    gh = s * 0.46 * glyph_scale          # cap height
    gw = s * 0.30 * glyph_scale          # overall width
    th = s * 0.115 * glyph_scale         # stroke thickness
    # An "L" carries its mass low and left, so nudge it right and up a little
    # to look centred rather than measure centred.
    x0 = (s - gw) / 2 + s * 0.012
    y0 = (s - gh) / 2 - s * 0.010
    stroke_r = th * 0.16                 # softened stroke ends

    # Accumulators for the downsample, in premultiplied space.
    n = size * size
    acc_r = [0] * n
    acc_g = [0] * n
    acc_b = [0] * n
    acc_a = [0] * n

    for sy in range(s):
        oy = (sy // SS) * size
        for sx in range(s):
            inside_bg = full_bleed or rounded_rect_coverage(sx, sy, 0, 0, s, s, radius)
            if not inside_bg:
                continue

            # The "L": a vertical stem plus a horizontal foot.
            in_stem = rounded_rect_coverage(sx, sy, x0, y0, x0 + th, y0 + gh, stroke_r)
            in_foot = rounded_rect_coverage(sx, sy, x0, y0 + gh - th, x0 + gw, y0 + gh, stroke_r)

            if in_stem or in_foot:
                r, g, b = WHITE
            else:
                t = (sx + sy) / span  # 0 at top-left, 1 at bottom-right
                r = int(PRIMARY[0] + (PRIMARY_HOVER[0] - PRIMARY[0]) * t)
                g = int(PRIMARY[1] + (PRIMARY_HOVER[1] - PRIMARY[1]) * t)
                b = int(PRIMARY[2] + (PRIMARY_HOVER[2] - PRIMARY[2]) * t)

            i = oy + (sx // SS)
            acc_r[i] += r
            acc_g[i] += g
            acc_b[i] += b
            acc_a[i] += 255

    # Downsample. Averaging premultiplied colour and dividing back out keeps
    # edge pixels the right hue; averaging straight RGBA would darken them
    # toward the transparent black of the background.
    samples = SS * SS
    rows = []
    for y in range(size):
        row = bytearray()
        row.append(0)  # PNG filter type 0 (None)
        base = y * size
        for x in range(size):
            i = base + x
            a_sum = acc_a[i]
            if a_sum == 0:
                row += b'\x00\x00\x00\x00'
                continue
            row.append(min(255, round(acc_r[i] * 255 / a_sum)))
            row.append(min(255, round(acc_g[i] * 255 / a_sum)))
            row.append(min(255, round(acc_b[i] * 255 / a_sum)))
            row.append(min(255, round(a_sum / samples)))
        rows.append(bytes(row))
    return b''.join(rows)


def write_png(path, size, raw):
    """Write 8-bit RGBA PNG. Hand-rolled so this needs no image library."""
    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')

    with open(path, 'wb') as fh:
        fh.write(png)
    print(f'  {os.path.basename(path):<28} {size}x{size}  {len(png):>7,} bytes')


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print('Generating PWA icons into public/icons/')

    targets = [
        # (filename, size, full_bleed, glyph_scale)
        ('icon-192.png', 192, False, 1.0),
        ('icon-512.png', 512, False, 1.0),
        # Maskable: Android may crop to a circle inscribed in the middle 80%,
        # so the mark shrinks and the background runs edge to edge.
        ('icon-maskable-512.png', 512, True, 0.72),
        # iOS ignores the manifest and applies its own rounded mask to this one.
        # It must be opaque or the corners come out black.
        ('apple-touch-icon.png', 180, True, 1.0),
    ]

    for name, size, full_bleed, glyph_scale in targets:
        raw = render(size, full_bleed, glyph_scale)
        write_png(os.path.join(OUT_DIR, name), size, raw)

    print('Done.')


if __name__ == '__main__':
    main()
