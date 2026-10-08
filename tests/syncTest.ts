// syncTest.ts — run with:  npx tsx tests/syncTest.ts
// The saved-data object and the rules for keeping the phone's copy and the server's copy in step
// (Sync/projectionsData.ts). No test framework needed. Exits non-zero on any failure.
import {
  APP_NAME, DEFAULT_STARTING_AGE, SCHEMA_VERSION, checkProjectionsData, checkServerRow, newProjectionsData,
  nextEditedAt, nextSyncStep, parseLocalSlot, readLegacyData, slotKey,
} from '../Sync/projectionsData';
import { entityTypeOf, masterEngine } from '../Engines/masterEngine';
import * as F from '../components/(editEntityCards)/entityForms';
import { entitySummary } from '../components/entitySummary';
import type { EntityTypeKey, LocalSlot, ProjectionsData, ServerRow } from '../TypesAndVariables/types';

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

/** True when these saved inputs read into the form's boxes and come back out as inputs: the edit card opens ready to save. */
const opensReady = <Text, Inputs>(form: F.EntityForm<Text, Inputs>) => (saved: Record<string, unknown>): boolean =>
  form.toInputs(form.read(saved)) !== null;
/** For the entity types the example cases use. */
const OPENS_READY: Partial<Record<EntityTypeKey, (saved: Record<string, unknown>) => boolean>> = {
  openingCash: opensReady(F.openingCashForm), income: opensReady(F.incomeForm), food: opensReady(F.foodForm),
  renting: opensReady(F.rentingForm), buyingHome: opensReady(F.buyingHomeForm),
};

// ── samples ──────────────────────────────────────────────────────────────────
const CASE = { caseId: 'case-aaaaaaaa', caseName: 'Rent', caseColor: '#4FA8DD', caseIndex: 0, isHidden: false };
const ENTITY = { entityId: '01-aaaaaaaa', caseId: CASE.caseId, name: 'Cash', isHidden: false, inputs: { amount: 5000 } };
const data = (editedAt: number, extra: Partial<ProjectionsData> = {}): ProjectionsData => ({
  ...newProjectionsData(editedAt), cases: [CASE], entities: [ENTITY], recentCaseIds: [CASE.caseId], ...extra,
});
const slot = (uploadWaiting: boolean, syncedVersion: number | null, editedAt = 1000): LocalSlot => ({
  data: data(editedAt), uploadWaiting, syncedVersion,
});
const row = (version: number, editedAt = 1000): ServerRow => ({ data: data(editedAt), version });
/** Through JSON, the way it comes back from the phone or the server. */
const saved = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

test('a new user', () => {
  const fresh = newProjectionsData(123);
  check(fresh.schemaVersion === SCHEMA_VERSION && fresh.editedAt === 123 && fresh.onboarded === false, 'not onboarded, stamped');
  check(fresh.startingAge === DEFAULT_STARTING_AGE && fresh.recentCaseIds.length === 0, 'default age, no recent cases');
  check(JSON.stringify(checkProjectionsData(saved(fresh))) === JSON.stringify(fresh), 'reads back the same');
});

test('the example cases a new user starts with', () => {
  const { cases, entities } = newProjectionsData(1);
  check(cases.map((c) => c.caseName).join() === 'Example life case 1,Example life case 2', 'two cases, named');
  check(cases[0].caseIndex === 0 && cases[1].caseIndex === 1 && cases[0].caseColor !== cases[1].caseColor, 'in order, different colors');
  check(cases.every((c) => entities.some((e) => e.caseId === c.caseId)), 'each has entities');
  check(entities.every((e) => cases.some((c) => c.caseId === e.caseId)), 'every entity belongs to one of them');
  for (const age of [{ years: 18, months: 0 }, DEFAULT_STARTING_AGE, { years: 35, months: 6 }, { years: 70, months: 0 }]) {
    const { computedCases } = masterEngine({ startingAge: age, cases, entities });
    check(computedCases.length === 2 && computedCases.every((c) => c.error === null), `they run in the engine from age ${age.years}`);
  }
  for (const e of entities) {
    const type = entityTypeOf(e.entityId);
    const ready = OPENS_READY[type];
    if (!ready) { check(false, `no form listed in this test for ${type}`); continue; }
    check(ready(e.inputs), `${e.name}: its edit card opens ready to save`);
    check(entitySummary(type, e.inputs).length > 0, `${e.name}: its card has facts to show`);
  }
  const again = newProjectionsData(1);
  check(again.cases[0].caseId !== cases[0].caseId && again.entities[0].entityId !== entities[0].entityId, 'fresh ids each time');
});

