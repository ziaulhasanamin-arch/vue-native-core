import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const apk = process.argv[2];
if (!apk) throw new Error('Usage: node scripts/android-device-check.mjs <apk>');
const pkg = 'com.takagelokoi.finance';
const out = path.resolve('android-device-results');
mkdirSync(out, { recursive: true });
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 60000 }).trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { package: pkg, startedAt: new Date().toISOString(), steps: [], pass: false };
const step = (name, detail) => { report.steps.push({ name, detail, at: new Date().toISOString() }); console.log(`[device] ${name}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };

async function cdpEvaluate(expression) {
  const list = await (await fetch('http://127.0.0.1:9222/json/list', { signal: AbortSignal.timeout(5000) })).json();
  const page = list.find(target => target.type === 'page' && target.webSocketDebuggerUrl);
  if (!page) throw new Error('No inspectable WebView page found');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  try {
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP evaluation timed out')), 10000);
      ws.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (message.id !== 1) return;
        clearTimeout(timer);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      });
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'WebView evaluation failed');
    return result.result.value;
  } finally { ws.close(); }
}

try {
  step('device', adb('shell', 'getprop', 'ro.build.version.release') + ' / API ' + adb('shell', 'getprop', 'ro.build.version.sdk'));
  adb('install', '-r', '-g', apk);
  step('install', 'APK installed successfully');
  adb('shell', 'pm', 'clear', pkg);
  adb('logcat', '-c');
  step('launch', adb('shell', 'am', 'start', '-W', '-n', `${pkg}/.MainActivity`));

  let socket = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    const unix = adb('shell', 'cat', '/proc/net/unix');
    socket = unix.match(/@?(webview_devtools_remote_\d+)/)?.[1] ?? '';
    if (socket) break;
    await sleep(1000);
  }
  if (!socket) throw new Error('WebView debugging socket never appeared; the native activity may have crashed before creating a WebView');
  step('webview-socket', socket);
  adb('forward', 'tcp:9222', `localabstract:${socket}`);

  const expression = `(() => {
    const text = document.body ? document.body.innerText : '';
    return JSON.stringify({
      url: location.href,
      title: document.title,
      heading: document.querySelector('h1') ? document.querySelector('h1').textContent : '',
      loading: !!document.querySelector('.loading-state'),
      onboarding: !!document.querySelector('.onboarding'),
      shell: !!document.querySelector('.app-shell'),
      body: text.slice(0, 4000),
      viewport: { width: innerWidth, height: innerHeight },
      userAgent: navigator.userAgent
    });
  })()`;
  let state = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(1500);
    try { state = JSON.parse(await cdpEvaluate(expression)); } catch (error) { step('cdp-wait', error.message); continue; }
    if (!state.loading && (state.onboarding || state.shell)) break;
  }
  report.webview = state;
  writeFileSync(path.join(out, 'screenshot.png'), execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 16 * 1024 * 1024 }));
  const logcat = execFileSync('adb', ['logcat', '-d', '-v', 'threadtime'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(path.join(out, 'logcat.txt'), logcat);
  const relevant = logcat.split('\n').filter(line => /Capacitor|chromium|AndroidRuntime|SQLite|takagelokoi/i.test(line));
  writeFileSync(path.join(out, 'relevant-logcat.txt'), relevant.join('\n'));
  report.processAlive = !!adb('shell', 'pidof', pkg).trim();
  report.pass = !!state && !state.loading && (state.onboarding || state.shell) && report.processAlive;
  step('result', report.pass ? 'App reached a usable screen on the Android emulator' : 'App did not reach a usable screen');
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  step('error', report.error);
  try { writeFileSync(path.join(out, 'screenshot.png'), execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 16 * 1024 * 1024 })); } catch {}
  try { writeFileSync(path.join(out, 'logcat.txt'), execFileSync('adb', ['logcat', '-d', '-v', 'threadtime'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })); } catch {}
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
if (!report.pass) process.exitCode = 1;
