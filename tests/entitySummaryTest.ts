// entitySummaryTest.ts — run with:  npx tsx tests/entitySummaryTest.ts
// Checks the facts shown on each entity card (components/entitySummary.ts). No test framework needed.
import { entitySummary } from '../components/entitySummary';
import { ENTITY_TYPES } from '../TypesAndVariables/entityTypeLabels';
import type { Age, EntityTypeKey } from '../TypesAndVariables/types';

// ── tiny harness ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const fails: string[] = [];
function check(cond: boolean, msg: string) {
  if (cond) passed++;
  else { failed++; fails.push(msg); }
}
const A = (years: number, months = 0): Age => ({ years, months });
const MAX_LENGTH = 24; // about what fits on one line of a card

/** A realistic saved entity of every type, and the lines its card should show. */
const SAMPLES: Record<EntityTypeKey, { inputs: Record<string, unknown>; want: string[] }> = {
  openingCash: { inputs: { amount: 8_000 }, want: ['$8,000'] },
  existingHome: {
    inputs: { totalPropertyValue: 320_000, downPaymentPct: 10, mortgageTermYears: 30, interestRatePct: 6.5, remainingBalance: 210_000 },
    want: ['Bought for $320,000', 'Owes $210,000'],
  },
  existingVehicle: {
    inputs: { financing: 'loan', totalVehicleValue: 28_000, downPaymentPct: 10, loanTermMonths: 60, interestRatePct: 6.5, remainingBalance: 14_000 },
    want: ['Bought for $28,000', 'Owes $14,000'],
  },
  existingCreditCard: { inputs: { currentBalance: 2_500, aprPct: 24, monthlyPayment: 150 }, want: ['Owes $2,500 at 24%', 'Pays $150/mo'] },
  existingStudentLoans: {
    inputs: { remainingBalance: 22_000, interestRatePct: 5, remainingTermMonths: 96, monthlyPayment: null },
    want: ['Owes $22,000 at 5%', '96 months left'],
  },
  existingInvestment: { inputs: { currentInvested: 15_000, returnPct: 6, monthlyContribution: 200 }, want: ['$15,000 at 6%', 'Adds $200/mo'] },
  otherExistingAsset: {
    inputs: { assetValue: 50_000, appreciationPct: -3, purchaseAge: A(20), financedWithLoan: false },
    want: ['Bought for $50,000', 'Loses 3%/yr'],
  },
  otherExistingLoan: {
    inputs: { remainingBalance: null, interestRatePct: 7, remainingTermMonths: 36, monthlyPayment: 310 },
    want: ['Pays $310/mo', '36 months left'],
  },
  income: { inputs: { salary: 72_000, raisePct: 1.5, filingStatus: 'single', endAge: A(65) }, want: ['$72,000/yr', 'Until age 65'] },
  renting: { inputs: { rentMonthly: 1_400, utilitiesMonthly: 150, startAge: A(22), endAge: A(30) }, want: ['$1,400/mo rent', 'Age 22 to 30'] },
  buyingHome: {
    inputs: { purchaseAge: A(30), totalPropertyValue: 320_000, downPaymentPct: 10, mortgageTermYears: 30, interestRatePct: 6.5 },
    want: ['$320,000 at age 30', '30 yr loan at 6.5%'],
  },
  buyingCar: {
    inputs: { purchaseAge: A(31, 6), financing: 'loan', totalVehicleValue: 30_000, downPaymentPct: 10, loanTermMonths: 60, interestRatePct: 7 },
    want: ['$30,000 at age 31y 6m', '60 mo loan at 7%'],
  },
  gas: { inputs: { milesPerWeek: 200, mpg: 28 }, want: ['200 mi/wk at 28 mpg'] },
  kid: { inputs: { annualCost: 15_000, birthAge: A(32) }, want: ["Born when you're 32", '$15,000/yr'] },
  education: {
    inputs: { paymentType: 'loan', costPerSemester: 6_000, numberOfSemesters: 4, startAge: A(27), loanRatePct: 6, loanTermYears: 10 },
    want: ['$6,000 × 4 semesters', 'Loan, from age 27'],
  },
  investing: {
    inputs: { initialContribution: 1_000, returnPct: 7, monthlyContribution: 50, contributionStartAge: A(28), contributionEndAge: A(40) },
    want: ['$50/mo at 7%', 'Age 28 to 40'],
  },
  food: { inputs: { diningOutMonthly: 250, groceriesMonthly: 450 }, want: ['Groceries $450/mo', 'Dining out $250/mo'] },
  healthInsurance: { inputs: { type: 'employerIndividual' }, want: ['Employer, just me', '$120/mo'] },
  pet: { inputs: { startAge: A(25), lifespanYears: 12, vetPerYear: 400, foodPerMonth: 60, adoptionCost: 300 }, want: ['From age 25, 12 yrs', 'About $93/mo'] },
  personal: { inputs: { clothing: 100, gym: 40, phonePlan: 60, books: null }, want: ['$200/mo total'] },
  birthdayChristmas: { inputs: { amount: 1_200, frequency: 'yearly' }, want: ['$1,200/yr'] },
  oneTimeExpense: { inputs: { age: A(29), amount: 9_000 }, want: ['$9,000', 'At age 29'] },
  recurringPayment: { inputs: { amount: 100, frequency: 'monthly', startAge: A(30) }, want: ['$100/mo', 'From age 30'] },
};

