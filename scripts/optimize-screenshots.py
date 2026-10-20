"""Prepares the screenshots from scripts/screenshots.mjs for the README.

    python scripts/optimize-screenshots.py

- Scales each raw screen (PNG) to 780 px wide and saves it as JPEG
  (docs/screenshots/NN-name.jpg; soft gradients make PNGs ~5x larger).
- Puts every screen into a phone frame (bezel, Dynamic Island, status bar,
  home indicator) as a PNG with a transparent background, so it looks right
  in GitHub's light and dark mode: docs/screenshots/phone/NN-name.png.
"""
import glob
import os

from PIL import Image, ImageDraw, ImageFont

DIR = 'docs/screenshots'
PHONE_DIR = f'{DIR}/phone'
FONT = glob.glob('node_modules/@expo-google-fonts/dm-sans/600SemiBold/*.ttf')[0]

# Phone geometry at 2x (the screens are 390 pt wide → 780 px).
STATUS = 108       # status bar above the app (54 pt)
HOME = 44          # strip below the app with the home indicator (22 pt)
BEZEL = 26         # dark frame around the screen
RADIUS = 110       # outer corner radius; the screen gets RADIUS - BEZEL
OUT_WIDTH = 540    # final width: shown at ~260 px on GitHub, sharp on retina
FRAME = (28, 27, 25, 255)
BUTTON = (58, 57, 53, 255)
RIM = (78, 76, 71, 255)


def to_jpeg(png_path: str) -> str:
    im = Image.open(png_path).convert('RGB')
    im = im.resize((780, round(im.height * 780 / im.width)), Image.LANCZOS)
    jpg = png_path[:-4] + '.jpg'
    im.save(jpg, quality=85, optimize=True, progressive=True)
    os.remove(png_path)
    return jpg


def in_phone(screen: Image.Image) -> Image.Image:
    w, h = screen.size
    # The app has no status bar on the web: add one in the colour of the app's top edge,
    # and a strip at the bottom in the colour of its bottom edge.
    top = screen.getpixel((w // 2, 2))
    bottom = screen.getpixel((w // 2, h - 3))
    full = Image.new('RGB', (w, STATUS + h + HOME), top)
    full.paste(Image.new('RGB', (w, HOME), bottom), (0, STATUS + h))
    full.paste(screen, (0, STATUS))

    d = ImageDraw.Draw(full)
    ink = (28, 27, 25)
    d.text((70, STATUS // 2 + 6), '9:41', font=ImageFont.truetype(FONT, 32), fill=ink, anchor='lm')
    # Dynamic Island
    d.rounded_rectangle((w // 2 - 124, 22, w // 2 + 124, 92), 35, fill=(0, 0, 0))
    # Signal, wifi, battery (simple shapes)
    x, y = w - 196, STATUS // 2 + 6
    for i, bar_h in enumerate((10, 15, 20, 25)):
        d.rounded_rectangle((x + i * 9, y + 12 - bar_h, x + i * 9 + 6, y + 12), 2, fill=ink)
    d.pieslice((x + 46, y - 14, x + 82, y + 22), 225, 315, fill=ink)
    d.rounded_rectangle((x + 94, y - 11, x + 140, y + 11), 7, outline=ink, width=3)
    d.rounded_rectangle((x + 99, y - 6, x + 135, y + 6), 3, fill=ink)
    d.rounded_rectangle((x + 143, y - 4, x + 147, y + 4), 2, fill=ink)
    # Home indicator
    d.rounded_rectangle((w // 2 - 134, full.height - 26, w // 2 + 134, full.height - 16), 5, fill=ink)

    # Screen with rounded corners inside the dark frame, plus side buttons.
    fw, fh = full.width + 2 * BEZEL, full.height + 2 * BEZEL
    phone = Image.new('RGBA', (fw + 12, fh), (0, 0, 0, 0))
    pd = ImageDraw.Draw(phone)
    pd.rounded_rectangle((0, 300, 10, 360), 4, fill=BUTTON)         # action button
    pd.rounded_rectangle((0, 420, 10, 530), 4, fill=BUTTON)         # volume up
    pd.rounded_rectangle((0, 550, 10, 660), 4, fill=BUTTON)         # volume down
    pd.rounded_rectangle((fw + 2, 470, fw + 12, 640), 4, fill=BUTTON)  # side button
    # A slightly lighter rim, like the metal edge, so the phone stays visible on dark backgrounds.
    pd.rounded_rectangle((6, 0, 6 + fw - 1, fh - 1), RADIUS, fill=FRAME, outline=RIM, width=5)
    mask = Image.new('L', full.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, full.width - 1, full.height - 1), RADIUS - BEZEL, fill=255)
    phone.paste(full, (6 + BEZEL, BEZEL), mask)
    return phone.resize((OUT_WIDTH, round(phone.height * OUT_WIDTH / phone.width)), Image.LANCZOS)


# 1. New raw screens → 780 px JPEG.
for png in glob.glob(f'{DIR}/[0-9]*.png'):
    to_jpeg(png)

# 2. Every screen in a phone frame.
os.makedirs(PHONE_DIR, exist_ok=True)
for jpg in sorted(glob.glob(f'{DIR}/[0-9]*.jpg')):
    name = os.path.basename(jpg)[:-4]
    in_phone(Image.open(jpg).convert('RGB')).save(f'{PHONE_DIR}/{name}.png', optimize=True)

print('done:', len(glob.glob(f'{PHONE_DIR}/*.png')), 'phone images')
