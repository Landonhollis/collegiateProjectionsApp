// propertyTest.ts — run with:  npx tsx propertyTest.ts
// Randomized tests: thousands of random (valid) entities and cases, checked against
// rules that must ALWAYS hold. Seeded, so any failure is reproducible.
// No test framework needed. Exits non-zero on any failure.
import { ACCOUNT_COUNT, balanceAt, coahe } from '../Engines/coahe';
import { ACCT, ENGINES, paymentFor } from '../Engines/entityEngines';
import { makeEntityId, masterEngine } from '../Engines/masterEngine';
import type { Age, Case, EngineCtx, Entity, EntityTypeKey, JournalEntry } from '../TypesAndVariables/types';

declare const process: { env: Record<string, string | undefined> }; // Node (tsx) provides it

// ── tiny harness ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const fails: string[] = [];
function check(cond: boolean, msg: string) {
  if (cond) passed++;
  else { failed++; if (fails.length < 60) fails.push(msg); }
}
function test(name: string, fn: () => void) {
  try { fn(); } catch (e) { failed++; fails.push(`${name}: threw ${(e as Error).stack}`); }
}

// ── seeded random ────────────────────────────────────────────────────────────
const SEED = Number(process.env.SEED ?? 20260925);
let state = SEED >>> 0;
const rand = () => { // mulberry32
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const num = (a: number, b: number) => a + rand() * (b - a);
const money = (a: number, b: number) => (rand() < 0.5 ? int(a, b) : Math.round(num(a, b) * 100) / 100);
const pick = <T>(xs: readonly T[]): T => xs[int(0, xs.length - 1)];
const maybe = <T>(p: number, f: () => T): T | undefined => (rand() < p ? f() : undefined);

// ── ages ─────────────────────────────────────────────────────────────────────
const toAge = (totalMonths: number): Age => {
  const t = Math.max(0, totalMonths);
  return { years: Math.floor(t / 12), months: t % 12 };
};
const ageMonths = (a: Age) => a.years * 12 + a.months;

// ═════════════════════════════════════════════════════════════════════════════
// Random valid inputs for every entity type
// ═════════════════════════════════════════════════════════════════════════════
type Gen = (start: Age) => Record<string, unknown>;
const at = (start: Age, offset: number) => toAge(ageMonths(start) + offset);

/** A consistent loan with one of its 4 numbers dropped (any 3 of 4). */
function loan3of4() {
  const B = money(500, 120_000), rate = pick([0, num(0, 14)]), n = int(6, 300);
  const pmt = Math.ceil(paymentFor(B, rate / 1200, n));
  const full: Record<string, number> = { remainingBalance: B, interestRatePct: rate, remainingTermMonths: n, monthlyPayment: pmt };
  delete full[pick(Object.keys(full))];
  return full;
}

const GENERATORS: Record<EntityTypeKey, Gen> = {
  openingCash: () => ({ amount: money(0, 200_000) }),
  existingHome: (s) => {
    const price = money(60_000, 1_200_000), dp = pick([0, 3.5, 10, 20, num(0, 100), 100]);
    const P0 = price * (1 - dp / 100);
    return {
      totalPropertyValue: price, downPaymentPct: dp, mortgageTermYears: pick([10, 15, 20, 30]), interestRatePct: num(0, 9),
      remainingBalance: rand() < 0.2 ? 0 : Math.round(P0 * num(0, 1)),
      purchaseAge: maybe(0.6, () => at(s, -int(0, 360))), sellAge: maybe(0.4, () => at(s, int(0, 600))),
    };
  },
  buyingHome: (s) => {
    const buy = int(-60, 600);
    return {
      purchaseAge: at(s, buy), totalPropertyValue: money(60_000, 1_500_000), downPaymentPct: pick([0, 5, 20, num(0, 100), 100]),
      mortgageTermYears: pick([10, 15, 30]), interestRatePct: num(0, 9), utilitiesMonthly: maybe(0.5, () => money(0, 900)),
      sellAge: maybe(0.4, () => at(s, Math.max(buy, 0) + int(0, 400))),
    };
  },
  existingVehicle: (s) => {
    const financing = pick(['loan', 'full'] as const), price = money(3_000, 90_000), dp = num(0, 50), n = int(12, 84);
    return {
      financing, totalVehicleValue: price, downPaymentPct: dp, loanTermMonths: n, interestRatePct: num(0, 15),
      remainingBalance: rand() < 0.2 ? 0 : Math.round(price * (1 - dp / 100) * num(0, 1)),
      purchaseAge: financing === 'full' || rand() < 0.3 ? at(s, -int(0, 180)) : undefined,
      sellAge: maybe(0.4, () => at(s, int(0, 240))),
    };
  },
  buyingCar: (s) => {
    const buy = int(-24, 500);
    return {
      purchaseAge: at(s, buy), financing: pick(['loan', 'full'] as const), totalVehicleValue: money(5_000, 100_000),
      downPaymentPct: num(0, 100), loanTermMonths: int(12, 84), interestRatePct: num(0, 15),
      sellAge: maybe(0.5, () => at(s, Math.max(buy, 0) + int(0, 200))),
      insuranceMonthly: maybe(0.5, () => money(0, 400)), maintenanceMonthly: maybe(0.5, () => money(0, 300)),
    };
  },
  existingCreditCard: (s) => ({
    currentBalance: money(0, 30_000), aprPct: num(0, 30), monthlyPayment: money(0, 1_500),
    paymentStartAge: maybe(0.3, () => at(s, int(-12, 60))),
  }),
  existingStudentLoans: () => loan3of4(),
  otherExistingLoan: () => loan3of4(),
  otherExistingAsset: (s) => ({
    assetValue: money(0, 100_000), appreciationPct: pick([num(-40, 12), -100, 0]), purchaseAge: at(s, -int(0, 240)),
    financedWithLoan: rand() < 0.5, ...loan3of4(),
  }),
  existingInvestment: (s) => ({
    account: int(4, 12), currentInvested: money(0, 500_000), returnPct: num(-15, 12),
    monthlyContribution: maybe(0.6, () => money(0, 3_000)), contributionStartAge: maybe(0.3, () => at(s, int(-12, 120))),
    contributionEndAge: maybe(0.5, () => at(s, int(0, 500))), monthlyWithdrawal: maybe(0.5, () => money(0, 8_000)),
    withdrawalStartAge: maybe(0.6, () => at(s, int(0, 600))), withdrawalEndAge: maybe(0.3, () => at(s, int(0, 900))),
  }),
  investing: (s) => ({
    account: int(4, 12), initialContribution: money(0, 50_000), returnPct: num(-15, 12), contributionStartAge: at(s, int(-24, 400)),
    monthlyContribution: maybe(0.7, () => money(0, 3_000)), contributionEndAge: maybe(0.5, () => at(s, int(0, 600))),
    monthlyWithdrawal: maybe(0.5, () => money(0, 8_000)), withdrawalStartAge: maybe(0.6, () => at(s, int(0, 700))),
    withdrawalEndAge: maybe(0.3, () => at(s, int(0, 900))),
  }),
  income: (s) => ({
    salary: money(0, 600_000), raisePct: num(-3, 6), filingStatus: pick(['single', 'married'] as const),
    startAge: maybe(0.3, () => at(s, int(-24, 120))), endAge: maybe(0.7, () => at(s, int(0, 600))),
    charityPct: maybe(0.3, () => num(0, 20)), retirementContributionPct: maybe(0.5, () => num(0, 30)), retirementAccount: 3,
    retirementReturnPct: maybe(0.5, () => num(-5, 10)), incomeTaxRatePct: maybe(0.2, () => num(0, 50)),
  }),
  renting: (s) => ({
    rentMonthly: money(0, 5_000), junkFeesMonthly: maybe(0.5, () => money(0, 200)), utilitiesMonthly: maybe(0.5, () => money(0, 500)),
    startAge: maybe(0.4, () => at(s, int(-12, 200))), endAge: maybe(0.6, () => at(s, int(0, 400))),
  }),
  gas: (s) => ({
    milesPerWeek: money(0, 1_000), mpg: num(8, 60), gasPricePerGallon: maybe(0.4, () => num(0, 8)),
    startAge: maybe(0.3, () => at(s, int(0, 200))), endAge: maybe(0.5, () => at(s, int(0, 700))),
  }),
  kid: (s) => ({ annualCost: money(0, 30_000), birthAge: at(s, int(-300, 400)) }),
  education: (s) => ({
    paymentType: pick(['loan', 'full'] as const), costPerSemester: money(0, 35_000), numberOfSemesters: int(0, 12),
    startAge: at(s, int(-72, 300)), loanRatePct: num(0, 10), loanTermYears: pick([1, 5, 10, 20, 25]),
  }),
  food: (s) => ({
    diningOutMonthly: money(0, 800), groceriesMonthly: money(0, 1_500),
    startAge: maybe(0.3, () => at(s, int(0, 200))), endAge: maybe(0.5, () => at(s, int(0, 900))),
  }),
  healthInsurance: (s) => ({
    type: pick(['employerIndividual', 'employerFamily', 'marketplaceIndividual', 'marketplaceFamily', 'medicare', 'none'] as const),
    monthlyPremiumOverride: maybe(0.3, () => money(0, 2_000)),
    startAge: maybe(0.4, () => at(s, int(0, 300))), endAge: maybe(0.6, () => at(s, int(0, 700))),
  }),
  pet: (s) => ({
    startAge: at(s, int(-200, 400)), lifespanYears: pick([0, num(1, 20), 12]), vetPerYear: money(0, 2_000),
    foodPerMonth: money(0, 200), adoptionCost: money(0, 3_000),
  }),
  personal: (s) => ({
    clothing: maybe(0.7, () => money(0, 300)), otherPersonalCare: maybe(0.5, () => money(0, 200)), entertainment: maybe(0.7, () => money(0, 500)),
    gym: maybe(0.5, () => money(0, 150)), phonePlan: maybe(0.8, () => money(0, 150)), books: maybe(0.3, () => money(0, 80)),
    courses: maybe(0.2, () => money(0, 300)), events: maybe(0.4, () => money(0, 300)),
    startAge: maybe(0.3, () => at(s, int(0, 200))), endAge: maybe(0.5, () => at(s, int(0, 900))),
  }),
  birthdayChristmas: (s) => ({
    amount: money(0, 5_000), frequency: pick(['monthly', 'yearly'] as const),
    startAge: maybe(0.3, () => at(s, int(0, 200))), endAge: maybe(0.5, () => at(s, int(0, 900))),
  }),
  oneTimeExpense: (s) => ({ age: at(s, int(-120, 1_000)), amount: money(0, 100_000) }),
  recurringPayment: (s) => ({
    amount: money(0, 3_000), frequency: pick(['monthly', 'yearly'] as const),
    startAge: maybe(0.4, () => at(s, int(-24, 500))), endAge: maybe(0.6, () => at(s, int(0, 900))),
  }),
};
const TYPES = Object.keys(GENERATORS) as EntityTypeKey[];

// Accounts each engine is allowed to touch ('inv' = its investment account input)
const A = ACCT;
const ALLOWED: Record<EntityTypeKey, Array<number | 'inv'>> = {
  openingCash: [A.CASH, A.EQUITY],
  existingHome: [A.PROPERTY, A.CASH, A.MORTGAGE, A.EQUITY, A.APPRECIATION, A.MORTGAGE_INTEREST, A.HOME_INSURANCE, A.PROPERTY_TAX, A.HOME_UTILITIES_MAINTENANCE],
  buyingHome: [A.PROPERTY, A.CASH, A.MORTGAGE, A.APPRECIATION, A.MORTGAGE_INTEREST, A.HOME_INSURANCE, A.PROPERTY_TAX, A.HOME_UTILITIES_MAINTENANCE],
  existingVehicle: [A.CASH, A.VEHICLES, A.VEHICLE_LOAN, A.EQUITY, A.CAR_INSURANCE, A.VEHICLE_LOAN_INTEREST, A.VEHICLE_DEPRECIATION, A.VEHICLE_MAINTENANCE],
  buyingCar: [A.CASH, A.VEHICLES, A.VEHICLE_LOAN, A.CAR_INSURANCE, A.VEHICLE_LOAN_INTEREST, A.VEHICLE_DEPRECIATION, A.VEHICLE_MAINTENANCE],
  existingCreditCard: [A.CASH, A.CREDIT_CARD, A.EQUITY, A.CREDIT_CARD_INTEREST],
  existingStudentLoans: [A.CASH, A.STUDENT_LOANS, A.EQUITY, A.STUDENT_LOAN_INTEREST],
  otherExistingLoan: [A.CASH, A.OTHER_DEBT, A.EQUITY, A.OTHER_DEBT_INTEREST],
  otherExistingAsset: [A.PROPERTY, A.CASH, A.OTHER_DEBT, A.EQUITY, A.APPRECIATION, A.OTHER_DEBT_INTEREST],
  existingInvestment: [A.CASH, A.EQUITY, A.INVESTMENT_GAINS, 'inv'],
  investing: [A.CASH, A.INVESTMENT_GAINS, 'inv'],
  income: [A.CASH, 3, A.EARNED_INCOME, A.INVESTMENT_GAINS, A.INCOME_TAX, A.CHARITY, A.OTHER_TAXES],
  renting: [A.CASH, A.RENT, A.RENTERS_INSURANCE, A.HOME_UTILITIES_MAINTENANCE],
  gas: [A.CASH, A.GAS],
  kid: [A.CASH, A.KIDS],
  education: [A.CASH, A.STUDENT_LOANS, A.EDUCATION, A.STUDENT_LOAN_INTEREST],
  food: [A.CASH, A.FOOD],
  healthInsurance: [A.CASH, A.HEALTH_INSURANCE],
  pet: [A.CASH, A.PETS],
  personal: [A.CASH, A.PERSONAL],
  birthdayChristmas: [A.CASH, A.BIRTHDAY_CHRISTMAS],
  oneTimeExpense: [A.CASH, A.ONE_TIME],
  recurringPayment: [A.CASH, A.RECURRING],
};
const ASSETS = [A.PROPERTY, A.VEHICLES, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const LIABILITIES = [A.MORTGAGE, A.VEHICLE_LOAN, A.STUDENT_LOANS, A.OTHER_DEBT, A.CREDIT_CARD];

const run = (type: EntityTypeKey, input: unknown, c: EngineCtx): JournalEntry[] =>
  (ENGINES[type] as (i: unknown, c: EngineCtx) => JournalEntry[])(input, c);

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
}

/** Every rule a single engine's output must satisfy. Returns a list of broken rules. */
function rulesFor(type: EntityTypeKey, input: Record<string, unknown>, e: JournalEntry[], c: EngineCtx): string[] {
  const out: string[] = [];
  const end = c.endMonth ?? 960;
  const allowed = new Set(ALLOWED[type].map((a) => (a === 'inv' ? (input.account as number) : a)));
  const running = new Map<number, number>();
  let prev = -1;
  for (const je of e) {
    if (je.caseId !== c.caseId) out.push('caseId');
    if (!Number.isInteger(je.month) || je.month < 0 || je.month > end) out.push(`month ${je.month} out of range`);
    if (je.month <= prev) out.push(`months not increasing at ${je.month}`);
    prev = je.month;
    if (je.lineEntries.length < 2) out.push(`month ${je.month}: < 2 lines`);
    let sum = 0;
    const seen = new Set<number>();
    for (const l of je.lineEntries) {
      sum += l.amount;
      if (!Number.isInteger(l.amount) || l.amount === 0) out.push(`month ${je.month}: bad amount ${l.amount}`);
      if (!allowed.has(l.account)) out.push(`month ${je.month}: account ${l.account} not allowed`);
      if (seen.has(l.account)) out.push(`month ${je.month}: account ${l.account} twice`);
      seen.add(l.account);
      if (l.account >= 70 && l.account <= 95 && l.amount < 0) out.push(`month ${je.month}: expense ${l.account} credited ${l.amount}`);
      if (l.account === A.EARNED_INCOME && l.amount > 0) out.push(`month ${je.month}: income debited`);
      running.set(l.account, (running.get(l.account) ?? 0) + l.amount);
    }
    if (sum !== 0) out.push(`month ${je.month}: sums to ${sum}`);
    for (const a of ASSETS) if ((running.get(a) ?? 0) < 0) out.push(`month ${je.month}: asset ${a} negative (${running.get(a)})`);
    for (const a of LIABILITIES) if ((running.get(a) ?? 0) > 0) out.push(`month ${je.month}: liability ${a} overpaid (${running.get(a)})`);
  }
  return out;
}

const shiftAges = (v: unknown, years: number): unknown => {
  if (Array.isArray(v)) return v.map((x) => shiftAges(x, years));
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.years === 'number' && typeof o.months === 'number' && Object.keys(o).length === 2) return { years: o.years + years, months: o.months };
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, shiftAges(x, years)]));
  }
  return v;
};

