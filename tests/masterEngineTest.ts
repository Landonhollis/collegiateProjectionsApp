// masterEngineTest.ts — run with:  npx tsx masterEngineTest.ts
// No test framework needed. Exits non-zero on any failure.
import { ACCOUNT_COUNT, balanceAt, coahe } from '../Engines/coahe';
import { ACCT, ENGINES } from '../Engines/entityEngines';
import { ENTITY_TYPE_CODES, RETIREMENT_ACCOUNT, entityTypeOf, makeEntityId, masterEngine } from '../Engines/masterEngine';
import type { Age, Case, Entity, EntityTypeKey, JournalEntry } from '../TypesAndVariables/types';

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
const startingAge = age(22, 4);
const entity = (type: EntityTypeKey, inputs: Record<string, unknown>): Entity => ({ entityId: makeEntityId(type), inputs });
const sameHistory = (a: Float64Array | null, b: Float64Array) =>
  a !== null && a.length === b.length && a.every((v, i) => v === b[i]);

// ═════════════════════════════════════════════════════════════════════════════
test('entity IDs', () => {
  const codes = Object.values(ENTITY_TYPE_CODES);
  check(new Set(codes).size === codes.length, 'type codes are unique');
  check(Object.keys(ENTITY_TYPE_CODES).length === Object.keys(ENGINES).length, 'every engine has a type code');
  for (const type of Object.keys(ENGINES) as EntityTypeKey[]) {
    const id = makeEntityId(type);
    check(/^\d{2}-[0-9a-z]{8}$/.test(id), `${type}: id "${id}" matches TT-xxxxxxxx`);
    check(entityTypeOf(id) === type, `${type}: round trip`);
  }
  check(makeEntityId('income').startsWith('09-'), 'income code is 09');
  const ids = new Set(Array.from({ length: 1000 }, () => makeEntityId('food')));
  check(ids.size === 1000, '1000 random ids are unique');
  check(throws(() => entityTypeOf('99-abcdefgh')), 'unknown type code throws');
  check(throws(() => entityTypeOf('9-abcdefgh')), 'malformed id throws');
  check(throws(() => entityTypeOf('09-ABCDEFGH')), 'uppercase random part throws');
});

// A realistic case, plus a second case to show cases stay independent
const incomeInputs = { salary: 60_000, raisePct: 2, filingStatus: 'single', retirementContributionPct: 6, endAge: age(65) };
const caseA: Case = {
  caseId: 'A', caseName: 'Buy a house at 30', caseColor: '#3a7', notes: { anything: true },
  entities: [
    entity('openingCash', { amount: 3_000 }),
    entity('income', incomeInputs),
    entity('existingInvestment', { currentInvested: 10_000, returnPct: 7 }),
    entity('buyingHome', { purchaseAge: age(30), totalPropertyValue: 350_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6.5 }),
    entity('investing', { account: 12, initialContribution: 1_000, returnPct: 6, contributionStartAge: age(25), monthlyContribution: 300 }),
    entity('food', { diningOutMonthly: 200, groceriesMonthly: 400 }),
  ],
};
const caseB: Case = {
  caseId: 'B', caseName: 'Keep renting', caseColor: '#a37',
  entities: [
    entity('openingCash', { amount: 3_000 }),
    entity('renting', { rentMonthly: 1_300 }),
  ],
};

