// outcomesTest.ts — run with:  npx tsx outcomesTest.ts
// No test framework needed. Exits non-zero on any failure.
import { ACCOUNT_COUNT, balanceAt, coahe, monthCount } from '../Engines/coahe';
import { ACCT } from '../Engines/entityEngines';
import { makeEntityId, masterEngine } from '../Engines/masterEngine';
import { OUTCOME_RULES, outcomeSeries } from '../Engines/outcomes';
import { OUTCOME_KEYS, OUTCOME_LABELS } from '../TypesAndVariables/outcomeLabels';
import type { Age, Case, Entity, EntityTypeKey, JournalEntry, OutcomeKey } from '../TypesAndVariables/types';

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

const age = (years: number, months = 0): Age => ({ years, months });
const je = (month: number, lines: Array<[number, number]>): JournalEntry =>
  ({ caseId: 'c', month, lineEntries: lines.map(([account, amount]) => ({ account, amount })) });
const entity = (type: EntityTypeKey, inputs: Record<string, unknown>): Entity =>
  ({ entityId: makeEntityId(type), caseId: 'c', name: type, isHidden: false, inputs });
const kase: Case = { caseId: 'c', caseName: 'c', caseColor: '#000000', caseIndex: 0, isHidden: false };
/** Run one case made of these entities and return its history. */
function historyOf(entities: Entity[], startingAge: Age = age(25)): Float64Array {
  const computed = masterEngine({ startingAge, cases: [kase], entities }).computedCases[0];
  if (!computed.chartOfAccountsHistory) throw new Error(`case failed: ${computed.error?.message}`);
  return computed.chartOfAccountsHistory;
}
const list = (series: Float64Array): string => Array.from(series).join(',');
const sum = (series: Float64Array): number => series.reduce((s, v) => s + v, 0);

// ═════════════════════════════════════════════════════════════════════════════
test('hand-built entries: every outcome, by hand', () => {
  const h = coahe([
    // month 0: $5,000 cash, $2,000 invested (acct 4), $1,000 in retirement (acct 3), a $20,000 car with a $12,000 loan
    je(0, [[ACCT.CASH, 5_000], [4, 2_000], [3, 1_000], [ACCT.VEHICLES, 20_000], [ACCT.VEHICLE_LOAN, -12_000], [ACCT.EQUITY, -16_000]]),
    // month 1: $4,000 pay, $900 income tax, $1,000 rent
    je(1, [[ACCT.CASH, 2_100], [ACCT.EARNED_INCOME, -4_000], [ACCT.INCOME_TAX, 900], [ACCT.RENT, 1_000]]),
    // month 1: value changes (no money moves): car −$300, investment +$20, retirement +$10
    je(1, [[ACCT.VEHICLE_DEPRECIATION, 300], [ACCT.VEHICLES, -300], [4, 20], [ACCT.INVESTMENT_GAINS, -20], [3, 10], [ACCT.RETIREMENT_GAINS, -10]]),
    // month 1: car loan: $60 interest, $400 payment
    je(1, [[ACCT.VEHICLE_LOAN_INTEREST, 60], [ACCT.VEHICLE_LOAN, 340], [ACCT.CASH, -400]]),
    // month 3: $500 moved from cash into the investment, and the investment loses $50
    je(3, [[4, 450], [ACCT.CASH, -500], [ACCT.INVESTMENT_GAINS, 50]]),
  ]);
  check(list(outcomeSeries(h, 'liquidCash')) === '5000,6700,6700,6200', 'liquid cash = the cash account');
  check(list(outcomeSeries(h, 'liquidCashPlusInvestments')) === '7000,8720,8720,8670', 'cash + accounts 4–12, without retirement (3)');
  // month 0: 5000 + 2000 + 1000 + 20000 − 12000 = 16000; month 1: 6700 + 2020 + 1010 + 19700 − 11660 = 17770
  check(list(outcomeSeries(h, 'netWorth')) === '16000,17770,17770,17720', 'net worth = assets − debts');
  check(list(outcomeSeries(h, 'incomePerMonth')) === '0,4000,0,0', 'income = gross pay posted that month');
  check(list(outcomeSeries(h, 'incomePlusGainsPerMonth')) === '0,4020,0,-50', 'income + investment gains (a loss is −), without retirement gains');
  check(list(outcomeSeries(h, 'incomePlusAllGainsPerMonth')) === '0,4030,0,-50', 'income + investment gains + retirement gains');
  check(list(outcomeSeries(h, 'expensesPerMonth')) === '0,1960,0,0', 'expenses = tax + rent + loan interest; no depreciation, no principal');
});

