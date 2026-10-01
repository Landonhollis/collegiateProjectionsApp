// engineSpecTest.ts — run with:  npx tsx engineSpecTest.ts
// Spec tests: what each engine SHOULD output, derived independently (hand calcs,
// textbook formulas, and small from-scratch reference simulations), compared to what
// it actually outputs. No test framework needed. Exits non-zero on any failure.
import {
  ACCT, ENGINES, bracketTax, checkAge, computeAnnualTaxes, homeInsuranceAnnual, monthsPaidFromBalance,
  paymentFor, recurringWindow, retirementLimitForAge, roundDollar, solveLoan, toMonth,
} from '../Engines/entityEngines';
import {
  CAR_INS_FULL_MONTHLY, FEDERAL, GAS, GAS_PRICE, HEALTH_PREMIUM_MONTHLY, HOME, HOME_INS_SE_CURVE, KIDS,
  PROPERTY_TAX_PCT, RETIREMENT_LIMIT, SE_STATES, VEHICLE,
} from '../TypesAndVariables/presetVars';
import type { Age, EngineCtx, JournalEntry } from '../TypesAndVariables/types';

// ── tiny harness ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const fails: string[] = [];
function check(cond: boolean, msg: string) {
  if (cond) passed++;
  else { failed++; fails.push(msg); }
}
const approx = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
function test(name: string, fn: () => void) {
  try { fn(); } catch (e) { failed++; fails.push(`${name}: threw ${(e as Error).message}`); }
}
const throws = (fn: () => void): boolean => { try { fn(); return false; } catch { return true; } };

const ctx = (years = 30, months = 0, endMonth?: number): EngineCtx => ({ caseId: 'spec', startAge: { years, months }, endMonth });
const age = (years: number, months = 0): Age => ({ years, months });

// ── ledger readers ───────────────────────────────────────────────────────────
/** Balance of an account after month m posts (inclusive). */
const bal = (e: JournalEntry[], acct: number, m = Infinity) => {
  let s = 0;
  for (const je of e) if (je.month <= m) for (const l of je.lineEntries) if (l.account === acct) s += l.amount;
  return s;
};
const line = (e: JournalEntry[], month: number, acct: number) =>
  e.find((x) => x.month === month)?.lineEntries.find((l) => l.account === acct)?.amount ?? 0;
const months = (e: JournalEntry[], acct: number) =>
  e.filter((x) => x.lineEntries.some((l) => l.account === acct)).map((x) => x.month);
const lastMonth = (e: JournalEntry[]) => (e.length ? e[e.length - 1].month : -1);

/** Every entry balanced, whole dollars, months strictly increasing, no zero lines. */
function wellFormed(name: string, e: JournalEntry[]) {
  let prev = -1;
  for (const je of e) {
    let sum = 0;
    for (const l of je.lineEntries) {
      sum += l.amount;
      if (!Number.isInteger(l.amount) || l.amount === 0) { check(false, `${name}: bad line ${JSON.stringify(l)} in month ${je.month}`); return; }
    }
    if (sum !== 0 || je.month <= prev) { check(false, `${name}: month ${je.month} unbalanced or out of order`); return; }
    prev = je.month;
  }
  check(true, `${name}: well formed`);
}

/**
 * Drift-free rule: for a single stream on an account, the posted running total after
 * every month must equal round(exact running total). `exact(m)` = that month's exact amount.
 */
function driftFree(name: string, e: JournalEntry[], acct: number, from: number, to: number, exact: (m: number) => number) {
  let cum = 0, bad = 0;
  for (let m = from; m <= to; m++) {
    cum += exact(m);
    if (bal(e, acct, m) !== roundDollar(cum)) bad++;
  }
  check(bad === 0, `${name}: acct ${acct} running total = round(exact) every month (${bad} misses)`);
}

/** Independent whole-dollar amortization (the loan rules, written from the spec). */
function amortize(balance: number, monthlyRate: number, payment: number, startMonth: number, lastM: number) {
  let b = balance;
  const rows: Array<{ m: number; interest: number; pay: number; after: number }> = [];
  for (let m = startMonth; m <= lastM && b > 0; m++) {
    const interest = roundDollar(b * monthlyRate);
    const pay = Math.min(payment, b + interest);
    b = b + interest - pay;
    rows.push({ m, interest, pay, after: b });
  }
  return rows;
}

// ═════════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════════
test('roundDollar', () => {
  const cases: Array<[number, number]> = [[0, 0], [0.49, 0], [0.5, 1], [1.5, 2], [2.5, 3], [-0.5, -1], [-2.5, -3], [-0.49, 0], [1234.4999, 1234], [99.99999999, 100]];
  for (const [x, want] of cases) check(roundDollar(x) === want, `roundDollar(${x}) = ${want} (got ${roundDollar(x)})`);
  check(Object.is(roundDollar(-0.2), 0), 'no −0');
});

test('ages and months', () => {
  const c = ctx(25, 3);
  check(toMonth(age(25, 3), c) === 0, 'same age → month 0');
  check(toMonth(age(26, 3), c) === 12, '+1 year → 12');
  check(toMonth(age(25, 0), c) === -3, 'earlier → negative');
  check(toMonth(age(30, 11), c) === 68, '30y11m from 25y3m → 68');
  for (const bad of [{ years: 30.5, months: 0 }, { years: 30, months: 12 }, { years: 30, months: -1 }, { years: -1, months: 0 }, { years: 30 }, null])
    check(throws(() => checkAge(bad as Age)), `invalid age ${JSON.stringify(bad)} throws`);
  check(!throws(() => checkAge(age(0, 0))) && !throws(() => checkAge(age(100, 11))), 'valid ages pass');
});

test('recurring window', () => {
  const c = ctx(30, 0, 960);
  const w = (s?: Age | null, e?: Age | null) => recurringWindow(c, s, e);
  check(JSON.stringify(w()) === '{"first":1,"last":960}', 'no ages → 1..960');
  check(JSON.stringify(w(age(31), age(32))) === '{"first":13,"last":24}', '31→32 posts 13..24 (12 months)');
  check(JSON.stringify(w(age(25), age(31))) === '{"first":1,"last":12}', 'start in past → starts at 1');
  check(w(age(31), age(31)).last < w(age(31), age(31)).first, 'start = end → empty');
  check(w(age(35), age(33)).last < w(age(35), age(33)).first, 'end before start → empty');
  check(w(age(20), age(25)).last < w(age(20), age(25)).first, 'entirely in the past → empty');
  check(w(null, age(200)).last === 960, 'end past the horizon → clamped to endMonth');
  check(recurringWindow(ctx(30, 0, 100), null, null).last === 100, 'custom endMonth');
});

// ═════════════════════════════════════════════════════════════════════════════
// Loan math (textbook values)
// ═════════════════════════════════════════════════════════════════════════════
test('paymentFor textbook values', () => {
  const cases: Array<[number, number, number, number]> = [
    [200_000, 6, 360, 1199.10], [240_000, 6.5, 360, 1516.96], [24_000, 6, 60, 463.99],
    [30_000, 5, 120, 318.20], [300_000, 7, 180, 2696.48], [10_000, 12, 12, 888.49],
  ];
  for (const [P, rate, n, want] of cases)
    check(approx(paymentFor(P, rate / 1200, n), want, 0.01), `payment ${P} @ ${rate}% × ${n} = ${want} (got ${paymentFor(P, rate / 1200, n).toFixed(2)})`);
  check(paymentFor(12_000, 0, 48) === 250, '0% → principal / n');
  check(paymentFor(0, 0.005, 60) === 0 && paymentFor(-5, 0.005, 60) === 0, 'no principal → 0');
  check(paymentFor(1_000, 0.01, 0) === 1_000, 'n ≤ 0 → pay it all');
});

test('monthsPaidFromBalance', () => {
  for (const [P0, rate, n] of [[240_000, 6.5, 360], [30_000, 7, 72], [100_000, 3, 180], [50_000, 0, 120]] as Array<[number, number, number]>) {
    const r = rate / 1200, pmt = paymentFor(P0, r, n);
    for (const k of [0, 1, 12, 59, n / 2, n - 1]) {
      const B = r === 0 ? P0 - pmt * k : P0 * Math.pow(1 + r, k) - (pmt * (Math.pow(1 + r, k) - 1)) / r;
      check(monthsPaidFromBalance(P0, r, n, B) === k, `${P0}@${rate}%/${n}: balance after ${k} → ${k} (got ${monthsPaidFromBalance(P0, r, n, B)})`);
    }
    check(monthsPaidFromBalance(P0, r, n, P0 * 2) === 0, 'balance above original → 0 paid');
    check(monthsPaidFromBalance(P0, r, n, 0) === n, 'zero balance → fully paid');
  }
});