// ═════════════════════════════════════════════════════════════════════════════
test('random entities: every rule, every engine', () => {
  const PER_TYPE = Number(process.env.PER_TYPE ?? 150);
  for (const type of TYPES) {
    let broken = 0, nonDet = 0, mutated = 0, prefixBad = 0, shiftBad = 0, threw = 0;
    for (let i = 0; i < PER_TYPE; i++) {
      const start = toAge(int(18 * 12, 65 * 12));
      const input = GENERATORS[type](start);
      const c: EngineCtx = { caseId: `c${i}`, startAge: start };
      const snapshot = JSON.stringify(input);
      let e: JournalEntry[];
      try { e = run(type, deepFreeze(structuredClone(input)), c); } catch (err) {
        threw++; if (threw <= 3) check(false, `${type}: valid input threw: ${(err as Error).message} :: ${snapshot}`); continue;
      }
      if (JSON.stringify(input) !== snapshot) mutated++;
      const bad = rulesFor(type, input, e, c);
      if (bad.length) { broken++; if (broken <= 3) check(false, `${type}: ${bad.slice(0, 3).join('; ')} :: ${snapshot} start=${JSON.stringify(start)}`); }
      if (JSON.stringify(run(type, input, c)) !== JSON.stringify(e)) nonDet++;
      // Shorter horizon = same months up to the cut
      const E = int(0, 960);
      const cut = run(type, input, { ...c, endMonth: E });
      if (JSON.stringify(cut) !== JSON.stringify(e.filter((x) => x.month <= E))) { prefixBad++; if (prefixBad <= 2) check(false, `${type}: endMonth ${E} is not a prefix :: ${snapshot}`); }
      // Everyone k years older (start + every age) = identical months. (401k limits depend on real age.)
      if (!(type === 'income' && input.retirementContributionPct)) {
        const k = int(1, 5);
        const shifted = run(type, shiftAges(input, k), { ...c, startAge: { years: start.years + k, months: start.months } });
        if (JSON.stringify(shifted) !== JSON.stringify(e)) { shiftBad++; if (shiftBad <= 2) check(false, `${type}: shifting all ages by ${k}y changed the output :: ${snapshot}`); }
      }
    }
    check(threw === 0, `${type}: ${threw} valid inputs threw`);
    check(broken === 0, `${type}: ${broken}/${PER_TYPE} broke a rule`);
    check(nonDet === 0, `${type}: deterministic`);
    check(mutated === 0, `${type}: never mutates its input`);
    check(prefixBad === 0, `${type}: endMonth cut is a prefix (${prefixBad} bad)`);
    check(shiftBad === 0, `${type}: time-shift invariant (${shiftBad} bad)`);
  }
});

