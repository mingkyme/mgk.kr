import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

declare global {
  interface Window {
    __sighTest: {
      calls: number; contexts: number; resumes: number; stops: number; closes: number; signal: boolean; failResume: boolean;
      mode: 'resolve' | 'reject' | 'pending'; resolve: null | (() => void);
      constraints?: MediaStreamConstraints; ended(): void; suspend(): void;
    };
  }
}
async function fakeAudio(page: Page) {
  await page.addInitScript(() => {
    let track: FakeTrack | undefined;
    let context: FakeContext | undefined;
    const state = window.__sighTest = {
      calls: 0, contexts: 0, resumes: 0, stops: 0, closes: 0, signal: false, failResume: false,
      mode: 'resolve' as 'resolve' | 'reject' | 'pending', resolve: null as null | (() => void),
      constraints: undefined as MediaStreamConstraints | undefined,
      ended() { if (track) { track.readyState = 'ended'; const event = new Event('ended'); track.dispatchEvent(event); track.onended?.(event); } },
      suspend() { if (context) { context.state = 'suspended'; const event = new Event('statechange'); context.dispatchEvent(event); context.onstatechange?.(event); } },
    };
    class FakeTrack extends EventTarget {
      kind = 'audio'; readyState = 'live'; onended: ((event: Event) => void) | null = null;
      stop() { if (this.readyState !== 'ended') { state.stops++; this.readyState = 'ended'; } }
    }
    class FakeAnalyser {
      fftSize = 2048; smoothingTimeConstant = 0; minDecibels = -100; maxDecibels = -10;
      get frequencyBinCount() { return this.fftSize / 2; }
      getFloatTimeDomainData(data: Float32Array) { data.fill(state.signal ? 0.15 : 0.0001); }
      getFloatFrequencyData(data: Float32Array) {
        data.fill(-100);
        if (state.signal) for (let i = 0; i < data.length; i++) if (i * 48000 / this.fftSize >= 80 && i * 48000 / this.fftSize <= 1000) data[i] = -20;
      }
      disconnect() {}
    }
    class FakeContext extends EventTarget {
      state = 'running'; sampleRate = 48000; destination = {};
      onstatechange: ((event: Event) => void) | null = null;
      constructor() { super(); context = this; state.contexts++; }
      resume() { state.resumes++; this.state = 'running'; return state.failResume ? Promise.reject(new Error('Synthetic resume failure')) : Promise.resolve(); }
      close() { if (this.state !== 'closed') { state.closes++; this.state = 'closed'; } return Promise.resolve(); }
      createAnalyser() { return new FakeAnalyser(); }
      createMediaStreamSource() { return { connect: (target: unknown) => { if (target === this.destination) throw new Error('Speaker feedback'); }, disconnect() {} }; }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeContext });
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async (constraints: MediaStreamConstraints) => {
      state.calls++; state.constraints = constraints;
      const stream = () => { track = new FakeTrack(); return { getTracks: () => [track], getAudioTracks: () => [track] }; };
      if (state.mode === 'reject') throw new DOMException('Synthetic permission denial', 'NotAllowedError');
      if (state.mode === 'pending') return new Promise(resolve => { state.resolve = () => resolve(stream()); });
      return stream();
    } });
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: class { constructor() { throw new Error('Audio recording is prohibited'); } } });
    localStorage.setItem('mgk-analytics-consent', 'accepted');
  });
}