test('solveLoan (any 3 of 4)', () => {
  const combos: Array<[number, number, number]> = [[25_000, 5.5, 120], [8_000, 18, 36], [150_000, 3.25, 240], [5_000, 0, 50]];
  for (const [B, rate, n] of combos) {
    const p = solveLoan({ balance: B, ratePct: rate, termMonths: n }).payment;
    check(approx(p, paymentFor(B, rate / 1200, n), 1e-9), `solve payment ${B}/${rate}/${n}`);
    check(approx(solveLoan({ ratePct: rate, termMonths: n, payment: p }).balance, B, 0.01), `solve balance ${B}`);
    check(solveLoan({ balance: B, ratePct: rate, payment: p }).termMonths === n, `solve term ${n}`);
    check(approx(solveLoan({ balance: B, termMonths: n, payment: p }).ratePct, rate, 1e-6), `solve rate ${rate}`);
  }
  check(solveLoan({ balance: 10_000, ratePct: 24, payment: 200 }).termMonths === Infinity, 'payment = interest → never paid off');
  check(solveLoan({ balance: 10_000, termMonths: 10, payment: 900 }).ratePct === 0, 'payments ≤ balance → rate 0');
  check(throws(() => solveLoan({ balance: 1, ratePct: 1 })), 'only 2 of 4 throws');
});

// ═════════════════════════════════════════════════════════════════════════════
// Presets (the SE averages are computed correctly)
// ═════════════════════════════════════════════════════════════════════════════
test('preset averages', () => {
  check(approx(HOME.propertyTaxPct, 7.33 / 12, 1e-9), `property tax avg = 0.6108% (got ${HOME.propertyTaxPct})`);
  check(approx(VEHICLE.insuranceMonthly, 2233 / 12, 1e-9), `car insurance avg = 186.08 (got ${VEHICLE.insuranceMonthly})`);
  check(approx(GAS.pricePerGallon, 49.415 / 12, 1e-9), `gas avg = 4.1179 (got ${GAS.pricePerGallon})`);
  check(approx(HOME_INS_SE_CURVE[0], 32_718 / 12, 1e-9) && approx(HOME_INS_SE_CURVE[4], 112_492 / 12, 1e-9), 'home insurance curve ends');
  check(SE_STATES.length === 12 && Object.keys(PROPERTY_TAX_PCT).length === 12 && Object.keys(CAR_INS_FULL_MONTHLY).length === 12 && Object.keys(GAS_PRICE).length === 12, '12 states everywhere');
  check(approx(HEALTH_PREMIUM_MONTHLY.employerIndividual, 120, 1e-9) && HEALTH_PREMIUM_MONTHLY.none === 0, 'health presets');
});

test('home insurance curve', () => {
  check(homeInsuranceAnnual(0) === 0 && homeInsuranceAnnual(-5) === 0, '$0 home → $0');
  check(approx(homeInsuranceAnnual(100_000), 2726.5 / 2, 1e-9), 'below first point: proportional (100k → 1363.25)');
  check(approx(homeInsuranceAnnual(250_000), (2726.5 + 43_708 / 12) / 2, 1e-9), 'midpoint 200k–300k interpolates');
  check(approx(homeInsuranceAnnual(2_000_000), (112_492 / 12) * 2, 1e-9), 'above last point: proportional (2M → 18,748.67)');
  let prev = 0, mono = true;
  for (let v = 10_000; v <= 3_000_000; v += 10_000) { const x = homeInsuranceAnnual(v); if (x < prev) mono = false; prev = x; }
  check(mono, 'never decreases as value rises');
});

// ═════════════════════════════════════════════════════════════════════════════
// Taxes (independent hand calculations)
// ═════════════════════════════════════════════════════════════════════════════
test('bracketTax', () => {
  const b = FEDERAL.brackets.single;
  check(bracketTax(0, b) === 0 && bracketTax(-10, b) === 0, 'no income → 0');
  check(approx(bracketTax(12_400, b), 1_240, 1e-9), 'top of 10% bracket');
  check(approx(bracketTax(12_401, b), 1_240.12, 1e-9), '$1 into 12%');
  check(approx(bracketTax(1_000_000, b), 1240 + 4560 + 12166 + 23058 + 17424 + 134_531.25 + 0.37 * (1_000_000 - 640_600), 1e-6), '$1M single');
});

test('federal + 12-state tax, $60k single (full hand calc)', () => {
  // Federal: taxable 60,000 − 16,100 = 43,900 → 1,240 + 31,500 × 12% = 5,020
  // States (AGI 60,000): AL 2,551 · AR 1,732.41 · FL 0 · GA 2,245.50 · KY 2,540.40 · LA 1,413.75
  //   MS 1,668 · NC 1,885.275 · SC 2,160 · TN 0 · VA 2,635.90 · WV 1,866.10 → avg 1,724.86125
  const t = computeAnnualTaxes(60_000, 0, 'single');
  check(approx(t.federal, 5_020, 1e-6), `federal 5,020 (got ${t.federal})`);
  check(approx(t.state, 20_698.335 / 12, 1e-6), `state avg 1,724.86 (got ${t.state})`);
  check(approx(t.incomeTax, 5_020 + 20_698.335 / 12, 1e-6), 'income tax = federal + state');
  check(approx(t.fica, 4_590, 1e-6), 'FICA 7.65% = 4,590');
});

test('federal married, FICA limits, 401k, override', () => {
  const m = computeAnnualTaxes(120_000, 0, 'married');
  check(approx(m.federal, 2_480 + 63_000 * 0.12, 1e-6), `married $120k federal = 10,040 (got ${m.federal})`);
  const hi = computeAnnualTaxes(250_000, 0, 'single');
  check(approx(hi.fica, 184_500 * 0.062 + 250_000 * 0.0145 + 50_000 * 0.009, 1e-6), `FICA wage base + 0.9% over 200k = 15,514 (got ${hi.fica})`);
  const hiM = computeAnnualTaxes(250_000, 0, 'married');
  check(approx(hiM.fica, 184_500 * 0.062 + 250_000 * 0.0145, 1e-6), 'married: no extra Medicare under 250k');
  const k = computeAnnualTaxes(300_000, 24_500, 'single');
  check(approx(k.federal, 1240 + 4560 + 12166 + 23058 + 17424 + 3175 * 0.35, 1e-6), `401k lowers federal: 59,559.25 (got ${k.federal})`);
  check(approx(k.fica, computeAnnualTaxes(300_000, 0, 'single').fica, 1e-9), '401k does NOT lower FICA');
  const o = computeAnnualTaxes(80_000, 5_000, 'single', 20);
  check(o.incomeTax === 15_000 && Number.isNaN(o.federal), 'override 20% × (80k − 5k) = 15,000');
  check(computeAnnualTaxes(80_000, 0, 'single', 0).incomeTax === 0, 'override 0% is honored (not treated as missing)');
  check(computeAnnualTaxes(0, 0, 'single').incomeTax === 0 && computeAnnualTaxes(0, 0, 'single').fica === 0, 'no wages → no tax');
  check(computeAnnualTaxes(10_000, 0, 'single').federal === 0, 'under the standard deduction → no federal');
});

test('401k limits by age', () => {
  const want: Array<[number, number]> = [[25, 24_500], [49, 24_500], [50, 32_500], [59, 32_500], [60, 35_750], [63, 35_750], [64, 32_500], [80, 32_500]];
  for (const [a, lim] of want) check(retirementLimitForAge(a) === lim, `age ${a} → ${lim}`);
  check(RETIREMENT_LIMIT.base === 24_500, 'base preset');
});

// ═════════════════════════════════════════════════════════════════════════════
// Engines: opening cash, recurring expenses
// ═════════════════════════════════════════════════════════════════════════════
test('opening cash', () => {
  const e = ENGINES.openingCash({ amount: 12_345.5 }, ctx());
  wellFormed('openingCash', e);
  check(e.length === 1 && e[0].month === 0 && line(e, 0, ACCT.CASH) === 12_346 && line(e, 0, ACCT.EQUITY) === -12_346, 'Dr cash / Cr equity, rounded');
  check(ENGINES.openingCash({ amount: 0 }, ctx()).length === 0, '$0 → nothing');
});

test('renting', () => {
  const c = ctx(30, 0);
  const e = ENGINES.renting({ rentMonthly: 1_433.33, junkFeesMonthly: 41.5, utilitiesMonthly: 187.25, startAge: age(31), endAge: age(35, 6) }, c);
  wellFormed('renting', e);
  check(e[0].month === 13 && lastMonth(e) === 66 && e.length === 54, 'posts 13..66 (54 months)');
  driftFree('renting', e, ACCT.RENTERS_INSURANCE, 13, 66, () => HOME.renterInsuranceMonthly);
  check(approx(bal(e, ACCT.RENT), (1_433.33 + 41.5) * 54, 1), 'rent + junk fees (two streams, ±$1)');
  check(approx(bal(e, ACCT.HOME_UTILITIES_MAINTENANCE), 187.25 * 54, 0.5), 'utilities');
  check(bal(e, ACCT.CASH) === -(bal(e, ACCT.RENT) + bal(e, ACCT.RENTERS_INSURANCE) + bal(e, ACCT.HOME_UTILITIES_MAINTENANCE)), 'cash pays it all');
  check(months(e, ACCT.HOME_UTILITIES_MAINTENANCE).length === 54, 'utilities every month');
  const noUtil = ENGINES.renting({ rentMonthly: 1_000, endAge: age(31) }, c);
  check(months(noUtil, ACCT.HOME_UTILITIES_MAINTENANCE).length === 0 && noUtil.length === 12, 'no utilities given → none posted');
});