// Fields every engine always reads (so a bad value there must throw), and which may be negative
const ALWAYS_READ: Partial<Record<EntityTypeKey, string[]>> = {
  openingCash: ['amount'], existingHome: ['totalPropertyValue', 'mortgageTermYears', 'interestRatePct', 'downPaymentPct', 'remainingBalance'],
  buyingHome: ['totalPropertyValue', 'downPaymentPct'], existingVehicle: ['totalVehicleValue'], buyingCar: ['totalVehicleValue'],
  existingCreditCard: ['currentBalance', 'aprPct', 'monthlyPayment'], existingInvestment: ['currentInvested', 'returnPct', 'account'],
  investing: ['returnPct', 'account', 'initialContribution'], income: ['salary', 'raisePct'], renting: ['rentMonthly'],
  gas: ['milesPerWeek', 'mpg'], kid: ['annualCost'], education: ['costPerSemester', 'numberOfSemesters'],
  food: ['diningOutMonthly', 'groceriesMonthly'], pet: ['lifespanYears', 'vetPerYear', 'foodPerMonth', 'adoptionCost'],
  personal: ['clothing', 'gym', 'phonePlan'], birthdayChristmas: ['amount'], oneTimeExpense: ['amount'], recurringPayment: ['amount'],
  otherExistingAsset: ['assetValue', 'appreciationPct'],
};
const MAY_BE_NEGATIVE = new Set(['returnPct', 'appreciationPct', 'raisePct']);