for (const synthetic of ['click', 'dispatchEvent'] as const) test(`sigh trusted activation rejects synthetic ${synthetic}`, async ({ page }) => {
  await fakeAudio(page);
  await page.goto('/tools/sigh-meter.html');
  const app = page.locator('#sigh-app');
  const start = page.locator('#sigh-start');
  await expect(app).toHaveAttribute('data-state', 'idle');
  const phase = await page.locator('#sigh-phase').textContent();
  const status = await page.locator('#sigh-status').textContent();
  await start.evaluate((button: HTMLButtonElement, method) => {
    if (method === 'click') button.click();
    else button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, synthetic);
  expect(await page.evaluate(() => ({
    calls: window.__sighTest.calls, contexts: window.__sighTest.contexts, resumes: window.__sighTest.resumes,
  }))).toEqual({ calls: 0, contexts: 0, resumes: 0 });
  await expect(app).toHaveAttribute('data-state', 'idle');
  await expect(page.locator('#sigh-phase')).toHaveText(phase!);
  await expect(page.locator('#sigh-status')).toHaveText(status!);
  await expect(start).toBeEnabled();

  // Native mouse and keyboard button activation must still reach begin synchronously.
  for (const [index, activation] of ['mouse', 'Enter', 'Space'].entries()) {
    if (activation === 'mouse') await start.click();
    else { await start.focus(); await start.press(activation); }
    await expect(app).toHaveAttribute('data-state', 'calibrating');
    expect(await page.evaluate(() => ({
      calls: window.__sighTest.calls, contexts: window.__sighTest.contexts, resumes: window.__sighTest.resumes,
    }))).toEqual({ calls: index + 1, contexts: index + 1, resumes: index + 1 });
    await page.locator('#sigh-stop').click();
    await expect(app).toHaveAttribute('data-state', 'idle');
    expect(await page.evaluate(() => window.__sighTest.closes)).toBe(index + 1);
    expect(await page.evaluate(() => window.__sighTest.stops)).toBe(index + 1);
  }
});

test('sigh only asks for microphone after clicking and stops on cancellation', async ({ page }) => {
  await fakeAudio(page);
  await page.goto('/tools/sigh-meter.html');
  await expect(page.locator('#sigh-app')).toBeVisible();
  expect(await page.evaluate(() => window.__sighTest.calls)).toBe(0);
  await expect(page.locator('script[data-ga-id]')).toHaveCount(0);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).not.toHaveAttribute('content', /google-analytics|googletagmanager/);
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-app')).toHaveAttribute('data-state', 'calibrating');
  expect(await page.evaluate(() => window.__sighTest.calls)).toBe(1);
  expect(await page.evaluate(() => window.__sighTest.constraints?.video)).toBe(false);
  await page.locator('#sigh-stop').click();
  await expect(page.locator('#sigh-start')).toBeEnabled();
  expect(await page.evaluate(() => window.__sighTest.stops)).toBe(1);
  expect(await page.evaluate(() => window.__sighTest.closes)).toBe(1);
  await expect(page.locator('#sigh-results li')).toHaveCount(0);
});

async function measuredRound(page: Page, activeMs = 1600) {
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-app')).toHaveAttribute('data-state', 'calibrating');
  await page.clock.runFor(1100);
  await expect(page.locator('#sigh-app')).toHaveAttribute('data-state', 'measuring');
  await page.evaluate(() => { window.__sighTest.signal = true; });
  await page.clock.runFor(activeMs);
  await page.evaluate(() => { window.__sighTest.signal = false; });
  // The remaining input is silence: skip idle callbacks, retaining real active frames.
  await page.clock.fastForward(4500 - activeMs);
}

test('synthetic sigh rounds rank sustained sounds, escape names and never store or send them', async ({ page }) => {
  await fakeAudio(page); await page.clock.install();
  await page.goto('/tools/sigh-meter.html');
  const before = await page.evaluate(() => JSON.stringify({ local: {...localStorage}, session: {...sessionStorage} }));
  const requests: string[] = []; page.on('request', request => requests.push(request.url()));
  await page.locator('#sigh-name').fill('<svg onload=x()>');
  await measuredRound(page);
  await expect(page.locator('#sigh-results li')).toHaveCount(1);
  await expect(page.locator('#sigh-results li')).toContainText('<svg onload=x()>');
  await expect(page.locator('#sigh-results svg')).toHaveCount(0);
  await page.locator('#sigh-name').fill('다음 참가자');
  await measuredRound(page, 2500);
  await expect(page.locator('#sigh-results li')).toHaveCount(2);
  await expect(page.locator('#sigh-results li').first()).toContainText('다음 참가자');
  expect(await page.evaluate(() => window.__sighTest.stops)).toBe(2);
  expect(await page.evaluate(() => window.__sighTest.closes)).toBe(2);
  expect(await page.evaluate(() => JSON.stringify({ local: {...localStorage}, session: {...sessionStorage} }))).toBe(before);
  expect(new URL(page.url()).search).toBe('');
  expect(requests).toEqual([]);
  await page.locator('#sigh-reset').click();
  await expect(page.locator('#sigh-results li')).toHaveCount(0);
});

