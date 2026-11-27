// Captura cuadro a cuadro: (1) órbita alrededor de la Tierra, (2) el cielo de Cerro Pachón durante la noche, (3) una exposición.
import { open } from './rec_lib.mjs';
import fs from 'node:fs';
const [,, lang = 'es'] = process.argv;
const url = `http://localhost:8765/${lang === 'en' ? 'en/' : ''}index.html?modo=simple&rec&full`;
const out = `frames_${lang}`; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
const P = await open(url);
const save = async (id, file) => { const d = await P.ev(`window.__rec.grab('${id}')`); fs.writeFileSync(`${out}/${file}`, Buffer.from(d.split(',')[1], 'base64')); };
const meta = { s2: [] };
const T22 = Date.UTC(2026, 10, 27, 1, 0);            // 22:00 hora de Chile (UTC−3)
// 1) órbita: 7 s a 30 fps, la cámara gira 70° alrededor de la Tierra y se acerca un poco
const N1 = 210;
for (let i = 0; i < N1; i++) { const f = i / (N1 - 1), e = f * f * (3 - 2 * f);
  await P.ev(`window.__rec.frame(${T22}, [${100 + 70 * e}, ${-17 + 6 * e}, ${23.6 - 2.6 * e}])`); await save('godCv', `s1_${String(i).padStart(4, '0')}.png`); }
// 2) la noche desde Cerro Pachón: de 20:45 a 06:15 en 10 s
const N2 = 300, tA = Date.UTC(2026, 10, 26, 23, 45), tB = Date.UTC(2026, 10, 27, 9, 15);
for (let i = 0; i < N2; i++) { const t = tA + (tB - tA) * i / (N2 - 1);
  await P.ev(`window.__rec.frame(${t})`); await save('skyCv', `s2_${String(i).padStart(4, '0')}.png`); await save('skyov', `s2o_${String(i).padStart(4, '0')}.png`);
  meta.s2.push({ t, lit: await P.ev('window.__rec.lit30()'), sun: await P.ev('window.__rec.sun()') }); }
// 3) una exposición de 30 s a las 22:04, campo a 55° hacia el noroeste
const T3 = Date.UTC(2026, 10, 27, 1, 4);
await P.ev(`window.__rec.frame(${T3})`);
meta.s3 = JSON.parse(await P.ev('JSON.stringify(window.__rec.expose(55, 330))'));
await P.ev(`window.__rec.frame(${T3})`); await save('ccd', 's3_ccd.png'); await save('skyCv', 's3_sky.png'); await save('skyov', 's3_skyov.png');
fs.writeFileSync(`${out}/meta.json`, JSON.stringify(meta));
console.log('listo', lang, 'exposición:', meta.s3, 'iluminados (min/max):', Math.min(...meta.s2.map(x => x.lit)), Math.max(...meta.s2.map(x => x.lit)));
P.close(); process.exit(0);
