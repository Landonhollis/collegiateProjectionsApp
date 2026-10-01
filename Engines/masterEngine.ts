// masterEngine.ts
// ─────────────────────────────────────────────────────────────────────────────
// Turns cases into computed cases:
//   for each case: every entity → its entity engine → all journal entries → COAHE
//
//   masterEngine({ startingAge, cases }) → { startingAge, computedCases }
//
// A computed case is its input case with `entities` replaced by
// `chartOfAccountsHistory`. Every other field (caseId, caseName, caseColor, …)
// passes through untouched. Cases come out in the same order they went in.
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
// ERRORS: a failure only fails its own case. That case gets
//   chartOfAccountsHistory = null and error = { entityId, message }.
// ─────────────────────────────────────────────────────────────────────────────

import { coahe } from './coahe';
import { ENGINES, INVESTMENT_ACCOUNT_MAX, checkAge } from './entityEngines';
import type {
  Age, Case, CaseError, ComputedCase, EngineCtx, EntityTypeKey, JournalEntry, MasterInput, MasterOutput,
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
// Engine
// ═════════════════════════════════════════════════════════════════════════════
function computeCase<C extends Case>(c: C, startingAge: Age): ComputedCase<C> {
  const { entities, ...passThrough } = c;
  const investmentAccounts: Record<string, number> = {};
  try {
    if (typeof c.caseId !== 'string' || c.caseId === '') throw new CaseFailure(null, 'case needs a non-empty string "caseId"');
    if (!Array.isArray(entities)) throw new CaseFailure(null, 'case has no "entities" array');
    checkAge(startingAge, 'startingAge');
    const ctx: EngineCtx = { caseId: c.caseId, startAge: startingAge };
    const seen = new Set<string>();
    let nextAccount = FIRST_INVESTMENT_ACCOUNT;
    const entries: JournalEntry[] = [];

    for (const entity of entities) {
      const id = entity?.entityId;
      try {
        if (seen.has(id)) throw new Error(`duplicate entityId "${id}"`);
        seen.add(id);
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
        if (e instanceof CaseFailure) throw e;
        throw new CaseFailure(id ?? null, (e as Error).message);
      }
    }

    return { ...passThrough, chartOfAccountsHistory: coahe(entries), investmentAccounts, error: null };
  } catch (e) {
    const error: CaseError = e instanceof CaseFailure
      ? { entityId: e.entityId, message: e.message }
      : { entityId: null, message: (e as Error).message };
    return { ...passThrough, chartOfAccountsHistory: null, investmentAccounts, error };
  }
}

export function masterEngine<C extends Case>(input: MasterInput<C>): MasterOutput<C> {
  const { startingAge, cases } = input;
  return { startingAge, computedCases: cases.map((c) => computeCase(c, startingAge)) };
}