test('permission denial recovers and a cancelled permission grant stops its late stream', async ({ page }) => {
  await fakeAudio(page); await page.goto('/tools/sigh-meter.html');
  await page.evaluate(() => { window.__sighTest.mode = 'reject'; });
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-error')).not.toBeEmpty();
  await expect(page.locator('#sigh-start')).toBeEnabled();
  await page.evaluate(() => { window.__sighTest.mode = 'pending'; });
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-app')).toHaveAttribute('data-state', 'requesting');
  await expect(page.locator('#sigh-stop')).toBeEnabled();
  await page.locator('#sigh-stop').click();
  await page.evaluate(() => window.__sighTest.resolve?.());
  await expect.poll(() => page.evaluate(() => window.__sighTest.stops)).toBe(1);
  await expect(page.locator('#sigh-results li')).toHaveCount(0);
  await expect(page.locator('#sigh-start')).toBeEnabled();
  await page.evaluate(() => { window.__sighTest.mode = 'resolve'; });
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-app')).toHaveAttribute('data-state', 'calibrating');
  await page.locator('#sigh-stop').click();
});

test('silence creates no result and reset cancels an active session', async ({ page }) => {
  await fakeAudio(page); await page.clock.install(); await page.goto('/tools/sigh-meter.html');
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-app')).toHaveAttribute('data-state', 'calibrating');
  await page.clock.runFor(5500);
  await expect(page.locator('#sigh-results li')).toHaveCount(0);
  await expect(page.locator('#sigh-start')).toBeEnabled();
  expect(await page.evaluate(() => window.__sighTest.stops)).toBe(1);
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-app')).toHaveAttribute('data-state', 'calibrating');
  await page.locator('#sigh-reset').click();
  expect(await page.evaluate(() => window.__sighTest.stops)).toBe(2);
  await expect(page.locator('#sigh-results li')).toHaveCount(0);
});

for (const interruption of ['hidden', 'ended', 'suspended'] as const) test(`sigh cleans up when ${interruption}`, async ({ page }) => {
  await fakeAudio(page); await page.goto('/tools/sigh-meter.html');
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-app')).toHaveAttribute('data-state', 'calibrating');
  await page.evaluate(kind => {
    if (kind === 'hidden') {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    } else if (kind === 'ended') window.__sighTest.ended();
    else window.__sighTest.suspend();
  }, interruption);
  await expect(page.locator('#sigh-start')).toBeEnabled();
  expect(await page.evaluate(() => window.__sighTest.closes)).toBe(1);
  await expect(page.locator('#sigh-results li')).toHaveCount(0);
});

test('audio initialization failure stops an already acquired stream and can retry', async ({ page }) => {
  await fakeAudio(page); await page.goto('/tools/sigh-meter.html');
  await page.evaluate(() => { window.__sighTest.failResume = true; });
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-error')).not.toBeEmpty();
  await expect(page.locator('#sigh-start')).toBeEnabled();
  expect(await page.evaluate(() => window.__sighTest.stops)).toBe(1);
  expect(await page.evaluate(() => window.__sighTest.closes)).toBe(1);
  await page.evaluate(() => { window.__sighTest.failResume = false; });
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-app')).toHaveAttribute('data-state', 'calibrating');
  await page.locator('#sigh-stop').click();
});

test('unsupported microphone API is explained without requesting access', async ({ page }) => {
  await fakeAudio(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined }));
  await page.goto('/tools/sigh-meter.html');
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-error')).not.toBeEmpty();
  expect(await page.evaluate(() => window.__sighTest.calls)).toBe(0);
  await expect(page.locator('#sigh-results li')).toHaveCount(0);
});

test('competition retains at most ten records and works at 320px with reduced motion', async ({ page }) => {
  test.setTimeout(90000); // Eleven full UI rounds, including calibration and actionability waits.
  await fakeAudio(page); await page.clock.install();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tools/sigh-meter.html');
  for (let i = 0; i < 11; i++) {
    await page.locator('#sigh-name').fill(`참가자 ${i + 1}`);
    await measuredRound(page, 650);
  }
  await expect(page.locator('#sigh-results li')).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await page.evaluate(() => window.__sighTest.stops)).toBe(11);
});

