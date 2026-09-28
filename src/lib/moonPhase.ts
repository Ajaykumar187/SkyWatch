const SYNODIC_MONTH = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

export interface MoonPhaseInfo {
  phase: number;
  name: string;
  emoji: string;
  illumination: number;
}

export function getMoonPhase(date: Date = new Date()): MoonPhaseInfo {
  const diffDays = (date.getTime() - KNOWN_NEW_MOON) / 86400000;
  const phase = ((diffDays % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const normalized = phase / SYNODIC_MONTH;

  const illumination = Math.round((1 - Math.cos(normalized * 2 * Math.PI)) * 50);

  let name = "New Moon";
  let emoji = "🌑";
  if (normalized < 0.03 || normalized > 0.97) {
    name = "New Moon"; emoji = "🌑";
  } else if (normalized < 0.22) {
    name = "Waxing Crescent"; emoji = "🌒";
  } else if (normalized < 0.28) {
    name = "First Quarter"; emoji = "🌓";
  } else if (normalized < 0.47) {
    name = "Waxing Gibbous"; emoji = "🌔";
  } else if (normalized < 0.53) {
    name = "Full Moon"; emoji = "🌕";
  } else if (normalized < 0.72) {
    name = "Waning Gibbous"; emoji = "🌖";
  } else if (normalized < 0.78) {
    name = "Last Quarter"; emoji = "🌗";
  } else {
    name = "Waning Crescent"; emoji = "🌘";
  }

  return { phase: normalized, name, emoji, illumination };
}
