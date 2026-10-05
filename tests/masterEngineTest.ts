// masterEngineTest.ts — run with:  npx tsx masterEngineTest.ts
// No test framework needed. Exits non-zero on any failure.
import { ACCOUNT_COUNT, balanceAt, coahe } from '../Engines/coahe';
import { ACCT, ENGINES } from '../Engines/entityEngines';
import { ENTITY_TYPE_CODES, RETIREMENT_ACCOUNT, entityTypeOf, makeCaseId, makeEntityId, masterEngine } from '../Engines/masterEngine';
import type { Age, Case, Entity, EntityTypeKey, JournalEntry, MasterInput } from '../TypesAndVariables/types';

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
const entity = (type: EntityTypeKey, inputs: Record<string, unknown>, caseId = ''): Entity =>
  ({ entityId: makeEntityId(type), caseId, name: type, isHidden: false, inputs });
/** A case with only an id (name and color filled in). */
const kase = (caseId: string): Case => ({ caseId, caseName: caseId, caseColor: '#000000', caseIndex: 0, isHidden: false });
/** The same entities, assigned to caseId. */
const inCase = (caseId: string, entities: Entity[]): Entity[] => entities.map((e) => ({ ...e, caseId }));
/** Run one case made of these entities. */
const runOne = (caseId: string, entities: Entity[], start: Age = startingAge) =>
  masterEngine({ startingAge: start, cases: [kase(caseId)], entities: inCase(caseId, entities) }).computedCases[0];
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
  check(/^case-[0-9a-z]{8}$/.test(makeCaseId()), 'case id matches case-xxxxxxxx');
  check(new Set(Array.from({ length: 1000 }, makeCaseId)).size === 1000, '1000 random case ids are unique');
});

// A realistic case, plus a second case to show cases stay independent
const incomeInputs = { salary: 60_000, raisePct: 2, filingStatus: 'single', retirementContributionPct: 6, endAge: age(65) };
const caseA: Case = { caseId: 'A', caseName: 'Buy a house at 30', caseColor: '#3a7', caseIndex: 0, isHidden: false, notes: { anything: true } };
const entitiesA: Entity[] = inCase('A', [
  entity('openingCash', { amount: 3_000 }),
  entity('income', incomeInputs),
  entity('existingInvestment', { currentInvested: 10_000, returnPct: 7 }),
  entity('buyingHome', { purchaseAge: age(30), totalPropertyValue: 350_000, downPaymentPct: 20, mortgageTermYears: 30, interestRatePct: 6.5 }),
  entity('investing', { account: 12, initialContribution: 1_000, returnPct: 6, contributionStartAge: age(25), monthlyContribution: 300 }),
  entity('food', { diningOutMonthly: 200, groceriesMonthly: 400 }),
]);
const caseB: Case = { caseId: 'B', caseName: 'Keep renting', caseColor: '#a37', caseIndex: 1, isHidden: false };
const entitiesB: Entity[] = inCase('B', [
  entity('openingCash', { amount: 3_000 }),
  entity('renting', { rentMonthly: 1_300 }),
]);

test('computed cases', () => {
  const out = masterEngine({ startingAge, cases: [caseA, caseB], entities: [...entitiesA, ...entitiesB] });
  check(out.startingAge === startingAge, 'startingAge passes through');
  check(out.computedCases.length === 2, 'one computed case per case');
  const [a, b] = out.computedCases;
  check(a.caseId === 'A' && b.caseId === 'B', 'order kept');
  check(a.caseName === 'Buy a house at 30' && a.caseColor === '#3a7' && a.notes === caseA.notes, 'other fields pass through');
  check(!('entities' in a), 'no entities field added');
  check(a.error === null && b.error === null, 'no errors');

  // Investment accounts: in order from 4; the input's account 12 is overwritten
  const [invExisting, invNew] = [entitiesA[2].entityId, entitiesA[4].entityId];
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

  // Entities of different cases mixed together in the array: each case still gets only its own, in order
  const mixed = [entitiesB[0], entitiesA[0], entitiesA[1], entitiesB[1], entitiesA[2], entitiesA[3], entitiesA[4], entitiesA[5]];
  const [ma, mb] = masterEngine({ startingAge, cases: [caseA, caseB], entities: mixed }).computedCases;
  check(sameHistory(ma.chartOfAccountsHistory, h) && sameHistory(mb.chartOfAccountsHistory, b.chartOfAccountsHistory!), 'mixed entity order → same histories');
  check(ma.investmentAccounts[invExisting] === 4 && ma.investmentAccounts[invNew] === 5, 'mixed entity order → same investment accounts');
  // Swapping the two investment entities swaps their accounts (entity order decides)
  const swapped = [entitiesA[0], entitiesA[1], entitiesA[4], entitiesA[3], entitiesA[2], entitiesA[5]];
  const sw = masterEngine({ startingAge, cases: [caseA], entities: swapped }).computedCases[0];
  check(sw.investmentAccounts[invNew] === 4 && sw.investmentAccounts[invExisting] === 5, 'investment accounts follow entities-array order');
  // Case order in the output follows the cases array, not the entities array
  const rev = masterEngine({ startingAge, cases: [caseB, caseA], entities: [...entitiesA, ...entitiesB] }).computedCases;
  check(rev[0].caseId === 'B' && rev[1].caseId === 'A', 'output order follows cases array');
});

