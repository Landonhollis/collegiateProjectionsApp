// outcomes.ts
// ─────────────────────────────────────────────────────────────────────────────
// Turns ONE case's chart of accounts history into the numbers the outcomes screen shows.
//
//   outcomeSeries(history, key, months?) → Float64Array, series[month] = that outcome in that month
//
// Every outcome is the same sum: add up a list of accounts in a month. Two switches finish it:
//   • credit:   the accounts hold credit (−) balances (income), so the sum is flipped to read as +.
//   • perMonth: the accounts are running totals that never reset (income, expenses), so the month's
//               number is this month's total − last month's total (what posted in that month).
//               Otherwise the total itself is the answer (a balance, like cash).
//
// THE SEVEN OUTCOMES
//   netWorth                   balance    assets + debts (debts are − balances, so adding subtracts them)
//   liquidCash                 balance    cash
//   liquidCashPlusInvestments  balance    cash + investment accounts 4–12 (NOT retirement, account 3)
//   expensesPerMonth           per month  every expense account except vehicle depreciation
//   incomePerMonth             per month  earned income (gross pay, before taxes; taxes are expenses)
//   incomePlusGainsPerMonth    per month  earned income + gains on investment accounts 4–12
//   incomePlusAllGainsPerMonth per month  the same + gains on retirement (account 3)
//
// WHAT IS LEFT OUT, AND WHY
//   • Value changes are not income or expenses: home / asset appreciation (52) and vehicle depreciation (83).
//     No money moves; they only show up in net worth. Retirement gains (53) are the same, except in
//     incomePlusAllGainsPerMonth, which is there to show them.
//   • Loan principal, down payments, buying an asset with cash and moving money into or out of an
//     investment are not expenses or income either: they swap one balance for another.
//
// RULES
//   • Month 0 = opening balances. A per-month outcome in month 0 is what posted in month 0
//     (only one-time costs dated today; the opening balances themselves post to equity).
//   • `months` = how many months to return (default: the history's own length). Past the end of the
//     history nothing more posts, so balances hold their last value and per-month outcomes are 0.
//     Use it to line up cases whose histories have different lengths.
//   • Bad input throws: an unknown key, a history that isn't whole months, a bad `months`.
// ─────────────────────────────────────────────────────────────────────────────

import { ACCOUNT_COUNT, balanceAt, monthCount } from './coahe';
import { ACCT, INVESTMENT_ACCOUNT_MAX } from './entityEngines';
import { FIRST_INVESTMENT_ACCOUNT } from './masterEngine';
import type { ChartOfAccountsHistory, OutcomeKey, OutcomeSeries } from '../TypesAndVariables/types';

const fail = (msg: string): never => {
  throw new Error(`[outcomes] ${msg}`);
};

/** Account numbers first … last, inclusive. */
const accounts = (first: number, last: number): number[] => Array.from({ length: last - first + 1 }, (_, i) => first + i);

// The chart of accounts in blocks (see ACCT): 0–19 assets, 20–39 debts, 40s equity, 50–69 income, 70+ expenses.
// Whole blocks are used so an account added later lands in the right outcome by itself.
const ASSETS_AND_DEBTS = accounts(0, 39);
const LIQUID_INVESTMENTS = accounts(FIRST_INVESTMENT_ACCOUNT, INVESTMENT_ACCOUNT_MAX);
const EXPENSES = accounts(70, ACCOUNT_COUNT - 1).filter((account) => account !== ACCT.VEHICLE_DEPRECIATION);

type OutcomeRule = { accounts: number[]; credit: boolean; perMonth: boolean };

export const OUTCOME_RULES: Record<OutcomeKey, OutcomeRule> = {
  netWorth: { accounts: ASSETS_AND_DEBTS, credit: false, perMonth: false },
  expensesPerMonth: { accounts: EXPENSES, credit: false, perMonth: true },
  liquidCash: { accounts: [ACCT.CASH], credit: false, perMonth: false },
  liquidCashPlusInvestments: { accounts: [ACCT.CASH, ...LIQUID_INVESTMENTS], credit: false, perMonth: false },
  incomePerMonth: { accounts: [ACCT.EARNED_INCOME], credit: true, perMonth: true },
  incomePlusGainsPerMonth: { accounts: [ACCT.EARNED_INCOME, ACCT.INVESTMENT_GAINS], credit: true, perMonth: true },
  incomePlusAllGainsPerMonth: {
    accounts: [ACCT.EARNED_INCOME, ACCT.INVESTMENT_GAINS, ACCT.RETIREMENT_GAINS],
    credit: true,
    perMonth: true,
  },
};

export function outcomeSeries(history: ChartOfAccountsHistory, key: OutcomeKey, months?: number): OutcomeSeries {
  const rule = OUTCOME_RULES[key];
  if (!rule) fail(`unknown outcome "${String(key)}"`);
  if (!(history instanceof Float64Array) || history.length % ACCOUNT_COUNT !== 0) fail('history is not a chart of accounts history');
  const historyMonths = monthCount(history);
  const count = months ?? historyMonths;
  if (!Number.isInteger(count) || count < 0) fail(`"months" must be a whole number ≥ 0, got ${count}`);

  const series = new Float64Array(count);
  let previous = 0; // last month's total (0 before month 0: every account starts empty)
  for (let month = 0; month < count; month++) {
    let total = previous; // past the end of the history nothing posts, so the total stays put
    if (month < historyMonths) {
      let sum = 0;
      for (const account of rule.accounts) sum += balanceAt(history, month, account);
      total = rule.credit ? 0 - sum : sum; // "0 − sum" so a zero never comes out as −0
    }
    series[month] = rule.perMonth ? total - previous : total;
    previous = total;
  }
  return series;
}