test('native Web Audio and getUserMedia analyze a synthetic WAV, never a real microphone', async ({ playwright, baseURL }) => {
  test.setTimeout(45000);
  const dir = mkdtempSync(join(tmpdir(), 'mgk-sigh-audio-'));
  const file = join(dir, 'synthetic.wav');
  const rate = 16000, seconds = 12;
  const wav = Buffer.alloc(44 + rate * seconds * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  for (let i = 0; i < rate * seconds; i++) {
    const t = i / rate, amplitude = t < 1.7 ? 0.0001 : 0.12;
    const signal = amplitude * (Math.sin(2 * Math.PI * 220 * t) + 0.4 * Math.sin(2 * Math.PI * 540 * t));
    wav.writeInt16LE(Math.round(signal * 32767), 44 + i * 2);
  }
  writeFileSync(file, wav);
  const browser = await playwright.chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${file}`, '--mute-audio'] });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const state = { requests: 0, tracks: [] as MediaStreamTrack[], reads: 0, closes: 0 };
      Object.defineProperty(window, '__sighNative', { value: state });
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async constraints => { state.requests++; const stream = await original(constraints); state.tracks.push(...stream.getTracks()); return stream; };
      const read = AnalyserNode.prototype.getFloatTimeDomainData;
      AnalyserNode.prototype.getFloatTimeDomainData = function(data) { state.reads++; return read.call(this, data); };
      const close = AudioContext.prototype.close;
      AudioContext.prototype.close = function() { state.closes++; return close.call(this); };
      localStorage.setItem('mgk-analytics-consent', 'declined');
    });
    await page.goto(`${baseURL}/tools/sigh-meter.html`);
    await page.locator('#sigh-start').click();
    await expect(page.locator('#sigh-results li')).toHaveCount(1, { timeout: 20000 });
    expect(await page.evaluate(() => {
      const state = (window as unknown as {__sighNative: {requests: number; reads: number; closes: number; tracks: MediaStreamTrack[]}}).__sighNative;
      return state.requests === 1 && state.reads > 20 && state.closes === 1 && state.tracks.length === 1 && state.tracks.every(track => track.readyState === 'ended');
    })).toBe(true);
    await expect(page.locator('#sigh-start')).toBeEnabled();
  } finally { await browser.close(); rmSync(dir, {recursive: true, force: true}); }
});

test('pinwheel reacts to sound, pauses in quiet and releases the microphone after four seconds', async ({ page }, testInfo) => {
  await fakeAudio(page); await page.clock.install();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/tools/sigh-meter.html');
  const fan = page.locator('#sigh-pinwheel');
  await expect(fan).toBeVisible();
  await expect(fan).toHaveAttribute('data-spinning', 'false');
  await expect(page.locator('#sigh-progress')).toHaveAttribute('max', '4');
  await page.locator('#sigh-start').click();
  await expect(page.locator('#sigh-app')).toHaveAttribute('data-state', 'calibrating');
  await page.clock.runFor(1100);
  await expect(fan).toHaveAttribute('data-spinning', 'false');
  await page.evaluate(() => { window.__sighTest.signal = true; });
  await page.clock.runFor(650);
  await expect(fan).toHaveAttribute('data-spinning', 'true');
  const angle = await fan.evaluate(node => (node as SVGElement).style.getPropertyValue('--sigh-angle'));
  expect(Number.parseFloat(angle)).toBeGreaterThan(0);
  await expect(fan).not.toHaveCSS('transform', 'none');
  await page.locator('.sigh-stage').screenshot({path:testInfo.outputPath('pinwheel-active.png')});
  await page.evaluate(() => { window.__sighTest.signal = false; });
  await page.clock.runFor(100);
  await expect(fan).toHaveAttribute('data-spinning', 'false');
  const stoppedAngle = await fan.evaluate(node => (node as SVGElement).style.getPropertyValue('--sigh-angle'));
  await page.clock.runFor(100);
  expect(await fan.evaluate(node => (node as SVGElement).style.getPropertyValue('--sigh-angle'))).toBe(stoppedAngle);
  await page.clock.fastForward(3500);
  await expect(page.locator('#sigh-app')).toHaveAttribute('data-state', 'done');
  await expect(page.locator('#sigh-results li')).toHaveCount(1);
  await expect(page.locator('#sigh-progress')).toHaveJSProperty('value', 4);
  expect(await page.evaluate(() => window.__sighTest.stops)).toBe(1);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(fan).toHaveCSS('transform', 'none');
});