test('random bad values always throw', () => {
  let missed = 0;
  for (const type of TYPES) {
    for (const field of ALWAYS_READ[type] ?? []) {
      for (let i = 0; i < 10; i++) {
        const start = toAge(int(18 * 12, 65 * 12));
        const c: EngineCtx = { caseId: 'bad', startAge: start };
        const input = GENERATORS[type](start);
        for (const badValue of [NaN, Infinity, -1_000_000, MAY_BE_NEGATIVE.has(field) ? -101 : -0.01]) {
          const threw = (() => { try { run(type, { ...input, [field]: badValue }, c); return false; } catch { return true; } })();
          if (!threw) { missed++; if (missed <= 5) check(false, `${type}.${field} = ${badValue} did not throw`); }
        }
      }
    }
  }
  check(missed === 0, `every bad value in an always-read field throws (${missed} missed)`);
});

// ═════════════════════════════════════════════════════════════════════════════
// Random whole cases through the master engine
// ═════════════════════════════════════════════════════════════════════════════
function randomCase(id: string, start: Age): Case {
  const entities: Entity[] = [{ entityId: makeEntityId('openingCash'), inputs: GENERATORS.openingCash(start) }];
  let investments = 0;
  for (let i = int(3, 25); i > 0; i--) {
    let type = pick(TYPES);
    if (type === 'investing' || type === 'existingInvestment') { if (investments >= 9) type = 'food'; else investments++; }
    entities.push({ entityId: makeEntityId(type), inputs: GENERATORS[type](start) });
  }
  return { caseId: id, caseName: `Case ${id}`, caseColor: '#123456', entities };
}