test('errors fail only their own case', () => {
  const bad = entity('buyingHome', { totalPropertyValue: 300_000 }, 'bad'); // missing purchaseAge
  const tooMany = Array.from({ length: 10 }, () => entity('investing', { initialContribution: 0, returnPct: 5, contributionStartAge: age(25) }, 'many'));
  const out = masterEngine({
    startingAge,
    cases: [{ ...kase('bad'), caseName: 'x' }, caseB, kase('unknown'), kase('many'), kase('empty')],
    entities: [
      entity('openingCash', { amount: 1 }, 'bad'), bad,
      ...entitiesB,
      { entityId: '99-abcdefgh', caseId: 'unknown', name: 'x', isHidden: false, inputs: {} },
      ...tooMany,
    ],
  });
  const [badOut, okOut, unknownOut, manyOut, emptyOut] = out.computedCases;
  check(badOut.error?.entityId === bad.entityId && badOut.chartOfAccountsHistory === null, 'bad entity → case error with its entityId');
  check(badOut.caseName === 'x', 'failed case still passes fields through');
  check(okOut.error === null && okOut.chartOfAccountsHistory !== null, 'other cases still compute');
  check(unknownOut.error?.entityId === '99-abcdefgh', 'unknown type code → case error');
  check(manyOut.error?.entityId === tooMany[9].entityId && /too many/.test(manyOut.error.message), '10th investment entity → case error');
  check(emptyOut.error === null && emptyOut.chartOfAccountsHistory?.length === 0, 'no entities → empty history');
});

test('linking cases and entities: problems throw', () => {
  const run = (cases: unknown, entities: unknown) => () => { masterEngine({ startingAge, cases, entities } as unknown as MasterInput); };
  const food = entity('food', { groceriesMonthly: 100 }, 'A');
  check(throws(run([caseA], undefined)), 'missing entities array throws');
  check(throws(run(undefined, [])), 'missing cases array throws');
  check(throws(run([caseA, { ...caseA }], [])), 'duplicate caseId throws');
  check(throws(run([{ caseName: 'no id' }], [])), 'missing caseId throws');
  check(throws(run([{ caseId: '' }], [])), 'empty caseId throws');
  check(throws(run([null], [])), 'null case throws');
  check(throws(run([caseA], [food, food])), 'duplicate entityId in one case throws');
  check(throws(run([caseA, caseB], [food, { ...food, caseId: 'B' }])), 'duplicate entityId across cases throws');
  check(throws(run([caseA], [{ ...food, caseId: 'nope' }])), 'entity with unknown caseId throws');
  check(throws(run([caseA], [{ entityId: food.entityId, inputs: {} }])), 'entity with no caseId throws');
  check(throws(run([caseA], [{ caseId: 'A', inputs: {} }])), 'entity with no entityId throws');
  check(throws(run([caseA], [null])), 'null entity throws');
  let message = '';
  try { run([caseA], [{ ...food, caseId: 'nope' }])(); } catch (e) { message = (e as Error).message; }
  check(message.includes(food.entityId) && message.includes('nope'), 'unknown caseId error names the entity and caseId');
  check(!throws(run([caseA, caseB], [])), 'cases with no entities are fine');
});

test('performance', () => {
  const cases = Array.from({ length: 4 }, (_, i) => ({ ...caseA, caseId: `p${i}` }));
  const entities = cases.flatMap((c) =>
    entitiesA.map((e) => ({ ...e, entityId: makeEntityId(entityTypeOf(e.entityId)), caseId: c.caseId })));
  const t0 = Date.now();
  masterEngine({ startingAge, cases, entities });
  const ms = Date.now() - t0;
  check(ms < 500, `4 cases < 500 ms (got ${ms} ms)`);
  console.log(`  perf: ~${ms} ms for 4 cases × ${entitiesA.length} entities`);
});