test('gas', () => {
  const c = ctx();
  const e = ENGINES.gas({ milesPerWeek: 250, mpg: 25, endAge: age(40) }, c);
  wellFormed('gas', e);
  const monthly = (250 * 52) / 12 / 25 * GAS.pricePerGallon; // ≈ $178.44
  check(approx(monthly, 178.44, 0.01), `≈ $178.44/mo (got ${monthly.toFixed(2)})`);
  driftFree('gas', e, ACCT.GAS, 1, 120, () => monthly);
  const own = ENGINES.gas({ milesPerWeek: 100, mpg: 20, gasPricePerGallon: 3, endAge: age(31) }, c);
  check(bal(own, ACCT.GAS) === 780, 'price override: 100 mi × 52 ÷ 20 mpg × $3 = $780/yr');
  check(throws(() => ENGINES.gas({ milesPerWeek: 100, mpg: 0 }, c)), 'mpg 0 throws');
  check(ENGINES.gas({ milesPerWeek: 0, mpg: 30 }, c).length === 0, '0 miles → nothing');
});

test('food, personal, gifts, recurring, health', () => {
  const c = ctx();
  const f = ENGINES.food({ diningOutMonthly: 150.4, groceriesMonthly: 433.33, endAge: age(31) }, c);
  wellFormed('food', f);
  check(approx(bal(f, ACCT.FOOD), (150.4 + 433.33) * 12, 1) && f.length === 12, 'food 12 months, both streams');

  const p = ENGINES.personal({ clothing: 50, otherPersonalCare: 20, entertainment: 100, gym: 40, phonePlan: 65, books: 10, courses: 30, events: 25, endAge: age(32) }, c);
  wellFormed('personal', p);
  check(bal(p, ACCT.PERSONAL) === 340 * 24, 'all 8 personal fields summed');

  const g = ENGINES.birthdayChristmas({ amount: 1_000, frequency: 'yearly', endAge: age(33) }, c);
  driftFree('gifts yearly', g, ACCT.BIRTHDAY_CHRISTMAS, 1, 36, () => 1_000 / 12);
  check(bal(g, ACCT.BIRTHDAY_CHRISTMAS, 12) === 1_000 && bal(g, ACCT.BIRTHDAY_CHRISTMAS) === 3_000, 'yearly $1,000 → exactly $1,000 per 12 months');
  const gm = ENGINES.birthdayChristmas({ amount: 90, frequency: 'monthly', endAge: age(31) }, c);
  check(bal(gm, ACCT.BIRTHDAY_CHRISTMAS) === 1_080, 'monthly frequency');

  const r = ENGINES.recurringPayment({ amount: 139, frequency: 'yearly', startAge: age(35), endAge: age(45) }, c);
  wellFormed('recurring', r);
  check(r[0].month === 61 && lastMonth(r) === 180 && bal(r, ACCT.RECURRING) === 1_390, '$139/yr for 10 yrs = $1,390, months 61..180');

  for (const type of Object.keys(HEALTH_PREMIUM_MONTHLY) as Array<keyof typeof HEALTH_PREMIUM_MONTHLY>) {
    const h = ENGINES.healthInsurance({ type, startAge: age(30), endAge: age(35) }, c);
    wellFormed(`health ${type}`, h);
    if (HEALTH_PREMIUM_MONTHLY[type] > 0) driftFree(`health ${type}`, h, ACCT.HEALTH_INSURANCE, 1, 60, () => HEALTH_PREMIUM_MONTHLY[type]);
    else check(h.length === 0, 'none → no entries');
  }
  const ho = ENGINES.healthInsurance({ type: 'marketplaceIndividual', monthlyPremiumOverride: 210, endAge: age(31) }, c);
  check(bal(ho, ACCT.HEALTH_INSURANCE) === 2_520, 'premium override replaces preset');
  const h0 = ENGINES.healthInsurance({ type: 'employerFamily', monthlyPremiumOverride: 0, endAge: age(31) }, c);
  check(h0.length === 0, 'override $0 is honored');
});

test('kid', () => {
  const c = ctx(28, 5);
  const e = ENGINES.kid({ annualCost: 14_000, birthAge: age(30, 2) }, c);
  wellFormed('kid', e);
  const b = toMonth(age(30, 2), c); // 21
  check(e[0].month === b + 1 && lastMonth(e) === b + 12 * KIDS.endAge && e.length === 240, `posts ${b + 1}..${b + 240}`);
  driftFree('kid', e, ACCT.KIDS, b + 1, b + 240, () => 14_000 / 12);
  check(bal(e, ACCT.KIDS) === 280_000, '$14k × 20 = $280k');
  const teen = ENGINES.kid({ annualCost: 12_000, birthAge: age(13, 5) }, c); // 15 years old now
  check(teen.length === 60 && bal(teen, ACCT.KIDS) === 60_000, 'already 15 → 5 years left');
  check(ENGINES.kid({ annualCost: 12_000, birthAge: age(5) }, c).length === 0, 'kid already 23 → nothing');
});

test('pet', () => {
  const c = ctx(30);
  const e = ENGINES.pet({ startAge: age(32), lifespanYears: 10.5, vetPerYear: 700, foodPerMonth: 60, adoptionCost: 350 }, c);
  wellFormed('pet', e);
  check(line(e, 24, ACCT.PETS) === 350 && line(e, 24, ACCT.CASH) === -350, 'adoption at month 24');
  check(e[1].month === 25 && lastMonth(e) === 24 + 126 && e.length === 1 + 126, 'care 25..150 (10.5 years)');
  check(bal(e, ACCT.PETS) === 350 + 126 * 60 + 700 * 10.5, 'adoption + food + vet');
  const zero = ENGINES.pet({ startAge: age(30), lifespanYears: 5, vetPerYear: 0, foodPerMonth: 0, adoptionCost: 0 }, c);
  check(zero.length === 0, 'all-zero pet → nothing');
});

test('one-time expense', () => {
  const c = ctx(30, 6);
  check(ENGINES.oneTimeExpense({ age: age(30, 6), amount: 500 }, c)[0].month === 0, 'at start → month 0');
  const e = ENGINES.oneTimeExpense({ age: age(45, 1), amount: 9_999.5 }, c);
  check(e.length === 1 && e[0].month === 175 && line(e, 175, ACCT.ONE_TIME) === 10_000, 'posts once at 175, rounded');
  check(ENGINES.oneTimeExpense({ age: age(30, 5), amount: 500 }, c).length === 0, 'past → nothing');
  check(ENGINES.oneTimeExpense({ age: age(200), amount: 500 }, c).length === 0, 'after the horizon → nothing');
});

// ═════════════════════════════════════════════════════════════════════════════
// Income
// ═════════════════════════════════════════════════════════════════════════════
test('income: $60k single, one year, exact', () => {
  const e = ENGINES.income({ salary: 60_000, raisePct: 0, filingStatus: 'single', endAge: age(31) }, ctx(30));
  wellFormed('income60', e);
  check(e.length === 12 && e[0].month === 1 && lastMonth(e) === 12, 'months 1..12');
  check(e.every((x) => line(e, x.month, ACCT.EARNED_INCOME) === -5_000), '$5,000 gross every month');
  const tax = 5_020 + 20_698.335 / 12;
  driftFree('income tax', e, ACCT.INCOME_TAX, 1, 12, () => tax / 12);
  driftFree('fica', e, ACCT.OTHER_TAXES, 1, 12, () => 4_590 / 12);
  check(bal(e, ACCT.INCOME_TAX) === 6_745 && bal(e, ACCT.OTHER_TAXES) === 4_590, 'year totals 6,745 + 4,590');
  check(bal(e, ACCT.CASH) === 60_000 - 6_745 - 4_590, 'take-home 48,665');
});

test('income: raises, charity, 401k growth', () => {
  const c = ctx(30);
  const e = ENGINES.income({
    salary: 100_000, raisePct: 3, filingStatus: 'married', charityPct: 5, retirementContributionPct: 10,
    retirementAccount: 3, retirementReturnPct: 6, endAge: age(33),
  }, c);
  wellFormed('incomeFull', e);
  const g = [100_000, 103_000, 106_090];
  check(bal(e, ACCT.EARNED_INCOME, 12) === -g[0] && bal(e, ACCT.EARNED_INCOME, 24) === -(g[0] + g[1]) && bal(e, ACCT.EARNED_INCOME, 36) === -(g[0] + g[1] + g[2]), '3% raise each year');
  const t = g.map((x) => computeAnnualTaxes(x, x * 0.1, 'married'));
  check(bal(e, ACCT.INCOME_TAX, 24) === roundDollar(t[0].incomeTax + t[1].incomeTax), 'year-2 tax recomputed on the raise');
  check(bal(e, ACCT.CHARITY, 36) === roundDollar(0.05 * (g[0] + g[1] + g[2])), 'charity 5% of gross');
  // 401k: deposits (drift-free) then grown by an independent loop, grow-then-deposit
  const f = Math.pow(1.06, 1 / 12);
  let exact = 0, depCum = 0, depPosted = 0;
  const want = new Map<number, number>();
  for (let m = 1; m <= 960; m++) {
    exact *= f;
    if (m <= 36) {
      depCum += (g[Math.floor((m - 1) / 12)] * 0.1) / 12;
      const dep = roundDollar(depCum) - depPosted;
      depPosted += dep;
      exact += dep;
    }
    want.set(m, roundDollar(exact));
  }
  let bad = 0;
  for (const m of [1, 2, 12, 13, 36, 37, 120, 500, 960]) if (bal(e, 3, m) !== want.get(m)) bad++;
  check(bad === 0, `401k balance matches independent grow-then-deposit loop (${bad} misses; 960: ${bal(e, 3)} vs ${want.get(960)})`);
  check(lastMonth(e) === 960, '401k keeps growing to the horizon after the job ends');
  check(bal(e, 3) === -bal(e, ACCT.INVESTMENT_GAINS) + depPosted, '401k = deposits + gains');
  const cash = bal(e, ACCT.CASH);
  check(cash === -(bal(e, ACCT.EARNED_INCOME) + bal(e, ACCT.INCOME_TAX) + bal(e, ACCT.OTHER_TAXES) + bal(e, ACCT.CHARITY)) - depPosted, 'cash = gross − taxes − charity − 401k');
});