test('random cases: history is consistent', () => {
  const CASES = Number(process.env.CASES ?? 60);
  let errors = 0, unbalanced = 0, assetNeg = 0, liabPos = 0, notLinear = 0, shuffleBad = 0, acctBad = 0, mutated = 0;
  for (let i = 0; i < CASES; i++) {
    const start = toAge(int(18 * 12, 60 * 12));
    const cs = [randomCase(`r${i}`, start), randomCase(`s${i}`, start)];
    const snapshot = JSON.stringify(cs);
    const out = masterEngine(deepFreeze({ startingAge: start, cases: structuredClone(cs) }));
    if (JSON.stringify(cs) !== snapshot) mutated++;
    for (const [k, cc] of out.computedCases.entries()) {
      if (cc.error) { errors++; if (errors <= 3) check(false, `case error: ${JSON.stringify(cc.error)}`); continue; }
      const h = cc.chartOfAccountsHistory!;
      const nM = h.length / ACCOUNT_COUNT;
      for (let m = 0; m < nM; m++) {
        let s = 0;
        for (let a = 0; a < ACCOUNT_COUNT; a++) s += h[m * ACCOUNT_COUNT + a];
        if (s !== 0) unbalanced++;
        for (const a of ASSETS) if (h[m * ACCOUNT_COUNT + a] < 0) assetNeg++;
        for (const a of LIABILITIES) if (h[m * ACCOUNT_COUNT + a] > 0) liabPos++;
      }
      // Investment accounts: distinct, 4.., in entity order
      const inv = cs[k].entities.filter((e) => /^(06|16)-/.test(e.entityId)).map((e) => cc.investmentAccounts[e.entityId]);
      if (inv.join() !== inv.map((_, j) => 4 + j).join()) acctBad++;
      // Linearity: the case history = the sum of each entity's own history (padded)
      const sum = new Float64Array(h.length);
      for (const ent of cs[k].entities) {
        const one = masterEngine({ startingAge: start, cases: [{ caseId: cs[k].caseId, entities: [ent] }] }).computedCases[0];
        const oh = one.chartOfAccountsHistory!;
        const acct = cc.investmentAccounts[ent.entityId];
        const own = one.investmentAccounts[ent.entityId];
        const oM = oh.length / ACCOUNT_COUNT;
        for (let m = 0; m < nM; m++) {
          const src = Math.min(m, oM - 1);
          if (src < 0) break;
          for (let a = 0; a < ACCOUNT_COUNT; a++) {
            const target = own !== undefined && a === own ? acct : a; // alone it gets account 4
            sum[m * ACCOUNT_COUNT + target] += oh[src * ACCOUNT_COUNT + a];
          }
        }
      }
      if (sum.some((v, j) => v !== h[j])) { notLinear++; if (notLinear <= 2) check(false, `case ${cc.caseId}: not the sum of its entities`); }
      // Shuffling non-investment entities doesn't change the history
      const invIdx = cs[k].entities.map((e, j) => (/^(06|16)-/.test(e.entityId) ? j : -1)).filter((j) => j >= 0);
      const others = cs[k].entities.filter((_, j) => !invIdx.includes(j)).sort(() => rand() - 0.5);
      const shuffled = [...others, ...invIdx.map((j) => cs[k].entities[j])];
      const sh = masterEngine({ startingAge: start, cases: [{ ...cs[k], entities: shuffled }] }).computedCases[0].chartOfAccountsHistory!;
      if (sh.length !== h.length || sh.some((v, j) => v !== h[j])) shuffleBad++;
    }
  }
  check(errors === 0, `no case errors on valid input (${errors})`);
  check(unbalanced === 0, `every month of every history sums to 0 (${unbalanced} off)`);
  check(assetNeg === 0, `assets (home, vehicles, investments) never below 0 (${assetNeg})`);
  check(liabPos === 0, `loans never overpaid (${liabPos})`);
  check(acctBad === 0, `investment accounts 4, 5, … in entity order (${acctBad})`);
  check(notLinear === 0, `history = sum of each entity's history (${notLinear})`);
  check(shuffleBad === 0, `entity order (non-investment) doesn't matter (${shuffleBad})`);
  check(mutated === 0, 'master engine never mutates its input');
});

