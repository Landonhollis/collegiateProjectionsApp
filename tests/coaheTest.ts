// coaheTest.ts — run with:  npx tsx coaheTest.ts
// No test framework needed. Exits non-zero on any failure.
import { ACCOUNT_COUNT, balanceAt, coahe, monthCount } from '../Engines/coahe';
import { ACCT, ENGINES } from '../Engines/entityEngines';
import type { Age, EngineCtx, JournalEntry } from '../TypesAndVariables/types';

// ── tiny harness ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const fails: string[] = [];
function check(cond: boolean, msg: string) {
  if (cond) passed++;
  else { failed++; fails.push(msg); }
}
function test(name: string, fn: () => void) {
  try { fn(); } catch (e) { failed++; fails.push(`${name}: threw ${(e as Error).message}`); }
}
const throws = (fn: () => void): boolean => { try { fn(); return false; } catch { return true; } };

const ctx = (startYears = 25, endMonth?: number): EngineCtx => ({ caseId: 'c-test', startAge: { years: startYears, months: 0 }, endMonth });
const age = (years: number, months = 0): Age => ({ years, months });
const je = (month: number, lines: Array<[number, number]>, caseId = 'c-test'): JournalEntry =>
  ({ caseId, month, lineEntries: lines.map(([account, amount]) => ({ account, amount })) });

/** Reference implementation: the literal "for each month, scan every entry" loop. */
function naive(entries: JournalEntry[]): number[] {
  const last = Math.max(...entries.map((e) => e.month));
  const running = new Array(ACCOUNT_COUNT).fill(0);
  const history: number[] = [];
  for (let month = 0; month <= last; month++) {
    for (const e of entries) {
      if (e.month !== month) continue;
      for (const l of e.lineEntries) running[l.account] += l.amount;
    }
    history.push(...running);
  }
  return history;
}

// ═════════════════════════════════════════════════════════════════════════════
test('hand-built entries', () => {
  const h = coahe([
    je(2, [[ACCT.FOOD, 100], [ACCT.CASH, -100]]), // out of order on purpose
    je(0, [[ACCT.CASH, 1_000], [ACCT.EQUITY, -1_000]]),
    je(2, [[ACCT.RENT, 500], [ACCT.CASH, -500]]),
    je(4, [[ACCT.CASH, 3_000], [ACCT.EARNED_INCOME, -3_000]]),
  ]);
  check(h instanceof Float64Array, 'returns a Float64Array');
  check(h.length === 5 * ACCOUNT_COUNT && monthCount(h) === 5, 'length = (last month + 1) · 150');
  check(h[ACCT.CASH] === 1_000 && h[ACCT.EQUITY] === -1_000, 'month 0 = opening balances (raw signed)');
  check(balanceAt(h, 1, ACCT.CASH) === 1_000, 'empty month repeats previous balances');
  check(balanceAt(h, 2, ACCT.CASH) === 400 && balanceAt(h, 2, ACCT.FOOD) === 100 && balanceAt(h, 2, ACCT.RENT) === 500, 'two entries in one month both post');
  check(h[3 * ACCOUNT_COUNT + ACCT.CASH] === 400, 'index = month · 150 + account');
  check(balanceAt(h, 4, ACCT.CASH) === 3_400 && balanceAt(h, 4, ACCT.FOOD) === 100, 'running total never resets');
  check(balanceAt(h, 4, 149) === 0, 'untouched accounts stay 0');
});

test('empty input', () => {
  check(coahe([]).length === 0, 'no entries → empty history');
});

test('bad input fails loudly', () => {
  const ok = je(0, [[ACCT.CASH, 1], [ACCT.EQUITY, -1]]);
  check(throws(() => coahe([ok, je(1, [[ACCT.CASH, 1], [ACCT.EQUITY, -1]], 'other')])), 'mixed caseIds');
  check(throws(() => coahe([je(-1, [[ACCT.CASH, 1], [ACCT.EQUITY, -1]])])), 'negative month');
  check(throws(() => coahe([je(1.5, [[ACCT.CASH, 1], [ACCT.EQUITY, -1]])])), 'non-integer month');
  check(throws(() => coahe([je(0, [[150, 1], [ACCT.EQUITY, -1]])])), 'account 150');
  check(throws(() => coahe([je(0, [[-1, 1], [ACCT.EQUITY, -1]])])), 'account −1');
  check(throws(() => coahe([je(0, [[ACCT.CASH, 1.5], [ACCT.EQUITY, -1.5]])])), 'non-whole-dollar amount');
  check(throws(() => coahe([je(0, [[ACCT.CASH, 2], [ACCT.EQUITY, -1]])])), 'entry not summing to 0');
  check(!throws(() => coahe([ok])), 'valid entry does not throw');
});

// Full case built from the real entity engines
const c = ctx(22);
const caseEntries: JournalEntry[] = [
  ...ENGINES.openingCash({ amount: 3_000 }, c),
  ...ENGINES.income({ salary: 60_000, raisePct: 2, filingStatus: 'single', retirementContributionPct: 6, retirementAccount: 3, endAge: age(65) }, c),
  ...ENGINES.renting({ rentMonthly: 1_300, utilitiesMonthly: 150, endAge: age(30) }, c),
  ...ENGINES.buyingHome({ purchaseAge: age(30), totalPropertyValue: 350_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6.5 }, c),
  ...ENGINES.buyingCar({ purchaseAge: age(24), financing: 'loan', totalVehicleValue: 30_000, downPaymentPct: 10, loanTermMonths: 60, interestRatePct: 7, sellAge: age(34) }, c),
  ...ENGINES.existingStudentLoans({ remainingBalance: 25_000, interestRatePct: 5, remainingTermMonths: 120 }, c),
  ...ENGINES.existingCreditCard({ currentBalance: 2_000, aprPct: 24, monthlyPayment: 150 }, c),
  ...ENGINES.investing({ account: 4, initialContribution: 1_000, returnPct: 7, contributionStartAge: age(25), monthlyContribution: 300, contributionEndAge: age(60) }, c),
  ...ENGINES.food({ diningOutMonthly: 200, groceriesMonthly: 400, endAge: age(80) }, c),
  ...ENGINES.kid({ annualCost: 15_000, birthAge: age(32) }, c),
  ...ENGINES.pet({ startAge: age(26), lifespanYears: 12, vetPerYear: 600, foodPerMonth: 50, adoptionCost: 250 }, c),
  ...ENGINES.oneTimeExpense({ age: age(40), amount: 12_000 }, c),
];

