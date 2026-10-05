// masterEngine.ts
// ─────────────────────────────────────────────────────────────────────────────
// Turns cases into computed cases:
//   for each case: its entities → their entity engines → all journal entries → COAHE
//
//   masterEngine({ startingAge, cases, entities }) → { startingAge, computedCases }
//
// Cases and entities are two separate arrays. Each entity belongs to exactly one
// case through entity.caseId. A case's entities are the ones with its caseId, in
// the order they appear in the entities array.
//
// A computed case is its input case plus chartOfAccountsHistory, investmentAccounts
// and error. Every case field (caseId, caseName, caseColor, …) passes through
// untouched. Cases come out in the same order they went in.
//
// HIDDEN (isHidden):
//   • A hidden case is left out completely: it is not computed and has no computed case.
//   • A hidden entity is skipped as if it didn't exist: its engine doesn't run (so its
//     inputs aren't checked) and it takes no investment account.
//   Hidden cases and entities are still linked and checked like any other (IDs, caseId).
//
// ENTITY IDS: "TT-xxxxxxxx"
//   TT       = 2-digit entity type code (ENTITY_TYPE_CODES), picks the engine
//   xxxxxxxx = 8 random base-36 characters
//   Type codes are permanent: never renumber them, only add new ones at the end.
//
// INVESTMENT ACCOUNTS (3–12, 10 per case), assigned here:
//   • 3 = retirement. Every income entity's pre-tax 401k deposits go here.
//   • 4–12 = investing / existingInvestment entities, in entity order (max 9).
//   Any account number already in an entity's inputs is overwritten.
//
// ERRORS:
//   • Problems linking cases and entities throw (whole call fails): cases or
//     entities not an array, a missing / duplicate caseId, a missing / duplicate
//     entityId, an entity whose caseId matches no case, an isHidden that isn't
//     true / false.
//   • Anything else only fails its own case. That case gets
//     chartOfAccountsHistory = null and error = { entityId, message }.
// ─────────────────────────────────────────────────────────────────────────────

import { coahe } from './coahe';
import { ENGINES, INVESTMENT_ACCOUNT_MAX, checkAge } from './entityEngines';
import type {
  Age, Case, CaseError, ComputedCase, EngineCtx, Entity, EntityTypeKey, JournalEntry, MasterInput, MasterOutput,
} from '../TypesAndVariables/types';

// ═════════════════════════════════════════════════════════════════════════════
// Entity IDs
// ═════════════════════════════════════════════════════════════════════════════
export const ENTITY_TYPE_CODES: Record<EntityTypeKey, string> = {
  openingCash: '01',
  existingHome: '02',
  existingVehicle: '03',
  existingCreditCard: '04',
  existingStudentLoans: '05',
  existingInvestment: '06',
  otherExistingAsset: '07',
  otherExistingLoan: '08',
  income: '09',
  renting: '10',
  buyingHome: '11',
  buyingCar: '12',
  gas: '13',
  kid: '14',
  education: '15',
  investing: '16',
  food: '17',
  healthInsurance: '18',
  pet: '19',
  personal: '20',
  birthdayChristmas: '21',
  oneTimeExpense: '22',
  recurringPayment: '23',
};
const TYPE_BY_CODE = new Map<string, EntityTypeKey>(
  Object.entries(ENTITY_TYPE_CODES).map(([type, code]) => [code, type as EntityTypeKey]),
);
const ENTITY_ID_PATTERN = /^(\d{2})-[0-9a-z]{8}$/;

/** New random ID for an entity of this type, e.g. makeEntityId('income') → "09-7mz2p1bd". */
export function makeEntityId(type: EntityTypeKey): string {
  const code = ENTITY_TYPE_CODES[type];
  if (!code) throw new Error(`[masterEngine] unknown entity type "${type}"`);
  let rand = '';
  for (let i = 0; i < 8; i++) rand += Math.floor(Math.random() * 36).toString(36);
  return `${code}-${rand}`;
}

/** New random case ID, e.g. "case-4k9x0qzt". */
export function makeCaseId(): string {
  let rand = '';
  for (let i = 0; i < 8; i++) rand += Math.floor(Math.random() * 36).toString(36);
  return `case-${rand}`;
}

/** Entity type from its ID. Throws on a malformed ID or unknown type code. */
export function entityTypeOf(entityId: string): EntityTypeKey {
  const match = ENTITY_ID_PATTERN.exec(entityId);
  if (!match) throw new Error(`[masterEngine] malformed entityId "${entityId}" (expected "TT-xxxxxxxx")`);
  const type = TYPE_BY_CODE.get(match[1]);
  if (!type) throw new Error(`[masterEngine] unknown entity type code "${match[1]}" in "${entityId}"`);
  return type;
}

