import { analyzeSigh, type SighFrame, type SighResult } from '../lib/sigh';

type Phase = 'idle' | 'requesting' | 'calibrating' | 'measuring' | 'done' | 'error';
interface Run {
  token: number; context: AudioContext; stream?: MediaStream; source?: MediaStreamAudioSourceNode;
  analyser?: AnalyserNode; raf?: number; stopped: boolean; onEnded?: () => void; onState?: () => void; frames: SighFrame[];
}
interface Entry { name: string; result: SighResult; order: number; }

/** Live, local numerical analysis only. This never creates or stores an audio recording. */
export function mountSighMeter(root: HTMLElement): () => void {
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#sigh-${id}`)!;
  const name = get<HTMLInputElement>('name'), start = get<HTMLButtonElement>('start');
  const stop = get<HTMLButtonElement>('stop'), reset = get<HTMLButtonElement>('reset');
  const status = get('status'), error = get('error'), phase = get('phase');
  const progress = get<HTMLProgressElement>('progress'), level = get<HTMLMeterElement>('level');
  const orb = root.querySelector<HTMLElement>('.sigh-orb');
  let generation = 0, current: Run | undefined, pending = false, disposed = false;
  let entries: Entry[] = [], order = 0, participant = 1, autoName = '참가자1', automatic = true;
  const busy = () => ['requesting', 'calibrating', 'measuring'].includes(root.dataset.state ?? '');
  function controls() { start.disabled = disposed || pending || busy(); name.disabled = busy(); stop.disabled = !busy(); }
  function state(next: Phase, message: string) {
    root.dataset.state = next;
    if (status.textContent !== message) status.textContent = message;
    controls();
  }
  function release(run: Run) {
    if (run.stopped) return;
    run.stopped = true;
    if (run.raf !== undefined) cancelAnimationFrame(run.raf);
    if (run.onState) run.context.removeEventListener('statechange', run.onState);
    for (const track of run.stream?.getTracks() ?? []) {
      if (run.onEnded) track.removeEventListener('ended', run.onEnded);
      track.stop();
    }
    try { run.source?.disconnect(); run.analyser?.disconnect(); } catch { /* Already disconnected. */ }
    void run.context.close().catch(() => {});
    run.frames.length = 0;
    if (current === run) current = undefined;
    level.value = 0;
    orb?.style.setProperty('--pulse', '0');
  }
  function cancel() {
    generation++;
    if (current) release(current);
    level.value = 0; progress.value = 0;
    phase.textContent = '준비 1초 → 한숨 8초';
    error.textContent = '';
    state('idle', pending ? '측정을 취소했어요. 열린 권한 요청이 끝나면 다시 시작할 수 있어요.' : '측정을 취소했어요. 준비되면 다시 시작하세요.');
  }
  function renderBoard() {
    const list = get('results');
    list.replaceChildren();
    let rank = 0, previous = -1;
    entries.forEach((entry, index) => {
      if (entry.result.score !== previous) rank = index + 1;
      previous = entry.result.score;
      const row = document.createElement('li');
      row.dataset.rank = String(rank); row.dataset.winner = String(rank === 1);
      const position = document.createElement('span');
      position.textContent = rank === 1 ? '🏆 공동 1위' : `${rank}위`;
      if (rank === 1 && entries.filter(item => item.result.score === entry.result.score).length === 1) position.textContent = '🏆 1위';
      const who = document.createElement('span'); who.className = 'sigh-entry-name'; who.textContent = entry.name;
      const points = document.createElement('span'); points.className = 'sigh-entry-score'; points.textContent = `${entry.result.score}점`;
      row.append(position, who, points); list.append(row);
    });
    get('empty').hidden = entries.length > 0;
  }
  function finish(run: Run, noiseRms: number, participantName: string) {
    const result = analyzeSigh(run.frames, noiseRms);
    release(run);
    progress.value = 8;
    phase.textContent = '측정 완료';
    if (!result) { state('done', '충분한 소리를 찾지 못했어요. 조용한 준비 1초 후 편안하게 다시 시도하세요.'); return; }
    get('score').textContent = String(result.score);
    get('duration').textContent = `${result.duration.toFixed(1)}초`;
    get('dbfs').textContent = `${result.levelDbfs.toFixed(1)} dBFS`;
    get('low').textContent = `${Math.round(result.lowRatio * 100)}%`;
    entries.push({ name: participantName, result, order: order++ });
    entries.sort((a, b) => b.result.score - a.result.score || a.order - b.order);
    entries = entries.slice(0, 10);
    renderBoard();
    if (automatic && name.value === autoName) { autoName = `참가자${++participant}`; name.value = autoName; }
    state('done', `${participantName} · ${result.score}점! 다음 참가자도 같은 거리에서 도전하세요.`);
  }
  function sample(run: Run, participantName: string) {
    const analyser = run.context.createAnalyser();
    run.analyser = analyser; analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0;
    run.source = run.context.createMediaStreamSource(run.stream!);
    // Deliberately no connection to context.destination: never play the microphone back.
    run.source.connect(analyser);
    const waveform = new Float32Array(analyser.fftSize);
    const spectrum = new Float32Array(analyser.frequencyBinCount);
    let started = performance.now(), previous = started, measuring = false;
    let quietSum = 0, quietDuration = 0, noiseRms = 0, captured = 0, shownSecond = -1;
    function frame(now: number) {
      if (run.stopped || run.token !== generation || disposed) return;
      if (document.hidden) { cancel(); return; }
      try {
        const elapsed = (now - started) / 1000;
        const dt = Math.min(0.1, Math.max(0, (now - previous) / 1000));
        previous = now;
        if (!Number.isFinite(elapsed) || !Number.isFinite(dt)) throw new Error('audio');
        analyser.getFloatTimeDomainData(waveform);
        analyser.getFloatFrequencyData(spectrum);
        let power = 0;
        for (const value of waveform) { if (!Number.isFinite(value)) throw new Error('audio'); power += value * value; }
        const rms = Math.min(1, Math.sqrt(power / waveform.length));
        let lowEnergy = 0, totalEnergy = 0;
        const binHz = run.context.sampleRate / analyser.fftSize;
        for (let bin = 0; bin < spectrum.length; bin++) {
          const hz = bin * binHz, db = spectrum[bin];
          if (hz < 80 || hz > 8000) continue;
          if (db === -Infinity) continue;
          if (!Number.isFinite(db)) throw new Error('audio');
          const energy = 10 ** (Math.min(0, db) / 10);
          totalEnergy += energy;
          if (hz <= 1000) lowEnergy += energy;
        }
        const lowRatio = totalEnergy > 0 ? Math.min(1, lowEnergy / totalEnergy) : 0;
        level.value = rms;
        orb?.style.setProperty('--pulse', String(Math.min(1, rms * 5)));
        if (!measuring) {
          const quietDt = Math.min(dt, Math.max(0, 1 - quietDuration));
          quietSum += rms * quietDt; quietDuration += quietDt;
          if (elapsed >= 1) {
            noiseRms = quietDuration > 0 ? quietSum / quietDuration : 0;
            measuring = true; started = now; shownSecond = -1;
            state('measuring', '한숨 8초 · 편안하게 내쉬어 주세요.');
            phase.textContent = '한숨 · 남은 8초'; shownSecond = 8;
          }
        } else {
          const duration = Math.min(dt, Math.max(0, 8 - captured));
          if (duration > 0 && run.frames.length < 10000) { run.frames.push({ rms, lowRatio, duration }); captured += duration; }
          progress.value = Math.min(8, Math.max(0, elapsed));
          const second = Math.max(0, Math.ceil(8 - elapsed));
          if (second !== shownSecond) { shownSecond = second; phase.textContent = `한숨 · 남은 ${second}초`; state('measuring', `한숨 ${second}초 남았어요. 편안한 호흡만 해 주세요.`); }
          if (elapsed >= 8) { finish(run, noiseRms, participantName); return; }
        }
        run.raf = requestAnimationFrame(frame);
      } catch (reason) { fail(run, reason); }
    }
    run.raf = requestAnimationFrame(frame);
  }
  function fail(run: Run | undefined, reason: unknown) {
    if (run && (run.token !== generation || run.stopped)) return;
    if (run) release(run);
    const kind = reason instanceof Error ? reason.name : '';
    const message = reason instanceof Error ? reason.message : '';
    error.textContent = message === 'unsupported' ? 'HTTPS 환경의 최신 브라우저에서 마이크를 사용할 수 있어요.'
      : kind === 'NotAllowedError' || kind === 'SecurityError' ? '마이크 권한이 거부되었어요. 주소창의 사이트 권한에서 마이크를 허용한 뒤 다시 시도하세요.'
      : kind === 'NotFoundError' || kind === 'DevicesNotFoundError' ? '연결된 마이크를 찾지 못했어요. 마이크를 연결한 뒤 다시 시도하세요.'
      : kind === 'NotReadableError' || kind === 'TrackStartError' ? '마이크를 읽을 수 없어요. 다른 앱의 마이크 사용과 기기 연결 상태를 확인하세요.'
      : '마이크 분석이 중단되었어요. 기기와 브라우저의 마이크 설정을 확인한 뒤 다시 시도하세요.';
    progress.value = 0; phase.textContent = '측정 중단';
    state('error', '점수를 남기지 않았어요. 다시 시도할 수 있어요.');
  }
  async function begin() {
    if (disposed || pending || busy() || document.hidden) return;
    const token = ++generation;
    const participantName = name.value.trim().slice(0, 20) || `참가자${participant}`;
    error.textContent = ''; progress.value = 0; level.value = 0; phase.textContent = '마이크 권한 확인 중';
    state('requesting', '마이크 권한을 확인하고 있어요. 원하면 지금 취소할 수 있어요.');
    let run: Run | undefined;
    try {
      if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const Audio = globalThis.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) throw new Error('unsupported');
      run = { token, context: new Audio(), stopped: false, frames: [] };
      current = run;
      // Safari activation must be used synchronously, BEFORE awaiting permission.
      const ownedContext = run;
      ownedContext.onState = () => { if (!ownedContext.stopped && ownedContext.context.state !== 'running') fail(ownedContext, new Error('audio')); };
      const resumed = run.context.resume().then(() => {
        if (!ownedContext.stopped) {
          ownedContext.context.addEventListener('statechange', ownedContext.onState!);
          ownedContext.onState!();
        }
        return !ownedContext.stopped;
      }, () => {
        if (token === generation && !disposed && !ownedContext.stopped) fail(ownedContext, new Error('audio'));
        return false;
      });
      pending = true; controls();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (token !== generation || run.stopped || disposed || document.hidden) {
        for (const track of stream.getTracks()) track.stop();
        release(run); return;
      }
      run.stream = stream;
      if (!await resumed || run.context.state !== 'running') throw new Error('audio');
      if (token !== generation || run.stopped || disposed || document.hidden) { release(run); return; }
      if (!stream.getAudioTracks().length || stream.getAudioTracks().some(track => track.readyState === 'ended')) throw new Error('audio');
      const owned = run;
      run.onEnded = () => fail(owned, new Error('audio'));
      for (const track of stream.getTracks()) track.addEventListener('ended', run.onEnded);
      phase.textContent = '준비 · 조용히 1초';
      state('calibrating', '준비 1초 · 조용히 기다려 주세요.');
      sample(run, participantName);
    } catch (reason) {
      if (token === generation && !disposed) fail(run, reason);
      else if (run) release(run);
    } finally { pending = false; controls(); }
  }
  function clear() {
    cancel(); entries = []; order = 0; participant = 1; autoName = '참가자1'; automatic = true; name.value = autoName;
    for (const id of ['score', 'duration', 'dbfs', 'low']) get(id).textContent = '—';
    renderBoard(); state('idle', '기록을 지웠어요. 버튼을 누를 때만 마이크 권한을 요청해요.');
  }
  const rename = () => { automatic = false; };
  const activate = (event: MouseEvent) => { if (event.isTrusted) void begin(); };
  start.addEventListener('click', activate); stop.addEventListener('click', cancel); reset.addEventListener('click', clear); name.addEventListener('input', rename);
  const visibility = () => { if (document.hidden && busy()) cancel(); };
  const leave = () => { if (busy()) cancel(); };
  function dispose() {
    disposed = true; cancel(); entries = [];
    start.removeEventListener('click', activate); stop.removeEventListener('click', cancel); reset.removeEventListener('click', clear); name.removeEventListener('input', rename);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', leave);
    document.removeEventListener('astro:before-swap', dispose);
  }
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', leave);
  document.addEventListener('astro:before-swap', dispose);
  state('idle', '버튼을 누를 때만 마이크 권한을 요청해요.');
  return dispose;
}

if (typeof document !== 'undefined') {
  const root = document.querySelector<HTMLElement>('#sigh-app');
  if (root) mountSighMeter(root);
}
