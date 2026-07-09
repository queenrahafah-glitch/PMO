export interface ColorPair {
  bg: string;
  color: string;
}

const DEFAULT_PAIR: ColorPair = { bg: 'oklch(93% 0.01 255)', color: 'oklch(50% 0.02 255)' };

function lookup(map: Record<string, ColorPair>, key: string): ColorPair {
  return map[key.trim().toLowerCase()] ?? DEFAULT_PAIR;
}

const COST_EFF_STATUS_COLORS: Record<string, ColorPair> = {
  'on going': { bg: 'oklch(93% 0.05 255)', color: 'oklch(45% 0.14 255)' },
  completed: { bg: 'oklch(92% 0.06 150)', color: 'oklch(45% 0.14 150)' },
};

const TASK_STATUS_COLORS: Record<string, ColorPair> = {
  complete: { bg: 'oklch(92% 0.06 150)', color: 'oklch(42% 0.14 150)' },
  'in progress': { bg: 'oklch(93% 0.05 255)', color: 'oklch(45% 0.14 255)' },
  'on hold': { bg: 'oklch(93% 0.06 80)', color: 'oklch(48% 0.13 80)' },
  'not yet started': { bg: 'oklch(93% 0.008 255)', color: 'oklch(48% 0.02 255)' },
  delayed: { bg: 'oklch(92% 0.07 25)', color: 'oklch(48% 0.16 25)' },
};

const RISK_COLORS: Record<string, ColorPair> = {
  'on track': { bg: 'oklch(92% 0.06 150)', color: 'oklch(42% 0.14 150)' },
  'at risk': { bg: 'oklch(93% 0.06 80)', color: 'oklch(48% 0.13 80)' },
  critical: { bg: 'oklch(92% 0.07 25)', color: 'oklch(48% 0.16 25)' },
};

const PRIORITY_COLORS: Record<string, ColorPair> = {
  low: { bg: 'oklch(93% 0.008 255)', color: 'oklch(48% 0.02 255)' },
  medium: { bg: 'oklch(93% 0.05 255)', color: 'oklch(45% 0.14 255)' },
  high: { bg: 'oklch(92% 0.07 25)', color: 'oklch(48% 0.16 25)' },
};

export function costEffStatusColor(status: string): ColorPair {
  const key = status.trim().toLowerCase().startsWith('completed') ? 'completed' : status;
  return lookup(COST_EFF_STATUS_COLORS, key);
}
export const taskStatusColor = (status: string) => lookup(TASK_STATUS_COLORS, status);
export const riskColor = (risk: string) => lookup(RISK_COLORS, risk);
export const priorityColor = (priority: string) => lookup(PRIORITY_COLORS, priority);

export function costEffProgressPct(status: string): number {
  const s = status.trim().toLowerCase();
  if (s.startsWith('completed')) return 100;
  if (s === 'on going') return 55;
  if (s === 'delayed') return 15;
  return 30;
}

export function taskProgressPct(status: string): number {
  const s = status.trim().toLowerCase();
  if (s === 'complete') return 100;
  if (s === 'in progress') return 50;
  if (s === 'on hold') return 20;
  if (s === 'delayed') return 10;
  return 0;
}

export const progressBarColor = (pct: number) => (pct >= 100 ? 'oklch(55% 0.14 150)' : 'oklch(52% 0.13 255)');
