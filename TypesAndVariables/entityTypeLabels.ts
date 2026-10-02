// entityTypeLabels.ts
// Display name for each entity type (entity cards, entity type menu).
// Same order as ENTITY_TYPE_CODES in masterEngine.ts.
import type { EntityTypeKey } from './types';

export const ENTITY_TYPE_LABELS: Record<EntityTypeKey, string> = {
  openingCash: 'Opening Cash',
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

/** Every entity type, in menu order. */
export const ENTITY_TYPES = Object.keys(ENTITY_TYPE_LABELS) as EntityTypeKey[];
