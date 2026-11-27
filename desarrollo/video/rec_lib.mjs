// Utilidades: abre Edge headless (GPU real, DPR 2) con la página en modo grabación.
import { spawn } from 'node:child_process';
export async function open(url, { dpr = 2, w = 1500, h = 1000 } = {}) {
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const port = 9333 + Math.floor(Math.random() * 500);
  const p = spawn(edge, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', `--user-data-dir=${process.cwd()}/edgeprof_v`, '--use-angle=d3d11', `--force-device-scale-factor=${dpr}`, `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let tgt; for (let i = 0; i < 50 && !tgt; i++) { await sleep(300); try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); tgt = l.find(t => t.type === 'page'); } catch {} }
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result.result.value; };
  await send('Page.enable'); await send('Page.navigate', { url });
  for (let i = 0; i < 60; i++) { await sleep(1000); if (await ev('window.__ready === true && !!window.__rec')) break; }
  await sleep(5000); // texturas de la Tierra
  return { ev, sleep, close: () => { ws.close(); p.kill(); } };
}
