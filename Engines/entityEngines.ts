// entityEngines.ts
// ─────────────────────────────────────────────────────────────────────────────
// One engine per entity type. Each engine takes ONE entity's raw inputs and returns
// every journal entry that entity creates, month by month.
//
//   engine(input, ctx) → JournalEntry[]
//   ctx = { caseId, startAge, endMonth? }   (endMonth defaults to 960)
//
// RULES (shared by every engine)
//   • Month numbers only. month = (12·eventYears + eventMonths) − (12·startYears + startMonths)
//   • Month 0 = opening balances. A one-time event at month n posts at n.
//     A recurring flow active from month s to month e posts at s+1 … e
//     (each month's entry is what happened during the month before it).
//   • Debit = +, credit = −. Every entry sums to exactly 0.
//   • Output is whole dollars. Math is done in decimals, then rounded so that
//     running totals stay exact (see Accrual) and cash absorbs any $1 leftovers.
//   • No inflation. All rates are real rates (see presetVars.ts).
//   • Negative cash is allowed (not flagged). Nothing posts after endMonth.
//   • Future-type entities with an age before startAge are clamped to month 0.
//   • Bad input throws: missing/invalid numbers, negative dollar amounts, percents
//     out of range, unknown choices, malformed ages, sales before start/purchase.
// ─────────────────────────────────────────────────────────────────────────────

import {
  EDUCATION, FEDERAL, FICA, GAS, HEALTH_PREMIUM_MONTHLY, HOME, HOME_INS_COVERAGE_POINTS,
  HOME_INS_SE_CURVE, INVESTING, KIDS, PROJECTION, RETIREMENT_LIMIT, SE_STATES, STATE_TAX, VEHICLE,
  type Bracket, type StateTaxRule,
} from '../TypesAndVariables/presetVars';
import type {
  Age, BirthdayChristmasInput, BuyingCarInput, BuyingHomeInput, EducationInput, Engine, EngineCtx, EntityInputs,
  EntityTypeKey, ExistingCreditCardInput, ExistingHomeInput, ExistingInvestmentInput, ExistingLoanInput,
  ExistingVehicleInput, FilingStatus, FoodInput, Frequency, GasInput, HealthInsuranceInput, HealthInsuranceType, IncomeInput,
  InvestingInput, JournalEntry, KidInput, OneTimeExpenseInput, OpeningCashInput, OtherExistingAssetInput,
  PersonalInput, PetInput, RecurringPaymentInput, RentingInput,
} from '../TypesAndVariables/types';

// ═════════════════════════════════════════════════════════════════════════════
// Accounts
// ═════════════════════════════════════════════════════════════════════════════
export const ACCT = {
  PROPERTY: 0, // house/property assets (also "other existing assets")
  CASH: 1,
  VEHICLES: 2,
  // 3–12: investment accounts (assigned by masterEngine: 3 = retirement, 4–12 = investing)
  MORTGAGE: 20,
  VEHICLE_LOAN: 21,
  STUDENT_LOANS: 22,
  OTHER_DEBT: 23,
  CREDIT_CARD: 24,
  EQUITY: 40,
  EARNED_INCOME: 50,
  INVESTMENT_GAINS: 51, // may carry a debit balance (losses)
  APPRECIATION: 52, // may carry a debit balance (other assets that lose value)
  RENT: 70,
  MORTGAGE_INTEREST: 71,
  CAR_INSURANCE: 72,
  GAS: 73,
  VEHICLE_LOAN_INTEREST: 74,
  KIDS: 75,
  RENTERS_INSURANCE: 76,
  HOME_INSURANCE: 77,
  PROPERTY_TAX: 78,
  INCOME_TAX: 79,
  HOME_UTILITIES_MAINTENANCE: 80,
  EDUCATION: 81,
  STUDENT_LOAN_INTEREST: 82,
  VEHICLE_DEPRECIATION: 83,
  ONE_TIME: 84,
  RECURRING: 85,
  BIRTHDAY_CHRISTMAS: 86,
  PERSONAL: 87,
  PETS: 88,
  HEALTH_INSURANCE: 89,
  FOOD: 90,
  CREDIT_CARD_INTEREST: 91,
  OTHER_DEBT_INTEREST: 92,
  CHARITY: 93, // new
  OTHER_TAXES: 94, // new: Social Security + Medicare
  VEHICLE_MAINTENANCE: 95, // new
} as const;
export const INVESTMENT_ACCOUNT_MIN = 3;
export const INVESTMENT_ACCOUNT_MAX = 12;

// ═════════════════════════════════════════════════════════════════════════════
// Small helpers
// ═════════════════════════════════════════════════════════════════════════════
const pct = (x: number | null | undefined): number => (x ?? 0) / 100;

/** Round half away from zero (so +2.5 → 3 and −2.5 → −3). Never returns −0. */
export const roundDollar = (x: number): number => {
  const r = Math.sign(x) * Math.round(Math.abs(x) + 1e-9);
  return r === 0 ? 0 : r;
};

/** Monthly growth factor for an effective annual rate: (1 + g)^(1/12). */
const monthlyFactor = (annualPct: number): number => Math.pow(1 + annualPct / 100, 1 / 12);

const fail = (msg: string): never => {
  throw new Error(`[entityEngines] ${msg}`);
};
const need = (value: number | null | undefined, name: string): number => {
  if (value === null || value === undefined || !Number.isFinite(value)) fail(`missing or invalid input "${name}"`);
  return value as number;
};
/** Required number ≥ min (default 0). */
const needMin = (value: number | null | undefined, name: string, min = 0): number => {
  const v = need(value, name);
  if (v < min) fail(`"${name}" must be ≥ ${min}, got ${v}`);
  return v;
};
/** Required number in [min, max]. */
const needRange = (value: number | null | undefined, name: string, min: number, max: number): number => {
  const v = need(value, name);
  if (v < min || v > max) fail(`"${name}" must be between ${min} and ${max}, got ${v}`);
  return v;
};
/** Optional number: null/undefined → null, otherwise must be ≥ min (default 0). */
const optMin = (value: number | null | undefined, name: string, min = 0): number | null =>
  value === null || value === undefined ? null : needMin(value, name, min);
/** Optional number: null/undefined → null, otherwise must be in [min, max]. */
const optRange = (value: number | null | undefined, name: string, min: number, max: number): number | null =>
  value === null || value === undefined ? null : needRange(value, name, min, max);
/** Required choice from a fixed list. */
const oneOf = <T extends string>(value: unknown, name: string, options: readonly T[]): T => {
  if (!options.includes(value as T)) fail(`"${name}" must be one of ${options.join(' | ')}, got ${JSON.stringify(value)}`);
  return value as T;
};
const needInvestmentAccount = (acct: number, name = 'account'): number => {
  if (!Number.isInteger(acct) || acct < INVESTMENT_ACCOUNT_MIN || acct > INVESTMENT_ACCOUNT_MAX)
    fail(`"${name}" must be an investment account ${INVESTMENT_ACCOUNT_MIN}–${INVESTMENT_ACCOUNT_MAX}, got ${acct}`);
  return acct;
};
const toMonthly = (amount: number, freq: Frequency): number =>
  oneOf(freq, 'frequency', ['monthly', 'yearly']) === 'yearly' ? amount / 12 : amount;

