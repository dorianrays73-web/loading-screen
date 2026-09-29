"""
Détoure un personnage sur fond noir uni et l'enregistre en PNG transparent recadré.

    python detourer.py source.jpg sortie.png            # contours nets (personnage classique)
    python detourer.py source.jpg sortie.png --glow     # effets lumineux sur noir (fils, flammes, aura)
    python detourer.py source.jpg sortie.png --fade 0.2 # estompe le bas (image coupée à la taille)
    python detourer.py source.jpg sortie.png --holes 300 # retire le noir enfermé (cheveux, rubans)

Seul le noir relié aux bords de l'image est retiré : les vêtements noirs du personnage sont conservés.
"""
import argparse

import numpy as np
from PIL import Image
from scipy import ndimage as nd


def cutout(src, dst, thresh=8, glow=False, fade=0.0, holes=0):
    rgb = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    mx = rgb.max(axis=2)

    lab, n = nd.label(mx <= thresh)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    # Poches de fond enfermées (entre les mèches, dans un ruban...) : retirées au-delà d'une taille minimale
    min_hole = 60 if glow else holes
    if min_hole > 0:
        sizes = nd.sum(np.ones_like(mx), lab, index=np.arange(1, n + 1))
        big = np.nonzero(sizes > min_hole)[0] + 1
        bg |= np.isin(lab, big)

    alpha = np.ones(mx.shape, np.float32)
    alpha[bg] = 0.0

    band = nd.binary_dilation(bg, iterations=4 if glow else 2) & ~bg
    if glow:
        alpha[band] = np.clip(mx[band] / 90.0, 0.0, 1.0)
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        reddish = (r > 1.5 * g) & (r > 1.5 * b) & ~bg
        alpha[reddish] = np.minimum(alpha[reddish], np.clip(mx[reddish] / 150.0, 0.0, 1.0))
    else:
        alpha[band] = np.clip((mx[band] - 2.0) / 12.0, 0.0, 1.0)

    soft = nd.gaussian_filter(alpha, 0.6)
    alpha = np.where(bg | band, np.minimum(soft, alpha + 0.15), alpha)
    alpha = np.clip(alpha, 0.0, 1.0)

    # Retire le noir mélangé aux pixels semi-transparents pour éviter un liseré sombre
    safe = np.maximum(alpha, 1e-3)[..., None]
    semi = (alpha < 1.0)[..., None]
    rgb = np.where(semi, np.clip(rgb / safe, 0, 255), rgb)

    h = alpha.shape[0]
    if fade > 0:
        f = int(h * fade)
        ramp = np.linspace(1.0, 0.0, f, dtype=np.float32)
        alpha[h - f:] *= ramp[:, None]

    out = np.dstack([rgb, alpha * 255.0]).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")
    box = im.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
    if box:
        im = im.crop(box)
    im.save(dst, optimize=True)
    print(dst, im.size)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--glow", action="store_true")
    p.add_argument("--fade", type=float, default=0.0)
    p.add_argument("--thresh", type=int, default=8)
    p.add_argument("--holes", type=int, default=0, help="retire les poches noires enfermées plus grandes que N pixels")
    a = p.parse_args()
    cutout(a.src, a.dst, a.thresh, a.glow, a.fade, a.holes)