test('income: 401k caps and catch-up by age', () => {
  const e = ENGINES.income({ salary: 400_000, raisePct: 0, filingStatus: 'single', retirementContributionPct: 20, retirementAccount: 3, retirementReturnPct: 0, endAge: age(52, 6) }, ctx(49, 6));
  // year 1 (age 49) cap 24,500; year 2 (turns 50) 32,500; year 3 32,500 (to 52y6m = 36 months)
  check(bal(e, 3, 12) === 24_500 && bal(e, 3, 24) === 24_500 + 32_500 && bal(e, 3, 36) === 24_500 + 65_000, 'cap 24,500 → 32,500 at 50 (0% return)');
  const e60 = ENGINES.income({ salary: 400_000, raisePct: 0, filingStatus: 'single', retirementContributionPct: 20, retirementAccount: 3, retirementReturnPct: 0, endAge: age(61) }, ctx(60));
  check(bal(e60, 3) === 35_750, 'age 60 super catch-up 35,750');
  const t = computeAnnualTaxes(400_000, 24_500, 'single');
  check(bal(e, ACCT.INCOME_TAX, 12) === roundDollar(t.incomeTax), 'tax uses the capped 401k');
});

test('income: windows and override', () => {
  const c = ctx(30);
  const e = ENGINES.income({ salary: 50_000, raisePct: 10, filingStatus: 'single', startAge: age(35), endAge: age(37) }, c);
  check(e[0].month === 61 && lastMonth(e) === 84 && e.length === 24, 'job from 35 to 37 → months 61..84');
  check(bal(e, ACCT.EARNED_INCOME) === -(50_000 + 55_000), 'raise counts from the job start');
  const o = ENGINES.income({ salary: 80_000, raisePct: 0, filingStatus: 'single', incomeTaxRatePct: 25, endAge: age(31) }, c);
  check(bal(o, ACCT.INCOME_TAX) === 20_000, 'override 25% → $20,000');
  const past = ENGINES.income({ salary: 50_000, raisePct: 0, filingStatus: 'single', startAge: age(20), endAge: age(29) }, c);
  check(past.length === 0, 'job that already ended → nothing');
});

// ═════════════════════════════════════════════════════════════════════════════
// Homes (independent reference simulation)
// ═════════════════════════════════════════════════════════════════════════════
type HomeRef = { value: Map<number, number>; loan: ReturnType<typeof amortize>; costs: Map<number, number[]> };
/** From-scratch model of a home: value, loan and the 4 monthly cost streams. */
function homeRef(open: number, valueExact0: number, loan: number, rate: number, payment: number, hold: number, util: number): HomeRef {
  const f = Math.pow(1 + HOME.appreciationRealPct / 100, 1 / 12);
  const value = new Map<number, number>();
  const costs = new Map<number, number[]>();
  for (let m = open; m <= hold; m++) value.set(m, Math.max(0, roundDollar(valueExact0 * Math.pow(f, m - open))));
  for (let m = open + 1; m <= hold; m++) {
    const v = value.get(m - 1)!; // value at the START of the month
    costs.set(m, [(v * HOME.propertyTaxPct) / 100 / 12, homeInsuranceAnnual(v) / 12, (v * HOME.maintenancePct) / 100 / 12, util]);
  }
  return { value, loan: amortize(loan, rate, payment, open + 1, hold), costs };
}

test('buying a home vs reference model (with sale)', () => {
  const c = ctx(28);
  const e = ENGINES.buyingHome({
    purchaseAge: age(30), totalPropertyValue: 350_000, downPaymentPct: 15, mortgageTermYears: 30,
    interestRatePct: 6.75, utilitiesMonthly: 380, sellAge: age(45, 6),
  }, c);
  wellFormed('buyingHome', e);
  const open = 24, sell = 24 + 186;
  const loan = 297_500, r = 0.0675 / 12, pmt = Math.ceil(paymentFor(loan, r, 360) - 1e-9);
  check(pmt === 1_930, `payment = ceil(1,929.60) = 1,930 (got ${pmt})`);
  const ref = homeRef(open, 350_000, loan, r, pmt, sell, 380);

  check(line(e, open, ACCT.PROPERTY) === 350_000 && line(e, open, ACCT.MORTGAGE) === -297_500 && line(e, open, ACCT.CASH) === -52_500, 'purchase: value / loan / down payment');
  let vBad = 0, lBad = 0, iBad = 0;
  for (let m = open; m < sell; m++) if (bal(e, ACCT.PROPERTY, m) !== ref.value.get(m)) vBad++;
  for (const row of ref.loan) {
    if (bal(e, ACCT.MORTGAGE, row.m) !== -row.after && row.m < sell) lBad++;
    if (line(e, row.m, ACCT.MORTGAGE_INTEREST) !== row.interest) iBad++;
  }
  check(vBad === 0, `home value = round(350k × 1.01^(t/12)) every month (${vBad} misses)`);
  check(lBad === 0 && iBad === 0, `mortgage matches independent amortization (${lBad} balance, ${iBad} interest misses)`);
  let cum = [0, 0, 0, 0], bad = 0;
  for (let m = open + 1; m <= sell; m++) {
    const x = ref.costs.get(m)!;
    cum = cum.map((s, i) => s + x[i]);
    if (bal(e, ACCT.PROPERTY_TAX, m) !== roundDollar(cum[0])) bad++;
    if (bal(e, ACCT.HOME_INSURANCE, m) !== roundDollar(cum[1])) bad++;
    if (Math.abs(bal(e, ACCT.HOME_UTILITIES_MAINTENANCE, m) - (cum[2] + cum[3])) > 1) bad++;
  }
  check(bad === 0, `property tax / insurance / maintenance+utilities follow the value (${bad} misses)`);
  // Sale: book value in, loan paid off from proceeds, nothing afterward
  const book = ref.value.get(sell)!;
  const owed = ref.loan.find((x) => x.m === sell)!.after;
  check(bal(e, ACCT.PROPERTY) === 0 && bal(e, ACCT.MORTGAGE) === 0 && lastMonth(e) === sell, 'sold: house and mortgage cleared, nothing after');
  check(bal(e, ACCT.APPRECIATION) === -(book - 350_000), 'appreciation credited = book − price');
  const paid = ref.loan.filter((x) => x.m <= sell).reduce((s, x) => s + x.pay, 0);
  const costs = bal(e, ACCT.PROPERTY_TAX) + bal(e, ACCT.HOME_INSURANCE) + bal(e, ACCT.HOME_UTILITIES_MAINTENANCE);
  check(bal(e, ACCT.CASH) === -52_500 - paid - costs + book - owed, 'cash = −down − payments − costs + sale − payoff');
});

test('buying a home: textbook 30-year mortgage totals', () => {
  const e = ENGINES.buyingHome({ purchaseAge: age(30), totalPropertyValue: 300_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6.5 }, ctx(30));
  const pays = months(e, ACCT.MORTGAGE_INTEREST);
  check(pays[0] === 1 && pays.length === 360, `360 payments starting month 1 (got ${pays.length})`);
  const textbookInterest = paymentFor(240_000, 0.065 / 12, 360) * 360 - 240_000; // ≈ 306,106
  check(approx(bal(e, ACCT.MORTGAGE_INTEREST), textbookInterest, 300), `total interest ≈ ${textbookInterest.toFixed(0)} (got ${bal(e, ACCT.MORTGAGE_INTEREST)})`);
  const r = 0.065 / 12, p = paymentFor(240_000, r, 360);
  const B60 = 240_000 * Math.pow(1 + r, 60) - (p * (Math.pow(1 + r, 60) - 1)) / r;
  check(approx(-bal(e, ACCT.MORTGAGE, 60), B60, 10), `balance after 5 yrs ≈ ${B60.toFixed(0)} (got ${-bal(e, ACCT.MORTGAGE, 60)})`);
  check(bal(e, ACCT.MORTGAGE, 360) === 0 && bal(e, ACCT.MORTGAGE) === 0, 'paid off at month 360');
  check(approx(bal(e, ACCT.PROPERTY), 300_000 * Math.pow(1.01, 80), 1), 'value grows 1%/yr real for 80 yrs');
  const cash = ENGINES.buyingHome({ purchaseAge: age(30), totalPropertyValue: 300_000, downPaymentPct: 100, mortgageTermYears: 30, interestRatePct: 6.5 }, ctx(30));
  check(months(cash, ACCT.MORTGAGE).length === 0 && line(cash, 0, ACCT.CASH) === -300_000, 'cash purchase: no mortgage');
  const zero = ENGINES.buyingHome({ purchaseAge: age(30), totalPropertyValue: 120_000, downPaymentPct: 0, mortgageTermYears: 10, interestRatePct: 0 }, ctx(30));
  check(line(zero, 1, ACCT.MORTGAGE) === 1_000 && months(zero, ACCT.MORTGAGE_INTEREST).length === 0 && bal(zero, ACCT.MORTGAGE) === 0, '0% loan: $1,000 × 120, no interest');
});