test('months: lining up cases of different lengths', () => {
  const h = coahe([
    je(0, [[ACCT.CASH, 1_000], [ACCT.EQUITY, -1_000]]),
    je(2, [[ACCT.FOOD, 300], [ACCT.CASH, -300]]),
  ]);
  check(monthCount(h) === 3, 'history is 3 months');
  check(list(outcomeSeries(h, 'liquidCash', 6)) === '1000,1000,700,700,700,700', 'a balance holds its last value past the end');
  check(list(outcomeSeries(h, 'expensesPerMonth', 6)) === '0,0,300,0,0,0', 'a per-month outcome is 0 past the end');
  check(list(outcomeSeries(h, 'liquidCash', 2)) === '1000,1000', 'fewer months than the history cuts it short');
  check(outcomeSeries(h, 'netWorth', 0).length === 0, '0 months → empty series');
  const empty = coahe([]);
  check(outcomeSeries(empty, 'netWorth').length === 0, 'empty history → empty series');
  check(list(outcomeSeries(empty, 'netWorth', 3)) === '0,0,0' && list(outcomeSeries(empty, 'incomePerMonth', 3)) === '0,0,0', 'empty history padded = all 0');
  check(Array.from(outcomeSeries(empty, 'incomePerMonth', 3)).every((v) => !Object.is(v, -0)), 'never −0');
});

test('a one-time cost dated today counts in month 0', () => {
  const h = historyOf([entity('openingCash', { amount: 10_000 }), entity('oneTimeExpense', { age: age(25), amount: 1_200 })]);
  check(outcomeSeries(h, 'expensesPerMonth')[0] === 1_200, 'month 0 expenses = what posted in month 0');
  check(outcomeSeries(h, 'liquidCash')[0] === 8_800 && outcomeSeries(h, 'netWorth')[0] === 8_800, 'and it has left cash and net worth');
});

test('bad input throws', () => {
  const h = coahe([je(0, [[ACCT.CASH, 1], [ACCT.EQUITY, -1]])]);
  check(throws(() => outcomeSeries(h, 'nope' as OutcomeKey)), 'unknown outcome');
  check(throws(() => outcomeSeries(new Float64Array(ACCOUNT_COUNT + 1), 'netWorth')), 'history not whole months');
  check(throws(() => outcomeSeries(h, 'netWorth', -1)) && throws(() => outcomeSeries(h, 'netWorth', 1.5)), 'bad months');
  check(OUTCOME_KEYS.length === 7 && OUTCOME_KEYS.every((k) => OUTCOME_RULES[k] && OUTCOME_LABELS[k]), 'every outcome has a rule and a label');
});

// A full life: every kind of account gets used.
const fullCase: Entity[] = [
  entity('openingCash', { amount: 8_000 }),
  entity('income', { salary: 72_000, raisePct: 1.5, filingStatus: 'single', retirementContributionPct: 8, charityPct: 2, endAge: age(65) }),
  entity('existingInvestment', { currentInvested: 15_000, returnPct: 6, monthlyContribution: 200, contributionEndAge: age(60), monthlyWithdrawal: 1_500, withdrawalStartAge: age(66) }),
  entity('investing', { initialContribution: 1_000, returnPct: -2, monthlyContribution: 50, contributionStartAge: age(28), contributionEndAge: age(40) }),
  entity('existingVehicle', { financing: 'loan', totalVehicleValue: 28_000, downPaymentPct: 10, loanTermMonths: 60, interestRatePct: 6.5, remainingBalance: 14_000, sellAge: age(31) }),
  entity('buyingCar', { purchaseAge: age(31), financing: 'full', totalVehicleValue: 30_000 }),
  entity('existingStudentLoans', { remainingBalance: 22_000, interestRatePct: 5, remainingTermMonths: 96 }),
  entity('existingCreditCard', { currentBalance: 2_500, aprPct: 24, monthlyPayment: 150 }),
  entity('renting', { rentMonthly: 1_400, utilitiesMonthly: 150, endAge: age(30) }),
  entity('buyingHome', { purchaseAge: age(30), totalPropertyValue: 320_000, downPaymentPct: 10, mortgageTermYears: 30, interestRatePct: 6.5, sellAge: age(70) }),
  entity('education', { paymentType: 'loan', costPerSemester: 6_000, numberOfSemesters: 4, startAge: age(27), loanRatePct: 6, loanTermYears: 10 }),
  entity('food', { diningOutMonthly: 250, groceriesMonthly: 450 }),
  entity('kid', { annualCost: 15_000, birthAge: age(32) }),
  entity('oneTimeExpense', { age: age(29), amount: 9_000 }),
];

