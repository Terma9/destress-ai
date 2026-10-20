"""Prepares the screenshots from scripts/screenshots.mjs for the README.

    python scripts/optimize-screenshots.py

- Scales each screen to 780 px wide (2x the phone width: sharp on GitHub).
- Builds docs/screenshots/hero.jpg: four key screens side by side.
- Saves everything as JPEG (soft gradients make PNGs ~5x larger).
"""
import glob
import os

from PIL import Image, ImageDraw, ImageFilter

DIR = 'docs/screenshots'
HERO = ['02-today', '03-checkin', '04-weekly-insights', '07-untangle']
IVORY = (251, 250, 247)


def rounded(im: Image.Image, radius: int) -> Image.Image:
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius, fill=255)
    out = Image.new('RGBA', im.size)
    out.paste(im, (0, 0), mask)
    return out


# 1. Each screen: 780 px wide, JPEG.
for f in glob.glob(f'{DIR}/[0-9]*.png'):
    im = Image.open(f).convert('RGB')
    im = im.resize((780, round(im.height * 780 / im.width)), Image.LANCZOS)
    im.save(f[:-4] + '.jpg', quality=85, optimize=True, progressive=True)
    os.remove(f)

# 2. The header image, with a soft shadow under each phone screen.
w, h, gap, pad, r = 390, 844, 36, 48, 44
screens = [rounded(Image.open(f'{DIR}/{n}.jpg').convert('RGB').resize((w, h), Image.LANCZOS), r) for n in HERO]
hero = Image.new('RGB', (pad * 2 + w * len(HERO) + gap * (len(HERO) - 1), pad * 2 + h), IVORY)
shadow = Image.new('RGBA', hero.size, (0, 0, 0, 0))
for i in range(len(HERO)):
    x = pad + i * (w + gap)
    ImageDraw.Draw(shadow).rounded_rectangle((x + 2, pad + 10, x + w + 2, pad + h + 10), r, fill=(28, 27, 25, 28))
shadow = shadow.filter(ImageFilter.GaussianBlur(14))
hero.paste(shadow, (0, 0), shadow)
for i, s in enumerate(screens):
    hero.paste(s, (pad + i * (w + gap), pad), s)
hero.save(f'{DIR}/hero.jpg', quality=85, optimize=True, progressive=True)

print('done:', len(glob.glob(f'{DIR}/*.jpg')), 'images')
