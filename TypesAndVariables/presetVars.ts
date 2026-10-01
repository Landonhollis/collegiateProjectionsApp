// presetVars.ts
// ─────────────────────────────────────────────────────────────────────────────
// Every preset the entity engines use, in one place, so they are easy to keep up to date.
//
// REGION: Southeast US = AL, AR, FL, GA, KY, LA, MS, NC, SC, TN, VA, WV.
//   Where a per-state number exists, it is stored per state and the engine uses the
//   plain average of the 12 states. To update a preset, change the state number and the
//   average updates itself.
//
// NO INFLATION: the app lives in today's (2026) dollars. So:
//   • every growth/appreciation/depreciation/return rate here is a REAL rate
//     (inflation already removed)
//   • tax brackets, deductions, and limits are frozen at their 2026 values
//
// UNITS: any field ending in "Pct" is a percent number (6.5 means 6.5%).
//        Money is whole dollars unless noted.
// Research date: 2026-09-24.
// ─────────────────────────────────────────────────────────────────────────────

import type { FilingStatus, HealthInsuranceType } from './types';

export const SE_STATES = ['AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'] as const;
export type SEState = (typeof SE_STATES)[number];
type PerState<T> = Record<SEState, T>;

const seAvg = (o: PerState<number>): number =>
  SE_STATES.reduce((sum, st) => sum + o[st], 0) / SE_STATES.length;

// ── Projection ───────────────────────────────────────────────────────────────
export const PROJECTION = {
  defaultEndMonth: 960, // 80 years; used only when upstream doesn't pass ctx.endMonth
};

// ── Housing ──────────────────────────────────────────────────────────────────
// Effective property tax on owner-occupied homes, % of home value per year.
// Source: Tax Foundation, "Property Taxes by State and County, 2026" (2024 ACS data).
export const PROPERTY_TAX_PCT: PerState<number> = {
  AL: 0.37, AR: 0.56, FL: 0.78, GA: 0.79, KY: 0.74, LA: 0.55,
  MS: 0.58, NC: 0.66, SC: 0.49, TN: 0.52, VA: 0.78, WV: 0.51,
};

// Homeowners insurance, $/year, at these dwelling-coverage levels.
// Source: Insurance.com 2026 state averages ($300k liability, $1k deductible).
// The engine uses the property value as the dwelling coverage and interpolates.
export const HOME_INS_COVERAGE_POINTS = [200_000, 300_000, 400_000, 600_000, 1_000_000];
export const HOME_INS_ANNUAL: PerState<number[]> = {
  AL: [2852, 3716, 4506, 6118, 8790],
  AR: [2458, 3195, 3960, 5450, 7732],
  FL: [6203, 8471, 11161, 16690, 25695],
  GA: [1784, 2301, 2888, 4120, 6031],
  KY: [3587, 4471, 5450, 7030, 9779],
  LA: [3766, 5185, 6613, 9540, 14556],
  MS: [1995, 2602, 3092, 4216, 6286],
  NC: [2481, 3799, 4768, 6692, 8296],
  SC: [2032, 2870, 3690, 5208, 8172],
  TN: [2409, 3198, 3970, 5489, 7936],
  VA: [1579, 1939, 2379, 3336, 5110],
  WV: [1572, 1961, 2333, 3037, 4109],
};

// Renters insurance, $/year. Source: Insurance Information Institute state averages.
export const RENTERS_INS_ANNUAL: PerState<number> = {
  AL: 219, AR: 205, FL: 181, GA: 205, KY: 159, LA: 243,
  MS: 262, NC: 170, SC: 186, TN: 187, VA: 152, WV: 173,
};

// Essential home utilities (electricity + natural gas + water + sewer), $/month.
// Source: Move.org 2026 state averages.
export const UTILITIES_ESSENTIAL_MONTHLY: PerState<number> = {
  AL: 391.73, AR: 294.55, FL: 283.78, GA: 402.91, KY: 309.77, LA: 311.83,
  MS: 324.62, NC: 310.6, SC: 295.94, TN: 340.72, VA: 349.5, WV: 540.04,
};
// Home internet, $/month. Source: BroadbandNow 2026 national average ($81.16).
export const HOME_INTERNET_MONTHLY = 81;

export const HOME = {
  propertyTaxPct: seAvg(PROPERTY_TAX_PCT), // ≈ 0.61 %/yr of current value
  // Real (after-inflation) appreciation. Long-run US real house-price growth:
  // Shiller 1890-1990 ≈ 0.2%/yr; S&P (Blitzer) long-run ≈ 1.2%/yr; Case-Shiller
  // 1974-2024 ≈ 1.5%/yr. 1.0% is the middle, forward-looking pick.
  appreciationRealPct: 1.0,
  // Maintenance + repairs ≈ 1.02% of value/yr (Census/Fed data via Homebuyer.com, 2025).
  maintenancePct: 1.0,
  utilitiesMonthly: seAvg(UTILITIES_ESSENTIAL_MONTHLY) + HOME_INTERNET_MONTHLY, // ≈ $427
  renterInsuranceMonthly: seAvg(RENTERS_INS_ANNUAL) / 12, // ≈ $16
};