test('slot key', () => {
  check(slotKey('abc') === `${APP_NAME}:abc` && slotKey('abc') !== slotKey('abd'), 'one key per user');
  check(throws(() => slotKey('')), 'empty user id throws');
});

test('saved data round trip', () => {
  const d = data(5000, { onboarded: true, startingAge: { years: 22, months: 4 } });
  const back = checkProjectionsData(saved(d));
  check(JSON.stringify(back) === JSON.stringify(d), 'data reads back the same');
  const { computedCases } = masterEngine(back);
  check(computedCases.length === 1 && computedCases[0].error === null, 'what it reads back runs in the engine');
  const s: LocalSlot = { data: d, uploadWaiting: true, syncedVersion: 7 };
  check(JSON.stringify(parseLocalSlot(JSON.stringify(s))) === JSON.stringify(s), 'slot reads back the same');
  const never: LocalSlot = { data: d, uploadWaiting: true, syncedVersion: null };
  check(parseLocalSlot(JSON.stringify(never)).syncedVersion === null, 'slot that has never been on the server');
  check(checkServerRow(saved({ data: d, version: 3 })).version === 3, 'server row reads back');
  const extra = checkProjectionsData(saved({ ...d, cases: [{ ...CASE, note: 'kept' }] }));
  check(extra.cases[0].note === 'kept', 'extra case fields pass through');
});

test('malformed saved data throws', () => {
  const d = data(5000);
  const bad: [string, unknown][] = [
    ['not an object', 'text'],
    ['an array', []],
    ['null', null],
    ['a newer schema version', { ...d, schemaVersion: SCHEMA_VERSION + 1 }],
    ['no schema version', { ...d, schemaVersion: undefined }],
    ['editedAt not a number', { ...d, editedAt: 'now' }],
    ['onboarded not a boolean', { ...d, onboarded: 'yes' }],
    ['no onboarded', { ...d, onboarded: undefined }],
    ['months 12', { ...d, startingAge: { years: 20, months: 12 } }],
    ['half years', { ...d, startingAge: { years: 20.5, months: 0 } }],
    ['cases not an array', { ...d, cases: {} }],
    ['a case with no name', { ...d, cases: [{ ...CASE, caseName: undefined }] }],
    ['a case with a text isHidden', { ...d, cases: [{ ...CASE, isHidden: 'false' }] }],
    ['entities not an array', { ...d, entities: null }],
    ['an entity with no inputs', { ...d, entities: [{ ...ENTITY, inputs: undefined }] }],
    ['an entity with array inputs', { ...d, entities: [{ ...ENTITY, inputs: [] }] }],
  ];
  for (const [name, value] of bad) check(throws(() => checkProjectionsData(saved(value))), name);
  check(throws(() => parseLocalSlot('not json')), 'slot: not JSON');
  check(throws(() => parseLocalSlot(JSON.stringify({ data: d, syncedVersion: 1 }))), 'slot: no uploadWaiting');
  check(throws(() => parseLocalSlot(JSON.stringify({ data: d, uploadWaiting: false, syncedVersion: '1' }))), 'slot: text version');
  check(throws(() => parseLocalSlot(JSON.stringify({ data: d, uploadWaiting: false }))), 'slot: no syncedVersion');
  check(throws(() => checkServerRow({ data: d })), 'server row: no version');
  check(throws(() => checkServerRow({ data: { ...d, onboarded: 1 }, version: 1 })), 'server row: bad data');
});

test('recent cases are read leniently', () => {
  const d = data(5000);
  const read = (recentCaseIds: unknown) => checkProjectionsData(saved({ ...d, recentCaseIds })).recentCaseIds;
  check(read('nope').length === 0 && read(undefined).length === 0, 'not a list → empty');
  check(read([CASE.caseId, 'case-gone0000', 7, CASE.caseId]).join() === CASE.caseId, 'gone cases, non-text and repeats dropped');
});