test('existing home vs reference model', () => {
  const c = ctx(40);
  const P0 = 320_000, r = 0.0425 / 12, pOrig = paymentFor(P0, r, 360);
  const B = roundDollar(P0 * Math.pow(1 + r, 84) - (pOrig * (Math.pow(1 + r, 84) - 1)) / r); // 7 years in
  const e = ENGINES.existingHome({ totalPropertyValue: 400_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 4.25, remainingBalance: B }, c);
  wellFormed('existingHome', e);
  const v0 = 400_000 * Math.pow(1.01, 7);
  const pmt = Math.ceil(paymentFor(B, r, 276) - 1e-9);
  check(approx(pmt, pOrig, 1), `rebuilt payment ≈ original ${pOrig.toFixed(2)} (got ${pmt})`);
  const ref = homeRef(0, v0, B, r, pmt, 960, HOME.utilitiesMonthly);
  check(line(e, 0, ACCT.PROPERTY) === roundDollar(v0) && line(e, 0, ACCT.MORTGAGE) === -B && line(e, 0, ACCT.EQUITY) === -(roundDollar(v0) - B), 'opening vs equity (value grown 7 yrs)');
  check(line(e, 0, ACCT.CASH) === 0, 'no cash at opening');
  let bad = 0;
  for (const row of ref.loan) if (bal(e, ACCT.MORTGAGE, row.m) !== -row.after) bad++;
  check(bad === 0 && ref.loan.length >= 275 && ref.loan.length <= 276, `276 payments left, matches amortization (${bad} misses, ${ref.loan.length} rows)`);
  for (const m of [1, 100, 500, 960]) check(bal(e, ACCT.PROPERTY, m) === ref.value.get(m), `value at month ${m}`);
  let cum = 0;
  for (let m = 1; m <= 960; m++) cum += ref.costs.get(m)![0];
  check(bal(e, ACCT.PROPERTY_TAX) === roundDollar(cum), 'property tax over 80 years');

  // Paid off, bought at 25: grown 15 yrs; mortgage inputs irrelevant
  const paid = ENGINES.existingHome({ totalPropertyValue: 200_000, downPaymentPct: 20, mortgageTermYears: 15, interestRatePct: 4, remainingBalance: 0, purchaseAge: age(25) }, c);
  check(line(paid, 0, ACCT.PROPERTY) === roundDollar(200_000 * Math.pow(1.01, 15)) && months(paid, ACCT.MORTGAGE).length === 0, 'paid-off home: value grown by ownership time, no mortgage');
  // Paid off, no purchase age: assume it was paid on schedule (15 yrs owned)
  const paid2 = ENGINES.existingHome({ totalPropertyValue: 200_000, downPaymentPct: 20, mortgageTermYears: 15, interestRatePct: 4, remainingBalance: 0 }, c);
  check(line(paid2, 0, ACCT.PROPERTY) === roundDollar(200_000 * Math.pow(1.01, 15)), 'no purchase age → owned for the loan term');
});

// ═════════════════════════════════════════════════════════════════════════════
// Vehicles
// ═════════════════════════════════════════════════════════════════════════════
test('buying a car vs reference model', () => {
  const c = ctx(30);
  const e = ENGINES.buyingCar({
    purchaseAge: age(31), financing: 'loan', totalVehicleValue: 32_000, downPaymentPct: 10, loanTermMonths: 60,
    interestRatePct: 6.9, sellAge: age(39), insuranceMonthly: 160, maintenanceMonthly: 95.5,
  }, c);
  wellFormed('buyingCar', e);
  const open = 12, sell = 108, loan = 28_800, r = 0.069 / 12, pmt = Math.ceil(paymentFor(loan, r, 60) - 1e-9);
  check(pmt === 569, `payment ceil(568.92) = 569 (got ${pmt})`);
  check(line(e, open, ACCT.VEHICLES) === 32_000 && line(e, open, ACCT.VEHICLE_LOAN) === -28_800 && line(e, open, ACCT.CASH) === -3_200, 'purchase lines');
  const rows = amortize(loan, r, pmt, open + 1, sell);
  let bad = 0;
  for (const row of rows) if (bal(e, ACCT.VEHICLE_LOAN, row.m) !== -row.after || line(e, row.m, ACCT.VEHICLE_LOAN_INTEREST) !== row.interest) bad++;
  check(bad === 0 && rows.length === 60 && rows[59].after === 0, `60 payments match amortization (${bad} misses)`);
  const f = Math.pow(0.83, 1 / 12);
  let vBad = 0;
  for (let m = open; m < sell; m++) if (bal(e, ACCT.VEHICLES, m) !== roundDollar(32_000 * Math.pow(f, m - open))) vBad++;
  check(vBad === 0, `value = round(32k × 0.83^(t/12)) (${vBad} misses)`);
  const book = roundDollar(32_000 * Math.pow(0.83, 8));
  check(bal(e, ACCT.VEHICLES, sell - 1) === roundDollar(32_000 * Math.pow(f, sell - 1 - open)) && bal(e, ACCT.VEHICLES) === 0, 'sold at book value; asset cleared');
  const paid = rows.reduce((t, x) => t + x.pay, 0);
  check(bal(e, ACCT.CASH) === -3_200 - paid - bal(e, ACCT.CAR_INSURANCE) - bal(e, ACCT.VEHICLE_MAINTENANCE) + book, 'cash = −down − payments − running costs + sale');
  check(bal(e, ACCT.VEHICLE_DEPRECIATION) === 32_000 - book, `depreciation expense = 32,000 − ${book}`);
  check(bal(e, ACCT.CAR_INSURANCE) === 160 * 96 && approx(bal(e, ACCT.VEHICLE_MAINTENANCE), 95.5 * 96, 0.5), 'insurance + maintenance for 96 months');
  check(lastMonth(e) === sell && bal(e, ACCT.VEHICLE_LOAN) === 0, 'nothing after the sale');
  const full = ENGINES.buyingCar({ purchaseAge: age(30), financing: 'full', totalVehicleValue: 25_000, downPaymentPct: 50, loanTermMonths: 60, interestRatePct: 9 }, c);
  check(months(full, ACCT.VEHICLE_LOAN).length === 0 && line(full, 0, ACCT.CASH) === -25_000, 'full: loan fields ignored');
  check(approx(bal(full, ACCT.CAR_INSURANCE, 12), VEHICLE.insuranceMonthly * 12, 0.5) && bal(full, ACCT.VEHICLE_MAINTENANCE, 12) === VEHICLE.maintenanceMonthly * 12, 'presets when not given');
  const d = months(full, ACCT.VEHICLE_DEPRECIATION);
  check(d.every((m) => line(full, m, ACCT.VEHICLE_DEPRECIATION) > 0) && bal(full, ACCT.VEHICLES) >= 0, 'depreciation only ever an expense; value ≥ 0');
});

test('existing vehicle', () => {
  const c = ctx(35);
  const P0 = 27_000, r = 0.05 / 12, pOrig = paymentFor(P0, r, 72);
  const B = roundDollar(P0 * Math.pow(1 + r, 30) - (pOrig * (Math.pow(1 + r, 30) - 1)) / r);
  const e = ENGINES.existingVehicle({ financing: 'loan', totalVehicleValue: 30_000, downPaymentPct: 10, loanTermMonths: 72, interestRatePct: 5, remainingBalance: B }, c);
  wellFormed('existingVehicle', e);
  check(line(e, 0, ACCT.VEHICLES) === roundDollar(30_000 * Math.pow(0.83, 30 / 12)), 'value depreciated 30 months');
  check(months(e, ACCT.VEHICLE_LOAN_INTEREST).length === 42 && bal(e, ACCT.VEHICLE_LOAN) === 0, '42 payments left, paid off');
  const full = ENGINES.existingVehicle({ financing: 'full', totalVehicleValue: 18_000, purchaseAge: age(33, 6), sellAge: age(36) }, c);
  check(line(full, 0, ACCT.VEHICLES) === roundDollar(18_000 * Math.pow(0.83, 1.5)) && lastMonth(full) === 12 && bal(full, ACCT.VEHICLES) === 0, 'bought in full 18 months ago, sold in 1 year');
  check(bal(full, ACCT.CASH) === roundDollar(18_000 * Math.pow(0.83, 2.5)) - bal(full, ACCT.CAR_INSURANCE) - bal(full, ACCT.VEHICLE_MAINTENANCE), 'cash = sale − running costs');
  const now = ENGINES.existingVehicle({ financing: 'full', totalVehicleValue: 10_000, purchaseAge: age(20), sellAge: age(35) }, c);
  check(now.length === 1 && line(now, 0, ACCT.CASH) === roundDollar(10_000 * Math.pow(0.83, 15)), 'sold at month 0 → cash = book value now');
});

