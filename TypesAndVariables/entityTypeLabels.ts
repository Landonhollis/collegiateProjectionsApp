// entityTypeLabels.ts
// Display name for each entity type (entity cards, entity type menu).
// Same order as ENTITY_TYPE_CODES in masterEngine.ts.
import type { EntityTypeKey, HealthInsuranceType } from './types';

export const ENTITY_TYPE_LABELS: Record<EntityTypeKey, string> = {
  openingCash: 'Existing Cash',
  existingHome: 'Existing Home',
  existingVehicle: 'Existing Vehicle',
  existingCreditCard: 'Existing Credit Card',
  existingStudentLoans: 'Existing Student Loans',
  existingInvestment: 'Existing Investment',
  otherExistingAsset: 'Other Existing Asset',
  otherExistingLoan: 'Other Existing Loan',
  income: 'Income',
  renting: 'Renting',
  buyingHome: 'Buying a Home',
  buyingCar: 'Buying a Car',
  gas: 'Gas',
  kid: 'Kid',
  education: 'Education',
  investing: 'Investing',
  food: 'Food',
  healthInsurance: 'Health Insurance',
  pet: 'Pet',
  personal: 'Personal',
  birthdayChristmas: 'Birthdays & Christmas',
  oneTimeExpense: 'One-Time Expense',
  recurringPayment: 'Recurring Payment',
};

/** Display name for each health insurance plan, in the order the plan dropdown lists them. */
export const HEALTH_PLAN_LABELS: Record<HealthInsuranceType, string> = {
  employerIndividual: 'Employer, just me',
  employerFamily: 'Employer, family',
  marketplaceIndividual: 'Marketplace, just me',
  marketplaceFamily: 'Marketplace, family',
  medicare: 'Medicare',
  none: 'None',
};

/** Every entity type, in menu order. */
export const ENTITY_TYPES = Object.keys(ENTITY_TYPE_LABELS) as EntityTypeKey[];

// ── Entity groups (UI only) ──────────────────────────────────────────────────
// One group = one row in the entity types menu = one entities screen.
// Most groups hold one entity type. Housing holds two (renting and buyingHome): they stay separate
// entity types everywhere else (IDs, engines, edit cards); only the screen is shared.
// The add button of a group with more than one option asks which one to add.
export type EntityGroup = {
  key: string;
  label: string; // menu row and screen name, e.g. "Housing"
  options: { type: EntityTypeKey; label: string }[]; // label = the choice in the add menu, e.g. "Buying"
};

const HOUSING: EntityGroup = {
  key: 'housing',
  label: 'Housing',
  options: [
    { type: 'renting', label: 'Renting' },
    { type: 'buyingHome', label: 'Buying' },
  ],
};

/** Every group, in menu order: the entity types in order, with Housing where renting was. */
export const ENTITY_GROUPS: EntityGroup[] = ENTITY_TYPES.filter((type) => type !== 'buyingHome').map((type) =>
  type === 'renting' ? HOUSING : { key: type, label: ENTITY_TYPE_LABELS[type], options: [{ type, label: ENTITY_TYPE_LABELS[type] }] },
);

/** The group this entity type is shown in. */
export function entityGroupOf(type: EntityTypeKey): EntityGroup {
  const group = ENTITY_GROUPS.find((g) => g.options.some((o) => o.type === type));
  if (!group) throw new Error(`No entity group holds entity type "${type}"`);
  return group;
}

/** The group with this key. Throws on an unknown key. */
export function entityGroupByKey(key: string): EntityGroup {
  const group = ENTITY_GROUPS.find((g) => g.key === key);
  if (!group) throw new Error(`No entity group with key "${key}"`);
  return group;
}