test('coahe on random journal soup = brute force', () => {
  for (let t = 0; t < 30; t++) {
    const entries: JournalEntry[] = [];
    for (let i = int(0, 400); i > 0; i--) {
      const lines = Array.from({ length: int(1, 5) }, () => ({ account: int(0, 149), amount: int(-100_000, 100_000) }));
      const s = lines.reduce((a, l) => a + l.amount, 0);
      lines.push({ account: int(0, 149), amount: -s });
      entries.push({ caseId: 'soup', month: int(0, 300), lineEntries: lines });
    }
    if (!entries.length) continue;
    const h = coahe(entries);
    const last = Math.max(...entries.map((e) => e.month));
    let bad = 0;
    for (const m of [0, int(0, last), last]) for (let a = 0; a < 150; a += 7) {
      const want = entries.filter((e) => e.month <= m).reduce((s, e) => s + e.lineEntries.filter((l) => l.account === a).reduce((x, l) => x + l.amount, 0), 0);
      if (balanceAt(h, m, a) !== want) bad++;
    }
    check(bad === 0 && h.length === (last + 1) * ACCOUNT_COUNT, `soup ${t}: matches brute force`);
  }
});

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\nseed ${SEED}: ${passed} checks passed, ${failed} failed`);
if (failed) {
  for (const f of fails) console.log('  ✗ ' + f.slice(0, 600));
  throw new Error(`${failed} checks failed`);
}
