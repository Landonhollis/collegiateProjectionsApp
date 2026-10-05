import { formatDollars } from "./formParsing";

// The number work behind the outcomes chart (no React, so it can be tested): the y-axis, the age labels, short dollar labels.

/** 1234 → "$1,234"; −1234 → "−$1,234". */
export function money(dollars: number): string {
  return `${dollars < 0 ? "−" : ""}$${formatDollars(Math.abs(dollars))}`;
}

/** Short dollars for axis labels: 950 → "$950", 250000 → "$250k", 1200000 → "$1.2M", −1500 → "−$1.5k". */
export function shortDollars(dollars: number): string {
  const size = Math.abs(dollars);
  const sign = dollars < 0 ? "−" : "";
  const short = (n: number) => String(Math.round(n * 10) / 10); // one decimal at most; no ".0"
  if (size < 1_000) return `${sign}$${Math.round(size)}`;
  if (size < 1_000_000) return `${sign}$${short(size / 1_000)}k`;
  if (size < 1_000_000_000) return `${sign}$${short(size / 1_000_000)}M`;
  return `${sign}$${short(size / 1_000_000_000)}B`;
}

export type YAxis = { min: number; max: number; ticks: number[] };

/**
 * The y-axis for data running from dataMin to dataMax. It always includes 0 (so it starts at 0 unless the data
 * goes below it), and its ends and labelled values are round numbers (steps of 1, 2 or 5 × a power of ten).
 */
export function yAxisFor(dataMin: number, dataMax: number): YAxis {
  if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) throw new Error(`yAxisFor: bad range ${dataMin} to ${dataMax}`);
  const low = Math.min(0, dataMin);
  const high = Math.max(0, dataMax);
  const span = high - low || 1; // all zeros: still draw an axis
  const rough = span / 4; // about four steps, then the nearest round step to that
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const lead = rough / power;
  const step = Math.max(1, (lead < 1.5 ? 1 : lead < 3.5 ? 2 : lead < 7.5 ? 5 : 10) * power);
  const min = Math.floor(low / step) * step;
  const max = Math.max(min + step, Math.ceil(high / step) * step);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
  return { min, max, ticks };
}

/**
 * The ages to label along the bottom: whole years, every 1, 2, 5 or 10 years depending on how long the chart runs.
 * month = how far along the chart that birthday is (month 0 = startAgeMonths).
 */
export function ageTicks(startAgeMonths: number, months: number): { month: number; years: number }[] {
  const lastMonth = months - 1;
  const spanYears = lastMonth / 12;
  const stepYears = spanYears <= 6 ? 1 : spanYears <= 12 ? 2 : spanYears <= 30 ? 5 : 10;
  const stepMonths = stepYears * 12;
  const ticks: { month: number; years: number }[] = [];
  for (let age = Math.ceil(startAgeMonths / stepMonths) * stepMonths; age - startAgeMonths <= lastMonth; age += stepMonths) {
    ticks.push({ month: age - startAgeMonths, years: age / 12 });
  }
  return ticks;
}
