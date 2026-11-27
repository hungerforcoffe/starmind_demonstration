"""Compone el video 1080×1080 a partir de los cuadros capturados del simulador.
Uso: python compose.py es|en  → video_es.mp4 / video_en.mp4"""
import json, os, subprocess, sys, shutil
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

LANG = sys.argv[1] if len(sys.argv) > 1 else 'es'
SRC = f'frames_{LANG}'
OUT = f'out_{LANG}'
S = 1080
FPS = 30
BG = (5, 9, 13); TXT = (237, 243, 245); MUT = (139, 155, 164); CYAN = (130, 215, 232); ORANGE = (232, 101, 47); LINE = (49, 67, 78)

def font(size, w=500, mono=False):
    if mono:
        return ImageFont.truetype('fonts/PlexMono.ttf', size)
    f = ImageFont.truetype('fonts/DMSans.ttf', size)
    f.set_variation_by_axes([min(40, max(9, size * 0.5)), w])
    return f

def num(x):
    s = f'{int(round(x)):,}'
    return s.replace(',', '.') if LANG == 'es' else s

T = {
 'es': dict(
   brand='Impacto orbital', brand2='Starmind 1M sobre Vera C. Rubin',
   s1a='La FCC autorizó Starmind', s1b='1.000.000 de satélites', s1c='25 de noviembre de 2026 · entre 500 y 1.002 km de altura',
   s2t='El cielo de Rubin durante una noche', s2sub='Cerro Pachón, Chile · noche del 26 al 27 de noviembre de 2026',
   lit='satélites iluminados sobre 30°', sun='Sol', chile='hora de Chile',
   c_dusk='Atardecer: el cielo todavía está claro', c_lit='Ya es de noche en Rubin, pero a 500–1.000 km los satélites siguen al sol',
   c_dark='La sombra de la Tierra los oculta: el cielo queda limpio',
   s3t='Una foto de 30 segundos de LSSTCam a las 22:04', s3a='{n} trazas en este campo (55° de altura, hacia el noroeste)',
   s3b='Promedio al anochecer: ~28 por imagen', s3c='Se pierde entre el {a} y el {b} de la imagen, según qué tan brillantes sean',
   s4pre='Escenario con el despliegue completo (2040)', s4m='Plazos de la FCC: 10 % en 2035, 50 % en 2038 y el millón completo en 2040',
   s4a='7 de cada 10 imágenes al anochecer', s4b='tendrían trazas de satélites',
   s4c='La FCC solo aprobó el plan de desechos de las capas bajo 600 km', s4d='No impuso condiciones para la astronomía óptica',
   s4e='Simulación con supuestos declarados · código abierto', url='hungerforcoffe.github.io/starmind_demonstration'),
 'en': dict(
   brand='Orbital impact', brand2='Starmind 1M over Vera C. Rubin',
   s1a='The FCC authorized Starmind', s1b='1,000,000 satellites', s1c='25 November 2026 · between 500 and 1,002 km altitude',
   s2t="Rubin's sky through one night", s2sub='Cerro Pachón, Chile · night of 26 to 27 November 2026',
   lit='sunlit satellites above 30°', sun='Sun', chile='Chile time',
   c_dusk='Dusk: the sky is still bright', c_lit="It's night at Rubin, but at 500–1,000 km the satellites are still in sunlight",
   c_dark="The Earth's shadow hides them: the sky is clean",
   s3t='A 30-second LSSTCam photo at 22:04', s3a='{n} streaks in this field (55° altitude, toward the northwest)',
   s3b='Average at dusk: ~28 per image', s3c='{a} to {b} of the image is lost, depending on how bright they are',
   s4pre='Full deployment scenario (2040)', s4m='FCC deadlines: 10 % by 2035, 50 % by 2038 and the full million by 2040',
   s4a='7 out of 10 images at dusk', s4b='would show satellite streaks',
   s4c='The FCC approved the debris plan only for the shells below 600 km', s4d='It set no conditions for optical astronomy',
   s4e='Simulation with declared assumptions · open source', url='hungerforcoffe.github.io/starmind_demonstration/en'),
}[LANG]

meta = json.load(open(f'{SRC}/meta.json', encoding='utf8'))