// SE-average homeowners insurance curve (same coverage points as above).
export const HOME_INS_SE_CURVE: number[] = HOME_INS_COVERAGE_POINTS.map((_, i) =>
  SE_STATES.reduce((sum, st) => sum + HOME_INS_ANNUAL[st][i], 0) / SE_STATES.length,
);

// ── Vehicles ─────────────────────────────────────────────────────────────────
// Full-coverage car insurance, $/month. Source: Insurify, July 2026 state averages.
export const CAR_INS_FULL_MONTHLY: PerState<number> = {
  AL: 142, AR: 152, FL: 236, GA: 259, KY: 192, LA: 209,
  MS: 184, NC: 114, SC: 256, TN: 132, VA: 204, WV: 153,
};

export const VEHICLE = {
  // AAA "Your Driving Costs" 2025: $4,334/yr depreciation × 5 yrs on a $38,938 avg car
  //   → 44.3% of value left after 5 years → 15.0%/yr nominal (declining balance).
  // Removing ~2.5%/yr inflation → ≈ 17%/yr REAL.
  depreciationRealPct: 17,
  insuranceMonthly: seAvg(CAR_INS_FULL_MONTHLY), // ≈ $186 (existing-vehicle preset)
  // AAA 2025: maintenance + repair + tires = 11.04¢/mile × 15,000 mi/yr ÷ 12.
  maintenanceMonthly: 138,
};

// Regular gas, $/gallon. Source: AAA state averages, Sept 22, 2026.
// NOTE: prices were elevated in 2026 (about $1/gal above Sept 2025). Update as needed.
export const GAS_PRICE: PerState<number> = {
  AL: 4.024, AR: 4.075, FL: 4.242, GA: 4.097, KY: 4.174, LA: 4.006,
  MS: 3.98, NC: 4.128, SC: 4.042, TN: 4.068, VA: 4.207, WV: 4.372,
};
export const GAS = { pricePerGallon: seAvg(GAS_PRICE) }; // ≈ $4.12

// ── Kids / Education / Investing ─────────────────────────────────────────────
export const KIDS = { endAge: 20 }; // kid costs stop when the child turns 20

export const EDUCATION = {
  semesterSpacingMonths: 6, // semesters every 6 months (simplification)
  gracePeriodMonths: 6, // federal student loans: 6-month grace after school
};

export const INVESTING = {
  // Default real return for retirement money when none is given.
  // US stocks long-run real return ≈ 6.5–7%/yr (Siegel, Stocks for the Long Run).
  defaultRealReturnPct: 7,
};

// ── Health insurance ($/month the person pays) ───────────────────────────────
// Marketplace benchmark (2nd-lowest silver) for a 40-year-old, before subsidies.
// Source: KFF, 2026.
export const MARKETPLACE_BENCHMARK_MONTHLY: PerState<number> = {
  AL: 645, AR: 774, FL: 683, GA: 615, KY: 590, LA: 646,
  MS: 662, NC: 638, SC: 564, TN: 711, VA: 455, WV: 1073,
};
// ACA federal age curve: family of 2 adults (40) + 2 kids (0–14)
//   = 2 × 1.000 + 2 × (0.765 / 1.278) ≈ 3.2 × the 40-year-old benchmark.
const FAMILY_OF_4_FACTOR = 2 + 2 * (0.765 / 1.278);

export const HEALTH_PREMIUM_MONTHLY: Record<HealthInsuranceType, number> = {
  employerIndividual: 1440 / 12, // KFF 2025 EHBS avg worker share, single: $1,440/yr
  employerFamily: 6850 / 12, // KFF 2025 EHBS avg worker share, family: $6,850/yr
  marketplaceIndividual: seAvg(MARKETPLACE_BENCHMARK_MONTHLY), // ≈ $671, unsubsidized
  marketplaceFamily: seAvg(MARKETPLACE_BENCHMARK_MONTHLY) * FAMILY_OF_4_FACTOR, // unsubsidized
  medicare: 202.9 + 46.5, // 2026 Part B standard + avg standalone Part D
  none: 0,
};

// ── Taxes (2026, frozen, no inflation indexing) ──────────────────────────────
export type Bracket = [overAmount: number, ratePct: number]; // rate applies to income above overAmount