test('type codes never change', () => {
  // If this fails, saved entities in users' apps would load as the wrong type. Add new types at the end only.
  const frozen = 'openingCash:01,existingHome:02,existingVehicle:03,existingCreditCard:04,existingStudentLoans:05,existingInvestment:06,otherExistingAsset:07,otherExistingLoan:08,income:09,renting:10,buyingHome:11,buyingCar:12,gas:13,kid:14,education:15,investing:16,food:17,healthInsurance:18,pet:19,personal:20,birthdayChristmas:21,oneTimeExpense:22,recurringPayment:23';
  check(Object.entries(ENTITY_TYPE_CODES).map(([t, c]) => `${t}:${c}`).join() === frozen, 'ENTITY_TYPE_CODES unchanged');
});

test('case and input validation', () => {
  const ok = [entity('openingCash', { amount: 100 })];
  const bad = runOne('ok', ok, { years: 22.5, months: 0 });
  check(bad.error !== null && /startingAge/.test(bad.error.message) && bad.chartOfAccountsHistory === null, 'bad startingAge → case error');
  const noAge = masterEngine({ startingAge: undefined as unknown as Age, cases: [kase('ok')], entities: inCase('ok', ok) }).computedCases[0];
  check(noAge.error !== null, 'missing startingAge → case error (even with no ages in the entities)');
  const noAgeEmpty = masterEngine({ startingAge: undefined as unknown as Age, cases: [kase('e')], entities: [] }).computedCases[0];
  check(noAgeEmpty.error !== null && /startingAge/.test(noAgeEmpty.error.message), 'missing startingAge → case error (even with no entities)');
  const e = entity('food', undefined as unknown as Record<string, unknown>);
  const noInputs = runOne('x', [e]);
  check(noInputs.error === null && noInputs.chartOfAccountsHistory!.length === 0, 'food with no inputs → nothing (all optional)');
  const noInputs2 = runOne('x', [entity('income', undefined as unknown as Record<string, unknown>)]);
  check(noInputs2.error?.entityId !== undefined && /salary/.test(noInputs2.error!.message), 'income with no inputs → error names salary');
  const neg = runOne('x', [entity('renting', { rentMonthly: -1 })]);
  check(neg.error !== null && /rentMonthly/.test(neg.error.message), 'negative rent → case error');
  check(masterEngine({ startingAge, cases: [], entities: [] }).computedCases.length === 0, 'no cases → no computed cases');
});