// ═════════════════════════════════════════════════════════════════════════════
// Accounts
// ═════════════════════════════════════════════════════════════════════════════
export const RETIREMENT_ACCOUNT = 3;
export const FIRST_INVESTMENT_ACCOUNT = 4;
const INVESTMENT_TYPES = new Set<EntityTypeKey>(['investing', 'existingInvestment']);

class CaseFailure extends Error {
  constructor(public entityId: string | null, message: string) {
    super(message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Linking cases and entities
// ═════════════════════════════════════════════════════════════════════════════
/** caseId → that case's entities, in entities-array order. Throws on any linking problem. */
function groupEntitiesByCase(cases: Case[], entities: Entity[]): Map<string, Entity[]> {
  if (!Array.isArray(cases)) throw new Error('[masterEngine] "cases" must be an array');
  if (!Array.isArray(entities)) throw new Error('[masterEngine] "entities" must be an array');

  const byCase = new Map<string, Entity[]>();
  cases.forEach((c, i) => {
    const caseId: unknown = c?.caseId;
    if (typeof caseId !== 'string' || caseId === '') throw new Error(`[masterEngine] case ${i} needs a non-empty string "caseId"`);
    if (byCase.has(caseId)) throw new Error(`[masterEngine] duplicate caseId "${caseId}"`);
    if (typeof c.isHidden !== 'boolean') throw new Error(`[masterEngine] case "${caseId}" needs "isHidden" to be true or false`);
    byCase.set(caseId, []);
  });

  const seenEntityIds = new Set<string>();
  entities.forEach((entity, i) => {
    const entityId: unknown = entity?.entityId;
    const caseId: unknown = entity?.caseId;
    if (typeof entityId !== 'string' || entityId === '') throw new Error(`[masterEngine] entity ${i} needs a non-empty string "entityId"`);
    if (seenEntityIds.has(entityId)) throw new Error(`[masterEngine] duplicate entityId "${entityId}"`);
    seenEntityIds.add(entityId);
    if (typeof entity.isHidden !== 'boolean') throw new Error(`[masterEngine] entity "${entityId}" needs "isHidden" to be true or false`);
    const caseEntities = typeof caseId === 'string' ? byCase.get(caseId) : undefined;
    if (!caseEntities) throw new Error(`[masterEngine] entity "${entityId}" has caseId "${String(caseId)}", which matches no case`);
    caseEntities.push(entity);
  });
  return byCase;
}

// ═════════════════════════════════════════════════════════════════════════════
// Engine
// ═════════════════════════════════════════════════════════════════════════════
function computeCase<C extends Case>(c: C, entities: Entity[], startingAge: Age): ComputedCase<C> {
  const investmentAccounts: Record<string, number> = {};
  try {
    checkAge(startingAge, 'startingAge');
    const ctx: EngineCtx = { caseId: c.caseId, startAge: startingAge };
    let nextAccount = FIRST_INVESTMENT_ACCOUNT;
    const entries: JournalEntry[] = [];

    for (const entity of entities) {
      if (entity.isHidden) continue; // hidden: as if it didn't exist
      const id = entity.entityId;
      try {
        const type = entityTypeOf(id);
        const inputs: Record<string, unknown> = { ...entity.inputs };
        if (INVESTMENT_TYPES.has(type)) {
          if (nextAccount > INVESTMENT_ACCOUNT_MAX)
            throw new Error(`too many investment entities (max ${INVESTMENT_ACCOUNT_MAX - FIRST_INVESTMENT_ACCOUNT + 1} per case)`);
          inputs.account = nextAccount;
          investmentAccounts[id] = nextAccount++;
        }
        if (type === 'income') inputs.retirementAccount = RETIREMENT_ACCOUNT;
        const engine = ENGINES[type] as (input: unknown, ctx: EngineCtx) => JournalEntry[];
        for (const je of engine(inputs, ctx)) entries.push(je);
      } catch (e) {
        throw new CaseFailure(id, (e as Error).message);
      }
    }

    return { ...c, chartOfAccountsHistory: coahe(entries), investmentAccounts, error: null };
  } catch (e) {
    const error: CaseError = e instanceof CaseFailure
      ? { entityId: e.entityId, message: e.message }
      : { entityId: null, message: (e as Error).message };
    return { ...c, chartOfAccountsHistory: null, investmentAccounts, error };
  }
}

export function masterEngine<C extends Case>(input: MasterInput<C>): MasterOutput<C> {
  const { startingAge, cases, entities } = input;
  const byCase = groupEntitiesByCase(cases, entities);
  const shownCases = cases.filter((c) => !c.isHidden); // hidden cases are left out completely
  return { startingAge, computedCases: shownCases.map((c) => computeCase(c, byCase.get(c.caseId) ?? [], startingAge)) };
}