// ═════════════════════════════════════════════════════════════════════════════
// Debts
// ═════════════════════════════════════════════════════════════════════════════
test('credit card', () => {
  const c = ctx(30);
  const e = ENGINES.existingCreditCard({ currentBalance: 5_000, aprPct: 24, monthlyPayment: 200 }, c);
  wellFormed('creditCard', e);
  const rows = amortize(5_000, 0.02, 200, 1, 960);
  let bad = 0;
  for (const row of rows) if (bal(e, ACCT.CREDIT_CARD, row.m) !== -row.after || line(e, row.m, ACCT.CREDIT_CARD_INTEREST) !== row.interest) bad++;
  check(bad === 0, `matches amortization month by month (${bad} misses)`);
  check(approx(bal(e, ACCT.CREDIT_CARD_INTEREST), 200 * 35.0028 - 5_000, 5), `total interest ≈ $2,000.56 (got ${bal(e, ACCT.CREDIT_CARD_INTEREST)})`);
  check(line(e, 0, ACCT.EQUITY) === 5_000 && line(e, 0, ACCT.CREDIT_CARD) === -5_000, 'opening: Dr equity / Cr card');
  const late = ENGINES.existingCreditCard({ currentBalance: 1_000, aprPct: 12, monthlyPayment: 100, paymentStartAge: age(31) }, c);
  let owed = 1_000;
  for (let m = 1; m <= 12; m++) owed += roundDollar(owed * 0.01);
  check(-bal(late, ACCT.CREDIT_CARD, 12) === owed && approx(owed, 1_000 * Math.pow(1.01, 12), 2), `no payments for a year → compounds to ${owed}`);
  check(months(late, ACCT.CASH)[0] === 13, 'first payment month 13');
  const none = ENGINES.existingCreditCard({ currentBalance: 1_000, aprPct: 0, monthlyPayment: 0 }, ctx(30, 0, 24));
  check(bal(none, ACCT.CREDIT_CARD) === -1_000 && none.length === 1, '0% and no payment → sits at −1,000');
});

test('existing student + other loans', () => {
  const c = ctx(30);
  const s = ENGINES.existingStudentLoans({ remainingBalance: 30_000, interestRatePct: 5, remainingTermMonths: 120 }, c);
  const o = ENGINES.otherExistingLoan({ remainingBalance: 30_000, interestRatePct: 5, remainingTermMonths: 120 }, c);
  wellFormed('studentLoans', s);
  const pmt = Math.ceil(paymentFor(30_000, 0.05 / 12, 120) - 1e-9);
  const rows = amortize(30_000, 0.05 / 12, pmt, 1, 960);
  check(rows.length === 120 && bal(s, ACCT.STUDENT_LOANS, 120) === 0, `paid off in 120 months with $${pmt}/mo`);
  check(bal(s, ACCT.STUDENT_LOAN_INTEREST) === rows.reduce((t, x) => t + x.interest, 0), 'interest matches amortization');
  check(s.every((x, i) => x.month === o[i].month && line(s, x.month, ACCT.CASH) === line(o, x.month, ACCT.CASH)), 'student and other loans: same math, different accounts');
  check(months(o, ACCT.OTHER_DEBT_INTEREST).length === 120 && months(o, ACCT.STUDENT_LOANS).length === 0, 'other loan uses 23/92');
  const given = ENGINES.otherExistingLoan({ remainingBalance: 10_000, interestRatePct: 6, monthlyPayment: 250 }, c);
  const n = solveLoan({ balance: 10_000, ratePct: 6, payment: 250 }).termMonths;
  check(months(given, ACCT.CASH).length === n && bal(given, ACCT.OTHER_DEBT) === 0, `term solved: ${n} payments of $250`);
  const bal0 = ENGINES.existingStudentLoans({ interestRatePct: 4, remainingTermMonths: 60, monthlyPayment: 300 }, c);
  check(approx(-line(bal0, 0, ACCT.STUDENT_LOANS), solveLoan({ ratePct: 4, termMonths: 60, payment: 300 }).balance, 0.5), 'balance solved from the other three');
  const stub = -line(bal0, lastMonth(bal0), ACCT.CASH);
  check(months(bal0, ACCT.CASH).length === 61 && stub > 0 && stub < 10 && bal(bal0, ACCT.STUDENT_LOANS) === 0, `60 × $300 + a tiny rounding stub ($${stub})`);
});

test('education', () => {
  const c = ctx(18);
  const full = ENGINES.education({ paymentType: 'full', costPerSemester: 7_500, numberOfSemesters: 8, startAge: age(18, 8) }, c);
  check(full.map((x) => x.month).join() === '8,14,20,26,32,38,44,50' && bal(full, ACCT.EDUCATION) === 60_000, 'full: 8 semesters every 6 months');
  // Loan: simple interest on the amount borrowed while in school + grace, then amortize the total
  const s = 0, N = 4, cost = 5_000, r = 0.055 / 12;
  const e = ENGINES.education({ paymentType: 'loan', costPerSemester: cost, numberOfSemesters: N, startAge: age(18), loanRatePct: 5.5, loanTermYears: 10 }, c);
  wellFormed('educationLoan', e);
  const repay = s + N * 6 + 6 + 1; // 31
  let exactInt = 0;
  for (let m = 1; m < repay; m++) exactInt += cost * Math.min(N, Math.floor((m - 1) / 6) + 1) * r;
  check(bal(e, ACCT.STUDENT_LOAN_INTEREST, repay - 1) === roundDollar(exactInt), `in-school + grace simple interest = ${roundDollar(exactInt)}`);
  const owed = N * cost + roundDollar(exactInt);
  check(-bal(e, ACCT.STUDENT_LOANS, repay - 1) === owed, 'balance at repayment = principal + accrued interest');
  check(months(e, ACCT.CASH)[0] === repay, `first payment month ${repay}`);
  const pmt = Math.ceil(paymentFor(owed, r, 120) - 1e-9);
  const rows = amortize(owed, r, pmt, repay, 960);
  let bad = 0;
  for (const row of rows) if (bal(e, ACCT.STUDENT_LOANS, row.m) !== -row.after) bad++;
  check(bad === 0 && rows.length === 120, `repayment matches amortization (${bad} misses)`);
  check(bal(e, ACCT.EDUCATION) === N * cost && bal(e, ACCT.CASH) === -(N * cost + bal(e, ACCT.STUDENT_LOAN_INTEREST)), 'total cash = tuition + all interest');
});

test('other existing asset', () => {
  const c = ctx(40);
  const up = ENGINES.otherExistingAsset({ assetValue: 50_000, appreciationPct: 4, purchaseAge: age(35), financedWithLoan: false }, c);
  wellFormed('assetUp', up);
  check(line(up, 0, ACCT.PROPERTY) === roundDollar(50_000 * Math.pow(1.04, 5)), 'value grown 5 yrs at 4%');
  check(bal(up, ACCT.PROPERTY) === roundDollar(50_000 * Math.pow(1.04, 5) * Math.pow(Math.pow(1.04, 1 / 12), 960)), 'held to the horizon, compounding monthly');
  check(bal(up, ACCT.APPRECIATION) === -(bal(up, ACCT.PROPERTY) - line(up, 0, ACCT.PROPERTY)), 'gains on 52');
  const gone = ENGINES.otherExistingAsset({ assetValue: 10_000, appreciationPct: -100, purchaseAge: age(40), financedWithLoan: false }, c);
  check(line(gone, 0, ACCT.PROPERTY) === 10_000 && bal(gone, ACCT.PROPERTY, 1) === 0, '−100% → worthless after a month');
  const loan = ENGINES.otherExistingAsset({ assetValue: 20_000, appreciationPct: 0, purchaseAge: age(39), financedWithLoan: true, remainingBalance: 12_000, interestRatePct: 7, remainingTermMonths: 24 }, c);
  check(line(loan, 0, ACCT.OTHER_DEBT) === -12_000 && line(loan, 0, ACCT.EQUITY) === -8_000 && bal(loan, ACCT.OTHER_DEBT) === 0, 'loan 23 paid off; equity = value − loan');
  check(months(loan, ACCT.OTHER_DEBT_INTEREST).length === 24, '24 payments');
});

// ═════════════════════════════════════════════════════════════════════════════
// Investments
// ═════════════════════════════════════════════════════════════════════════════
test('existing investment: growth + contributions (closed form)', () => {
  const e = ENGINES.existingInvestment({ account: 5, currentInvested: 10_000, returnPct: 7 }, ctx(30, 0, 120));
  check(bal(e, 5) === roundDollar(10_000 * Math.pow(1.07, 10)), '10k @ 7% for 10 yrs = 19,672');
  check(line(e, 0, 5) === 10_000 && line(e, 0, ACCT.EQUITY) === -10_000, 'opens vs equity');
  const c = ENGINES.existingInvestment({ account: 5, currentInvested: 5_000, returnPct: 6, monthlyContribution: 400, contributionEndAge: age(50) }, ctx(30));
  const f = Math.pow(1.06, 1 / 12);
  const fv = (n: number) => 5_000 * Math.pow(f, n) + (400 * (Math.pow(f, n) - 1)) / (f - 1);
  for (const n of [1, 12, 120, 240]) check(approx(bal(c, 5, n), fv(n), 1), `FV after ${n} months ≈ ${fv(n).toFixed(0)} (got ${bal(c, 5, n)})`);
  check(approx(bal(c, 5, 360), fv(240) * Math.pow(f, 120), 1), 'contributions stop at 50, growth continues');
  check(bal(c, 5) === 5_000 + 400 * 240 - bal(c, ACCT.INVESTMENT_GAINS), 'balance = opening + contributions + gains');
  check(line(c, 1, 5) === roundDollar(5_000 * f) - 5_000 + 400, 'month 1: grow first, then contribute');
});

