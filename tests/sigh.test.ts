import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountSighMeter } from '../src/scripts/sigh-meter';
import { readFileSync, existsSync } from 'node:fs';

it('provides the accessible Korean competition surface and privacy cautions', () => {
  const path = new URL('../src/pages/tools/sigh-meter.astro', import.meta.url);
  expect(existsSync(path)).toBe(true);
  const page = readFileSync(path, 'utf8');
  expect(page).toContain('color-scheme:light');
  expect(page).toContain('background:#fffdfa');
  for (const id of ['app', 'name', 'start', 'stop', 'reset', 'status', 'error', 'results', 'score', 'phase', 'progress', 'level']) {
    expect(page).toContain(`id="sigh-${id}"`);
  }
  for (const text of ['한숨 측정기', '오늘의 한숨 대결', '15~20cm', '과호흡', 'dBFS', '의료', '음악', '저장', '전송', 'prefers-reduced-motion', 'maxlength="20"', 'aria-live="polite"', 'role="alert"']) expect(page).toContain(text);
});
import { analyzeSigh } from '../src/lib/sigh';

const sound = (seconds: number, rms = 0.1, lowRatio = 0.6) =>
  Array.from({ length: Math.round(seconds * 20) }, () => ({ rms, lowRatio, duration: 0.05 }));

describe('analyzeSigh — synthetic frames only', () => {
  it('scores meaningful sound with weighted RMS dBFS, duration and low energy ratio', () => {
    const result = analyzeSigh(sound(3), 0.01)!;
    expect(result).not.toBeNull();
    expect(result.duration).toBeCloseTo(3);
    expect(result.levelDbfs).toBeCloseTo(-20);
    expect(result.lowRatio).toBeCloseTo(0.6);
    expect(result.score).toBe(57);
  });
  it('rejects invalid or unbounded input rather than returning nonfinite scores', () => {
    for (const noise of [NaN, Infinity, -1, 2]) expect(analyzeSigh(sound(1), noise)).toBeNull();
    for (const bad of [
      { rms: NaN }, { rms: Infinity }, { rms: -1 }, { rms: 2 },
      { duration: NaN }, { duration: Infinity }, { duration: -1 }, { duration: 0.11 },
      { lowRatio: NaN }, { lowRatio: Infinity }, { lowRatio: -0.1 }, { lowRatio: 1.1 },
    ]) expect(analyzeSigh([{ rms: 0.1, lowRatio: 0.6, duration: 0.05, ...bad }, ...sound(1)], 0.001)).toBeNull();
    expect(analyzeSigh(sound(8.1), 0.001)).toBeNull();
    expect(analyzeSigh(Array.from({ length: 10001 }, () => ({ rms: 0.1, duration: 0.0001, lowRatio: 1 })), 0.001)).toBeNull();
  });
  it('accepts the 0.4 second boundary and scores each component monotonically', () => {
    expect(analyzeSigh(sound(0.4), 0.001)).not.toBeNull();
    const base = analyzeSigh(sound(1, 0.01, 0.2), 0.001)!;
    expect(analyzeSigh(sound(3, 0.01, 0.2), 0.001)!.score).toBeGreaterThan(base.score);
    expect(analyzeSigh(sound(1, 0.1, 0.2), 0.001)!.score).toBeGreaterThan(base.score);
    expect(analyzeSigh(sound(1, 0.01, 0.9), 0.001)!.score).toBeGreaterThan(base.score);
    const full = analyzeSigh(sound(8, 1, 1), 0)!;
    expect(full.score).toBe(100);
    expect(full.duration).toBeCloseTo(8);
    for (const value of Object.values(full)) expect(Number.isFinite(value)).toBe(true);
    expect(analyzeSigh(sound(6, 1, 1), 0)!.score).toBe(full.score);
    expect(analyzeSigh(sound(1, 0.007, 1), 0)).toBeNull();
  });
  it('does not rank silence, ambient noise or a short burst', () => {
    expect(analyzeSigh([], 0)).toBeNull();
    expect(analyzeSigh([{ rms: 0, lowRatio: 1, duration: 1 }], 0)).toBeNull();
    expect(analyzeSigh([{ rms: 0.011, lowRatio: 1, duration: 1 }], 0.01)).toBeNull();
    expect(analyzeSigh([{ rms: 0.1, lowRatio: 1, duration: 0.1 }], 0.001)).toBeNull();
  });
});

