export const SIGH_SECONDS = 4;
export interface SighFrame { rms: number; lowRatio: number; duration: number; }
export interface SighResult { score: number; duration: number; levelDbfs: number; lowRatio: number; }

/** A toy sound score, never a sigh classifier or a physical/medical measurement. */
export function analyzeSigh(frames: SighFrame[], noiseRms: number): SighResult | null {
  if (!Array.isArray(frames) || frames.length > 10000 || !Number.isFinite(noiseRms) || noiseRms < 0 || noiseRms > 1) return null;
  let elapsed = 0;
  for (const frame of frames) {
    if (!frame || !Number.isFinite(frame.rms) || frame.rms < 0 || frame.rms > 1 ||
      !Number.isFinite(frame.lowRatio) || frame.lowRatio < 0 || frame.lowRatio > 1 ||
      !Number.isFinite(frame.duration) || frame.duration <= 0 || frame.duration > 0.1) return null;
    elapsed += frame.duration;
    if (elapsed > SIGH_SECONDS + 1e-9) return null;
  }
  const threshold = Math.max(0.008, noiseRms * 2.5);
  let duration = 0, power = 0, low = 0;
  for (const frame of frames) {
    if (frame.rms <= threshold) continue;
    duration += frame.duration;
    power += frame.rms ** 2 * frame.duration;
    low += frame.lowRatio * frame.duration;
  }
  if (duration < 0.4 - 1e-9) return null;
  const rms = Math.sqrt(power / duration);
  const lowRatio = low / duration;
  const aboveNoiseDb = Math.max(0, 20 * Math.log10(rms / Math.max(noiseRms, 0.001)));
  const score = Math.max(1, Math.min(100, Math.round(
    50 * Math.min(duration / (SIGH_SECONDS * 0.75), 1) + 35 * Math.min(aboveNoiseDb / 30, 1) + 15 * lowRatio,
  )));
  return { score, duration, levelDbfs: 20 * Math.log10(rms), lowRatio };
}