test('computed cases', () => {
  const out = masterEngine({ startingAge, cases: [caseA, caseB] });
  check(out.startingAge === startingAge, 'startingAge passes through');
  check(out.computedCases.length === 2, 'one computed case per case');
  const [a, b] = out.computedCases;
  check(a.caseId === 'A' && b.caseId === 'B', 'order kept');
  check(a.caseName === 'Buy a house at 30' && a.caseColor === '#3a7' && a.notes === caseA.notes, 'other fields pass through');
  check(!('entities' in a), 'entities replaced');
  check(a.error === null && b.error === null, 'no errors');

  // Investment accounts: in order from 4; the input's account 12 is overwritten
  const [invExisting, invNew] = [caseA.entities[2].entityId, caseA.entities[4].entityId];
  check(a.investmentAccounts[invExisting] === 4 && a.investmentAccounts[invNew] === 5, 'investment accounts 4, 5 in entity order');
  check(Object.keys(a.investmentAccounts).length === 2, 'only investment entities get accounts');
  check(Object.keys(b.investmentAccounts).length === 0, 'case B has no investment accounts');

  // History equals running the engines + COAHE by hand
  const ctx = { caseId: 'A', startAge: startingAge };
  const byHand: JournalEntry[] = [
    ...ENGINES.openingCash({ amount: 3_000 }, ctx),
    ...ENGINES.income({ ...incomeInputs, filingStatus: 'single', retirementAccount: RETIREMENT_ACCOUNT }, ctx),
    ...ENGINES.existingInvestment({ account: 4, currentInvested: 10_000, returnPct: 7 }, ctx),
    ...ENGINES.buyingHome({ purchaseAge: age(30), totalPropertyValue: 350_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6.5 }, ctx),
    ...ENGINES.investing({ account: 5, initialContribution: 1_000, returnPct: 6, contributionStartAge: age(25), monthlyContribution: 300 }, ctx),
    ...ENGINES.food({ diningOutMonthly: 200, groceriesMonthly: 400 }, ctx),
  ];
  check(sameHistory(a.chartOfAccountsHistory, coahe(byHand)), 'history = COAHE(all engines by hand)');

  const h = a.chartOfAccountsHistory!;
  const last = h.length / ACCOUNT_COUNT - 1;
  check(balanceAt(h, last, RETIREMENT_ACCOUNT) > 0, '401k deposits land in account 3');
  check(balanceAt(h, 0, 4) === 10_000, 'existing investment opens in account 4');
  check(balanceAt(h, last, 12) === 0, 'account 12 unused (input value overwritten)');
  check(balanceAt(h, 0, ACCT.CASH) === 3_000, 'opening cash');
  check(!sameHistory(b.chartOfAccountsHistory, h), 'cases computed independently');
});

test('errors fail only their own case', () => {
  const bad = entity('buyingHome', { totalPropertyValue: 300_000 }); // missing purchaseAge
  const tooMany: Case = {
    caseId: 'many',
    entities: Array.from({ length: 10 }, () => entity('investing', { initialContribution: 0, returnPct: 5, contributionStartAge: age(25) })),
  };
  const out = masterEngine({
    startingAge,
    cases: [
      { caseId: 'bad', caseName: 'x', entities: [entity('openingCash', { amount: 1 }), bad] },
      caseB,
      { caseId: 'unknown', entities: [{ entityId: '99-abcdefgh', inputs: {} }] },
      tooMany,
      { caseId: 'dupe', entities: [caseB.entities[0], caseB.entities[0]] },
      { caseId: 'empty', entities: [] },
    ],
  });
  const [badOut, okOut, unknownOut, manyOut, dupeOut, emptyOut] = out.computedCases;
  check(badOut.error?.entityId === bad.entityId && badOut.chartOfAccountsHistory === null, 'bad entity → case error with its entityId');
  check(badOut.caseName === 'x', 'failed case still passes fields through');
  check(okOut.error === null && okOut.chartOfAccountsHistory !== null, 'other cases still compute');
  check(unknownOut.error?.entityId === '99-abcdefgh', 'unknown type code → case error');
  check(manyOut.error?.entityId === tooMany.entities[9].entityId && /too many/.test(manyOut.error.message), '10th investment entity → case error');
  check(dupeOut.error !== null && /duplicate/.test(dupeOut.error.message), 'duplicate entityId → case error');
  check(emptyOut.error === null && emptyOut.chartOfAccountsHistory?.length === 0, 'no entities → empty history');
});

test('performance', () => {
  const cases = Array.from({ length: 4 }, (_, i) => ({ ...caseA, caseId: `p${i}` }));
  const t0 = Date.now();
  masterEngine({ startingAge, cases });
  const ms = Date.now() - t0;
  check(ms < 500, `4 cases < 500 ms (got ${ms} ms)`);
  console.log(`  perf: ~${ms} ms for 4 cases × ${caseA.entities.length} entities`);
});

test('type codes never change', () => {
  // If this fails, saved entities in users' apps would load as the wrong type. Add new types at the end only.
  const frozen = 'openingCash:01,existingHome:02,existingVehicle:03,existingCreditCard:04,existingStudentLoans:05,existingInvestment:06,otherExistingAsset:07,otherExistingLoan:08,income:09,renting:10,buyingHome:11,buyingCar:12,gas:13,kid:14,education:15,investing:16,food:17,healthInsurance:18,pet:19,personal:20,birthdayChristmas:21,oneTimeExpense:22,recurringPayment:23';
  check(Object.entries(ENTITY_TYPE_CODES).map(([t, c]) => `${t}:${c}`).join() === frozen, 'ENTITY_TYPE_CODES unchanged');
});