// ── Time ─────────────────────────────────────────────────────────────────────
/** Throws unless `a` is { years: whole number ≥ 0, months: whole number 0–11 }. */
export const checkAge = (a: Age, name = 'age'): Age => {
  if (!a || !Number.isInteger(a.years) || a.years < 0 || !Number.isInteger(a.months) || a.months < 0 || a.months > 11)
    fail(`"${name}" must be { years: whole number ≥ 0, months: whole number 0–11 }, got ${JSON.stringify(a)}`);
  return a;
};
const ageInMonths = (a: Age): number => 12 * checkAge(a).years + a.months;

/** Event month for an age: (12·y2 + m2) − (12·y1 + m1). Can be negative (in the past). */
export const toMonth = (age: Age, ctx: EngineCtx): number => ageInMonths(age) - ageInMonths(ctx.startAge);
export const lastMonthOf = (ctx: EngineCtx): number => ctx.endMonth ?? PROJECTION.defaultEndMonth;

/** Month a purchase/start posts (clamped so nothing lands before month 0). */
const eventMonth = (age: Age, ctx: EngineCtx): number => Math.max(0, toMonth(age, ctx));

/** Month a one-time COST posts, or null if it's already in the past (then it's in opening cash). */
const costMonth = (age: Age, ctx: EngineCtx): number | null => {
  const m = toMonth(age, ctx);
  return m >= 0 ? m : null;
};

/**
 * Sale month of an owned asset, or null when there is no sale.
 * Throws if the sale is before month 0 (already sold) or before the purchase.
 */
const saleMonth = (sellAge: Age | null | undefined, ctx: EngineCtx, purchaseAge?: Age): number | null => {
  if (!sellAge) return null;
  const m = toMonth(checkAge(sellAge, 'sellAge'), ctx);
  if (m < 0) fail('"sellAge" is before the starting age (already sold; leave this entity out)');
  if (purchaseAge && m < toMonth(purchaseAge, ctx)) fail('"sellAge" is before "purchaseAge"');
  return m;
};

/** Loan length in whole months (≥ 1). `scale` = 12 when the input is in years. */
const termMonths = (value: number | null | undefined, name: string, scale = 1): number => {
  const n = Math.round(need(value, name) * scale);
  if (n < 1) fail(`"${name}" must be at least 1 month, got ${value}`);
  return n;
};

/**
 * Posting window for a recurring flow active from startAge to endAge.
 * Posts at months first … last (inclusive). Empty when last < first.
 * startAge missing = starts now. endAge missing = runs to endMonth.
 */
export const recurringWindow = (ctx: EngineCtx, startAge?: Age | null, endAge?: Age | null) => {
  const s = startAge ? Math.max(0, toMonth(checkAge(startAge, 'startAge'), ctx)) : 0;
  const limit = lastMonthOf(ctx);
  const e = endAge ? Math.min(toMonth(checkAge(endAge, 'endAge'), ctx), limit) : limit;
  return { first: s + 1, last: e };
};