test('full case from the entity engines', () => {
  const h = coahe(caseEntries);
  const last = Math.max(...caseEntries.map((e) => e.month));
  check(monthCount(h) === last + 1, `month count = ${last + 1}`);

  // Matches the literal nested-loop definition exactly
  const ref = naive(caseEntries);
  let mismatches = 0;
  for (let i = 0; i < ref.length; i++) if (h[i] !== ref[i]) mismatches++;
  check(ref.length === h.length && mismatches === 0, `matches literal nested loop (${mismatches} mismatches)`);

  // Every month's snapshot sums to 0 (debits = credits)
  let unbalanced = 0;
  for (let m = 0; m <= last; m++) {
    let sum = 0;
    for (let a = 0; a < ACCOUNT_COUNT; a++) sum += balanceAt(h, m, a);
    if (sum !== 0) unbalanced++;
  }
  check(unbalanced === 0, `every month sums to 0 (${unbalanced} months off)`);

  // Spot checks against known engine behavior
  check(balanceAt(h, 0, ACCT.STUDENT_LOANS) === -25_000, 'opening student loan balance −25000');
  check(balanceAt(h, 0, ACCT.CREDIT_CARD) === -2_000, 'opening credit card balance −2000');
  check(balanceAt(h, last, ACCT.STUDENT_LOANS) === 0, 'student loans paid off by the end');
  check(balanceAt(h, 95, ACCT.PROPERTY) === 0 && balanceAt(h, 96, ACCT.PROPERTY) === 350_000, 'home lands on the books at month 96');
  check(balanceAt(h, 96, ACCT.MORTGAGE) === -280_000, 'mortgage opens at −280000');
});

test('performance', () => {
  const t0 = Date.now();
  for (let i = 0; i < 20; i++) coahe(caseEntries);
  const ms = (Date.now() - t0) / 20;
  check(ms < 50, `avg coahe run < 50 ms (got ${ms.toFixed(1)} ms)`);
  console.log(`  perf: ~${ms.toFixed(1)} ms per coahe run (${caseEntries.length} journal entries)`);
});

test('order, gaps, linearity, no mutation', () => {
  const a = [je(0, [[ACCT.CASH, 500], [ACCT.EQUITY, -500]]), je(3, [[ACCT.FOOD, 20], [ACCT.CASH, -20]])];
  const b = [je(1, [[ACCT.RENT, 100], [ACCT.CASH, -100]]), je(900, [[ACCT.ONE_TIME, 7], [ACCT.CASH, -7]])];
  const all = [...a, ...b];
  const frozen = JSON.stringify(all);
  const h = coahe(all);
  check(JSON.stringify(all) === frozen, 'input not mutated');
  const shuffled = coahe([all[3], all[1], all[0], all[2]]);
  check(shuffled.every((v, i) => v === h[i]), 'entry order does not matter');
  check(monthCount(h) === 901 && balanceAt(h, 899, ACCT.CASH) === 380 && balanceAt(h, 900, ACCT.CASH) === 373, 'long gap carries balances forward');
  // Linearity: coahe(A ∪ B) = coahe(A) + coahe(B), shorter one padded with its last month
  const ha = coahe(a), hb = coahe(b);
  let bad = 0;
  for (let m = 0; m < 901; m++) for (let acct = 0; acct < ACCOUNT_COUNT; acct++) {
    const va = balanceAt(ha, Math.min(m, monthCount(ha) - 1), acct), vb = balanceAt(hb, Math.min(m, monthCount(hb) - 1), acct);
    if (balanceAt(h, m, acct) !== va + vb) bad++;
  }
  check(bad === 0, `coahe(A ∪ B) = coahe(A) + coahe(B) (${bad} misses)`);
  check(coahe([je(0, [[0, 5], [149, -5]])]).length === ACCOUNT_COUNT, 'only month 0 → 150 values; accounts 0 and 149 work');
  const big = coahe([je(0, [[ACCT.CASH, 4_000_000_000_000], [ACCT.EQUITY, -4_000_000_000_000]])]);
  check(big[ACCT.CASH] === 4e12, 'trillions stay exact');
  check(coahe([{ caseId: 'c-test', month: 2, lineEntries: [] }]).length === 3 * ACCOUNT_COUNT, 'an entry with no lines is fine');
  check(throws(() => coahe([je(0, [[ACCT.CASH, NaN], [ACCT.EQUITY, 0]])])), 'NaN amount throws');
  check(throws(() => coahe([{ caseId: 'c-test', month: '3' as unknown as number, lineEntries: [] }])), 'string month throws');
  check(throws(() => coahe([je(0, [[1.5, 1], [ACCT.EQUITY, -1]])])), 'fractional account throws');
});

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed) {
  for (const f of fails.slice(0, 40)) console.log('  ✗ ' + f);
  throw new Error(`${failed} checks failed`);
}