test('hidden cases and entities', () => {
  const hide = <T extends { isHidden: boolean }>(x: T): T => ({ ...x, isHidden: true });
  const all = [...entitiesA, ...entitiesB];
  const base = masterEngine({ startingAge, cases: [caseA, caseB], entities: all }).computedCases;

  // Hidden case: left out completely; the other case is untouched
  const hiddenA = masterEngine({ startingAge, cases: [hide(caseA), caseB], entities: all }).computedCases;
  check(hiddenA.length === 1 && hiddenA[0].caseId === 'B', 'hidden case has no computed case');
  check(sameHistory(hiddenA[0].chartOfAccountsHistory, base[1].chartOfAccountsHistory!), 'hiding a case does not change the other case');
  check(masterEngine({ startingAge, cases: [hide(caseA), hide(caseB)], entities: all }).computedCases.length === 0, 'all cases hidden → no computed cases');
  // A hidden case's entities are never run, so a bad one can't cause an error
  const badInHidden = masterEngine({
    startingAge, cases: [hide(kase('h')), caseB],
    entities: [entity('renting', { rentMonthly: -1 }, 'h'), ...entitiesB],
  }).computedCases;
  check(badInHidden.length === 1 && badInHidden[0].error === null, 'bad entity in a hidden case is ignored');

  // Hidden entity: same result as the case without that entity
  entitiesA.forEach((e, i) => {
    const hidden = masterEngine({ startingAge, cases: [caseA], entities: entitiesA.map((x) => (x === e ? hide(x) : x)) }).computedCases[0];
    const removed = masterEngine({ startingAge, cases: [caseA], entities: entitiesA.filter((x) => x !== e) }).computedCases[0];
    check(hidden.error === null && sameHistory(hidden.chartOfAccountsHistory, removed.chartOfAccountsHistory!), `hidden entity ${i} = entity removed (history)`);
    check(JSON.stringify(hidden.investmentAccounts) === JSON.stringify(removed.investmentAccounts), `hidden entity ${i} = entity removed (investment accounts)`);
    check(!sameHistory(hidden.chartOfAccountsHistory, base[0].chartOfAccountsHistory!), `hiding entity ${i} changes the history`);
  });
  // Hiding the first investment entity frees account 4 for the next one
  const [invExisting, invNew] = [entitiesA[2].entityId, entitiesA[4].entityId];
  const freed = masterEngine({ startingAge, cases: [caseA], entities: entitiesA.map((x, i) => (i === 2 ? hide(x) : x)) }).computedCases[0];
  check(freed.investmentAccounts[invNew] === 4 && !(invExisting in freed.investmentAccounts), 'hidden investment entity takes no account');
  // 10 investment entities is too many, unless one is hidden
  const ten = Array.from({ length: 10 }, () => entity('investing', { initialContribution: 0, returnPct: 5, contributionStartAge: age(25) }));
  check(runOne('ten', ten).error !== null, '10 shown investment entities → error');
  check(runOne('ten', ten.map((x, i) => (i === 0 ? hide(x) : x))).error === null, '10 investment entities with 1 hidden is fine');
  // A hidden entity's inputs are never checked
  const withBadHidden = runOne('x', [entity('openingCash', { amount: 500 }), hide(entity('renting', { rentMonthly: -1 }))]);
  check(withBadHidden.error === null && balanceAt(withBadHidden.chartOfAccountsHistory!, 0, ACCT.CASH) === 500, 'hidden entity with bad inputs is skipped');
  // Every entity hidden: same as a case with no entities
  const allHidden = runOne('x', entitiesB.map(hide));
  check(allHidden.error === null && sameHistory(allHidden.chartOfAccountsHistory, runOne('x', []).chartOfAccountsHistory!), 'all entities hidden = empty case');

  // Hidden things are still linked and checked
  check(throws(() => masterEngine({ startingAge, cases: [caseB], entities: [hide(entity('food', {}, 'nope'))] })), 'hidden entity with unknown caseId still throws');
  check(throws(() => masterEngine({ startingAge, cases: [hide(caseB), caseB], entities: [] })), 'duplicate caseId still throws when one is hidden');
  const noFlagCase = { caseId: 'n', caseName: 'n', caseColor: '#000000', caseIndex: 0 } as unknown as Case;
  check(throws(() => masterEngine({ startingAge, cases: [noFlagCase], entities: [] })), 'case without isHidden throws');
  const noFlagEntity = { entityId: makeEntityId('food'), caseId: 'B', name: 'x', inputs: {} } as unknown as Entity;
  check(throws(() => masterEngine({ startingAge, cases: [caseB], entities: [noFlagEntity] })), 'entity without isHidden throws');
});

test('investment accounts: 9 fit, mixed types, 401k shared', () => {
  const nine: Entity[] = Array.from({ length: 9 }, (_, i) =>
    i % 2 ? entity('existingInvestment', { currentInvested: 1_000 * (i + 1), returnPct: 0 }) : entity('investing', { initialContribution: 1_000 * (i + 1), returnPct: 0, contributionStartAge: startingAge }));
  const out = runOne('nine', nine);
  check(out.error === null, '9 investment entities is fine');
  check(nine.map((n) => out.investmentAccounts[n.entityId]).join() === '4,5,6,7,8,9,10,11,12', 'accounts 4–12 in order across both types');
  check(nine.every((n, i) => balanceAt(out.chartOfAccountsHistory!, 0, 4 + i) === 1_000 * (i + 1)), 'each balance lands in its own account');
  const inc = (salary: number) => entity('income', { salary, raisePct: 0, filingStatus: 'single', retirementContributionPct: 10, retirementReturnPct: 5, endAge: { years: 30, months: 0 } });
  const [a, b] = [inc(50_000), inc(80_000)];
  const both = runOne('two', [a, b]).chartOfAccountsHistory!;
  const onlyA = runOne('a', [a]).chartOfAccountsHistory!;
  const onlyB = runOne('b', [b]).chartOfAccountsHistory!;
  const last = both.length / ACCOUNT_COUNT - 1;
  check(balanceAt(both, last, RETIREMENT_ACCOUNT) === balanceAt(onlyA, last, 3) + balanceAt(onlyB, last, 3) && balanceAt(both, last, 3) > 0, 'two incomes share account 3; balances add up');
  const extra = runOne('x', [{ ...entity('food', { groceriesMonthly: 100, diningOutMonthly: 0 }), name: 'Groceries', icon: '🛒' } as Entity]);
  check(extra.error === null, 'extra UI fields on an entity are ignored');
});

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed) {
  for (const f of fails.slice(0, 40)) console.log('  ✗ ' + f);
  throw new Error(`${failed} checks failed`);
}