// ═════════════════════════════════════════════════════════════════════════════
// Accrual: turns a stream of decimal amounts into whole dollars with no drift.
//   Each call posts round(running exact total) − (already posted).
//   Example: $333.33/mo posts 333, 333, 334, … and every 3 months totals exactly $1,000.
// ═════════════════════════════════════════════════════════════════════════════
class Accrual {
  private exact = 0;
  private posted = 0;
  take(amount: number): number {
    this.exact += amount;
    const post = roundDollar(this.exact) - this.posted;
    this.posted += post;
    return post;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Ledger: collects lines per month, then builds balanced whole-dollar entries.
// ═════════════════════════════════════════════════════════════════════════════
class Ledger {
  private months = new Map<number, Map<number, number>>();
  private accruals = new Map<string, Accrual>();
  constructor(private ctx: EngineCtx) {}

  /** Add a signed amount (debit +, credit −) to an account in a month. */
  add(month: number, account: number, amount: number): void {
    if (!Number.isFinite(amount)) fail(`non-finite amount for account ${account} in month ${month}`);
    if (amount === 0) return;
    let m = this.months.get(month);
    if (!m) this.months.set(month, (m = new Map()));
    m.set(account, (m.get(account) ?? 0) + amount);
  }

  /** Debit one account and credit another by the same amount. */
  move(month: number, debitAccount: number, creditAccount: number, amount: number): void {
    this.add(month, debitAccount, amount);
    this.add(month, creditAccount, -amount);
  }

  /**
   * Recurring cash expense with drift-free rounding. `key` separates streams
   * (e.g. 'rent' vs 'utilities') so each stream's running total stays exact.
   */
  expense(month: number, account: number, amountDecimal: number, key = String(account)): void {
    let acc = this.accruals.get(key);
    if (!acc) this.accruals.set(key, (acc = new Accrual()));
    const post = acc.take(amountDecimal);
    this.move(month, account, ACCT.CASH, post);
  }

  build(): JournalEntry[] {
    const last = lastMonthOf(this.ctx);
    const out: JournalEntry[] = [];
    for (const month of [...this.months.keys()].sort((a, b) => a - b)) {
      if (month < 0 || month > last) continue;
      const lines = [...this.months.get(month)!.entries()].filter(([, v]) => v !== 0);
      if (lines.length === 0) continue;
      // Round every line except one "plug" line, which takes −(sum of the others).
      // Plug = cash when present, else the largest line. Engines pre-round anything
      // that feeds a tracked balance, so the plug only absorbs ±$1 rounding.
      let plug = lines.findIndex(([a]) => a === ACCT.CASH);
      if (plug < 0) plug = lines.reduce((best, l, i) => (Math.abs(l[1]) > Math.abs(lines[best][1]) ? i : best), 0);
      let sum = 0;
      const rounded = lines.map(([account, v], i): [number, number] => {
        if (i === plug) return [account, 0];
        const r = roundDollar(v);
        sum += r;
        return [account, r];
      });
      rounded[plug][1] = sum === 0 ? 0 : -sum;
      const lineEntries = rounded
        .filter(([, v]) => v !== 0)
        .sort((a, b) => a[0] - b[0])
        .map(([account, amount]) => ({ account, amount }));
      if (lineEntries.length) out.push({ caseId: this.ctx.caseId, month, lineEntries });
    }
    return out;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Loan math
// ═════════════════════════════════════════════════════════════════════════════
/** Level payment that pays off `principal` in n months at monthly rate r. */
export function paymentFor(principal: number, r: number, n: number): number {
  if (principal <= 0) return 0;
  if (n <= 0) return principal;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Present value (balance) of n payments of `payment` at monthly rate r. */
function balanceFor(payment: number, r: number, n: number): number {
  if (r === 0) return payment * n;
  return (payment * (1 - Math.pow(1 + r, -n))) / r;
}

/**
 * Months already paid on a loan that started at P0 (rate r, term n), given today's balance B.
 * Balance after k payments: B = P0(1+r)^k − pmt·((1+r)^k − 1)/r
 * Solve for k: (1+r)^k = (pmt − B·r) / (pmt − P0·r)
 */
export function monthsPaidFromBalance(P0: number, r: number, n: number, B: number): number {
  if (B >= P0) return 0;
  if (B <= 0) return n;
  const pmt = paymentFor(P0, r, n);
  const k = r === 0 ? (P0 - B) / pmt : Math.log((pmt - B * r) / (pmt - P0 * r)) / Math.log(1 + r);
  return Math.min(n, Math.max(0, Math.round(k)));
}

export type LoanTerms = { balance: number; ratePct: number; termMonths: number; payment: number };

/**
 * "Any 3 of 4" loan solver: balance, annual rate, months left, monthly payment.
 * termMonths may come back as Infinity when the payment never covers the interest.
 */
export function solveLoan(input: {
  balance?: number | null; ratePct?: number | null; termMonths?: number | null; payment?: number | null;
}): LoanTerms {
  const has = (v: number | null | undefined) => v !== null && v !== undefined && Number.isFinite(v);
  const given = [input.balance, input.ratePct, input.termMonths, input.payment].filter(has).length;
  if (given < 3) fail('loan needs at least 3 of: remaining balance, interest rate, time left, monthly payment');

  let B = input.balance as number, n = input.termMonths as number, pmt = input.payment as number;
  let r = has(input.ratePct) ? pct(input.ratePct) / 12 : NaN;

  if (!has(input.payment)) pmt = paymentFor(B, r, n);
  else if (!has(input.balance)) B = balanceFor(pmt, r, n);
  else if (!has(input.termMonths)) {
    if (B <= 0) n = 0;
    else if (r === 0) n = Math.ceil(B / pmt - 1e-9);
    else if (pmt <= B * r) n = Infinity; // payment never covers interest
    else n = Math.ceil(-Math.log(1 - (B * r) / pmt) / Math.log(1 + r) - 1e-9);
  } else if (!has(input.ratePct)) {
    // Bisection: balanceFor() falls as r rises. If pmt·n ≤ B the rate would be ≤ 0 → use 0.
    if (pmt * n <= B) r = 0;
    else {
      let lo = 0, hi = 1; // monthly rate 0%–100%
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (balanceFor(pmt, mid, n) > B) lo = mid; else hi = mid;
      }
      r = (lo + hi) / 2;
    }
  }
  return { balance: B, ratePct: r * 12 * 100, termMonths: n, payment: pmt };
}

/**
 * Runs a loan month by month in WHOLE dollars so the ledger and schedule never drift.
 *   interest = round(balance × r)   → Dr interest expense, Cr liability
 *   payment  = min(payment, balance + interest)  (final payment clamped)
 *                                    → Dr liability, Cr cash
 * Before payFromMonth, interest still accrues (and grows the balance).
 * If payment ≤ interest the balance grows forever (allowed; Engine 2 can flag).
 * Returns balanceAfter(month).
 */
function runLoan(led: Ledger, o: {
  balance: number; monthlyRate: number; payment: number;
  firstMonth: number; payFromMonth: number; lastMonth: number;
  liabilityAccount: number; interestAccount: number;
}): (month: number) => number {
  let bal = roundDollar(o.balance);
  const payment = Math.max(0, roundDollar(o.payment));
  const after = new Map<number, number>();
  let m = o.firstMonth;
  for (; m <= o.lastMonth && bal > 0; m++) {
    const interest = roundDollar(bal * o.monthlyRate);
    const pay = m >= o.payFromMonth ? Math.min(payment, bal + interest) : 0;
    led.move(m, o.interestAccount, o.liabilityAccount, interest); // interest charged
    led.move(m, o.liabilityAccount, ACCT.CASH, pay); // payment
    bal = bal + interest - pay;
    after.set(m, bal);
  }
  const lastRun = m - 1;
  const start = roundDollar(o.balance);
  return (month: number) => {
    if (month < o.firstMonth) return start;
    if (month > lastRun) return after.get(lastRun) ?? start;
    return after.get(month)!;
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Value tracking (appreciation / depreciation / investment growth)
//   Keep the exact decimal value D. Each month post round(D) − booked.
//   So the books always equal round(D): no drift, and never below $0 for assets.
// ═════════════════════════════════════════════════════════════════════════════

type OwnedAssetSpec = {
  assetAccount: number;
  valueCounterAccount: number; // 52 appreciation (±) or 83 vehicle depreciation
  annualGrowthPct: number; // real; negative = loses value
  openMonth: number;
  openValueExact: number; // value when it lands on the books
  opening: 'existing' | 'purchase'; // existing → vs equity (40); purchase → vs cash
  loan: null | {
    balance: number; monthlyRate: number; payment: number;
    liabilityAccount: number; interestAccount: number;
  };
  sellMonth: number | null;
  /** Monthly costs given the value at the START of the month: [account, $, streamKey]. */
  monthlyCosts?: (value: number) => Array<[number, number, string]>;
};

/**
 * Shared core for houses, vehicles and other assets:
 *   open (month 0 vs equity, or purchase vs cash + loan) → monthly: costs, loan
 *   payment, value change → optional sale at book value (loan paid from proceeds).
 */
function runOwnedAsset(led: Ledger, ctx: EngineCtx, s: OwnedAssetSpec): void {
  const last = lastMonthOf(ctx);
  const open = s.openMonth;
  if (open > last) return;

  const value0 = Math.max(0, roundDollar(s.openValueExact));
  const loan0 = s.loan ? Math.max(0, roundDollar(s.loan.balance)) : 0;

  // Opening entry
  led.add(open, s.assetAccount, value0);
  if (loan0 > 0) led.add(open, s.loan!.liabilityAccount, -loan0);
  led.add(open, s.opening === 'existing' ? ACCT.EQUITY : ACCT.CASH, -(value0 - loan0));

  const sell = s.sellMonth === null ? null : Math.max(open, s.sellMonth);
  const holdLast = sell === null ? last : Math.min(sell, last);

  // Loan payments (first payment the month after opening)
  const loanBalanceAfter = s.loan && loan0 > 0
    ? runLoan(led, {
        balance: loan0, monthlyRate: s.loan.monthlyRate, payment: s.loan.payment,
        firstMonth: open + 1, payFromMonth: open + 1, lastMonth: holdLast,
        liabilityAccount: s.loan.liabilityAccount, interestAccount: s.loan.interestAccount,
      })
    : () => 0;

  // Monthly costs + value change
  const f = monthlyFactor(s.annualGrowthPct);
  let booked = value0;
  for (let m = open + 1; m <= holdLast; m++) {
    if (s.monthlyCosts) for (const [acct, amt, key] of s.monthlyCosts(booked)) led.expense(m, acct, amt, key);
    const target = Math.max(0, roundDollar(s.openValueExact * Math.pow(f, m - open)));
    led.move(m, s.assetAccount, s.valueCounterAccount, target - booked);
    booked = target;
  }

  // Sale at book value; pay off any open loan from the proceeds
  if (sell !== null && sell <= last) {
    led.move(sell, ACCT.CASH, s.assetAccount, booked);
    const owed = loanBalanceAfter(sell);
    if (owed > 0) led.move(sell, s.loan!.liabilityAccount, ACCT.CASH, owed);
  }
}

type InvestmentSpec = {
  account: number;
  openMonth: number;
  openAmount: number;
  openFrom: 'equity' | 'cash'; // existing account vs new money
  returnPct: number; // real, yoy
  contribution: { monthly: number; first: number; last: number };
  withdrawal: { monthly: number; first: number; last: number };
};

/**
 * Investment account: each month grows first (on last month's balance), then
 * contributions (cash → account) and withdrawals (account → cash).
 * Gains: Dr account / Cr 51. Losses flip the signs (51 may carry a debit balance).
 *
 * Withdrawals stop at $0: a withdrawal takes min(amount, balance). When it empties the
 * account, the sub-dollar remainder is dropped too, so the account stays exactly $0
 * (each investing entity owns its account, so this is exact).
 */
function runInvestment(led: Ledger, ctx: EngineCtx, s: InvestmentSpec): void {
  const last = lastMonthOf(ctx);
  if (s.openMonth > last) return;
  const open = roundDollar(s.openAmount);
  const contrib = roundDollar(s.contribution.monthly);
  const withdraw = roundDollar(s.withdrawal.monthly);
  led.move(s.openMonth, s.account, s.openFrom === 'equity' ? ACCT.EQUITY : ACCT.CASH, open);

  const f = monthlyFactor(s.returnPct);
  let exact = open;
  let booked = open;
  const lastContribution = contrib ? s.contribution.last : -1;
  for (let m = s.openMonth + 1; m <= last; m++) {
    if (exact === 0 && m > lastContribution) break; // empty, and nothing more coming in
    exact *= f;
    const target = roundDollar(exact);
    led.move(m, s.account, ACCT.INVESTMENT_GAINS, target - booked);
    booked = target;
    if (contrib && m >= s.contribution.first && m <= s.contribution.last) {
      led.move(m, s.account, ACCT.CASH, contrib);
      exact += contrib;
      booked += contrib;
    }
    if (withdraw && m >= s.withdrawal.first && m <= s.withdrawal.last && booked > 0) {
      const take = Math.min(withdraw, booked);
      led.move(m, ACCT.CASH, s.account, take);
      booked -= take;
      exact = booked === 0 ? 0 : exact - take;
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Preset-driven helpers (exported for tests / UI previews)
// ═════════════════════════════════════════════════════════════════════════════

/** SE-average homeowners insurance $/yr for a dwelling value (linear between survey points). */
export function homeInsuranceAnnual(value: number): number {
  const xs = HOME_INS_COVERAGE_POINTS, ys = HOME_INS_SE_CURVE;
  if (value <= 0) return 0;
  if (value <= xs[0]) return (ys[0] * value) / xs[0];
  if (value >= xs[xs.length - 1]) return (ys[ys.length - 1] * value) / xs[xs.length - 1];
  for (let i = 1; i < xs.length; i++) {
    if (value <= xs[i]) {
      const t = (value - xs[i - 1]) / (xs[i] - xs[i - 1]);
      return ys[i - 1] + t * (ys[i] - ys[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

/** Progressive tax on `taxable` using [overAmount, ratePct] brackets. */
export function bracketTax(taxable: number, brackets: Bracket[]): number {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [over, rate] = brackets[i];
    const next = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    if (taxable <= over) break;
    tax += (Math.min(taxable, next) - over) * (rate / 100);
  }
  return tax;
}

function stateIncomeTax(rule: StateTaxRule, agi: number, status: FilingStatus, federalTax: number): number {
  let base = agi - rule.stdDeduction[status] - rule.exemption[status];
  if (rule.deductsFederalTax) base -= federalTax;
  base = Math.max(0, base);
  const table = rule.highIncome && base > rule.highIncome.over ? rule.highIncome[status] : rule.brackets[status];
  const tax = Math.max(0, bracketTax(base, table) - (rule.credit?.[status] ?? 0));
  return tax + agi * pct(rule.localPctOfAgi);
}

export type AnnualTaxes = { federal: number; state: number; incomeTax: number; fica: number };

/**
 * Annual taxes on wages.
 *   AGI = wages − pre-tax retirement
 *   Federal: 2026 brackets after the standard deduction
 *   State: average of the 12 Southeast states' 2026 rules (FL/TN = $0)
 *   FICA (→ acct 94): 6.2% SS up to the wage base + 1.45% Medicare + 0.9% over the threshold
 *   Override: incomeTaxRatePct (federal + state combined) × AGI replaces federal + state.
 * Charity is NOT deducted (per design).
 */
export function computeAnnualTaxes(
  wages: number, pretaxRetirement: number, status: FilingStatus, incomeTaxRatePct?: number | null,
): AnnualTaxes {
  const agi = Math.max(0, wages - pretaxRetirement);
  const fica =
    Math.min(wages, FICA.socialSecurityWageBase) * pct(FICA.socialSecurityPct) +
    wages * pct(FICA.medicarePct) +
    Math.max(0, wages - FICA.additionalMedicareThreshold[status]) * pct(FICA.additionalMedicarePct);

  if (incomeTaxRatePct !== null && incomeTaxRatePct !== undefined && Number.isFinite(incomeTaxRatePct)) {
    const incomeTax = agi * pct(incomeTaxRatePct);
    return { federal: NaN, state: NaN, incomeTax, fica };
  }
  const federal = bracketTax(Math.max(0, agi - FEDERAL.standardDeduction[status]), FEDERAL.brackets[status]);
  const state =
    SE_STATES.reduce((sum, st) => sum + stateIncomeTax(STATE_TAX[st], agi, status, federal), 0) / SE_STATES.length;
  return { federal, state, incomeTax: federal + state, fica };
}

/** 401(k)-style pre-tax limit for someone this age (whole years). */
export function retirementLimitForAge(ageYears: number): number {
  if (ageYears >= 60 && ageYears <= 63) return RETIREMENT_LIMIT.base + RETIREMENT_LIMIT.catchUp60to63;
  if (ageYears >= 50) return RETIREMENT_LIMIT.base + RETIREMENT_LIMIT.catchUp50;
  return RETIREMENT_LIMIT.base;
}

// ═════════════════════════════════════════════════════════════════════════════
// ███ ENGINES ███
// ═════════════════════════════════════════════════════════════════════════════

// ── Opening cash ─────────────────────────────────────────────────────────────
/** Month 0: Dr cash / Cr equity. */
export const openingCashEngine: Engine<OpeningCashInput> = (input, ctx) => {
  const led = new Ledger(ctx);
  led.move(0, ACCT.CASH, ACCT.EQUITY, roundDollar(needMin(input.amount, 'amount')));
  return led.build();
};

// ── Home costs (shared by existing + buying) ─────────────────────────────────
const homeMonthlyCosts = (utilitiesMonthly: number) => (value: number): Array<[number, number, string]> => [
  [ACCT.PROPERTY_TAX, (value * pct(HOME.propertyTaxPct)) / 12, 'propertyTax'],
  [ACCT.HOME_INSURANCE, homeInsuranceAnnual(value) / 12, 'homeInsurance'],
  [ACCT.HOME_UTILITIES_MAINTENANCE, (value * pct(HOME.maintenancePct)) / 12, 'maintenance'],
  [ACCT.HOME_UTILITIES_MAINTENANCE, utilitiesMonthly, 'utilities'],
];

// ── Existing home ────────────────────────────────────────────────────────────
/**
 * Rebuilds the original mortgage, finds how many months have been paid from the
 * remaining balance, grows the value over that time, then runs the future.
 */
export const existingHomeEngine: Engine<ExistingHomeInput> = (input, ctx) => {
  const led = new Ledger(ctx);
  const price = needMin(input.totalPropertyValue, 'totalPropertyValue');
  const r = pct(optMin(input.interestRatePct, 'interestRatePct')) / 12;
  const n = termMonths(input.mortgageTermYears, 'mortgageTermYears', 12);
  const P0 = price * (1 - pct(optRange(input.downPaymentPct, 'downPaymentPct', 0, 100)));
  const B = roundDollar(optMin(input.remainingBalance, 'remainingBalance') ?? 0);
  const sell = saleMonth(input.sellAge, ctx);

  const monthsPaid = B > 0 ? monthsPaidFromBalance(P0, r, n, B) : P0 > 0 ? n : 0;
  const monthsOwned = input.purchaseAge ? Math.max(0, -toMonth(checkAge(input.purchaseAge, 'purchaseAge'), ctx)) : monthsPaid;
  const monthsLeft = Math.max(1, n - monthsPaid);

  runOwnedAsset(led, ctx, {
    assetAccount: ACCT.PROPERTY,
    valueCounterAccount: ACCT.APPRECIATION,
    annualGrowthPct: HOME.appreciationRealPct,
    openMonth: 0,
    openValueExact: price * Math.pow(1 + pct(HOME.appreciationRealPct), monthsOwned / 12),
    opening: 'existing',
    loan: B > 0 ? {
      balance: B, monthlyRate: r, payment: Math.ceil(paymentFor(B, r, monthsLeft) - 1e-9),
      liabilityAccount: ACCT.MORTGAGE, interestAccount: ACCT.MORTGAGE_INTEREST,
    } : null,
    sellMonth: sell,
    monthlyCosts: homeMonthlyCosts(HOME.utilitiesMonthly),
  });
  return led.build();
};

// ── Buying a home ────────────────────────────────────────────────────────────
export const buyingHomeEngine: Engine<BuyingHomeInput> = (input, ctx) => {
  const led = new Ledger(ctx);
  if (!input.purchaseAge) fail('buying a home needs "purchaseAge"');
  const purchaseAge = checkAge(input.purchaseAge, 'purchaseAge');
  const price = roundDollar(needMin(input.totalPropertyValue, 'totalPropertyValue'));
  const loan = roundDollar(price * (1 - pct(needRange(input.downPaymentPct, 'downPaymentPct', 0, 100))));
  const r = pct(loan > 0 ? needMin(input.interestRatePct, 'interestRatePct') : 0) / 12;
  runOwnedAsset(led, ctx, {
    assetAccount: ACCT.PROPERTY,
    valueCounterAccount: ACCT.APPRECIATION,
    annualGrowthPct: HOME.appreciationRealPct,
    openMonth: eventMonth(purchaseAge, ctx),
    openValueExact: price,
    opening: 'purchase',
    loan: loan > 0 ? {
      balance: loan, monthlyRate: r,
      payment: Math.ceil(paymentFor(loan, r, termMonths(input.mortgageTermYears, 'mortgageTermYears', 12)) - 1e-9),
      liabilityAccount: ACCT.MORTGAGE, interestAccount: ACCT.MORTGAGE_INTEREST,
    } : null,
    sellMonth: saleMonth(input.sellAge, ctx, purchaseAge),
    monthlyCosts: homeMonthlyCosts(optMin(input.utilitiesMonthly, 'utilitiesMonthly') ?? HOME.utilitiesMonthly),
  });
  return led.build();
};

// ── Vehicles (shared) ────────────────────────────────────────────────────────
const vehicleMonthlyCosts = (insuranceMonthly: number, maintenanceMonthly: number) =>
  (): Array<[number, number, string]> => [
    [ACCT.CAR_INSURANCE, insuranceMonthly, 'carInsurance'],
    [ACCT.VEHICLE_MAINTENANCE, maintenanceMonthly, 'vehicleMaintenance'],
  ];

// ── Existing vehicle ─────────────────────────────────────────────────────────
export const existingVehicleEngine: Engine<ExistingVehicleInput> = (input, ctx) => {
  const led = new Ledger(ctx);
  const price = needMin(input.totalVehicleValue, 'totalVehicleValue');
  const financing = oneOf(input.financing, 'financing', ['loan', 'full']);
  const sell = saleMonth(input.sellAge, ctx);
  let monthsOwned = 0;
  let loan: OwnedAssetSpec['loan'] = null;

  if (financing === 'loan') {
    const r = pct(optMin(input.interestRatePct, 'interestRatePct')) / 12;
    const n = termMonths(input.loanTermMonths, 'loanTermMonths');
    const P0 = price * (1 - pct(optRange(input.downPaymentPct, 'downPaymentPct', 0, 100)));
    const B = roundDollar(optMin(input.remainingBalance, 'remainingBalance') ?? 0);
    const monthsPaid = B > 0 ? monthsPaidFromBalance(P0, r, n, B) : n;
    monthsOwned = monthsPaid;
    if (B > 0) loan = {
      balance: B, monthlyRate: r, payment: Math.ceil(paymentFor(B, r, Math.max(1, n - monthsPaid)) - 1e-9),
      liabilityAccount: ACCT.VEHICLE_LOAN, interestAccount: ACCT.VEHICLE_LOAN_INTEREST,
    };
  } else if (!input.purchaseAge) fail('existing vehicle bought in full needs "purchaseAge"');
  if (input.purchaseAge) monthsOwned = Math.max(0, -toMonth(checkAge(input.purchaseAge, 'purchaseAge'), ctx));

  runOwnedAsset(led, ctx, {
    assetAccount: ACCT.VEHICLES,
    valueCounterAccount: ACCT.VEHICLE_DEPRECIATION,
    annualGrowthPct: -VEHICLE.depreciationRealPct,
    openMonth: 0,
    openValueExact: price * Math.pow(1 - pct(VEHICLE.depreciationRealPct), monthsOwned / 12),
    opening: 'existing',
    loan,
    sellMonth: sell,
    monthlyCosts: vehicleMonthlyCosts(VEHICLE.insuranceMonthly, VEHICLE.maintenanceMonthly),
  });
  return led.build();
};

// ── Buying a car ─────────────────────────────────────────────────────────────
export const buyingCarEngine: Engine<BuyingCarInput> = (input, ctx) => {
  const led = new Ledger(ctx);
  if (!input.purchaseAge) fail('buying a car needs "purchaseAge"');
  const purchaseAge = checkAge(input.purchaseAge, 'purchaseAge');
  const price = roundDollar(needMin(input.totalVehicleValue, 'totalVehicleValue'));
  const financing = oneOf(input.financing, 'financing', ['loan', 'full']);
  const loanAmt = financing === 'loan'
    ? roundDollar(price * (1 - pct(optRange(input.downPaymentPct, 'downPaymentPct', 0, 100)))) : 0;
  const r = pct(loanAmt > 0 ? needMin(input.interestRatePct, 'interestRatePct') : 0) / 12;
  runOwnedAsset(led, ctx, {
    assetAccount: ACCT.VEHICLES,
    valueCounterAccount: ACCT.VEHICLE_DEPRECIATION,
    annualGrowthPct: -VEHICLE.depreciationRealPct,
    openMonth: eventMonth(purchaseAge, ctx),
    openValueExact: price,
    opening: 'purchase',
    loan: loanAmt > 0 ? {
      balance: loanAmt, monthlyRate: r,
      payment: Math.ceil(paymentFor(loanAmt, r, termMonths(input.loanTermMonths, 'loanTermMonths')) - 1e-9),
      liabilityAccount: ACCT.VEHICLE_LOAN, interestAccount: ACCT.VEHICLE_LOAN_INTEREST,
    } : null,
    sellMonth: saleMonth(input.sellAge, ctx, purchaseAge),
    monthlyCosts: vehicleMonthlyCosts(
      optMin(input.insuranceMonthly, 'insuranceMonthly') ?? VEHICLE.insuranceMonthly,
      optMin(input.maintenanceMonthly, 'maintenanceMonthly') ?? VEHICLE.maintenanceMonthly,
    ),
  });
  return led.build();
};

// ── Existing credit card debt ────────────────────────────────────────────────
/** Interest accrues monthly onto the card; payments start at paymentStartAge. */
export const existingCreditCardEngine: Engine<ExistingCreditCardInput> = (input, ctx) => {
  const led = new Ledger(ctx);
  const bal = roundDollar(needMin(input.currentBalance, 'currentBalance'));
  led.move(0, ACCT.EQUITY, ACCT.CREDIT_CARD, bal);
  runLoan(led, {
    balance: bal, monthlyRate: pct(needMin(input.aprPct, 'aprPct')) / 12,
    payment: optMin(input.monthlyPayment, 'monthlyPayment') ?? 0,
    firstMonth: 1, payFromMonth: recurringWindow(ctx, input.paymentStartAge).first, lastMonth: lastMonthOf(ctx),
    liabilityAccount: ACCT.CREDIT_CARD, interestAccount: ACCT.CREDIT_CARD_INTEREST,
  });
  return led.build();
};

// ── Existing loans (student + other non-asset) ───────────────────────────────
/** The "any 3 of 4" loan inputs, each checked when given (term ≥ 1 month, the rest ≥ 0). */
const checkedLoanInputs = (input: ExistingLoanInput) => ({
  balance: optMin(input.remainingBalance, 'remainingBalance'),
  ratePct: optMin(input.interestRatePct, 'interestRatePct'),
  termMonths: optMin(input.remainingTermMonths, 'remainingTermMonths', 1),
  payment: optMin(input.monthlyPayment, 'monthlyPayment'),
});
const existingLoanEngine = (liab: number, interest: number): Engine<ExistingLoanInput> => (input, ctx) => {
  const led = new Ledger(ctx);
  const t = solveLoan(checkedLoanInputs(input));
  const B = roundDollar(t.balance);
  const payment = input.monthlyPayment ?? Math.ceil(t.payment - 1e-9);
  led.move(0, ACCT.EQUITY, liab, B);
  runLoan(led, {
    balance: B, monthlyRate: t.ratePct / 1200, payment,
    firstMonth: 1, payFromMonth: 1, lastMonth: lastMonthOf(ctx),
    liabilityAccount: liab, interestAccount: interest,
  });
  return led.build();
};
export const existingStudentLoansEngine = existingLoanEngine(ACCT.STUDENT_LOANS, ACCT.STUDENT_LOAN_INTEREST);
export const otherExistingLoanEngine = existingLoanEngine(ACCT.OTHER_DEBT, ACCT.OTHER_DEBT_INTEREST);

// ── Other existing assets ────────────────────────────────────────────────────
/** Asset → acct 0, value change ↔ 52, loan → 23 / interest 92. Held to the end. */
export const otherExistingAssetEngine: Engine<OtherExistingAssetInput> = (input, ctx) => {
  const led = new Ledger(ctx);
  if (!input.purchaseAge) fail('other existing asset needs "purchaseAge"');
  const g = needMin(input.appreciationPct, 'appreciationPct', -100);
  const monthsOwned = Math.max(0, -toMonth(checkAge(input.purchaseAge, 'purchaseAge'), ctx));
  if (typeof input.financedWithLoan !== 'boolean') fail('"financedWithLoan" must be true or false');
  let loan: OwnedAssetSpec['loan'] = null;
  if (input.financedWithLoan) {
    const t = solveLoan(checkedLoanInputs(input));
    loan = {
      balance: t.balance, monthlyRate: t.ratePct / 1200,
      payment: input.monthlyPayment ?? Math.ceil(t.payment - 1e-9),
      liabilityAccount: ACCT.OTHER_DEBT, interestAccount: ACCT.OTHER_DEBT_INTEREST,
    };
  }
  runOwnedAsset(led, ctx, {
    assetAccount: ACCT.PROPERTY,
    valueCounterAccount: ACCT.APPRECIATION,
    annualGrowthPct: g,
    openMonth: 0,
    openValueExact: needMin(input.assetValue, 'assetValue') * Math.max(0, Math.pow(1 + pct(g), monthsOwned / 12)),
    opening: 'existing',
    loan,
    sellMonth: null,
  });
  return led.build();
};

// ── Existing investment account ──────────────────────────────────────────────
export const existingInvestmentEngine: Engine<ExistingInvestmentInput> = (input, ctx) => {
  const led = new Ledger(ctx);
  const c = recurringWindow(ctx, input.contributionStartAge, input.contributionEndAge);
  const w = recurringWindow(ctx, input.withdrawalStartAge, input.withdrawalEndAge);
  runInvestment(led, ctx, {
    account: needInvestmentAccount(input.account),
    openMonth: 0, openAmount: needMin(input.currentInvested, 'currentInvested'), openFrom: 'equity',
    returnPct: needMin(input.returnPct, 'returnPct', -100),
    contribution: { monthly: optMin(input.monthlyContribution, 'monthlyContribution') ?? 0, ...c },
    withdrawal: { monthly: optMin(input.monthlyWithdrawal, 'monthlyWithdrawal') ?? 0, ...w },
  });
  return led.build();
};

// ── Investing (new account) ──────────────────────────────────────────────────
export const investingEngine: Engine<InvestingInput> = (input, ctx) => {
  const led = new Ledger(ctx);
  if (!input.contributionStartAge) fail('investing needs "contributionStartAge"');
  const open = eventMonth(input.contributionStartAge, ctx);
  const c = recurringWindow(ctx, input.contributionStartAge, input.contributionEndAge);
  const w = recurringWindow(ctx, input.withdrawalStartAge ?? input.contributionStartAge, input.withdrawalEndAge);
  runInvestment(led, ctx, {
    account: needInvestmentAccount(input.account),
    openMonth: open, openAmount: optMin(input.initialContribution, 'initialContribution') ?? 0, openFrom: 'cash',
    returnPct: needMin(input.returnPct, 'returnPct', -100),
    contribution: { monthly: optMin(input.monthlyContribution, 'monthlyContribution') ?? 0, ...c },
    withdrawal: {
      monthly: optMin(input.monthlyWithdrawal, 'monthlyWithdrawal') ?? 0, first: Math.max(w.first, open + 1), last: w.last,
    },
  });
  return led.build();
};

// ── Income ───────────────────────────────────────────────────────────────────
/**
 * Monthly: Cr 50 gross · Dr 79 income tax · Dr 94 SS+Medicare · Dr 93 charity ·
 *          Dr retirement account (pre-tax) · Dr cash net pay.
 * Taxes are figured on the whole salary year, then spread evenly over its 12 months.
 * This engine also grows its own retirement deposits (Dr account / Cr 51) until endMonth.
 */
export const incomeEngine: Engine<IncomeInput> = (input, ctx) => {
  const led = new Ledger(ctx);
  const salary = needMin(input.salary, 'salary');
  const raise = pct(optMin(input.raisePct, 'raisePct', -100));
  const charity = pct(optRange(input.charityPct, 'charityPct', 0, 100));
  const retPct = pct(optRange(input.retirementContributionPct, 'retirementContributionPct', 0, 100));
  const retAcct = retPct > 0 ? needInvestmentAccount(input.retirementAccount as number, 'retirementAccount') : 0;
  const taxRatePct = optRange(input.incomeTaxRatePct, 'incomeTaxRatePct', 0, 100);
  const { first, last } = recurringWindow(ctx, input.startAge, input.endAge);
  const status: FilingStatus = oneOf(input.filingStatus, 'filingStatus', ['single', 'married']);

  // Retirement deposits (grown here; several income entities can share account 3)
  const retFactor = monthlyFactor(
    optMin(input.retirementReturnPct, 'retirementReturnPct', -100) ?? INVESTING.defaultRealReturnPct,
  );
  const retDeposits = new Accrual();
  let retExact = 0;
  let retBooked = 0;

  let yearIndex = -1;
  let gross = 0, retirement = 0, incomeTax = 0, fica = 0;
  const growUntil = retPct > 0 ? lastMonthOf(ctx) : last;

  for (let m = first; m <= growUntil; m++) {
    // 1) Grow retirement money deposited before this month
    if (retExact !== 0) {
      retExact *= retFactor;
      const target = roundDollar(retExact);
      led.move(m, retAcct, ACCT.INVESTMENT_GAINS, target - retBooked);
      retBooked = target;
    }
    if (m > last) continue;

    // 2) New salary year → recompute that year's numbers once
    const yi = Math.floor((m - first) / 12);
    if (yi !== yearIndex) {
      yearIndex = yi;
      gross = salary * Math.pow(1 + raise, yi);
      const ageYears = Math.floor((ageInMonths(ctx.startAge) + m - 1) / 12);
      retirement = Math.min(gross * retPct, retirementLimitForAge(ageYears));
      ({ incomeTax, fica } = computeAnnualTaxes(gross, retirement, status, taxRatePct));
    }

    // 3) Paycheck. Accrual keeps each stream's yearly total exact; cash takes the net.
    led.expense(m, ACCT.EARNED_INCOME, -gross / 12, 'gross'); // Cr 50, Dr cash
    led.expense(m, ACCT.INCOME_TAX, incomeTax / 12, 'incomeTax');
    led.expense(m, ACCT.OTHER_TAXES, fica / 12, 'fica');
    if (charity) led.expense(m, ACCT.CHARITY, (gross * charity) / 12, 'charity');
    if (retPct > 0) {
      const dep = retDeposits.take(retirement / 12);
      led.move(m, retAcct, ACCT.CASH, dep); // pre-tax deposit
      retExact += dep;
      retBooked += dep;
    }
  }
  return led.build();
};

// ── Simple recurring expenses (shared) ───────────────────────────────────────
/** Posts the given monthly amounts every month of the window (drift-free rounding). */
function recurring(
  ctx: EngineCtx, startAge: Age | null | undefined, endAge: Age | null | undefined,
  streams: Array<[account: number, monthly: number, key: string]>,
): JournalEntry[] {
  const led = new Ledger(ctx);
  const { first, last } = recurringWindow(ctx, startAge, endAge);
  for (let m = first; m <= last; m++) for (const [acct, amt, key] of streams) if (amt) led.expense(m, acct, amt, key);
  return led.build();
}

// ── Home renting ─────────────────────────────────────────────────────────────
export const rentingEngine: Engine<RentingInput> = (input, ctx) =>
  recurring(ctx, input.startAge, input.endAge, [
    [ACCT.RENT, needMin(input.rentMonthly, 'rentMonthly'), 'rent'],
    [ACCT.RENT, optMin(input.junkFeesMonthly, 'junkFeesMonthly') ?? 0, 'junkFees'],
    [ACCT.RENTERS_INSURANCE, HOME.renterInsuranceMonthly, 'rentersInsurance'],
    [ACCT.HOME_UTILITIES_MAINTENANCE, optMin(input.utilitiesMonthly, 'utilitiesMonthly') ?? 0, 'utilities'],
  ]);

// ── Gas ──────────────────────────────────────────────────────────────────────
/** $/month = miles/week × 52 ÷ 12 ÷ mpg × $/gal */
export const gasEngine: Engine<GasInput> = (input, ctx) => {
  const mpg = need(input.mpg, 'mpg');
  if (mpg <= 0) fail(`"mpg" must be > 0, got ${mpg}`);
  const price = optMin(input.gasPricePerGallon, 'gasPricePerGallon') ?? GAS.pricePerGallon;
  const monthly = ((needMin(input.milesPerWeek, 'milesPerWeek') * 52) / 12 / mpg) * price;
  return recurring(ctx, input.startAge, input.endAge, [[ACCT.GAS, monthly, 'gas']]);
};

// ── Kids (one kid per entity) ────────────────────────────────────────────────
/** Runs from birth until the kid turns KIDS.endAge (preset, 20). */
export const kidEngine: Engine<KidInput> = (input, ctx) => {
  if (!input.birthAge) fail('kid needs "birthAge"');
  const endAgeMonths = ageInMonths(checkAge(input.birthAge, 'birthAge')) + KIDS.endAge * 12;
  const endAge: Age = { years: Math.floor(endAgeMonths / 12), months: endAgeMonths % 12 };
  return recurring(ctx, input.birthAge, endAge, [[ACCT.KIDS, needMin(input.annualCost, 'annualCost') / 12, 'kid']]);
};

// ── Education ────────────────────────────────────────────────────────────────
/**
 * Semesters land every 6 months starting at startAge (event months). Semesters before
 * month 0 are skipped (enter those as existing student loans).
 *  full: Dr 81 / Cr cash each semester.
 *  loan: Dr 81 / Cr 22 each semester (money is borrowed). While in school and during
 *        the 6-month grace period, SIMPLE interest accrues on the amount borrowed
 *        (Dr 82 / Cr 22). Then the whole balance is repaid in level payments over the term.
 *        "Finish age" isn't needed: school ends 6 months after the last semester starts.
 */
export const educationEngine: Engine<EducationInput> = (input, ctx) => {
  const led = new Ledger(ctx);
  if (!input.startAge) fail('education needs "startAge"');
  const s = toMonth(checkAge(input.startAge, 'startAge'), ctx); // may be < 0 if school already started
  const paymentType = oneOf(input.paymentType, 'paymentType', ['loan', 'full']);
  const N = Math.round(needMin(input.numberOfSemesters, 'numberOfSemesters'));
  const cost = roundDollar(needMin(input.costPerSemester, 'costPerSemester'));
  const gap = EDUCATION.semesterSpacingMonths;
  // Past semesters are skipped (already paid / already existing student loans).
  const semesterMonths = Array.from({ length: N }, (_, i) => s + i * gap).filter((m) => m >= 0);

  if (paymentType === 'full') {
    for (const m of semesterMonths) led.move(m, ACCT.EDUCATION, ACCT.CASH, cost);
    return led.build();
  }

  const r = pct(needMin(input.loanRatePct, 'loanRatePct')) / 12;
  const n = termMonths(input.loanTermYears, 'loanTermYears', 12);
  const schoolEnds = s + N * gap;
  const repayStart = schoolEnds + EDUCATION.gracePeriodMonths + 1; // first payment month
  const accrual = new Accrual();
  let principal = 0;
  let balance = 0;
  for (let m = Math.max(0, s); m < repayStart; m++) {
    if (m > Math.max(0, s)) {
      const interest = accrual.take(principal * r); // interest for the month just ended
      led.move(m, ACCT.STUDENT_LOAN_INTEREST, ACCT.STUDENT_LOANS, interest);
      balance += interest;
    }
    if (semesterMonths.includes(m)) {
      led.move(m, ACCT.EDUCATION, ACCT.STUDENT_LOANS, cost);
      principal += cost;
      balance += cost;
    }
  }
  runLoan(led, {
    balance, monthlyRate: r, payment: Math.ceil(paymentFor(balance, r, n) - 1e-9),
    firstMonth: repayStart, payFromMonth: repayStart, lastMonth: lastMonthOf(ctx),
    liabilityAccount: ACCT.STUDENT_LOANS, interestAccount: ACCT.STUDENT_LOAN_INTEREST,
  });
  return led.build();
};

// ── Food ─────────────────────────────────────────────────────────────────────
export const foodEngine: Engine<FoodInput> = (input, ctx) =>
  recurring(ctx, input.startAge, input.endAge, [
    [ACCT.FOOD, optMin(input.diningOutMonthly, 'diningOutMonthly') ?? 0, 'diningOut'],
    [ACCT.FOOD, optMin(input.groceriesMonthly, 'groceriesMonthly') ?? 0, 'groceries'],
  ]);

// ── Health insurance ─────────────────────────────────────────────────────────
export const healthInsuranceEngine: Engine<HealthInsuranceInput> = (input, ctx) => {
  const type = oneOf(input.type, 'type', Object.keys(HEALTH_PREMIUM_MONTHLY) as HealthInsuranceType[]);
  return recurring(ctx, input.startAge, input.endAge, [
    [ACCT.HEALTH_INSURANCE, optMin(input.monthlyPremiumOverride, 'monthlyPremiumOverride') ?? HEALTH_PREMIUM_MONTHLY[type], 'health'],
  ]);
};

// ── Pets (one pet per entity) ────────────────────────────────────────────────
export const petEngine: Engine<PetInput> = (input, ctx) => {
  if (!input.startAge) fail('pet needs "startAge"');
  const endMonths = ageInMonths(checkAge(input.startAge, 'startAge')) + Math.round(needMin(input.lifespanYears, 'lifespanYears') * 12);
  const endAge: Age = { years: Math.floor(endMonths / 12), months: endMonths % 12 };
  const vetMonthly = (optMin(input.vetPerYear, 'vetPerYear') ?? 0) / 12;
  const foodMonthly = optMin(input.foodPerMonth, 'foodPerMonth') ?? 0;
  const adoption = roundDollar(optMin(input.adoptionCost, 'adoptionCost') ?? 0);
  const led = new Ledger(ctx);
  const adoptMonth = costMonth(input.startAge, ctx); // an already-owned pet has no adoption cost
  if (adoptMonth !== null) led.move(adoptMonth, ACCT.PETS, ACCT.CASH, adoption);
  const { first, last } = recurringWindow(ctx, input.startAge, endAge);
  for (let m = first; m <= last; m++) {
    led.expense(m, ACCT.PETS, vetMonthly, 'vet');
    led.expense(m, ACCT.PETS, foodMonthly, 'petFood');
  }
  return led.build();
};

// ── Personal items & recreation ──────────────────────────────────────────────
export const personalEngine: Engine<PersonalInput> = (input, ctx) => {
  const keys = ['clothing', 'otherPersonalCare', 'entertainment', 'gym', 'phonePlan', 'books', 'courses', 'events'] as const;
  return recurring(ctx, input.startAge, input.endAge, keys.map((k) => [ACCT.PERSONAL, optMin(input[k], k) ?? 0, k]));
};

// ── Birthday & Christmas ─────────────────────────────────────────────────────
export const birthdayChristmasEngine: Engine<BirthdayChristmasInput> = (input, ctx) =>
  recurring(ctx, input.startAge, input.endAge, [
    [ACCT.BIRTHDAY_CHRISTMAS, toMonthly(needMin(input.amount, 'amount'), input.frequency), 'gifts'],
  ]);

// ── Other: one-time expense ──────────────────────────────────────────────────
export const oneTimeExpenseEngine: Engine<OneTimeExpenseInput> = (input, ctx) => {
  if (!input.age) fail('one-time expense needs "age"');
  const amount = roundDollar(needMin(input.amount, 'amount'));
  const led = new Ledger(ctx);
  const m = costMonth(checkAge(input.age, 'age'), ctx); // past expenses are already in opening cash
  if (m !== null) led.move(m, ACCT.ONE_TIME, ACCT.CASH, amount);
  return led.build();
};

// ── Other: recurring payment ─────────────────────────────────────────────────
export const recurringPaymentEngine: Engine<RecurringPaymentInput> = (input, ctx) =>
  recurring(ctx, input.startAge, input.endAge, [
    [ACCT.RECURRING, toMonthly(needMin(input.amount, 'amount'), input.frequency), 'recurring'],
  ]);

// ═════════════════════════════════════════════════════════════════════════════
// Registry: upstream picks the engine by entity type.
// ═════════════════════════════════════════════════════════════════════════════
export const ENGINES = {
  openingCash: openingCashEngine,
  existingHome: existingHomeEngine,
  existingVehicle: existingVehicleEngine,
  existingCreditCard: existingCreditCardEngine,
  existingStudentLoans: existingStudentLoansEngine,
  existingInvestment: existingInvestmentEngine,
  otherExistingAsset: otherExistingAssetEngine,
  otherExistingLoan: otherExistingLoanEngine,
  income: incomeEngine,
  renting: rentingEngine,
  buyingHome: buyingHomeEngine,
  buyingCar: buyingCarEngine,
  gas: gasEngine,
  kid: kidEngine,
  education: educationEngine,
  investing: investingEngine,
  food: foodEngine,
  healthInsurance: healthInsuranceEngine,
  pet: petEngine,
  personal: personalEngine,
  birthdayChristmas: birthdayChristmasEngine,
  oneTimeExpense: oneTimeExpenseEngine,
  recurringPayment: recurringPaymentEngine,
} as const satisfies { [K in EntityTypeKey]: Engine<EntityInputs[K]> };