test('sync rules', () => {
  // Nothing waiting on the phone.
  check(nextSyncStep(slot(false, 4), row(4)) === 'done', 'nothing waiting, server unchanged → done');
  check(nextSyncStep(slot(false, 4), row(5)) === 'takeServer', 'nothing waiting, server moved → take the server');
  check(nextSyncStep(slot(false, 4, 9000), row(5, 1000)) === 'takeServer', 'nothing waiting: the server wins even when its edit is older');
  // Changes waiting on the phone.
  check(nextSyncStep(slot(true, 4), row(4)) === 'upload', 'waiting, server unchanged → upload');
  check(nextSyncStep(slot(true, 4, 1000), row(4, 9000)) === 'upload', 'waiting, server unchanged: upload whatever the times say');
  // Both changed: the most recent edit wins.
  check(nextSyncStep(slot(true, 4, 9000), row(5, 1000)) === 'upload', 'conflict, phone edited last → upload');
  check(nextSyncStep(slot(true, 4, 1000), row(5, 9000)) === 'takeServer', 'conflict, server edited last → take the server');
  check(nextSyncStep(slot(true, 4, 5000), row(5, 5000)) === 'upload', 'conflict, a tie → the phone');
  // The phone has never matched the server (syncedVersion null), but a row exists.
  check(nextSyncStep(slot(true, null, 9000), row(1, 1000)) === 'upload', 'never synced, phone newer → upload');
  check(nextSyncStep(slot(true, null, 1000), row(1, 9000)) === 'takeServer', 'never synced, server newer → take the server');
});

test('edit times always move forward', () => {
  check(nextEditedAt(2000, 1000) === 2000, 'the clock, normally');
  check(nextEditedAt(1000, 5000) === 5001, 'a clock that is behind still counts as later');
  check(nextEditedAt(5000, 5000) === 5001, 'the same millisecond');
});

test('data from before accounts', () => {
  const none = { cases: null, entities: null, startingAge: null, recentCaseIds: null };
  check(readLegacyData(none, 1) === null, 'nothing saved → null');
  check(readLegacyData({ ...none, recentCaseIds: '["x"]' }, 1) === null, 'only a recent list → null');
  const legacy = readLegacyData({
    cases: JSON.stringify([CASE]), entities: JSON.stringify([ENTITY]),
    startingAge: JSON.stringify({ years: 19, months: 6 }), recentCaseIds: JSON.stringify([CASE.caseId, 'case-gone0000']),
  }, 777);
  check(legacy !== null && legacy.cases.length === 1 && legacy.entities.length === 1, 'cases and entities come across');
  check(legacy !== null && legacy.startingAge.years === 19 && legacy.startingAge.months === 6, 'starting age comes across');
  check(legacy !== null && legacy.recentCaseIds.join() === CASE.caseId, 'recent cases, less the ones that are gone');
  check(legacy !== null && legacy.onboarded === false && legacy.editedAt === 777 && legacy.schemaVersion === SCHEMA_VERSION, 'not onboarded, stamped');
  check(legacy !== null && JSON.stringify(checkProjectionsData(saved(legacy))) === JSON.stringify(legacy), 'it is valid saved data');
  const onlyCases = readLegacyData({ ...none, cases: JSON.stringify([CASE]) }, 1);
  check(onlyCases !== null && onlyCases.entities.length === 0 && onlyCases.startingAge === DEFAULT_STARTING_AGE, 'missing keys get defaults');
  check(readLegacyData({ ...none, cases: JSON.stringify([CASE]), recentCaseIds: 'not json' }, 1)?.recentCaseIds.length === 0, 'bad recent list is dropped');
  check(throws(() => readLegacyData({ ...none, cases: '{}' }, 1)), 'malformed cases throw');
  check(throws(() => readLegacyData({ ...none, entities: JSON.stringify([{ entityId: 1 }]) }, 1)), 'malformed entities throw');
});

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed) {
  for (const f of fails.slice(0, 40)) console.log('  ✗ ' + f);
  throw new Error(`${failed} checks failed`);
}
