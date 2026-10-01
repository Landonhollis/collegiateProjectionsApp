// coahe.ts — Chart of Accounts History Engine
// ─────────────────────────────────────────────────────────────────────────────
// Input: every journal entry from every entity engine for ONE case, combined.
// Output: ChartOfAccountsHistory, a snapshot of all 150 accounts after each month.
//
//   coahe(entries) → Float64Array of length (lastMonth + 1) · 150
//   history[month · 150 + account] = balance of `account` after month `month` posts
//
// RULES
//   • Month count comes only from the entries: lastMonth = highest month found.
//   • Month 0 holds the opening balances (the month-0 entries are posted first).
//   • Balances are a running total and never reset. A month with no entries
//     repeats the previous month's balances.
//   • Raw signed balances: debit = +, credit = −, exactly as posted.
//     (A $200k mortgage is −200000.) Every month's snapshot sums to 0.
//   • Bad input throws: mixed caseIds, a month that isn't a whole number ≥ 0,
//     an account outside 0–149, an amount that isn't a whole dollar, or an entry
//     that doesn't sum to 0.
// ─────────────────────────────────────────────────────────────────────────────

import type { ChartOfAccountsHistory, JournalEntry } from '../TypesAndVariables/types';

export const ACCOUNT_COUNT = 150;

const fail = (msg: string): never => {
  throw new Error(`[coahe] ${msg}`);
};

/** Throws if a journal entry is malformed. */
function validate(je: JournalEntry, caseId: string): void {
  if (je.caseId !== caseId) fail(`mixed caseIds: "${caseId}" and "${je.caseId}"`);
  if (!Number.isInteger(je.month) || je.month < 0) fail(`invalid month ${je.month}`);
  let sum = 0;
  for (const l of je.lineEntries) {
    if (!Number.isInteger(l.account) || l.account < 0 || l.account >= ACCOUNT_COUNT)
      fail(`month ${je.month}: invalid account ${l.account}`);
    if (!Number.isInteger(l.amount)) fail(`month ${je.month} acct ${l.account}: amount ${l.amount} is not whole dollars`);
    sum += l.amount;
  }
  if (sum !== 0) fail(`month ${je.month}: entry does not sum to 0 (got ${sum})`);
}

export function coahe(entries: JournalEntry[]): ChartOfAccountsHistory {
  if (entries.length === 0) return new Float64Array(0);

  // 1) Validate and find the last month
  const caseId = entries[0].caseId;
  let lastMonth = 0;
  for (const je of entries) {
    validate(je, caseId);
    if (je.month > lastMonth) lastMonth = je.month;
  }

  // 2) Group entries by month (one pass, instead of scanning every entry every month)
  const byMonth: JournalEntry[][] = Array.from({ length: lastMonth + 1 }, () => []);
  for (const je of entries) byMonth[je.month].push(je);

  // 3) Post each month into the running chart, then snapshot it into the history
  const running = new Float64Array(ACCOUNT_COUNT);
  const history = new Float64Array((lastMonth + 1) * ACCOUNT_COUNT);
  for (let month = 0; month <= lastMonth; month++) {
    for (const je of byMonth[month]) for (const l of je.lineEntries) running[l.account] += l.amount;
    history.set(running, month * ACCOUNT_COUNT);
  }
  return history;
}

// ── Readers ──────────────────────────────────────────────────────────────────
/** Number of months in a history (lastMonth + 1). */
export const monthCount = (history: ChartOfAccountsHistory): number => history.length / ACCOUNT_COUNT;

/** Balance of `account` after month `month` posts. */
export const balanceAt = (history: ChartOfAccountsHistory, month: number, account: number): number =>
  history[month * ACCOUNT_COUNT + account];
