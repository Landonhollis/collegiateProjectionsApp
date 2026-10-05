// entityFormsTest.ts — run with:  npx tsx tests/entityFormsTest.ts
// Checks every edit card's form (components/(editEntityCards)/entityForms.ts) against its engine:
//   • a new (blank) form can't be saved, except where every box is optional
//   • filled-in text turns into exactly the expected engine inputs
//   • those inputs run through masterEngine with no error
//   • saved inputs read back into the same text (so editing an entity shows what was saved)
//   • each way of getting the text wrong is refused
// No test framework needed. Exits non-zero on any failure.
import { masterEngine, makeEntityId } from '../Engines/masterEngine';
import * as F from '../components/(editEntityCards)/entityForms';
import type { EntityForm } from '../components/(editEntityCards)/entityForms';
import { EMPTY_AGE, EMPTY_LOAN, parseAgeWindow, parseLoanText, parseSignedPercent, optional, parseDollars, type AgeText, type LoanInputs, type LoanText } from '../components/formParsing';
import type { Age, Case, EntityTypeKey } from '../TypesAndVariables/types';

// ── tiny harness ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const fails: string[] = [];
function check(cond: boolean, msg: string) {
  if (cond) passed++;
  else { failed++; fails.push(msg); }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const startingAge: Age = { years: 22, months: 0 };
const kase: Case = { caseId: 'c', caseName: 'c', caseColor: '#000000', caseIndex: 0, isHidden: false };
const age = (years: string, months = ''): AgeText => ({ years, months });
const A = (years: number, months = 0): Age => ({ years, months });

/** Runs these saved inputs as one entity of this type. Returns the engine error message, or null. */
function engineError(type: EntityTypeKey, inputs: Record<string, unknown>): string | null {
  const entity = { entityId: makeEntityId(type), caseId: 'c', name: type, isHidden: false, inputs };
  const out = masterEngine({ startingAge, cases: [kase], entities: [entity] }).computedCases[0];
  return out.error ? out.error.message : null;
}

type Sample<Text, Inputs> = {
  name: string;
  text: Text;
  /** Exactly what the card must save for that text. */
  expect: Inputs;
  /** What read(expect) gives back when it isn't the same as `text` (e.g. boxes hidden by a choice come back blank). */
  readBack?: Text;
};

/**
 * One form, one or more valid samples, and a list of ways to break the first sample.
 * `blankIsValid`: every box is optional, so a new form can be saved as it is.
 */
function testForm<Text extends object, Inputs extends Record<string, unknown>>(
  // NoInfer: Text and Inputs come from the form alone, so the samples are checked against the form's own types.
  type: EntityTypeKey, form: EntityForm<Text, Inputs>, samples: Sample<NoInfer<Text>, NoInfer<Inputs>>[],
  broken: Array<[why: string, change: Partial<NoInfer<Text>>]>, blankIsValid = false,
) {
  const blank = form.toInputs(form.read(undefined));
  check(blankIsValid ? blank !== null : blank === null, `${type}: a new blank form ${blankIsValid ? 'can' : "can't"} be saved`);

  for (const s of samples) {
    const label = `${type} (${s.name})`;
    const inputs = form.toInputs(s.text);
    check(inputs !== null, `${label}: valid text is accepted`);
    if (inputs === null) continue;
    check(same(inputs, s.expect), `${label}: saves the expected inputs\n      got    ${JSON.stringify(inputs)}\n      wanted ${JSON.stringify(s.expect)}`);
    const error = engineError(type, inputs);
    check(error === null, `${label}: the engine runs it (${error})`);
    const reread = form.read(inputs);
    check(same(reread, s.readBack ?? s.text), `${label}: saved inputs read back into the same text\n      got    ${JSON.stringify(reread)}\n      wanted ${JSON.stringify(s.readBack ?? s.text)}`);
    check(same(form.toInputs(reread), inputs), `${label}: read → save again gives the same inputs`);
  }
  for (const [why, change] of broken) {
    check(form.toInputs({ ...samples[0].text, ...change }) === null, `${type}: refused when ${why}`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Shared parsing
// ═════════════════════════════════════════════════════════════════════════════
check(parseSignedPercent('-2.5') === -2.5 && parseSignedPercent('7') === 7 && parseSignedPercent('−3') === -3, 'signed percent: negatives and decimals');
check(parseSignedPercent('-101') === null && parseSignedPercent('101') === null && parseSignedPercent('abc') === null && parseSignedPercent('') === null, 'signed percent: out of range / junk refused');
check(optional('', parseDollars) === null && optional('  ', parseDollars) === null, 'optional: blank → null (not given)');
check(optional('1,200', parseDollars) === 1200 && optional('12.5', parseDollars) === undefined, 'optional: valid → number, junk → undefined');
check(same(parseAgeWindow(EMPTY_AGE, EMPTY_AGE), { startAge: null, endAge: null }), 'age window: both blank is fine');
check(same(parseAgeWindow(age('30'), age('40', '6')), { startAge: A(30), endAge: A(40, 6) }), 'age window: blank months = 0');
check(parseAgeWindow(age('40'), age('30')) === null && parseAgeWindow(age('40'), age('40')) === null, 'age window: end must be after start');
check(parseAgeWindow(age('30', '12'), EMPTY_AGE) === null && parseAgeWindow(age('', '5'), EMPTY_AGE) === null, 'age window: bad months / months without years refused');
check(parseLoanText(EMPTY_LOAN) === null, 'loan: nothing filled is refused');
check(parseLoanText({ balance: '10,000', ratePct: '5', termMonths: '', payment: '' }) === null, 'loan: 2 of 4 is refused');

// ═════════════════════════════════════════════════════════════════════════════
// What you have now
// ═════════════════════════════════════════════════════════════════════════════
testForm('openingCash', F.openingCashForm,
  [{ name: 'basic', text: { amount: '3,000' }, expect: { amount: 3000 } },
   { name: 'zero', text: { amount: '0' }, expect: { amount: 0 } }],
  [['amount is blank', { amount: '' }], ['amount has cents', { amount: '10.50' }], ['amount is negative', { amount: '-5' }]]);

const homeText: F.ExistingHomeText = { price: '300,000', downPct: '20', termYears: '30', ratePct: '6.5', remaining: '200,000', purchaseAge: EMPTY_AGE, sellAge: EMPTY_AGE };
testForm('existingHome', F.existingHomeForm,
  [{ name: 'mortgage', text: homeText,
     expect: { totalPropertyValue: 300000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6.5, remainingBalance: 200000, purchaseAge: null, sellAge: null } },
   { name: 'paid off, with ages', text: { ...homeText, remaining: '0', purchaseAge: age('18', '6'), sellAge: age('40', '0') },
     expect: { totalPropertyValue: 300000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6.5, remainingBalance: 0, purchaseAge: A(18, 6), sellAge: A(40) } }],
  [['price is blank', { price: '' }], ['down payment is over 100', { downPct: '101' }], ['term is 0', { termYears: '0' }],
   ['rate is blank', { ratePct: '' }], ['remaining balance is blank', { remaining: '' }], ['purchase months are 12', { purchaseAge: age('20', '12') }],
   ['sell age is before purchase age', { purchaseAge: age('20'), sellAge: age('19') }]]);

const vehicleLoan: F.ExistingVehicleText = { financing: 'loan', price: '30,000', downPct: '10', termMonths: '72', ratePct: '5', remaining: '18,000', purchaseAge: EMPTY_AGE, sellAge: EMPTY_AGE };
testForm('existingVehicle', F.existingVehicleForm,
  [{ name: 'loan', text: vehicleLoan,
     expect: { financing: 'loan', totalVehicleValue: 30000, purchaseAge: null, sellAge: null, downPaymentPct: 10, loanTermMonths: 72, interestRatePct: 5, remainingBalance: 18000 } },
   { name: 'paid in full', text: { ...vehicleLoan, financing: 'full', purchaseAge: age('20'), sellAge: age('30') },
     expect: { financing: 'full', totalVehicleValue: 30000, purchaseAge: A(20), sellAge: A(30), downPaymentPct: null, loanTermMonths: null, interestRatePct: null, remainingBalance: null },
     // The loan boxes are hidden when paid in full, so nothing from them is saved.
     readBack: { financing: 'full', price: '30,000', downPct: '', termMonths: '', ratePct: '', remaining: '', purchaseAge: age('20', '0'), sellAge: age('30', '0') } }],
  [['price is blank', { price: '' }], ['loan term is blank', { termMonths: '' }], ['loan rate is blank', { ratePct: '' }],
   ['down payment is blank', { downPct: '' }], ['remaining balance is blank', { remaining: '' }],
   ['paid in full with no purchase age', { financing: 'full' }], ['sell age is not valid', { sellAge: age('', '3') }]]);

testForm('existingCreditCard', F.existingCreditCardForm,
  [{ name: 'paying now', text: { balance: '4,000', aprPct: '24.9', payment: '150', paymentStartAge: EMPTY_AGE },
     expect: { currentBalance: 4000, aprPct: 24.9, monthlyPayment: 150, paymentStartAge: null } },
   { name: 'paying later', text: { balance: '4,000', aprPct: '0', payment: '0', paymentStartAge: age('25', '3') },
     expect: { currentBalance: 4000, aprPct: 0, monthlyPayment: 0, paymentStartAge: A(25, 3) } }],
  [['balance is blank', { balance: '' }], ['APR is blank', { aprPct: '' }], ['payment is blank', { payment: '' }], ['start age is not valid', { paymentStartAge: age('x') }]]);

const loanSamples: Sample<LoanText, LoanInputs>[] = [
  { name: 'no payment', text: { balance: '20,000', ratePct: '5.5', termMonths: '120', payment: '' },
    expect: { remainingBalance: 20000, interestRatePct: 5.5, remainingTermMonths: 120, monthlyPayment: null } },
  { name: 'no term', text: { balance: '20,000', ratePct: '5.5', termMonths: '', payment: '250' },
    expect: { remainingBalance: 20000, interestRatePct: 5.5, remainingTermMonths: null, monthlyPayment: 250 } },
  { name: 'no rate', text: { balance: '20,000', ratePct: '', termMonths: '120', payment: '250' },
    expect: { remainingBalance: 20000, interestRatePct: null, remainingTermMonths: 120, monthlyPayment: 250 } },
  { name: 'no balance', text: { balance: '', ratePct: '5.5', termMonths: '120', payment: '250' },
    expect: { remainingBalance: null, interestRatePct: 5.5, remainingTermMonths: 120, monthlyPayment: 250 } },
  { name: 'all four', text: { balance: '20,000', ratePct: '5.5', termMonths: '120', payment: '250' },
    expect: { remainingBalance: 20000, interestRatePct: 5.5, remainingTermMonths: 120, monthlyPayment: 250 } },
];
for (const type of ['existingStudentLoans', 'otherExistingLoan'] as const) {
  testForm(type, F.existingLoanForm, loanSamples,
    [['only 2 of 4 are filled', { termMonths: '', payment: '' }], ['term is 0', { termMonths: '0' }], ['rate is over 100', { ratePct: '150' }], ['balance has letters', { balance: '20k' }]]);
}

const existingInvText: F.ExistingInvestmentText = {
  invested: '10,000', returnPct: '7', contribution: '', contributionStartAge: EMPTY_AGE, contributionEndAge: EMPTY_AGE,
  withdrawal: '', withdrawalStartAge: EMPTY_AGE, withdrawalEndAge: EMPTY_AGE,
};
testForm('existingInvestment', F.existingInvestmentForm,
  [{ name: 'just sitting there', text: existingInvText,
     expect: { currentInvested: 10000, returnPct: 7, monthlyContribution: null, contributionStartAge: null, contributionEndAge: null, monthlyWithdrawal: null, withdrawalStartAge: null, withdrawalEndAge: null } },
   { name: 'deposits then withdrawals, losing value',
     text: { invested: '10,000', returnPct: '-2.5', contribution: '300', contributionStartAge: age('25', '0'), contributionEndAge: age('60', '0'), withdrawal: '1,500', withdrawalStartAge: age('65', '0'), withdrawalEndAge: age('90', '6') },
     expect: { currentInvested: 10000, returnPct: -2.5, monthlyContribution: 300, contributionStartAge: A(25), contributionEndAge: A(60), monthlyWithdrawal: 1500, withdrawalStartAge: A(65), withdrawalEndAge: A(90, 6) } }],
  [['invested is blank', { invested: '' }], ['return is blank', { returnPct: '' }], ['return is below −100', { returnPct: '-150' }],
   ['deposit has cents', { contribution: '10.5' }], ['deposits stop before they start', { contributionStartAge: age('40'), contributionEndAge: age('30') }],
   ['withdrawals stop before they start', { withdrawalStartAge: age('70'), withdrawalEndAge: age('65') }]]);

const assetText: F.OtherExistingAssetText = { value: '15,000', appreciationPct: '-5', purchaseAge: age('20', '0'), financed: 'none', loan: EMPTY_LOAN };
testForm('otherExistingAsset', F.otherExistingAssetForm,
  [{ name: 'no loan', text: assetText,
     expect: { assetValue: 15000, appreciationPct: -5, purchaseAge: A(20), financedWithLoan: false, remainingBalance: null, interestRatePct: null, remainingTermMonths: null, monthlyPayment: null } },
   { name: 'with a loan', text: { ...assetText, appreciationPct: '2', financed: 'loan', loan: { balance: '8,000', ratePct: '6', termMonths: '48', payment: '' } },
     expect: { assetValue: 15000, appreciationPct: 2, purchaseAge: A(20), financedWithLoan: true, remainingBalance: 8000, interestRatePct: 6, remainingTermMonths: 48, monthlyPayment: null } }],
  [['value is blank', { value: '' }], ['change in value is blank', { appreciationPct: '' }], ['purchase age is blank', { purchaseAge: EMPTY_AGE }],
   ['it has a loan but the loan boxes are empty', { financed: 'loan' }],
   ['it has a loan with only 2 boxes filled', { financed: 'loan', loan: { balance: '8,000', ratePct: '6', termMonths: '', payment: '' } }]]);

// ═════════════════════════════════════════════════════════════════════════════
// Plans & spending
// ═════════════════════════════════════════════════════════════════════════════
const incomeText: F.IncomeText = {
  salary: '60,000', raisePct: '0', filingStatus: 'single', startAge: EMPTY_AGE, endAge: EMPTY_AGE,
  charityPct: '', retirementPct: '', retirementReturnPct: '', taxMode: 'calculated', taxRatePct: '',
};
check(F.incomeForm.read(undefined).raisePct === '0', 'income: a new income starts with a 0% raise');
testForm('income', F.incomeForm,
  [{ name: 'simple', text: incomeText,
     expect: { salary: 60000, raisePct: 0, filingStatus: 'single', startAge: null, endAge: null, charityPct: null, retirementContributionPct: null, retirementReturnPct: null, incomeTaxRatePct: null } },
   { name: 'everything, own tax rate',
     text: { salary: '120,000', raisePct: '-1.5', filingStatus: 'married', startAge: age('24', '6'), endAge: age('65', '0'), charityPct: '10', retirementPct: '6', retirementReturnPct: '5.5', taxMode: 'rate', taxRatePct: '22' },
     expect: { salary: 120000, raisePct: -1.5, filingStatus: 'married', startAge: A(24, 6), endAge: A(65), charityPct: 10, retirementContributionPct: 6, retirementReturnPct: 5.5, incomeTaxRatePct: 22 } },
   { name: 'own tax rate of 0', text: { ...incomeText, taxMode: 'rate', taxRatePct: '0' },
     expect: { salary: 60000, raisePct: 0, filingStatus: 'single', startAge: null, endAge: null, charityPct: null, retirementContributionPct: null, retirementReturnPct: null, incomeTaxRatePct: 0 } }],
  [['salary is blank', { salary: '' }], ['raise is blank', { raisePct: '' }], ['raise is below −100', { raisePct: '-101' }],
   ['end age is before start age', { startAge: age('30'), endAge: age('25') }], ['charity is over 100', { charityPct: '120' }],
   ['retirement savings is not a number', { retirementPct: 'six' }], ['own tax rate is chosen but blank', { taxMode: 'rate' }]]);
// A typed tax rate is thrown away when the engine is asked to work the tax out.
check(F.incomeForm.toInputs({ ...incomeText, taxMode: 'calculated', taxRatePct: '22' })?.incomeTaxRatePct === null, 'income: "work it out" saves no tax rate even if one was typed');

testForm('renting', F.rentingForm,
  [{ name: 'rent only', text: { rent: '1,300', utilities: '', junkFees: '', startAge: EMPTY_AGE, endAge: EMPTY_AGE },
     expect: { rentMonthly: 1300, utilitiesMonthly: null, junkFeesMonthly: null, startAge: null, endAge: null } },
   { name: 'everything', text: { rent: '1,300', utilities: '180', junkFees: '75', startAge: age('22', '0'), endAge: age('30', '0') },
     expect: { rentMonthly: 1300, utilitiesMonthly: 180, junkFeesMonthly: 75, startAge: A(22), endAge: A(30) } }],
  [['rent is blank', { rent: '' }], ['utilities has cents', { utilities: '99.99' }], ['fees are negative', { junkFees: '-1' }], ['end age is before start age', { startAge: age('30'), endAge: age('22') }]]);

const buyHome: F.BuyingHomeText = { payment: 'mortgage', purchaseAge: age('30', '0'), price: '350,000', downPct: '20', termYears: '30', ratePct: '6.5', utilities: '', sellAge: EMPTY_AGE };
testForm('buyingHome', F.buyingHomeForm,
  [{ name: 'mortgage', text: buyHome,
     expect: { purchaseAge: A(30), totalPropertyValue: 350000, utilitiesMonthly: null, sellAge: null, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6.5 } },
   { name: 'cash', text: { ...buyHome, payment: 'cash', utilities: '400', sellAge: age('45', '0') },
     expect: { purchaseAge: A(30), totalPropertyValue: 350000, utilitiesMonthly: 400, sellAge: A(45), downPaymentPct: 100, mortgageTermYears: 0, interestRatePct: 0 },
     readBack: { payment: 'cash', purchaseAge: age('30', '0'), price: '350,000', downPct: '', termYears: '', ratePct: '', utilities: '400', sellAge: age('45', '0') } }],
  [['purchase age is blank', { purchaseAge: EMPTY_AGE }], ['price is blank', { price: '' }], ['down payment is blank', { downPct: '' }],
   ['term is blank', { termYears: '' }], ['rate is blank', { ratePct: '' }], ['utilities are not a number', { utilities: 'lots' }],
   ['sell age is before purchase age', { sellAge: age('29') }]]);

const buyCar: F.BuyingCarText = { financing: 'loan', purchaseAge: age('25', '0'), price: '28,000', downPct: '10', termMonths: '60', ratePct: '6.9', sellAge: EMPTY_AGE, insurance: '', maintenance: '' };
testForm('buyingCar', F.buyingCarForm,
  [{ name: 'loan, average costs', text: buyCar,
     expect: { financing: 'loan', purchaseAge: A(25), totalVehicleValue: 28000, sellAge: null, insuranceMonthly: null, maintenanceMonthly: null, downPaymentPct: 10, loanTermMonths: 60, interestRatePct: 6.9 } },
   { name: 'paid in full, own costs', text: { ...buyCar, financing: 'full', sellAge: age('33', '0'), insurance: '150', maintenance: '90' },
     expect: { financing: 'full', purchaseAge: A(25), totalVehicleValue: 28000, sellAge: A(33), insuranceMonthly: 150, maintenanceMonthly: 90, downPaymentPct: null, loanTermMonths: null, interestRatePct: null },
     readBack: { financing: 'full', purchaseAge: age('25', '0'), price: '28,000', downPct: '', termMonths: '', ratePct: '', sellAge: age('33', '0'), insurance: '150', maintenance: '90' } }],
  [['purchase age is blank', { purchaseAge: EMPTY_AGE }], ['price is blank', { price: '' }], ['loan term is 0', { termMonths: '0' }],
   ['loan rate is blank', { ratePct: '' }], ['down payment is blank', { downPct: '' }], ['insurance has cents', { insurance: '1.5' }],
   ['sell age is before purchase age', { sellAge: age('24', '11') }]]);

testForm('gas', F.gasForm,
  [{ name: 'average price', text: { milesPerWeek: '250', mpg: '28.5', gasPrice: '', startAge: EMPTY_AGE, endAge: EMPTY_AGE },
     expect: { milesPerWeek: 250, mpg: 28.5, gasPricePerGallon: null, startAge: null, endAge: null } },
   { name: 'own price, ages', text: { milesPerWeek: '0', mpg: '40', gasPrice: '3.59', startAge: age('23', '0'), endAge: age('70', '0') },
     expect: { milesPerWeek: 0, mpg: 40, gasPricePerGallon: 3.59, startAge: A(23), endAge: A(70) } }],
  [['miles are blank', { milesPerWeek: '' }], ['mpg is 0', { mpg: '0' }], ['mpg is blank', { mpg: '' }], ['gas price is negative', { gasPrice: '-3' }]]);

testForm('kid', F.kidForm,
  [{ name: 'basic', text: { annualCost: '15,000', birthAge: age('30', '6') }, expect: { annualCost: 15000, birthAge: A(30, 6) } }],
  [['cost is blank', { annualCost: '' }], ['birth age is blank', { birthAge: EMPTY_AGE }], ['birth months are 12', { birthAge: age('30', '12') }]]);

const eduText: F.EducationText = { paymentType: 'loan', costPerSemester: '8,000', semesters: '8', startAge: age('22', '0'), loanRatePct: '6.5', loanTermYears: '10' };
testForm('education', F.educationForm,
  [{ name: 'loan', text: eduText,
     expect: { paymentType: 'loan', costPerSemester: 8000, numberOfSemesters: 8, startAge: A(22), loanRatePct: 6.5, loanTermYears: 10 } },
   { name: 'paid in full', text: { ...eduText, paymentType: 'full' },
     expect: { paymentType: 'full', costPerSemester: 8000, numberOfSemesters: 8, startAge: A(22), loanRatePct: null, loanTermYears: null },
     readBack: { paymentType: 'full', costPerSemester: '8,000', semesters: '8', startAge: age('22', '0'), loanRatePct: '', loanTermYears: '' } }],
  [['cost is blank', { costPerSemester: '' }], ['semesters is 0', { semesters: '0' }], ['semesters is a fraction', { semesters: '2.5' }],
   ['start age is blank', { startAge: EMPTY_AGE }], ['loan rate is blank', { loanRatePct: '' }], ['loan term is 0', { loanTermYears: '0' }]]);

const investText: F.InvestingText = {
  initial: '1,000', returnPct: '6', contributionStartAge: age('25', '0'), contribution: '', contributionEndAge: EMPTY_AGE,
  withdrawal: '', withdrawalStartAge: EMPTY_AGE, withdrawalEndAge: EMPTY_AGE,
};
check(F.investingForm.read(undefined).initial === '0', 'investing: a new account starts with $0 paid in up front');
testForm('investing', F.investingForm,
  [{ name: 'lump sum', text: investText,
     expect: { initialContribution: 1000, returnPct: 6, contributionStartAge: A(25), monthlyContribution: null, contributionEndAge: null, monthlyWithdrawal: null, withdrawalStartAge: null, withdrawalEndAge: null } },
   { name: 'deposits then withdrawals',
     text: { initial: '0', returnPct: '7', contributionStartAge: age('25', '0'), contribution: '500', contributionEndAge: age('60', '0'), withdrawal: '3,000', withdrawalStartAge: age('65', '0'), withdrawalEndAge: age('95', '0') },
     expect: { initialContribution: 0, returnPct: 7, contributionStartAge: A(25), monthlyContribution: 500, contributionEndAge: A(60), monthlyWithdrawal: 3000, withdrawalStartAge: A(65), withdrawalEndAge: A(95) } }],
  [['starting amount is blank', { initial: '' }], ['return is blank', { returnPct: '' }], ['start age is blank', { contributionStartAge: EMPTY_AGE }],
   ['deposits stop before they start', { contributionEndAge: age('24') }], ['withdrawals stop before they start', { withdrawalStartAge: age('70'), withdrawalEndAge: age('66') }],
   ['withdrawals stop before the account opens (no withdrawal start)', { withdrawalEndAge: age('24') }]]);

testForm('food', F.foodForm,
  [{ name: 'basic', text: { diningOut: '200', groceries: '400', startAge: EMPTY_AGE, endAge: EMPTY_AGE },
     expect: { diningOutMonthly: 200, groceriesMonthly: 400, startAge: null, endAge: null } }],
  [['dining out is blank', { diningOut: '' }], ['groceries is blank', { groceries: '' }], ['end age is before start age', { startAge: age('50'), endAge: age('40') }]]);

for (const type of F.HEALTH_INSURANCE_TYPES) {
  const inputs = F.healthInsuranceForm.toInputs({ type, premium: '', startAge: EMPTY_AGE, endAge: EMPTY_AGE });
  check(inputs !== null && inputs.type === type && engineError('healthInsurance', inputs) === null, `healthInsurance: plan "${type}" saves and runs`);
}
testForm('healthInsurance', F.healthInsuranceForm,
  [{ name: 'average premium', text: { type: 'employerIndividual', premium: '', startAge: EMPTY_AGE, endAge: EMPTY_AGE },
     expect: { type: 'employerIndividual', monthlyPremiumOverride: null, startAge: null, endAge: null } },
   { name: 'own premium, ages', text: { type: 'marketplaceFamily', premium: '350', startAge: age('26', '0'), endAge: age('65', '0') },
     expect: { type: 'marketplaceFamily', monthlyPremiumOverride: 350, startAge: A(26), endAge: A(65) } }],
  [['premium has cents', { premium: '99.5' }], ['end age is before start age', { startAge: age('65'), endAge: age('26') }]],
  true);

testForm('pet', F.petForm,
  [{ name: 'basic', text: { startAge: age('24', '0'), lifespanYears: '12', vetPerYear: '600', foodPerMonth: '60', adoptionCost: '0' },
     expect: { startAge: A(24), lifespanYears: 12, vetPerYear: 600, foodPerMonth: 60, adoptionCost: 0 } }],
  [['start age is blank', { startAge: EMPTY_AGE }], ['lifespan is 0', { lifespanYears: '0' }], ['vet is blank', { vetPerYear: '' }],
   ['food is blank', { foodPerMonth: '' }], ['adoption cost is blank', { adoptionCost: '' }]]);

const personalBlank: F.PersonalText = { clothing: '', otherPersonalCare: '', entertainment: '', gym: '', phonePlan: '', books: '', courses: '', events: '', startAge: EMPTY_AGE, endAge: EMPTY_AGE };
testForm('personal', F.personalForm,
  [{ name: 'a few filled', text: { ...personalBlank, clothing: '100', gym: '40', phonePlan: '65' },
     expect: { startAge: null, endAge: null, clothing: 100, otherPersonalCare: null, entertainment: null, gym: 40, phonePlan: 65, books: null, courses: null, events: null } },
   { name: 'all filled, ages', text: { clothing: '100', otherPersonalCare: '30', entertainment: '80', gym: '40', phonePlan: '65', books: '15', courses: '25', events: '50', startAge: age('22', '0'), endAge: age('80', '0') },
     expect: { startAge: A(22), endAge: A(80), clothing: 100, otherPersonalCare: 30, entertainment: 80, gym: 40, phonePlan: 65, books: 15, courses: 25, events: 50 } }],
  [['clothing has cents', { clothing: '9.99' }], ['events is negative', { events: '-1' }], ['end age is before start age', { startAge: age('30'), endAge: age('20') }]],
  true);
check(F.PERSONAL_KEYS.length === 8 && new Set(F.PERSONAL_KEYS).size === 8, 'personal: 8 different amounts');

for (const [type, form] of [['birthdayChristmas', F.birthdayChristmasForm], ['recurringPayment', F.recurringPaymentForm]] as const) {
  testForm(type, form,
    [{ name: 'monthly', text: { amount: '50', frequency: 'monthly', startAge: EMPTY_AGE, endAge: EMPTY_AGE },
       expect: { amount: 50, frequency: 'monthly', startAge: null, endAge: null } },
     { name: 'yearly, ages', text: { amount: '1,200', frequency: 'yearly', startAge: age('25', '0'), endAge: age('60', '0') },
       expect: { amount: 1200, frequency: 'yearly', startAge: A(25), endAge: A(60) } }],
    [['amount is blank', { amount: '' }], ['amount has cents', { amount: '5.5' }], ['end age is before start age', { startAge: age('60'), endAge: age('25') }]]);
}

testForm('oneTimeExpense', F.oneTimeExpenseForm,
  [{ name: 'basic', text: { age: age('28', '3'), amount: '12,000' }, expect: { age: A(28, 3), amount: 12000 } }],
  [['age is blank', { age: EMPTY_AGE }], ['amount is blank', { amount: '' }], ['months are 12', { age: age('28', '12') }]]);

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed) {
  for (const f of fails.slice(0, 60)) console.log('  ✗ ' + f);
  throw new Error(`${failed} checks failed`);
}
