// exampleCases.ts
// The two cases every new account starts with, so there is something to look at and work with straight away
// (and so the onboarding walkthrough has cases, entities and chart lines to show).
// They are ordinary cases and entities: the user can edit, hide or delete them like any other.
//
// The two tell one simple story: the same pay and the same spending, renting the whole time or buying a home at 28.
// Start ages are left blank ("now") wherever they can be, so the examples work whatever starting age the user sets.
// Every number here is a starting point picked by the AI; change them freely.
import { makeCaseId, makeEntityId } from '../Engines/masterEngine';
import type { Case, Entity, EntityInputs, EntityTypeKey } from './types';

/** What an edit card saves for entity type K: its engine's inputs, minus the fields masterEngine fills in. */
type SavedInputs<K extends EntityTypeKey> = Omit<EntityInputs[K], 'account' | 'retirementAccount'>;

function entity<K extends EntityTypeKey>(caseId: string, type: K, name: string, inputs: SavedInputs<K>): Entity {
  return { entityId: makeEntityId(type), caseId, name, isHidden: false, inputs: { ...inputs } };
}

/** The entities both examples share: some cash, a salary until 65, and food. */
function sharedEntities(caseId: string): Entity[] {
  return [
    entity(caseId, 'openingCash', 'Existing Cash', { amount: 2_000 }),
    entity(caseId, 'income', 'Income', {
      salary: 55_000,
      raisePct: 1,
      filingStatus: 'single',
      startAge: null,
      endAge: { years: 65, months: 0 },
      charityPct: null,
      retirementContributionPct: 5,
      retirementReturnPct: null,
      incomeTaxRatePct: null,
    }),
    entity(caseId, 'food', 'Food', { groceriesMonthly: 350, diningOutMonthly: 200, startAge: null, endAge: null }),
  ];
}

/** New copies of the example cases and their entities, with fresh ids. */
export function exampleCases(): { cases: Case[]; entities: Entity[] } {
  const renting: Case = { caseId: makeCaseId(), caseName: 'Example life case 1', caseColor: '#4FA8DD', caseIndex: 0, isHidden: false }; // Sky
  const buying: Case = { caseId: makeCaseId(), caseName: 'Example life case 2', caseColor: '#E8735A', caseIndex: 1, isHidden: false }; // Coral
  const buyAge = { years: 28, months: 0 };

  return {
    cases: [renting, buying],
    entities: [
      // 1: rent the whole time.
      ...sharedEntities(renting.caseId),
      entity(renting.caseId, 'renting', 'Renting', {
        rentMonthly: 1_100, utilitiesMonthly: 427, junkFeesMonthly: null, startAge: null, endAge: null,
      }),
      // 2: rent until 28, then buy a home.
      ...sharedEntities(buying.caseId),
      entity(buying.caseId, 'renting', 'Renting', {
        rentMonthly: 1_100, utilitiesMonthly: 427, junkFeesMonthly: null, startAge: null, endAge: buyAge,
      }),
      entity(buying.caseId, 'buyingHome', 'Buying a Home', {
        purchaseAge: buyAge,
        totalPropertyValue: 250_000,
        downPaymentPct: 10,
        mortgageTermYears: 30,
        interestRatePct: 6.5,
        utilitiesMonthly: null, // the average
        sellAge: null,
      }),
    ],
  };
}
