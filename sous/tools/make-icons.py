#!/usr/bin/env python3
"""Regenerate the PWA icons. No image libraries: a signed-distance rasteriser
with 4x supersampling, then a hand-rolled PNG encoder.

    python3 tools/make-icons.py web/icons
"""
import zlib, struct, math, sys

def png(path, w, h, px):
    raw = b''.join(b'\x00' + bytes(px[y*w*4:(y+1)*w*4]) for y in range(h))
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    out = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    open(path, 'wb').write(out)

def sd_round_rect(x, y, cx, cy, hw, hh, r):
    dx, dy = abs(x - cx) - (hw - r), abs(y - cy) - (hh - r)
    return math.hypot(max(dx, 0), max(dy, 0)) + min(max(dx, dy), 0) - r

def sd_circle(x, y, cx, cy, r):
    return math.hypot(x - cx, y - cy) - r

def sd_segment(x, y, ax, ay, bx, by, r):
    px, py = x - ax, y - ay
    bax, bay = bx - ax, by - ay
    denom = bax * bax + bay * bay
    h = 0.0 if denom == 0 else max(0.0, min(1.0, (px * bax + py * bay) / denom))
    return math.hypot(px - bax * h, py - bay * h) - r

BG   = (194, 65, 12)     # paprika
INK  = (255, 255, 255)
CREAM= (251, 247, 242)

def render(size, maskable=False, ss=4):
    W = size * ss
    inset = W * 0.14 if maskable else 0.0     # maskable art must sit in the safe zone
    S = W - 2 * inset
    cx = cy = W / 2
    corner = S * 0.235

    ring_r = S * 0.30
    ring_t = S * 0.062
    hand_len = ring_r * 0.66

    # timer hand at 1 o'clock-ish
    ang = math.radians(-52)
    hx, hy = cx + math.cos(ang) * hand_len, cy + math.sin(ang) * hand_len

    knob_hw, knob_hh = S * 0.075, S * 0.055
    knob_cy = cy - ring_r - ring_t * 0.5 - knob_hh * 0.72

    buf = bytearray(size * size * 4)
    for py in range(size):
        for px_ in range(size):
            r = g = b = a = 0.0
            for oy in range(ss):
                for ox in range(ss):
                    x = px_ * ss + ox + 0.5
                    y = py * ss + oy + 0.5

                    # background plate
                    d_bg = sd_round_rect(x, y, cx, cy, S / 2, S / 2, corner)
                    if d_bg > 0.75:
                        continue
                    cov_bg = min(1.0, max(0.0, 0.5 - d_bg))
                    cr, cg, cb = BG

                    # knob on top of the timer
                    d_knob = sd_round_rect(x, y, cx, knob_cy, knob_hw, knob_hh, knob_hh * 0.55)
                    # ring (annulus)
                    d_ring = abs(sd_circle(x, y, cx, cy, ring_r)) - ring_t / 2
                    # hand + hub
                    d_hand = min(sd_segment(x, y, cx, cy, hx, hy, ring_t * 0.46),
                                 sd_circle(x, y, cx, cy, ring_t * 0.62))
                    d_ink = min(d_ring, d_hand, d_knob)
                    cov_ink = min(1.0, max(0.0, 0.5 - d_ink))
                    if cov_ink > 0:
                        cr = cr + (INK[0] - cr) * cov_ink
                        cg = cg + (INK[1] - cg) * cov_ink
                        cb = cb + (INK[2] - cb) * cov_ink

                    r += cr * cov_bg; g += cg * cov_bg; b += cb * cov_bg; a += cov_bg
            n = ss * ss
            alpha = a / n
            i = (py * size + px_) * 4
            if alpha > 0:
                buf[i]   = min(255, round(r / a))
                buf[i+1] = min(255, round(g / a))
                buf[i+2] = min(255, round(b / a))
            buf[i+3] = min(255, round(alpha * 255))
    return buf

out = sys.argv[1]
for size, name, maskable in [(192, 'icon-192.png', False), (512, 'icon-512.png', False), (512, 'icon-maskable-512.png', True)]:
    png(f'{out}/{name}', size, size, render(size, maskable))
    print('wrote', name)