class FakeElement extends EventTarget {
  value: string | number = ''; textContent = ''; disabled = false; hidden = false;
  dataset: Record<string, string> = {}; children: FakeElement[] = [];
  style = { setProperty: vi.fn() };
  append(...children: FakeElement[]) { this.children.push(...children); }
  replaceChildren(...children: FakeElement[]) { this.children = children; }
  setAttribute() {}
  // Unit-only physical activation model; real DOM .click() remains untrusted.
  click() {
    if (this.disabled) return;
    const event = new Event('click');
    Object.defineProperty(event, 'isTrusted', { value: true });
    this.dispatchEvent(event);
  }
}
function environment() {
  const elements = new Map<string, FakeElement>();
  for (const id of ['name','start','stop','reset','status','error','results','score','phase','progress','level','duration','dbfs','low','empty']) elements.set('#sigh-' + id, new FakeElement());
  const root = new FakeElement();
  const querySelector = (selector: string) => selector === '.sigh-orb' ? new FakeElement() : elements.get(selector);
  Object.assign(root, { querySelector });
  elements.get('#sigh-name')!.value = '참가자1';
  const doc = Object.assign(new EventTarget(), { hidden: false, visibilityState: 'visible', createElement: () => new FakeElement(), querySelector: () => null });
  vi.stubGlobal('document', doc); vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('isSecureContext', true);
  let now = 0, id = 0; const raf = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('performance', { now: () => now });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { raf.set(++id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => raf.delete(key));
  const stop = vi.fn(); const track = Object.assign(new EventTarget(), { stop, readyState: 'live' });
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  let grant!: (value: unknown) => void; let reject!: (reason: unknown) => void;
  const getUserMedia = vi.fn(() => new Promise((resolve, rejectPromise) => { grant = resolve; reject = rejectPromise; }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  let rms = 0.001;
  const contexts: FakeContext[] = [];
  class FakeContext extends EventTarget {
    state = 'running'; sampleRate = 48000; onstatechange: (() => void) | null = null;
    resume = vi.fn(async () => {}); close = vi.fn(async () => { this.state = 'closed'; });
    source = { connect: vi.fn(), disconnect: vi.fn() };
    analyser = { fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: 0, disconnect: vi.fn(),
      getFloatTimeDomainData: (data: Float32Array) => data.fill(rms),
      getFloatFrequencyData: (data: Float32Array) => { data.fill(-100); for (let i=4;i<40;i++) data[i] = -20; },
    };
    constructor() { super(); contexts.push(this); }
    createAnalyser() { return this.analyser; }
    createMediaStreamSource() { return this.source; }
  }
  vi.stubGlobal('AudioContext', FakeContext);
  const tick = (milliseconds: number) => { now += milliseconds; const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(callback => callback(now)); };
  return { root: root as unknown as HTMLElement, elements, doc, stop, track, stream, getUserMedia, contexts, tick, raf, grant: () => grant(stream), reject: (error: unknown) => reject(error), setRms: (value: number) => { rms = value; } };
}
const flush = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('ignores explicitly untrusted activation without allocating audio or changing phase', async () => {
  const env = environment();
  const add = vi.spyOn(env.elements.get('#sigh-start')!, 'addEventListener');
  const dispose = mountSighMeter(env.root);
  const start = env.elements.get('#sigh-start')!;
  const phase = env.elements.get('#sigh-phase')!.textContent;
  const status = env.elements.get('#sigh-status')!.textContent;
  const event = new Event('click', { bubbles: true });
  expect(event.isTrusted).toBe(false);
  start.dispatchEvent(event); await flush();
  expect(env.getUserMedia).not.toHaveBeenCalled();
  expect(env.contexts).toHaveLength(0);
  expect(env.root.dataset.state).toBe('idle');
  expect(env.elements.get('#sigh-phase')!.textContent).toBe(phase);
  expect(env.elements.get('#sigh-status')!.textContent).toBe(status);
  expect(start.disabled).toBe(false);
  // Disposal must remove the same trusted-click wrapper registered at mount.
  const remove = vi.spyOn(start, 'removeEventListener');
  dispose();
  expect(remove).toHaveBeenCalledWith('click', add.mock.calls[0][1]);
  expect(env.getUserMedia).not.toHaveBeenCalled();
});

it('samples one quiet second and eight seconds, then ranks safely and releases resources', async () => {
  const env = environment(); mountSighMeter(env.root);
  env.elements.get('#sigh-start')!.click(); env.grant(); await flush();
  expect(env.root.dataset.state).toBe('calibrating');
  expect(env.contexts[0].source.connect).toHaveBeenCalledWith(env.contexts[0].analyser);
  for (let i=0;i<10;i++) env.tick(100);
  expect(env.root.dataset.state).toBe('measuring');
  env.setRms(0.1);
  for (let i=0;i<79;i++) env.tick(100);
  expect(env.root.dataset.state).toBe('measuring');
  env.tick(100);
  expect(env.root.dataset.state).toBe('done');
  expect(Number(env.elements.get('#sigh-score')!.textContent)).toBeGreaterThan(1);
  expect(env.elements.get('#sigh-results')!.children).toHaveLength(1);
  expect(env.elements.get('#sigh-name')!.value).toBe('참가자2');
  expect(env.stop).toHaveBeenCalledOnce();
  expect(env.contexts[0].close).toHaveBeenCalledOnce();
  expect(env.raf.size).toBe(0);
  env.elements.get('#sigh-reset')!.click();
  expect(env.elements.get('#sigh-score')!.textContent).toBe('—');
  expect(env.elements.get('#sigh-results')!.children).toHaveLength(0);
  expect(env.elements.get('#sigh-name')!.value).toBe('참가자1');
  expect(env.getUserMedia).toHaveBeenCalledOnce();
});

it('handles resume rejection immediately even with permission pending and stops its late stream', async () => {
  const env = environment();
  const Audio = globalThis.AudioContext;
  vi.stubGlobal('AudioContext', class extends Audio { resume = vi.fn(async () => { throw new Error('resume failed'); }); });
  mountSighMeter(env.root); env.elements.get('#sigh-start')!.click(); await flush();
  expect(env.root.dataset.state).toBe('error');
  expect(env.contexts[0].close).toHaveBeenCalledOnce();
  expect(env.elements.get('#sigh-error')!.textContent).not.toBe('');
  env.grant(); await flush();
  expect(env.stop).toHaveBeenCalledOnce();
  expect(env.raf.size).toBe(0);
});

it.each(['visibilitychange', 'pagehide', 'astro:before-swap'])('cancels on %s without leaving a frame or score', async event => {
  const env = environment(); mountSighMeter(env.root);
  env.elements.get('#sigh-start')!.click(); env.grant(); await flush();
  if (event === 'visibilitychange') { env.doc.hidden = true; env.doc.visibilityState = 'hidden'; }
  (event === 'pagehide' ? window : env.doc).dispatchEvent(new Event(event));
  expect(env.stop).toHaveBeenCalledOnce();
  expect(env.contexts[0].close).toHaveBeenCalledOnce();
  expect(env.raf.size).toBe(0);
  expect(env.elements.get('#sigh-results')!.children).toHaveLength(0);
  expect(env.root.dataset.state).toBe('idle');
});

it.each(['ended', 'suspended'])('stops on %s without a result', async cause => {
  const env = environment(); mountSighMeter(env.root);
  env.elements.get('#sigh-start')!.click(); env.grant(); await flush();
  if (cause === 'ended') env.track.dispatchEvent(new Event('ended'));
  else { env.contexts[0].state = 'suspended'; env.contexts[0].dispatchEvent(new Event('statechange')); }
  expect(env.stop).toHaveBeenCalledOnce();
  expect(env.contexts[0].close).toHaveBeenCalledOnce();
  expect(env.raf.size).toBe(0);
  expect(env.root.dataset.state).toBe('error');
  expect(env.elements.get('#sigh-results')!.children).toHaveLength(0);
});

it('closes a context suspended while microphone permission is still pending', async () => {
  const env = environment(); mountSighMeter(env.root);
  env.elements.get('#sigh-start')!.click(); await flush();
  env.contexts[0].state = 'suspended'; env.contexts[0].dispatchEvent(new Event('statechange'));
  expect(env.contexts[0].close).toHaveBeenCalledOnce();
  expect(env.root.dataset.state).toBe('error');
  env.grant(); await flush();
  expect(env.stop).toHaveBeenCalledOnce();
  expect(env.raf.size).toBe(0);
});

it('requests only on click, resumes before permission, cancels pending and stops late streams', async () => {
  const env = environment(); mountSighMeter(env.root);
  expect(env.getUserMedia).not.toHaveBeenCalled();
  env.elements.get('#sigh-start')!.click();
  expect(env.contexts[0].resume).toHaveBeenCalledOnce();
  expect(env.root.dataset.state).toBe('requesting');
  expect(env.getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
  expect(env.elements.get('#sigh-name')!.disabled).toBe(true);
  expect(env.elements.get('#sigh-stop')!.disabled).toBe(false);
  env.elements.get('#sigh-stop')!.click();
  expect(env.contexts[0].close).toHaveBeenCalledOnce();
  env.elements.get('#sigh-start')!.click();
  expect(env.getUserMedia).toHaveBeenCalledOnce();
  env.grant(); await flush();
  expect(env.stop).toHaveBeenCalledOnce();
  expect(env.raf.size).toBe(0);
  expect(env.root.dataset.state).toBe('idle');
  expect(env.elements.get('#sigh-results')!.children).toHaveLength(0);
});
