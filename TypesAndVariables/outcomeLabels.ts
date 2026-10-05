// outcomeLabels.ts
// Display name for each outcome (outcomes menu, outcomes screen), in menu order.
// What each one adds up is in Engines/outcomes.ts.
import type { OutcomeKey } from './types';

export const OUTCOME_LABELS: Record<OutcomeKey, string> = {
  netWorth: 'Net Worth',
  expensesPerMonth: 'Expenses per Month',
  liquidCash: 'Liquid Cash',
  liquidCashPlusInvestments: 'Liquid Cash + Investments',
  incomePerMonth: 'Income per Month',
  incomePlusGainsPerMonth: 'Income + Gains per Month',
  incomePlusAllGainsPerMonth: 'Income + All Gains per Month',
};

/** Every outcome, in menu order. */
export const OUTCOME_KEYS = Object.keys(OUTCOME_LABELS) as OutcomeKey[];