test('a full case: the outcomes agree with the books', () => {
  const h = historyOf(fullCase);
  const n = monthCount(h);
  const netWorth = outcomeSeries(h, 'netWorth');
  const cash = outcomeSeries(h, 'liquidCash');
  const cashPlus = outcomeSeries(h, 'liquidCashPlusInvestments');
  const income = outcomeSeries(h, 'incomePerMonth');
  const incomePlus = outcomeSeries(h, 'incomePlusGainsPerMonth');
  const expenses = outcomeSeries(h, 'expensesPerMonth');
  check(n === 961, 'runs the whole 960 months');
  check([netWorth, cash, cashPlus, income, incomePlus, expenses].every((s) => s.length === n), 'one number per month');
  check([netWorth, cash, cashPlus, income, incomePlus, expenses].every((s) => s.every((v) => Number.isInteger(v))), 'whole dollars');

  // Every month's books sum to 0, so net worth must equal −(everything that isn't an asset or a debt).
  let offBooks = 0, offCash = 0, offChange = 0, negative = 0;
  for (let m = 0; m < n; m++) {
    let rest = 0;
    for (let a = 40; a < ACCOUNT_COUNT; a++) rest += balanceAt(h, m, a);
    if (netWorth[m] !== -rest) offBooks++;
    if (cash[m] !== balanceAt(h, m, ACCT.CASH)) offCash++;
    if (expenses[m] < 0 || income[m] < 0) negative++;
    if (m === 0) continue;
    // What changes net worth in a month: income − expenses, plus the value changes left out of both.
    const moved = (account: number) => balanceAt(h, m, account) - balanceAt(h, m - 1, account);
    const valueChanges = -moved(ACCT.APPRECIATION) - moved(ACCT.RETIREMENT_GAINS) - moved(ACCT.VEHICLE_DEPRECIATION);
    if (netWorth[m] - netWorth[m - 1] !== incomePlus[m] - expenses[m] + valueChanges) offChange++;
  }
  check(offBooks === 0, `net worth = −(equity + income + expenses) every month (${offBooks} off)`);
  check(offCash === 0, 'liquid cash = the cash account every month');
  check(negative === 0, 'income and expenses are never negative');
  check(offChange === 0, `net worth change = income + gains − expenses + value changes (${offChange} off)`);

  // Per-month outcomes add back up to the running totals.
  check(sum(income) === -balanceAt(h, n - 1, ACCT.EARNED_INCOME), 'income per month adds up to all earned income');
  check(sum(incomePlus) - sum(income) === -balanceAt(h, n - 1, ACCT.INVESTMENT_GAINS), 'the gains part adds up to account 51');
  const incomePlusAll = outcomeSeries(h, 'incomePlusAllGainsPerMonth');
  check(sum(incomePlusAll) - sum(incomePlus) === -balanceAt(h, n - 1, ACCT.RETIREMENT_GAINS), 'the retirement part adds up to account 53');
  check(income[12] === 6_000 && income[41 * 12] === 0, '$72,000 a year = $6,000 a month; nothing after the job ends');
  check(balanceAt(h, n - 1, ACCT.RETIREMENT_GAINS) < 0 && balanceAt(h, n - 1, 3) > 0, 'retirement gains are on their own account');
  let investments = 0;
  for (let a = 4; a <= 12; a++) investments += balanceAt(h, 600, a);
  check(investments > 0 && cashPlus[600] - cash[600] === investments, 'cash + investments adds accounts 4–12 only');
  check(balanceAt(h, 12, ACCT.VEHICLE_DEPRECIATION) > 0, 'the car lost value …');
  let cashExpenses = 0;
  for (let a = 70; a <= 95; a++) if (a !== ACCT.VEHICLE_DEPRECIATION) cashExpenses += balanceAt(h, 12, a);
  check(sum(expenses.subarray(0, 13)) === cashExpenses, '… and that is not in expenses');
});

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed) {
  for (const f of fails.slice(0, 40)) console.log('  ✗ ' + f);
  throw new Error(`${failed} checks failed`);
}