// Federal: IRS Rev. Proc. 2025-32 (OBBBA).
export const FEDERAL = {
  standardDeduction: { single: 16_100, married: 32_200 },
  brackets: {
    single: [[0, 10], [12_400, 12], [50_400, 22], [105_700, 24], [201_775, 32], [256_225, 35], [640_600, 37]] as Bracket[],
    married: [[0, 10], [24_800, 12], [100_800, 22], [211_400, 24], [403_550, 32], [512_450, 35], [768_700, 37]] as Bracket[],
  },
};

// FICA → "Other taxes expense" (94).
export const FICA = {
  socialSecurityPct: 6.2,
  socialSecurityWageBase: 184_500, // SSA 2026
  medicarePct: 1.45,
  additionalMedicarePct: 0.9,
  additionalMedicareThreshold: { single: 200_000, married: 250_000 }, // statutory
};

// Pre-tax 401(k)/403(b) employee deferral limits, 2026 (IRS Notice 2025-67).
export const RETIREMENT_LIMIT = {
  base: 24_500,
  catchUp50: 8_000, // age 50+
  catchUp60to63: 11_250, // replaces catchUp50 for ages 60–63
};

// State income tax. The engine computes the tax in each of the 12 states and averages
// the results (FL and TN count as $0). Starting point = federal AGI (wages − pre-tax 401k).
// Sources: Tax Foundation "State Individual Income Tax Rates and Brackets, 2026", plus
// 2026 laws signed after that table: GA HB 463 (4.99%, $15k/$30k std), SC H.4216
// (1.99% / 5.21%, no std deduction), WV SB 392 (5% cut), AR Act 1 (top rate 3.7%).
export type StateTaxRule = {
  brackets: { single: Bracket[]; married: Bracket[] };
  highIncome?: { over: number; single: Bracket[]; married: Bracket[] }; // AR's separate table
  stdDeduction: { single: number; married: number };
  exemption: { single: number; married: number };
  credit?: { single: number; married: number };
  deductsFederalTax?: boolean; // AL lets you deduct federal income tax paid
  localPctOfAgi?: number; // average local income tax (Tax Foundation)
};

const flat = (pct: number): { single: Bracket[]; married: Bracket[] } => ({
  single: [[0, pct]],
  married: [[0, pct]],
});
const same = (b: Bracket[]) => ({ single: b, married: b });
const NONE: StateTaxRule = {
  brackets: flat(0),
  stdDeduction: { single: 0, married: 0 },
  exemption: { single: 0, married: 0 },
};

export const STATE_TAX: PerState<StateTaxRule> = {
  AL: {
    brackets: { single: [[0, 2], [500, 4], [3_000, 5]], married: [[0, 2], [1_000, 4], [6_000, 5]] },
    stdDeduction: { single: 2_500, married: 5_000 }, // phase-out floor (applies above ~$36k AGI)
    exemption: { single: 1_500, married: 3_000 },
    deductsFederalTax: true,
    localPctOfAgi: 0.07,
  },
  AR: {
    brackets: same([[0, 0], [5_600, 2], [11_200, 3], [16_000, 3.4], [26_400, 3.7]]),
    highIncome: { over: 94_700, ...same([[0, 2], [4_700, 3.7]]) },
    stdDeduction: { single: 2_470, married: 4_940 },
    exemption: { single: 0, married: 0 },
    credit: { single: 29, married: 58 },
  },
  FL: NONE,
  GA: { brackets: flat(4.99), stdDeduction: { single: 15_000, married: 30_000 }, exemption: { single: 0, married: 0 } },
  KY: {
    brackets: flat(3.5),
    stdDeduction: { single: 3_360, married: 6_720 }, // married = 2 × (couples file separately to get it)
    exemption: { single: 0, married: 0 },
    localPctOfAgi: 0.93,
  },
  LA: { brackets: flat(3.0), stdDeduction: { single: 12_875, married: 25_750 }, exemption: { single: 0, married: 0 } },
  MS: {
    brackets: same([[0, 0], [10_000, 4.0]]),
    stdDeduction: { single: 2_300, married: 4_600 },
    exemption: { single: 6_000, married: 12_000 },
  },
  NC: { brackets: flat(3.99), stdDeduction: { single: 12_750, married: 25_500 }, exemption: { single: 0, married: 0 } },
  SC: { brackets: same([[0, 1.99], [30_000, 5.21]]), stdDeduction: { single: 0, married: 0 }, exemption: { single: 0, married: 0 } },
  TN: NONE,
  VA: {
    brackets: same([[0, 2], [3_000, 3], [5_000, 5], [17_000, 5.75]]),
    stdDeduction: { single: 8_750, married: 17_500 },
    exemption: { single: 930, married: 1_860 },
  },
  WV: {
    brackets: same([[0, 2.11], [10_000, 2.81], [25_000, 3.16], [40_000, 4.22], [60_000, 4.58]]),
    stdDeduction: { single: 0, married: 0 },
    exemption: { single: 2_000, married: 4_000 },
  },
};