test('investments: withdrawals stop at $0', () => {
  const c = ctx(60);
  const flat = ENGINES.existingInvestment({ account: 4, currentInvested: 10_000, returnPct: 0, monthlyWithdrawal: 3_000 }, c);
  wellFormed('drain', flat);
  check([1, 2, 3, 4].map((m) => line(flat, m, ACCT.CASH)).join() === '3000,3000,3000,1000', 'takes 3,000 × 3, then the last 1,000');
  check(flat.length === 5 && bal(flat, 4) === 0 && bal(flat, ACCT.CASH) === 10_000, 'then stops; account exactly $0; cash got exactly 10,000');
  const grow = ENGINES.investing({ account: 6, initialContribution: 50_000, returnPct: 5, contributionStartAge: age(60), monthlyWithdrawal: 1_000 }, c);
  wellFormed('drainGrow', grow);
  let neg = 0;
  for (let m = 0; m <= 960; m++) if (bal(grow, 6, m) < 0) neg++;
  const lastW = months(grow, ACCT.CASH).filter((m) => m > 0).pop()!;
  check(neg === 0 && bal(grow, 6) === 0, 'never negative; ends at 0');
  check(line(grow, lastW, ACCT.CASH) <= 1_000 && line(grow, lastW, ACCT.CASH) > 0, 'last withdrawal is whatever was left');
  check(bal(grow, ACCT.CASH) === -50_000 + 50_000 - bal(grow, ACCT.INVESTMENT_GAINS), 'cash out = money in + gains');
  check(lastMonth(grow) === lastW, 'nothing posts after it is empty');
  // Contributions after emptying refill it
  const refill = ENGINES.existingInvestment({ account: 4, currentInvested: 1_000, returnPct: 0, monthlyWithdrawal: 1_000, withdrawalEndAge: age(60, 1), monthlyContribution: 100, contributionStartAge: age(61) }, ctx(60, 0, 24));
  check(bal(refill, 4, 12) === 0 && bal(refill, 4, 24) === 1_200, 'emptied, then refilled by later contributions');
});

test('investing (new account)', () => {
  const c = ctx(25);
  const e = ENGINES.investing({ account: 7, initialContribution: 2_000, returnPct: 8, contributionStartAge: age(27), monthlyContribution: 250, contributionEndAge: age(57) }, c);
  wellFormed('investing', e);
  check(e[0].month === 24 && line(e, 24, 7) === 2_000 && line(e, 24, ACCT.CASH) === -2_000, 'opens with cash at the start age');
  check(line(e, 25, ACCT.CASH) === -250 && months(e, ACCT.CASH).filter((m) => line(e, m, ACCT.CASH) === -250).length === 360, '360 contributions');
  const f = Math.pow(1.08, 1 / 12);
  const fv = 2_000 * Math.pow(f, 360) + (250 * (Math.pow(f, 360) - 1)) / (f - 1);
  check(approx(bal(e, 7, 384), fv, 1), `FV at 57 ≈ ${fv.toFixed(0)} (got ${bal(e, 7, 384)})`);
  const w = ENGINES.investing({ account: 7, initialContribution: 1_000, returnPct: 0, contributionStartAge: age(30), monthlyWithdrawal: 100 }, c);
  check(months(w, ACCT.CASH)[1] === 61 && line(w, 61, ACCT.CASH) === 100, 'withdrawals default to start with the account');
});

// ═════════════════════════════════════════════════════════════════════════════
// Cross-engine equivalences (two engines that must agree)
// ═════════════════════════════════════════════════════════════════════════════
const sameAfterMonth0 = (a: JournalEntry[], b: JournalEntry[]) =>
  JSON.stringify(a.filter((x) => x.month > 0)) === JSON.stringify(b.filter((x) => x.month > 0));

test('equivalences', () => {
  const c = ctx(30);
  // Buying a home today ≡ owning it with a brand-new mortgage (except cash vs equity at month 0)
  const buy = ENGINES.buyingHome({ purchaseAge: age(30), totalPropertyValue: 300_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6 }, c);
  const own = ENGINES.existingHome({ totalPropertyValue: 300_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6, remainingBalance: 240_000, purchaseAge: age(30) }, c);
  check(sameAfterMonth0(buy, own), 'buyingHome today ≡ existingHome with a new mortgage (months ≥ 1)');
  check(line(buy, 0, ACCT.CASH) === line(own, 0, ACCT.EQUITY), 'month 0: down payment from cash vs equity');
  // Same for cars
  const bc = ENGINES.buyingCar({ purchaseAge: age(30), financing: 'loan', totalVehicleValue: 20_000, downPaymentPct: 10, loanTermMonths: 48, interestRatePct: 5 }, c);
  const oc = ENGINES.existingVehicle({ financing: 'loan', totalVehicleValue: 20_000, downPaymentPct: 10, loanTermMonths: 48, interestRatePct: 5, remainingBalance: 18_000, purchaseAge: age(30) }, c);
  check(sameAfterMonth0(bc, oc), 'buyingCar today ≡ existingVehicle with a new loan');
  // New investment today ≡ existing investment of the same amount
  const ni = ENGINES.investing({ account: 4, initialContribution: 8_000, returnPct: 6, contributionStartAge: age(30), monthlyContribution: 100 }, c);
  const ei = ENGINES.existingInvestment({ account: 4, currentInvested: 8_000, returnPct: 6, monthlyContribution: 100 }, c);
  check(sameAfterMonth0(ni, ei), 'investing today ≡ existingInvestment');
  // Credit card ≡ other loan with the same numbers (different accounts)
  const cc = ENGINES.existingCreditCard({ currentBalance: 4_000, aprPct: 18, monthlyPayment: 150 }, c);
  const ol = ENGINES.otherExistingLoan({ remainingBalance: 4_000, interestRatePct: 18, monthlyPayment: 150 }, c);
  check(cc.length === ol.length && cc.every((x, i) => x.month === ol[i].month && line(cc, x.month, ACCT.CASH) === line(ol, x.month, ACCT.CASH) && line(cc, x.month, ACCT.CREDIT_CARD) === line(ol, x.month, ACCT.OTHER_DEBT)), 'credit card ≡ other loan');
  // Yearly $1,200 ≡ monthly $100
  const y = ENGINES.recurringPayment({ amount: 1_200, frequency: 'yearly', endAge: age(40) }, c);
  const mth = ENGINES.recurringPayment({ amount: 100, frequency: 'monthly', endAge: age(40) }, c);
  check(JSON.stringify(y) === JSON.stringify(mth), 'yearly 1,200 ≡ monthly 100');
  // Kid $12k/yr ≡ recurring $1,000/mo for 20 years (different account)
  const k = ENGINES.kid({ annualCost: 12_000, birthAge: age(31) }, c);
  const rp = ENGINES.recurringPayment({ amount: 1_000, frequency: 'monthly', startAge: age(31), endAge: age(51) }, c);
  check(bal(k, ACCT.KIDS) === bal(rp, ACCT.RECURRING) && k[0].month === rp[0].month && lastMonth(k) === lastMonth(rp), 'kid ≡ 20 years of recurring');
  // Income override 0% tax → cash = gross − FICA
  const i0 = ENGINES.income({ salary: 50_000, raisePct: 0, filingStatus: 'single', incomeTaxRatePct: 0, endAge: age(31) }, c);
  check(bal(i0, ACCT.CASH) === 50_000 - roundDollar(50_000 * 0.0765), '0% income tax → only FICA withheld');
});

// ═════════════════════════════════════════════════════════════════════════════
// Horizon (endMonth) and past/future clamping
// ═════════════════════════════════════════════════════════════════════════════
test('endMonth truncation and clamping', () => {
  for (const end of [0, 1, 60, 240]) {
    const c = ctx(30, 0, end);
    const all = [
      ...ENGINES.income({ salary: 70_000, raisePct: 2, filingStatus: 'single', retirementContributionPct: 5, retirementAccount: 3 }, c),
      ...ENGINES.buyingHome({ purchaseAge: age(30), totalPropertyValue: 250_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6 }, c),
      ...ENGINES.food({ diningOutMonthly: 100, groceriesMonthly: 300 }, c),
    ];
    check(all.every((x) => x.month <= end), `endMonth ${end}: nothing after it`);
  }
  const c = ctx(30);
  const pastBuy = ENGINES.buyingHome({ purchaseAge: age(28), totalPropertyValue: 200_000, downPaymentPct: 100, mortgageTermYears: 30, interestRatePct: 0 }, c);
  check(pastBuy[0].month === 0 && line(pastBuy, 0, ACCT.CASH) === -200_000, 'future-type purchase in the past → clamped to month 0');
  const late = ENGINES.buyingHome({ purchaseAge: age(120), totalPropertyValue: 200_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6 }, c);
  check(late.length === 0, 'purchase after the horizon → nothing');
});

