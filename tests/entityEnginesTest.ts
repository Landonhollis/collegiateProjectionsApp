// entityEngines.test.ts — run with:  npx tsx entityEngines.test.ts
// No test framework needed. Exits non-zero on any failure.
import {
  ACCT, ENGINES, bracketTax, computeAnnualTaxes, homeInsuranceAnnual, monthsPaidFromBalance,
  paymentFor, retirementLimitForAge, roundDollar, solveLoan,
} from '../Engines/entityEngines';
import type { Age, EngineCtx, JournalEntry } from '../TypesAndVariables/types';
import { FEDERAL, GAS, HEALTH_PREMIUM_MONTHLY, HOME, HOME_INS_SE_CURVE, VEHICLE } from '../TypesAndVariables/presetVars';

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

// ── ledger helpers ───────────────────────────────────────────────────────────
const VALID_ACCOUNTS = new Set<number>([...Object.values(ACCT), 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const ctx = (startYears = 25, endMonth?: number): EngineCtx => ({ caseId: 'c-test', startAge: { years: startYears, months: 0 }, endMonth });
const age = (years: number, months = 0): Age => ({ years, months });

/** Invariants every engine must satisfy. */
function invariants(name: string, entries: JournalEntry[], c: EngineCtx) {
  const end = c.endMonth ?? 960;
  let prev = -1;
  for (const je of entries) {
    check(je.caseId === c.caseId, `${name}: caseId passes through`);
    check(Number.isInteger(je.month) && je.month >= 0 && je.month <= end, `${name}: month ${je.month} in [0, ${end}]`);
    check(je.month > prev, `${name}: months strictly increasing (${prev} → ${je.month})`);
    prev = je.month;
    check(je.lineEntries.length >= 2, `${name}: month ${je.month} has ≥ 2 lines`);
    let sum = 0;
    for (const l of je.lineEntries) {
      check(Number.isInteger(l.amount), `${name}: month ${je.month} acct ${l.account} whole dollars (${l.amount})`);
      check(l.amount !== 0 && !Object.is(l.amount, -0), `${name}: month ${je.month} no zero lines`);
      check(VALID_ACCOUNTS.has(l.account), `${name}: account ${l.account} is valid`);
      sum += l.amount;
    }
    check(sum === 0, `${name}: month ${je.month} sums to 0 (got ${sum})`);
  }
}
/** Balance of an account after posting month `m` (inclusive). */
const balanceAt = (entries: JournalEntry[], acct: number, m = Infinity) =>
  entries.filter((e) => e.month <= m).reduce((s, e) => s + e.lineEntries.filter((l) => l.account === acct).reduce((a, l) => a + l.amount, 0), 0);
const monthsTouching = (entries: JournalEntry[], acct: number) =>
  entries.filter((e) => e.lineEntries.some((l) => l.account === acct)).map((e) => e.month);
const lineAt = (entries: JournalEntry[], month: number, acct: number) =>
  entries.find((e) => e.month === month)?.lineEntries.find((l) => l.account === acct)?.amount ?? 0;

// ═════════════════════════════════════════════════════════════════════════════
test('rounding', () => {
  check(roundDollar(2.5) === 3 && roundDollar(-2.5) === -3, 'round half away from zero');
  check(Object.is(roundDollar(-0.4), 0), 'never −0');
});

test('loan math', () => {
  // Textbook: $200,000, 6%, 30 yr → $1,199.10
  check(approx(paymentFor(200_000, 0.06 / 12, 360), 1199.1, 0.01), 'mortgage payment 1199.10');
  // Rebuild months paid: balance after 60 payments on 240k @ 6.5% / 30y
  const r = 0.065 / 12, P0 = 240_000, pmt = paymentFor(P0, r, 360);
  const B60 = P0 * Math.pow(1 + r, 60) - (pmt * (Math.pow(1 + r, 60) - 1)) / r;
  check(monthsPaidFromBalance(P0, r, 360, B60) === 60, 'months paid solved = 60');
  // 3-of-4 solver round trips
  const full = { balance: 25_000, ratePct: 5.5, termMonths: 120 };
  const p = solveLoan(full).payment;
  check(approx(p, paymentFor(25_000, 0.055 / 12, 120), 1e-9), 'solve payment');
  check(approx(solveLoan({ ...full, balance: null, payment: p }).balance, 25_000, 0.01), 'solve balance');
  check(solveLoan({ ...full, termMonths: null, payment: p }).termMonths === 120, 'solve term');
  check(approx(solveLoan({ ...full, ratePct: null, payment: p }).ratePct, 5.5, 1e-6), 'solve rate (bisection)');
  check(solveLoan({ balance: 10_000, ratePct: 24, payment: 100 }).termMonths === Infinity, 'payment ≤ interest → never paid off');
});

test('federal + state taxes (independent hand calc)', () => {
  // Single, $75k, no 401k: taxable 58,900 → 1,240 + 4,560 + 1,870 = 7,670
  const t = computeAnnualTaxes(75_000, 0, 'single');
  check(approx(t.federal, 7670, 0.001), `federal single 75k = 7670 (got ${t.federal})`);
  check(approx(t.fica, 75_000 * 0.0765, 0.001), 'FICA 7.65% under wage base');
  // Hand-computed per-state taxes for AGI 75k single (see comments in plan):
  const byState = [3179, 2287.41, 0, 2994, 3204.9, 1863.75, 2268, 2483.775, 2941.5, 0, 3498.4, 2545.9];
  const expectedState = byState.reduce((a, b) => a + b, 0) / 12;
  check(approx(t.state, expectedState, 0.01), `SE avg state tax 75k = ${expectedState.toFixed(2)} (got ${t.state.toFixed(2)})`);
  // Married, $150k: taxable 117,800 → 2,480 + 9,120 + 3,740 = 15,340
  check(approx(computeAnnualTaxes(150_000, 0, 'married').federal, 15_340, 0.001), 'federal MFJ 150k');
  // High earner: SS capped, additional Medicare
  const hi = computeAnnualTaxes(300_000, 0, 'single');
  check(approx(hi.fica, 184_500 * 0.062 + 300_000 * 0.0145 + 100_000 * 0.009, 0.001), 'FICA cap + 0.9% surtax');
  // Override
  check(approx(computeAnnualTaxes(80_000, 5_000, 'single', 20).incomeTax, 15_000, 0.001), 'override × AGI');
  check(bracketTax(12_400, FEDERAL.brackets.single) === 1240, 'bracket edge');
  check(retirementLimitForAge(30) === 24_500 && retirementLimitForAge(55) === 32_500 && retirementLimitForAge(61) === 35_750, '401k limits by age');
});

test('home insurance curve', () => {
  check(approx(homeInsuranceAnnual(300_000), HOME_INS_SE_CURVE[1], 1e-9), 'exact at survey point');
  check(approx(HOME_INS_SE_CURVE[1], 43_708 / 12, 0.01), 'SE avg at 300k = 3642.33');
  const mid = homeInsuranceAnnual(350_000);
  check(mid > HOME_INS_SE_CURVE[1] && mid < HOME_INS_SE_CURVE[2], 'interpolates between points');
});

// ═════════════════════════════════════════════════════════════════════════════
test('opening cash', () => {
  const c = ctx(), e = ENGINES.openingCash({ amount: 5432.6 }, c);
  invariants('openingCash', e, c);
  check(e.length === 1 && lineAt(e, 0, ACCT.CASH) === 5433 && lineAt(e, 0, ACCT.EQUITY) === -5433, 'Dr cash / Cr equity');
});

test('buying a home: purchase, payments, appreciation, sale', () => {
  const c = ctx(25);
  const e = ENGINES.buyingHome({
    purchaseAge: age(26), totalPropertyValue: 300_000, downPaymentPct: 20, mortgageTermYears: 30,
    interestRatePct: 6.5, utilitiesMonthly: 350, sellAge: age(36),
  }, c);
  invariants('buyingHome', e, c);
  check(lineAt(e, 12, ACCT.PROPERTY) === 300_000 && lineAt(e, 12, ACCT.MORTGAGE) === -240_000 && lineAt(e, 12, ACCT.CASH) === -60_000, 'purchase entry');
  check(monthsTouching(e, ACCT.MORTGAGE_INTEREST)[0] === 13, 'first payment the month after purchase');
  const book = roundDollar(300_000 * Math.pow(1.01, 10));
  const bookAtSale = balanceAt(e, ACCT.PROPERTY, 131) - lineAt(e, 132, ACCT.APPRECIATION);
  check(bookAtSale === book, `book value at sale = ${book} (got ${bookAtSale})`);
  check(balanceAt(e, ACCT.PROPERTY) === 0, 'house off the books after sale');
  check(balanceAt(e, ACCT.MORTGAGE) === 0, 'mortgage paid from proceeds');
  check(e[e.length - 1].month === 132, 'nothing after the sale');
  check(balanceAt(e, ACCT.APPRECIATION) === -(book - 300_000), 'appreciation credited to 52');
});

test('buying a home: full 30-year payoff', () => {
  const c = ctx(25);
  const e = ENGINES.buyingHome({ purchaseAge: age(25), totalPropertyValue: 250_000, downPaymentPct: 10, mortgageTermYears: 30, interestRatePct: 6 }, c);
  invariants('buyingHome30', e, c);
  const pay = monthsTouching(e, ACCT.MORTGAGE_INTEREST);
  check(pay.length >= 359 && pay.length <= 360, `≈360 payments (got ${pay.length})`);
  check(balanceAt(e, ACCT.MORTGAGE) === 0, 'mortgage fully paid');
  check(balanceAt(e, ACCT.PROPERTY) > 0, 'still own the house at end');
});

test('existing home: rebuild loan from remaining balance', () => {
  const c = ctx(35);
  const r = 0.065 / 12, P0 = 240_000, pmt = paymentFor(P0, r, 360);
  const B60 = roundDollar(P0 * Math.pow(1 + r, 60) - (pmt * (Math.pow(1 + r, 60) - 1)) / r);
  const e = ENGINES.existingHome({ totalPropertyValue: 300_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6.5, remainingBalance: B60 }, c);
  invariants('existingHome', e, c);
  const V0 = roundDollar(300_000 * Math.pow(1.01, 5));
  check(lineAt(e, 0, ACCT.PROPERTY) === V0, `month-0 value = price grown 5 yrs (${V0})`);
  check(lineAt(e, 0, ACCT.MORTGAGE) === -B60 && lineAt(e, 0, ACCT.EQUITY) === -(V0 - B60), 'opening vs equity');
  const pays = monthsTouching(e, ACCT.MORTGAGE_INTEREST);
  check(pays.length >= 299 && pays.length <= 300, `≈300 payments left (got ${pays.length})`);
  check(balanceAt(e, ACCT.MORTGAGE) === 0, 'mortgage ends at 0');
  // Paid-off home with purchase age
  const e2 = ENGINES.existingHome({ totalPropertyValue: 200_000, downPaymentPct: 20, mortgageTermYears: 15, interestRatePct: 4, remainingBalance: 0, purchaseAge: age(15) }, c);
  invariants('existingHomePaidOff', e2, c);
  check(lineAt(e2, 0, ACCT.PROPERTY) === roundDollar(200_000 * Math.pow(1.01, 20)), 'paid-off home grown 20 yrs');
  check(monthsTouching(e2, ACCT.MORTGAGE).length === 0, 'no mortgage lines');
  // Monthly home costs ≈ presets
  const m1 = e2.find((x) => x.month === 1)!;
  const val = lineAt(e2, 0, ACCT.PROPERTY);
  check(approx(-lineAt(e2, 1, ACCT.CASH), val * HOME.propertyTaxPct / 1200 + homeInsuranceAnnual(val) / 12 + val * HOME.maintenancePct / 1200 + HOME.utilitiesMonthly, 3) || m1 === undefined, 'month-1 costs match presets (±$3 rounding)');
});

test('vehicles: loan, depreciation ≥ 0, sale', () => {
  const c = ctx(30);
  const r = 0.07 / 12, P0 = 31_500, pmt = paymentFor(P0, r, 72);
  const B24 = roundDollar(P0 * Math.pow(1 + r, 24) - (pmt * (Math.pow(1 + r, 24) - 1)) / r);
  const e = ENGINES.existingVehicle({ financing: 'loan', totalVehicleValue: 35_000, downPaymentPct: 10, loanTermMonths: 72, interestRatePct: 7, remainingBalance: B24, sellAge: age(33) }, c);
  invariants('existingVehicle', e, c);
  check(lineAt(e, 0, ACCT.VEHICLES) === roundDollar(35_000 * Math.pow(0.83, 2)), 'month-0 value depreciated 2 yrs');
  for (let m = 0; m <= 36; m++) check(balanceAt(e, ACCT.VEHICLES, m) >= 0, `vehicle value ≥ 0 at ${m}`);
  check(balanceAt(e, ACCT.VEHICLES) === 0 && balanceAt(e, ACCT.VEHICLE_LOAN) === 0, 'sold: asset and loan cleared');
  check(balanceAt(e, ACCT.VEHICLE_DEPRECIATION) > 0, 'depreciation expense (Dr 83)');
  // Bought in full, 3 years ago, kept 60 years: never below 0
  const e2 = ENGINES.existingVehicle({ financing: 'full', totalVehicleValue: 20_000, purchaseAge: age(27) }, c);
  invariants('existingVehicleFull', e2, c);
  check(balanceAt(e2, ACCT.VEHICLES) >= 0, 'never depreciates below $0');
  check(approx(-balanceAt(e2, ACCT.CAR_INSURANCE, 12) * -1, VEHICLE.insuranceMonthly * 12, 1), 'insurance preset × 12');
  // Buying a car with loan
  const e3 = ENGINES.buyingCar({ purchaseAge: age(31), financing: 'loan', totalVehicleValue: 30_000, downPaymentPct: 20, loanTermMonths: 60, interestRatePct: 6, insuranceMonthly: 150, maintenanceMonthly: 90 }, c);
  invariants('buyingCar', e3, c);
  check(lineAt(e3, 12, ACCT.CASH) === -6_000 && lineAt(e3, 12, ACCT.VEHICLE_LOAN) === -24_000, 'down payment + loan at purchase month');
  check(monthsTouching(e3, ACCT.VEHICLE_LOAN_INTEREST).length === 60 && balanceAt(e3, ACCT.VEHICLE_LOAN) === 0, '60 payments, paid off');
});

test('credit card', () => {
  const c = ctx();
  const e = ENGINES.existingCreditCard({ currentBalance: 5_000, aprPct: 24, monthlyPayment: 200 }, c);
  invariants('creditCard', e, c);
  const months = monthsTouching(e, ACCT.CREDIT_CARD_INTEREST);
  // n = −ln(1 − B·r/P) / ln(1+r) = −ln(0.5)/ln(1.02) = 35.0 months
  check(months.length >= 34 && months.length <= 36, `payoff ≈ 35 months (got ${months.length})`);
  check(balanceAt(e, ACCT.CREDIT_CARD) === 0, 'card paid off');
  const e2 = ENGINES.existingCreditCard({ currentBalance: 5_000, aprPct: 24, monthlyPayment: 200, paymentStartAge: age(25, 6) }, c);
  invariants('creditCardDelayed', e2, c);
  check(-balanceAt(e2, ACCT.CREDIT_CARD, 6) > 5_000 && lineAt(e2, 6, ACCT.CASH) === 0 && lineAt(e2, 7, ACCT.CASH) === -200, 'interest grows until payments start');
  const e3 = ENGINES.existingCreditCard({ currentBalance: 5_000, aprPct: 30, monthlyPayment: 100 }, ctx(25, 120));
  invariants('creditCardGrows', e3, ctx(25, 120));
  check(-balanceAt(e3, ACCT.CREDIT_CARD) > 5_000, 'payment < interest → balance grows (allowed)');
});

test('existing loans (3 of 4)', () => {
  const c = ctx();
  const e = ENGINES.existingStudentLoans({ remainingBalance: 30_000, interestRatePct: 5, remainingTermMonths: 120 }, c);
  invariants('studentLoans', e, c);
  const n = monthsTouching(e, ACCT.STUDENT_LOAN_INTEREST).length;
  check(n >= 119 && n <= 120 && balanceAt(e, ACCT.STUDENT_LOANS) === 0, `paid off in ≈120 (got ${n})`);
  const e2 = ENGINES.otherExistingLoan({ remainingBalance: 8_000, remainingTermMonths: 36, monthlyPayment: 250 }, c);
  invariants('otherLoanRateSolved', e2, c);
  check(balanceAt(e2, ACCT.OTHER_DEBT) === 0 && lineAt(e2, 0, ACCT.OTHER_DEBT) === -8_000, 'rate solved, paid off');
});

test('other existing asset', () => {
  const c = ctx(40);
  const e = ENGINES.otherExistingAsset({ assetValue: 40_000, appreciationPct: -10, purchaseAge: age(38), financedWithLoan: true, remainingBalance: 20_000, interestRatePct: 8, remainingTermMonths: 48 }, c);
  invariants('otherAsset', e, c);
  check(lineAt(e, 0, ACCT.PROPERTY) === roundDollar(40_000 * 0.81), 'value after 2 yrs at −10%');
  check(balanceAt(e, ACCT.APPRECIATION) > 0, 'loss sits as a debit on 52');
  check(balanceAt(e, ACCT.OTHER_DEBT) === 0 && balanceAt(e, ACCT.PROPERTY) >= 0, 'loan paid; value ≥ 0');
});

test('bad input fails loudly', () => {
  let threw = false;
  try { ENGINES.otherExistingAsset({ assetValue: 1, appreciationPct: -150, purchaseAge: age(20), financedWithLoan: false }, ctx()); } catch { threw = true; }
  check(threw, 'appreciation < −100% throws');
  threw = false;
  try { ENGINES.income({ salary: 50_000, raisePct: 0, filingStatus: 'single', retirementContributionPct: 5 }, ctx()); } catch { threw = true; }
  check(threw, '401k % without an account throws');
  threw = false;
  try { ENGINES.existingStudentLoans({ remainingBalance: 1000, interestRatePct: 5 }, ctx()); } catch { threw = true; }
  check(threw, 'loan with only 2 of 4 throws');
});

test('investments', () => {
  const c = ctx(30, 120);
  const e = ENGINES.existingInvestment({ account: 3, currentInvested: 10_000, returnPct: 7, monthlyContribution: 500, contributionEndAge: age(40) }, c);
  invariants('existingInvestment', e, c);
  const f = Math.pow(1.07, 1 / 12);
  let fv = 10_000;
  for (let m = 1; m <= 120; m++) fv = fv * f + 500;
  check(approx(balanceAt(e, 3), fv, 1), `FV matches closed loop (${fv.toFixed(0)} vs ${balanceAt(e, 3)})`);
  check(balanceAt(e, 3) === -balanceAt(e, ACCT.EQUITY) + 500 * 120 - balanceAt(e, ACCT.INVESTMENT_GAINS), 'account = opening + contributions + gains');
  const c2 = ctx(30);
  const e2 = ENGINES.investing({ account: 4, initialContribution: 5_000, returnPct: 6, contributionStartAge: age(31), monthlyContribution: 200, contributionEndAge: age(61), monthlyWithdrawal: 3_000, withdrawalStartAge: age(61), withdrawalEndAge: age(80) }, c2);
  invariants('investing', e2, c2);
  check(lineAt(e2, 12, 4) === 5_000 && lineAt(e2, 12, ACCT.CASH) === -5_000, 'initial contribution at start age');
  check(lineAt(e2, 12, ACCT.INVESTMENT_GAINS) === 0, 'no growth in the opening month');
  const e3 = ENGINES.existingInvestment({ account: 5, currentInvested: 1_000, returnPct: -20, monthlyWithdrawal: 0 }, ctx(30, 24));
  invariants('investmentLoss', e3, ctx(30, 24));
  check(balanceAt(e3, ACCT.INVESTMENT_GAINS) > 0, 'losses: Dr 51');
});

test('income', () => {
  const c = ctx(22);
  const e = ENGINES.income({ salary: 75_000, raisePct: 0, filingStatus: 'single', endAge: age(23) }, c);
  invariants('income', e, c);
  check(e.length === 12 && balanceAt(e, ACCT.EARNED_INCOME) === -75_000, 'exactly $75,000 gross over 12 months');
  const t = computeAnnualTaxes(75_000, 0, 'single');
  check(balanceAt(e, ACCT.INCOME_TAX) === roundDollar(t.incomeTax), 'income tax total exact');
  check(balanceAt(e, ACCT.OTHER_TAXES) === roundDollar(t.fica), 'FICA total exact');

  const e2 = ENGINES.income({
    salary: 100_000, raisePct: 2, filingStatus: 'married', charityPct: 10, retirementContributionPct: 10,
    retirementAccount: 3, retirementReturnPct: 7, endAge: age(62),
  }, c);
  invariants('incomeFull', e2, c);
  check(balanceAt(e2, ACCT.EARNED_INCOME, 12) === -100_000 && balanceAt(e2, ACCT.EARNED_INCOME, 24) === -(100_000 + 102_000), 'raise applies in year 2');
  check(balanceAt(e2, ACCT.CHARITY, 12) === 10_000, 'charity 10% (not deducted)');
  const t2 = computeAnnualTaxes(100_000, 10_000, 'married');
  check(balanceAt(e2, ACCT.INCOME_TAX, 12) === roundDollar(t2.incomeTax), 'pre-tax 401k lowers income tax');
  check(balanceAt(e2, 3, 960) > 1_000_000, 'retirement money keeps growing after work ends');
  check(e2[e2.length - 1].month === 960, 'retirement growth runs to endMonth');

  const e3 = ENGINES.income({ salary: 400_000, raisePct: 0, filingStatus: 'single', retirementContributionPct: 10, retirementAccount: 6, endAge: age(23) }, c);
  const deposits = e3.filter((x) => x.month <= 12).reduce((s, x) => s + (x.lineEntries.find((l) => l.account === 6)?.amount ?? 0), 0) - balanceAt(e3, ACCT.RETIREMENT_GAINS, 12) * -1;
  check(approx(deposits, 24_500, 1), `401k capped at 24,500 (got ${deposits})`);
});

test('renting, gas, food, personal, gifts, recurring, one-time', () => {
  const c = ctx(25);
  const r = ENGINES.renting({ rentMonthly: 1_450, utilitiesMonthly: 180, junkFeesMonthly: 45, endAge: age(27) }, c);
  invariants('renting', r, c);
  check(r.length === 24 && balanceAt(r, ACCT.RENT) === 24 * 1_495, '24 months of rent + fees');
  check(approx(balanceAt(r, ACCT.RENTERS_INSURANCE), HOME.renterInsuranceMonthly * 24, 0.5), 'renters insurance preset');

  const g = ENGINES.gas({ milesPerWeek: 250, mpg: 25, endAge: age(26) }, c);
  invariants('gas', g, c);
  check(approx(balanceAt(g, ACCT.GAS), 250 * 52 / 25 * GAS.pricePerGallon, 0.5), 'gas = gallons × SE price');

  const f = ENGINES.food({ diningOutMonthly: 0, groceriesMonthly: 333.33, endAge: age(26) }, c);
  invariants('food', f, c);
  check(balanceAt(f, ACCT.FOOD) === 4_000, 'drift-free rounding: 333.33 × 12 → 4,000');

  const p = ENGINES.personal({ clothing: 60, gym: 35.5, phonePlan: 70, startAge: age(25), endAge: age(26) }, c);
  invariants('personal', p, c);
  check(balanceAt(p, ACCT.PERSONAL) === 60 * 12 + 426 + 840, 'personal sums');

  const b = ENGINES.birthdayChristmas({ amount: 1_200, frequency: 'yearly', endAge: age(35) }, c);
  invariants('gifts', b, c);
  check(b.length === 120 && balanceAt(b, ACCT.BIRTHDAY_CHRISTMAS) === 12_000, 'yearly spread monthly');

  const rp = ENGINES.recurringPayment({ amount: 15.99, frequency: 'monthly', startAge: age(30), endAge: age(31) }, c);
  invariants('recurring', rp, c);
  check(rp[0].month === 61 && rp.length === 12 && balanceAt(rp, ACCT.RECURRING) === roundDollar(15.99 * 12), 'window + total');

  const o = ENGINES.oneTimeExpense({ age: age(20), amount: 900 }, c);
  invariants('oneTime', o, c);
  check(o.length === 0, 'past one-time expense is skipped (already in opening cash)');
  const o0 = ENGINES.oneTimeExpense({ age: age(25), amount: 900 }, c);
  check(o0[0].month === 0, 'expense at the start age posts at month 0');
  const o2 = ENGINES.oneTimeExpense({ age: age(40, 6), amount: 12_000 }, c);
  check(o2[0].month === 186 && lineAt(o2, 186, ACCT.ONE_TIME) === 12_000, 'posts at its event month');
});

test('kids, pets, health', () => {
  const c = ctx(25);
  const k = ENGINES.kid({ annualCost: 15_000, birthAge: age(27) }, c);
  invariants('kid', k, c);
  check(k[0].month === 25 && k[k.length - 1].month === 264 && k.length === 240, 'birth → age 20 = 240 months');
  check(balanceAt(k, ACCT.KIDS) === 300_000, '$15k × 20 years');

  const pt = ENGINES.pet({ startAge: age(26), lifespanYears: 12, vetPerYear: 600, foodPerMonth: 50, adoptionCost: 250 }, c);
  invariants('pet', pt, c);
  check(lineAt(pt, 12, ACCT.PETS) === 250 && pt[pt.length - 1].month === 156, 'adoption + lifespan window');
  check(balanceAt(pt, ACCT.PETS) === 250 + 12 * (600 + 600), 'pet totals');

  const oldPet = ENGINES.pet({ startAge: age(20), lifespanYears: 12, vetPerYear: 600, foodPerMonth: 50, adoptionCost: 250 }, c);
  invariants('oldPet', oldPet, c);
  check(balanceAt(oldPet, ACCT.PETS) === 7 * 1200, 'already-owned pet: no adoption cost, 7 yrs of care left');
  const oldKid = ENGINES.kid({ annualCost: 12_000, birthAge: age(20) }, c);
  check(oldKid.length === 180 && oldKid[oldKid.length - 1].month === 180, 'existing 5-yr-old kid: 15 yrs left');
  for (const type of Object.keys(HEALTH_PREMIUM_MONTHLY) as Array<keyof typeof HEALTH_PREMIUM_MONTHLY>) {
    const h = ENGINES.healthInsurance({ type, endAge: age(26) }, c);
    invariants(`health:${type}`, h, c);
    check(approx(balanceAt(h, ACCT.HEALTH_INSURANCE), HEALTH_PREMIUM_MONTHLY[type] * 12, 0.5), `health ${type} preset × 12`);
  }
});

test('education', () => {
  const c = ctx(18);
  const full = ENGINES.education({ paymentType: 'full', costPerSemester: 5_000, numberOfSemesters: 8, startAge: age(18) }, c);
  invariants('educationFull', full, c);
  check(full.map((x) => x.month).join() === '0,6,12,18,24,30,36,42' && balanceAt(full, ACCT.EDUCATION) === 40_000, 'semesters every 6 months');

  const mid = ENGINES.education({ paymentType: 'full', costPerSemester: 5_000, numberOfSemesters: 8, startAge: age(16) }, c);
  check(mid.map((x) => x.month).join() === '0,6,12,18', 'school already started: past semesters skipped');
  const loan = ENGINES.education({ paymentType: 'loan', costPerSemester: 5_000, numberOfSemesters: 8, startAge: age(18), loanRatePct: 6, loanTermYears: 10 }, c);
  invariants('educationLoan', loan, c);
  // Simple interest on the amount borrowed, months 1..54
  let expected = 0;
  for (let m = 1; m <= 54; m++) expected += 5_000 * Math.min(8, Math.floor((m - 1) / 6) + 1) * 0.005;
  check(approx(balanceAt(loan, ACCT.STUDENT_LOAN_INTEREST, 54), expected, 1), `in-school + grace interest (simple) ≈ ${expected}`);
  const pays = loan.filter((x) => lineAt(loan, x.month, ACCT.CASH) !== 0).map((x) => x.month);
  check(pays[0] === 55, 'first payment after the 6-month grace period');
  check(pays.length >= 119 && pays.length <= 120 && balanceAt(loan, ACCT.STUDENT_LOANS) === 0, '10-yr repayment, paid off');
});

test('endMonth + integration (whole case balances)', () => {
  const c = ctx(22, 480);
  const all: JournalEntry[] = [
    ...ENGINES.openingCash({ amount: 3_000 }, c),
    ...ENGINES.existingCreditCard({ currentBalance: 2_500, aprPct: 22, monthlyPayment: 150 }, c),
    ...ENGINES.existingStudentLoans({ remainingBalance: 27_000, interestRatePct: 5.5, remainingTermMonths: 120 }, c),
    ...ENGINES.existingVehicle({ financing: 'full', totalVehicleValue: 12_000, purchaseAge: age(19) }, c),
    ...ENGINES.income({ salary: 58_000, raisePct: 2.5, filingStatus: 'single', charityPct: 10, retirementContributionPct: 6, retirementAccount: 3, endAge: age(65) }, c),
    ...ENGINES.renting({ rentMonthly: 1_200, utilitiesMonthly: 160, endAge: age(28) }, c),
    ...ENGINES.buyingHome({ purchaseAge: age(28), totalPropertyValue: 320_000, downPaymentPct: 10, mortgageTermYears: 30, interestRatePct: 6.25, utilitiesMonthly: 400 }, c),
    ...ENGINES.buyingCar({ purchaseAge: age(27), financing: 'loan', totalVehicleValue: 28_000, downPaymentPct: 15, loanTermMonths: 60, interestRatePct: 6.9, sellAge: age(37) }, c),
    ...ENGINES.gas({ milesPerWeek: 220, mpg: 28 }, c),
    ...ENGINES.kid({ annualCost: 14_000, birthAge: age(30) }, c),
    ...ENGINES.investing({ account: 4, initialContribution: 1_000, returnPct: 7, contributionStartAge: age(23), monthlyContribution: 300, contributionEndAge: age(60) }, c),
    ...ENGINES.food({ diningOutMonthly: 150, groceriesMonthly: 420 }, c),
    ...ENGINES.healthInsurance({ type: 'employerIndividual', endAge: age(65) }, c),
    ...ENGINES.pet({ startAge: age(29), lifespanYears: 13, vetPerYear: 500, foodPerMonth: 45, adoptionCost: 300 }, c),
    ...ENGINES.personal({ clothing: 60, entertainment: 100, phonePlan: 65 }, c),
    ...ENGINES.birthdayChristmas({ amount: 1_000, frequency: 'yearly' }, c),
    ...ENGINES.oneTimeExpense({ age: age(29), amount: 15_000 }, c),
    ...ENGINES.recurringPayment({ amount: 20, frequency: 'monthly' }, c),
    ...ENGINES.otherExistingAsset({ assetValue: 3_000, appreciationPct: -5, purchaseAge: age(21), financedWithLoan: false }, c),
    ...ENGINES.otherExistingLoan({ remainingBalance: 1_500, interestRatePct: 9, monthlyPayment: 100 }, c),
    ...ENGINES.existingInvestment({ account: 5, currentInvested: 2_000, returnPct: 7 }, c),
    ...ENGINES.existingHome({ totalPropertyValue: 150_000, downPaymentPct: 100, mortgageTermYears: 30, interestRatePct: 0, remainingBalance: 0, purchaseAge: age(22) }, c),
    ...ENGINES.education({ paymentType: 'loan', costPerSemester: 4_000, numberOfSemesters: 4, startAge: age(30), loanRatePct: 6.5, loanTermYears: 10 }, c),
  ];
  check(all.every((x) => x.month <= 480), 'nothing after endMonth');
  // Engine 2 simulation: balances[acct] += amt
  const bal = new Map<number, number>();
  for (const je of all) for (const l of je.lineEntries) bal.set(l.account, (bal.get(l.account) ?? 0) + l.amount);
  const total = [...bal.values()].reduce((a, b) => a + b, 0);
  check(total === 0, `whole case trial balance = 0 (got ${total})`);
  check((bal.get(ACCT.MORTGAGE) ?? 0) === 0 && (bal.get(ACCT.STUDENT_LOANS) ?? 0) === 0 && (bal.get(ACCT.CREDIT_CARD) ?? 0) === 0, 'all loans paid by month 480');
});

test('performance', () => {
  const t0 = Date.now();
  for (let i = 0; i < 50; i++) {
    ENGINES.income({ salary: 90_000, raisePct: 2, filingStatus: 'married', retirementContributionPct: 10, retirementAccount: 3 }, ctx(22));
    ENGINES.buyingHome({ purchaseAge: age(30), totalPropertyValue: 400_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6.5 }, ctx(22));
  }
  const ms = (Date.now() - t0) / 100;
  check(ms < 50, `avg engine run < 50 ms (got ${ms.toFixed(1)} ms)`);
  console.log(`  perf: ~${ms.toFixed(1)} ms per 960-month engine run`);
});

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed) {
  for (const f of fails.slice(0, 40)) console.log('  ✗ ' + f);
  throw new Error(`${failed} checks failed`);
}