for (const type of ENTITY_TYPES) {
  const { inputs, want } = SAMPLES[type];
  const got = entitySummary(type, inputs);
  check(got.join(' | ') === want.join(' | '), `${type}: want "${want.join(' | ')}", got "${got.join(' | ')}"`);
  check(got.length >= 1 && got.length <= 2, `${type}: 1 or 2 lines`);
  check(got.every((line) => line.length <= MAX_LENGTH), `${type}: every line fits (${got.map((l) => l.length).join(', ')} chars)`);

  // Saved data can be missing things or hold the wrong kind of value: never throw, never show junk.
  for (const broken of [{}, { amount: 'lots', salary: null, purchaseAge: 'soon', type: 'gold', financing: 7 }]) {
    let lines: string[] | null = null;
    try { lines = entitySummary(type, broken); } catch { /* checked below */ }
    check(lines !== null && lines.length <= 2, `${type}: unreadable inputs don't throw`);
    check(lines !== null && lines.every((l) => !/undefined|null|NaN|object/.test(l)), `${type}: unreadable inputs show no junk (${lines?.join(' | ')})`);
  }
}

// The other routes through each type.
const also = (type: EntityTypeKey, inputs: Record<string, unknown>, want: string[]) => {
  const got = entitySummary(type, inputs);
  check(got.join(' | ') === want.join(' | '), `${type}: want "${want.join(' | ')}", got "${got.join(' | ')}"`);
};
also('existingHome', { totalPropertyValue: 250_000, remainingBalance: 0 }, ['Bought for $250,000', 'Paid off']);
also('existingVehicle', { financing: 'full', totalVehicleValue: 12_000, purchaseAge: A(20) }, ['Bought for $12,000', 'Paid in full']);
also('buyingHome', { purchaseAge: A(35), totalPropertyValue: 400_000, downPaymentPct: 100, mortgageTermYears: 30, interestRatePct: 0 }, ['$400,000 at age 35', 'Paid in cash']);
also('buyingCar', { purchaseAge: A(31), financing: 'full', totalVehicleValue: 30_000 }, ['$30,000 at age 31', 'Paid in full']);
also('education', { paymentType: 'full', costPerSemester: 4_500, numberOfSemesters: 8, startAge: A(18) }, ['$4,500 × 8 semesters', 'Cash, from age 18']);
also('existingInvestment', { currentInvested: 90_000, returnPct: 5, monthlyContribution: null, monthlyWithdrawal: 1_500 }, ['$90,000 at 5%', 'Takes $1,500/mo']);
also('investing', { initialContribution: 5_000, returnPct: 7, monthlyContribution: null, contributionStartAge: A(25) }, ['$5,000 at 7%', 'From age 25']);
also('otherExistingAsset', { assetValue: 9_000, appreciationPct: 0 }, ['Bought for $9,000', 'Holds its value']);
also('healthInsurance', { type: 'marketplaceFamily', monthlyPremiumOverride: 640 }, ['Marketplace, family', '$640/mo']);
also('income', { salary: 55_000 }, ['$55,000/yr']);

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed) {
  for (const f of fails.slice(0, 40)) console.log('  ✗ ' + f);
  throw new Error(`${failed} checks failed`);
}