def brand(d):
    x, y = 56, 52
    d.ellipse([x, y, x + 34, y + 34], outline=(108, 126, 135), width=2)
    d.ellipse([x + 7, y + 7, x + 27, y + 27], outline=(70, 110, 120), width=1)
    for off, a in ((0, 255), (-7, 140), (7, 140)):
        d.line([x + 2, y + 25 + off, x + 32, y + 10 + off], fill=ORANGE + (a,), width=2)
    d.text((x + 48, y - 2), T['brand'], font=font(24, 600), fill=TXT)
    d.text((x + 48, y + 27), T['brand2'], font=font(17, 400), fill=MUT)

def wrap(d, text, f, maxw):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=f) > maxw and cur:
            lines.append(cur); cur = w
        else:
            cur = t
    return lines + ([cur] if cur else [])

def fit(d, text, w, maxw, start):
    size = start
    while size > 20 and d.textlength(text, font=font(size, w)) > maxw: size -= 2
    return font(size, w)

def ease(f):
    f = max(0.0, min(1.0, f)); return f * f * (3 - 2 * f)

def alpha_text(base, xy, text, f, color, a):
    if a <= 0: return
    layer = Image.new('RGBA', base.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text(xy, text, font=f, fill=color + (int(255 * a),))
    base.alpha_composite(layer)

def scene1(i, n):
    img = Image.new('RGBA', (S, S), BG + (255,))
    g = Image.open(f'{SRC}/s1_{i:04d}.png').convert('RGBA')
    w, h = g.size; side = min(w, h)
    g = g.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2)).resize((900, 900), Image.LANCZOS)
    img.alpha_composite(g, (90, 290))  # el globo bajo el título, para que el texto quede sobre el espacio oscuro
    d = ImageDraw.Draw(img); brand(d)
    t = i / FPS
    alpha_text(img, (56, 150), T['s1a'], font(40, 500), MUT, ease((t - 0.3) / 0.6))
    alpha_text(img, (56, 196), T['s1b'], font(78, 600), TXT, ease((t - 0.7) / 0.6))
    alpha_text(img, (56, 296), T['s1c'], font(24, 400), CYAN, ease((t - 1.3) / 0.6))
    return img

def scene2(i, n):
    img = Image.new('RGBA', (S, S), BG + (255,))
    d = ImageDraw.Draw(img); brand(d)
    d.text((56, 128), T['s2t'], font=font(44, 600), fill=TXT)
    d.text((56, 186), T['s2sub'], font=font(21, 400), fill=MUT)
    sky = Image.open(f'{SRC}/s2_{i:04d}.png').convert('RGBA')
    ov = Image.open(f'{SRC}/s2o_{i:04d}.png').convert('RGBA').resize(sky.size)
    sky.alpha_composite(ov)
    sky = sky.resize((740, 740), Image.LANCZOS)
    img.alpha_composite(sky, (56, 252))
    m = meta['s2'][i]
    hhmm = (datetime.fromtimestamp(m['t'] / 1000, tz=timezone.utc) - timedelta(hours=3)).strftime('%H:%M')
    x = 822
    d.text((x, 262), hhmm, font=font(64, mono=True), fill=TXT)
    d.text((x, 344), T['chile'], font=font(18, 400), fill=MUT)
    d.text((x, 372), f"{T['sun']} {m['sun']:+.0f}°".replace('-', '−'), font=font(22, 500), fill=(255, 211, 77))
    d.text((x, 452), num(m['lit']), font=font(56, mono=True), fill=ORANGE if m['lit'] > 0 else TXT)
    for k, line in enumerate(wrap(d, T['lit'], font(18, 400), 210)):
        d.text((x, 526 + 24 * k), line, font=font(18, 400), fill=MUT)
    cap = T['c_dusk'] if m['sun'] > -12 else (T['c_lit'] if m['lit'] > 150 else T['c_dark'])
    for k, line in enumerate(wrap(d, cap, font(27, 500), 968)):
        d.text((56, 1010 - 34 * (len(wrap(d, cap, font(27, 500), 968)) - 1) + 34 * k - 4), line, font=font(27, 500), fill=TXT)
    return img