test('case and input validation', () => {
  const ok = { caseId: 'ok', entities: [entity('openingCash', { amount: 100 })] };
  const bad = masterEngine({ startingAge: { years: 22.5, months: 0 }, cases: [ok] }).computedCases[0];
  check(bad.error !== null && /startingAge/.test(bad.error.message) && bad.chartOfAccountsHistory === null, 'bad startingAge → case error');
  const noAge = masterEngine({ startingAge: undefined as unknown as Age, cases: [ok] }).computedCases[0];
  check(noAge.error !== null, 'missing startingAge → case error (even with no ages in the entities)');
  const noId = masterEngine({ startingAge, cases: [{ entities: [] } as unknown as Case] }).computedCases[0];
  check(noId.error !== null && /caseId/.test(noId.error.message), 'missing caseId → case error');
  const nullEnt = masterEngine({ startingAge, cases: [{ caseId: 'n', entities: [null as unknown as Entity] }] }).computedCases[0];
  check(nullEnt.error !== null && nullEnt.error.entityId === null, 'null entity → case error');
  const e = entity('food', undefined as unknown as Record<string, unknown>);
  const noInputs = masterEngine({ startingAge, cases: [{ caseId: 'x', entities: [e] }] }).computedCases[0];
  check(noInputs.error === null && noInputs.chartOfAccountsHistory!.length === 0, 'food with no inputs → nothing (all optional)');
  const noInputs2 = masterEngine({ startingAge, cases: [{ caseId: 'x', entities: [entity('income', undefined as unknown as Record<string, unknown>)] }] }).computedCases[0];
  check(noInputs2.error?.entityId !== undefined && /salary/.test(noInputs2.error!.message), 'income with no inputs → error names salary');
  const neg = masterEngine({ startingAge, cases: [{ caseId: 'x', entities: [entity('renting', { rentMonthly: -1 })] }] }).computedCases[0];
  check(neg.error !== null && /rentMonthly/.test(neg.error.message), 'negative rent → case error');
  check(masterEngine({ startingAge, cases: [] }).computedCases.length === 0, 'no cases → no computed cases');
});

test('investment accounts: 9 fit, mixed types, 401k shared', () => {
  const nine: Entity[] = Array.from({ length: 9 }, (_, i) =>
    i % 2 ? entity('existingInvestment', { currentInvested: 1_000 * (i + 1), returnPct: 0 }) : entity('investing', { initialContribution: 1_000 * (i + 1), returnPct: 0, contributionStartAge: startingAge }));
  const out = masterEngine({ startingAge, cases: [{ caseId: 'nine', entities: nine }] }).computedCases[0];
  check(out.error === null, '9 investment entities is fine');
  check(nine.map((n) => out.investmentAccounts[n.entityId]).join() === '4,5,6,7,8,9,10,11,12', 'accounts 4–12 in order across both types');
  check(nine.every((n, i) => balanceAt(out.chartOfAccountsHistory!, 0, 4 + i) === 1_000 * (i + 1)), 'each balance lands in its own account');
  const inc = (salary: number) => entity('income', { salary, raisePct: 0, filingStatus: 'single', retirementContributionPct: 10, retirementReturnPct: 5, endAge: { years: 30, months: 0 } });
  const [a, b] = [inc(50_000), inc(80_000)];
  const both = masterEngine({ startingAge, cases: [{ caseId: 'two', entities: [a, b] }] }).computedCases[0].chartOfAccountsHistory!;
  const onlyA = masterEngine({ startingAge, cases: [{ caseId: 'a', entities: [a] }] }).computedCases[0].chartOfAccountsHistory!;
  const onlyB = masterEngine({ startingAge, cases: [{ caseId: 'b', entities: [b] }] }).computedCases[0].chartOfAccountsHistory!;
  const last = both.length / ACCOUNT_COUNT - 1;
  check(balanceAt(both, last, RETIREMENT_ACCOUNT) === balanceAt(onlyA, last, 3) + balanceAt(onlyB, last, 3) && balanceAt(both, last, 3) > 0, 'two incomes share account 3; balances add up');
  const extra = masterEngine({ startingAge, cases: [{ caseId: 'x', entities: [{ ...entity('food', { groceriesMonthly: 100, diningOutMonthly: 0 }), name: 'Groceries', icon: '🛒' } as Entity] }] }).computedCases[0];
  check(extra.error === null, 'extra UI fields on an entity are ignored');
});

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed) {
  for (const f of fails.slice(0, 40)) console.log('  ✗ ' + f);
  throw new Error(`${failed} checks failed`);
}