// ═════════════════════════════════════════════════════════════════════════════
// Bad input throws (a clear error, never a silent wrong answer)
// ═════════════════════════════════════════════════════════════════════════════
test('bad input throws', () => {
  const c = ctx(30);
  const bad: Array<[string, () => unknown]> = [
    ['negative opening cash', () => ENGINES.openingCash({ amount: -1 }, c)],
    ['existing home sold in the past', () => ENGINES.existingHome({ totalPropertyValue: 1e5, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 5, remainingBalance: 5e4, sellAge: age(29) }, c)],
    ['existing car sold in the past', () => ENGINES.existingVehicle({ financing: 'full', totalVehicleValue: 1e4, purchaseAge: age(25), sellAge: age(29, 11) }, c)],
    ['home sold before bought', () => ENGINES.buyingHome({ purchaseAge: age(35), totalPropertyValue: 1e5, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 5, sellAge: age(34) }, c)],
    ['car sold before bought', () => ENGINES.buyingCar({ purchaseAge: age(35), financing: 'full', totalVehicleValue: 1e4, sellAge: age(34, 11) }, c)],
    ['car bought & sold in the past', () => ENGINES.buyingCar({ purchaseAge: age(25), financing: 'full', totalVehicleValue: 1e4, sellAge: age(28) }, c)],
    ['mortgage term 0', () => ENGINES.buyingHome({ purchaseAge: age(31), totalPropertyValue: 1e5, downPaymentPct: 20, mortgageTermYears: 0, interestRatePct: 5 }, c)],
    ['down payment 101%', () => ENGINES.buyingHome({ purchaseAge: age(31), totalPropertyValue: 1e5, downPaymentPct: 101, mortgageTermYears: 30, interestRatePct: 5 }, c)],
    ['negative interest', () => ENGINES.buyingHome({ purchaseAge: age(31), totalPropertyValue: 1e5, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: -1 }, c)],
    ['car loan term 0', () => ENGINES.buyingCar({ purchaseAge: age(31), financing: 'loan', totalVehicleValue: 1e4, downPaymentPct: 0, loanTermMonths: 0, interestRatePct: 5 }, c)],
    ['unknown financing', () => ENGINES.buyingCar({ purchaseAge: age(31), financing: 'lease' as 'loan', totalVehicleValue: 1e4 }, c)],
    ['negative salary', () => ENGINES.income({ salary: -1, raisePct: 0, filingStatus: 'single' }, c)],
    ['401k over 100%', () => ENGINES.income({ salary: 1e5, raisePct: 0, filingStatus: 'single', retirementContributionPct: 101, retirementAccount: 3 }, c)],
    ['bad filing status', () => ENGINES.income({ salary: 1e5, raisePct: 0, filingStatus: 'joint' as 'single' }, c)],
    ['charity over 100%', () => ENGINES.income({ salary: 1e5, raisePct: 0, filingStatus: 'single', charityPct: 120 }, c)],
    ['raise below −100%', () => ENGINES.income({ salary: 1e5, raisePct: -101, filingStatus: 'single' }, c)],
    ['negative rent', () => ENGINES.renting({ rentMonthly: -5 }, c)],
    ['negative junk fees', () => ENGINES.renting({ rentMonthly: 5, junkFeesMonthly: -1 }, c)],
    ['negative food', () => ENGINES.food({ diningOutMonthly: -1, groceriesMonthly: 5 }, c)],
    ['NaN groceries', () => ENGINES.food({ diningOutMonthly: 1, groceriesMonthly: NaN }, c)],
    ['negative personal', () => ENGINES.personal({ gym: -10 }, c)],
    ['negative one-time', () => ENGINES.oneTimeExpense({ age: age(31), amount: -100 }, c)],
    ['negative past one-time', () => ENGINES.oneTimeExpense({ age: age(20), amount: -100 }, c)],
    ['negative recurring', () => ENGINES.recurringPayment({ amount: -1, frequency: 'monthly' }, c)],
    ['bad frequency', () => ENGINES.birthdayChristmas({ amount: 1, frequency: 'weekly' as 'monthly' }, c)],
    ['negative kid cost', () => ENGINES.kid({ annualCost: -1, birthAge: age(31) }, c)],
    ['negative pet vet', () => ENGINES.pet({ startAge: age(31), lifespanYears: 10, vetPerYear: -1, foodPerMonth: 1, adoptionCost: 1 }, c)],
    ['negative lifespan', () => ENGINES.pet({ startAge: age(31), lifespanYears: -1, vetPerYear: 1, foodPerMonth: 1, adoptionCost: 1 }, c)],
    ['bad health type', () => ENGINES.healthInsurance({ type: 'toString' as 'none' }, c)],
    ['negative premium', () => ENGINES.healthInsurance({ type: 'none', monthlyPremiumOverride: -1 }, c)],
    ['negative gas price', () => ENGINES.gas({ milesPerWeek: 10, mpg: 20, gasPricePerGallon: -1 }, c)],
    ['negative miles', () => ENGINES.gas({ milesPerWeek: -10, mpg: 20 }, c)],
    ['bad payment type', () => ENGINES.education({ paymentType: 'grant' as 'full', costPerSemester: 1, numberOfSemesters: 1, startAge: age(31) }, c)],
    ['education loan term 0', () => ENGINES.education({ paymentType: 'loan', costPerSemester: 1, numberOfSemesters: 1, startAge: age(31), loanRatePct: 5, loanTermYears: 0 }, c)],
    ['negative tuition', () => ENGINES.education({ paymentType: 'full', costPerSemester: -1, numberOfSemesters: 1, startAge: age(31) }, c)],
    ['negative card balance', () => ENGINES.existingCreditCard({ currentBalance: -1, aprPct: 20, monthlyPayment: 10 }, c)],
    ['negative APR', () => ENGINES.existingCreditCard({ currentBalance: 1, aprPct: -20, monthlyPayment: 10 }, c)],
    ['loan term 0', () => ENGINES.existingStudentLoans({ remainingBalance: 1_000, interestRatePct: 5, remainingTermMonths: 0 }, c)],
    ['negative loan payment', () => ENGINES.otherExistingLoan({ remainingBalance: 1_000, interestRatePct: 5, monthlyPayment: -5 }, c)],
    ['return below −100%', () => ENGINES.existingInvestment({ account: 4, currentInvested: 1, returnPct: -101 }, c)],
    ['negative invested', () => ENGINES.existingInvestment({ account: 4, currentInvested: -1, returnPct: 5 }, c)],
    ['negative withdrawal', () => ENGINES.investing({ account: 4, initialContribution: 1, returnPct: 5, contributionStartAge: age(31), monthlyWithdrawal: -1 }, c)],
    ['account 13', () => ENGINES.investing({ account: 13, initialContribution: 1, returnPct: 5, contributionStartAge: age(31) }, c)],
    ['appreciation below −100%', () => ENGINES.otherExistingAsset({ assetValue: 1, appreciationPct: -101, purchaseAge: age(29), financedWithLoan: false }, c)],
    ['financedWithLoan not boolean', () => ENGINES.otherExistingAsset({ assetValue: 1, appreciationPct: 0, purchaseAge: age(29), financedWithLoan: 'no' as unknown as boolean }, c)],
    ['fractional age', () => ENGINES.oneTimeExpense({ age: { years: 31.5, months: 0 }, amount: 1 }, c)],
    ['age months 12', () => ENGINES.food({ diningOutMonthly: 1, groceriesMonthly: 1, startAge: { years: 31, months: 12 } }, c)],
    ['bad startAge in ctx', () => ENGINES.kid({ annualCost: 1, birthAge: age(31) }, { caseId: 'x', startAge: { years: 30.5, months: 0 } })],
    ['missing purchase age', () => ENGINES.buyingHome({ totalPropertyValue: 1, downPaymentPct: 100, mortgageTermYears: 1, interestRatePct: 0 } as never, c)],
  ];
  for (const [name, fn] of bad) check(throws(fn), `throws: ${name}`);
  // …and the errors say what's wrong
  try { ENGINES.renting({ rentMonthly: -5 }, c); } catch (e) { check(/rentMonthly/.test((e as Error).message), 'error names the field'); }
  // Allowed negatives still work
  check(!throws(() => ENGINES.existingInvestment({ account: 4, currentInvested: 1_000, returnPct: -20 }, c)), 'negative return allowed');
  check(!throws(() => ENGINES.otherExistingAsset({ assetValue: 1_000, appreciationPct: -30, purchaseAge: age(29), financedWithLoan: false }, c)), 'depreciation allowed');
  check(!throws(() => ENGINES.income({ salary: 1e5, raisePct: -2, filingStatus: 'single' }, c)), 'pay cut allowed');
  check(!throws(() => ENGINES.existingHome({ totalPropertyValue: 1e5, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 5, remainingBalance: 5e4, sellAge: age(30) }, c)), 'selling right now (month 0) allowed');
});

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed) {
  for (const f of fails.slice(0, 60)) console.log('  ✗ ' + f);
  throw new Error(`${failed} checks failed`);
}