def scene3(i, n):
    img = Image.new('RGBA', (S, S), BG + (255,))
    d = ImageDraw.Draw(img); brand(d)
    d.text((56, 128), T['s3t'], font=font(42, 600), fill=TXT)
    ccd = Image.open(f'{SRC}/s3_ccd.png').convert('RGBA')
    z = 1 + 0.06 * ease(i / (n - 1))
    side = int(ccd.size[0] / z); o = (ccd.size[0] - side) // 2
    ccd = ccd.crop((o, o, o + side, o + side)).resize((700, 700), Image.LANCZOS)
    img.alpha_composite(ccd, (56, 200))
    s3 = meta['s3']; a, b = [x.strip() for x in s3['loss'].replace('%', '').split('–')]
    x, maxw = 790, 236
    y = 210
    d.text((x, y), s3['n'], font=font(84, mono=True), fill=ORANGE)
    y += 104
    for line in wrap(d, T['s3a'].format(n=s3['n']).split(' ', 1)[1], font(20, 500), maxw):
        d.text((x, y), line, font=font(20, 500), fill=TXT); y += 27
    y += 26
    for line in wrap(d, T['s3b'], font(20, 400), maxw):
        d.text((x, y), line, font=font(20, 400), fill=MUT); y += 27
    t = i / FPS
    loss = T['s3c'].format(a=a + ' %', b=b + ' %')
    lines = wrap(d, loss, font(27, 500), 968)
    for k, line in enumerate(lines):
        alpha_text(img, (56, 940 + 36 * k), line, font(27, 500), TXT, ease((t - 1.2) / 0.6))
    return img

def scene4(i, n):
    img = Image.new('RGBA', (S, S), BG + (255,))
    d = ImageDraw.Draw(img); brand(d)
    t = i / FPS
    fa = fit(d, max(T['s4a'], T['s4b'], key=len), 600, 968, 62)
    alpha_text(img, (56, 196), T['s4pre'], font(26, 500), (217, 135, 101), ease(t / 0.5))
    alpha_text(img, (56, 250), T['s4a'], fa, TXT, ease(t / 0.5))
    alpha_text(img, (56, 326), T['s4b'], fa, CYAN, ease((t - 0.2) / 0.5))
    ad = ease((t - 0.5) / 0.6)
    lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
    for k in range(10):
        x0 = 56 + k * 62
        if k < 7: ld.rounded_rectangle([x0, 430, x0 + 50, 466], 5, fill=ORANGE + (int(255 * ad),))
        else: ld.rounded_rectangle([x0, 430, x0 + 50, 466], 5, outline=LINE + (int(255 * ad),), width=2)
    img.alpha_composite(lay)
    y = 540
    for k, s in enumerate((T['s4m'], T['s4c'], T['s4d'])):
        a = ease((t - 1.2 - 0.4 * k) / 0.6)
        for j, line in enumerate(wrap(d, s, font(28, 500), 900)):
            if j == 0:  # una sola barra por viñeta
                lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); ld = ImageDraw.Draw(lay)
                ld.rectangle([56, y + 6, 60, y + 34], fill=ORANGE + (int(255 * a),))
                img.alpha_composite(lay)
            alpha_text(img, (76, y), line, font(28, 500), TXT, a); y += 40
        y += 22
    a = ease((t - 2.6) / 0.6)
    alpha_text(img, (56, 900), T['url'], font(30, 500), CYAN, a)
    alpha_text(img, (56, 950), T['s4e'], font(20, 400), MUT, a)
    return img

scenes = [(scene1, 210), (scene2, 300), (scene3, 180), (scene4, 195)]  # el cierre dura 1 s más por la viñeta de plazos
XF = 12  # cuadros de fundido entre escenas
shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
k = 0; prev_tail = None
for si, (fn, n) in enumerate(scenes):
    for i in range(n):
        fr = fn(i, n)
        if si > 0 and i < XF and prev_tail is not None:
            fr = Image.blend(prev_tail, fr, (i + 1) / (XF + 1))
        if si < len(scenes) - 1 and i == n - 1:
            prev_tail = fr
        if si < len(scenes) - 1 and i >= n - XF:
            continue  # el final de la escena se funde con el comienzo de la siguiente
        fr.convert('RGB').save(f'{OUT}/{k:05d}.png'); k += 1
ff = imageio_ffmpeg.get_ffmpeg_exe()
mp4 = f'video_{LANG}.mp4'
subprocess.run([ff, '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', f'{OUT}/%05d.png', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
                '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], check=True)
print(mp4, k, 'cuadros', f'{k / FPS:.1f} s', f'{os.path.getsize(mp4) / 1e6:.1f} MB')
