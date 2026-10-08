# CollegiateProjections

Financial projection engine for a React Native app (engine code only for now, plain TypeScript).
The user builds **cases** (scenarios) out of **entities** (a financial event, e.g. buying a house, income, food spending).

## Pipeline
```
masterEngine({ startingAge, cases, entities })
  group entities by caseId → per case → each entity → its entity engine → JournalEntry[] → coahe() → chartOfAccountsHistory
  → { startingAge, computedCases }
```

## Files
- `types.ts`: every shared type (entity inputs, JournalEntry, Case, ComputedCase, …). Start here.
- `entityEngines.ts`: one engine per entity type, `ENGINES` registry, `ACCT` account numbers.
- `presetVars.ts`: all preset numbers (SE-US averages, 2026 tax rules, real rates).
- `coahe.ts`: Chart of Accounts History Engine.
- `masterEngine.ts`: entity IDs, links entities to cases, investment account assignment, runs everything per case.
- `outcomes.ts`: `outcomeSeries(history, key, months?)` turns one case's history into what the outcomes screen shows
  (net worth, liquid cash, expenses per month, …). The seven outcomes and what each adds up are listed at its top.
- `costGuides.ts`: the spending guides behind the "i" buttons on the kid, food and pet edit cards (Southeast averages, each with its source).
  Guide numbers only; the engines never read them.
- `exampleCases.ts`: the two example cases (and their entities) every new account starts with.
- `Sync/projectionsData.ts`: the one object saved per user (`ProjectionsData`), checking saved data, and the rules for keeping
  the phone's copy and the Supabase copy in step. `Sync/supabase.ts`: the Supabase client and the three calls (read / add / replace my row).
- `aiContext/`: handoff docs for the app (start with `aiContext/README.md`). `aiContext/appMap.json` = routes, navigation,
  state, operations, components with build status. Update these when any of those change.
- Tests (`npx tsx tests/<file>.ts`, no framework). Run all eleven after any change:
  `entityEnginesTest`, `engineSpecTest` (hand calcs + reference models), `coaheTest`, `masterEngineTest`, `outcomesTest`, `chartMathsTest` (the outcomes chart's axes and labels),
  `propertyTest` (seeded random fuzz; `SEED=`, `PER_TYPE=`, `CASES=` env vars),
  `entityFormsTest` (every edit card's form: text → engine inputs → runs in its engine → reads back),
  `entitySummaryTest` (the facts shown on each entity card),
  `costGuidesTest` (the spending guides: hand calcs from the source numbers),
  `syncTest` (the saved-data object: reading it back, malformed data, the sync rules).

## Rules
- Money is whole dollars. Debit = +, credit = −. Every journal entry sums to 0.
- No inflation: everything is in today's (2026) dollars with real rates.
- Months: month 0 = opening balances. Month = age in months − startingAge in months. Default horizon 960.
- `startingAge` is shared by all cases (cases are graphed side by side by age).
- History: `Float64Array`, `history[month * 150 + account]` = balance after that month posts.
  Raw signed balances, never reset. Length = (latest month in the entries + 1); cases may differ in length. The COAHE takes no endMonth.
- Entity IDs: `"TT-xxxxxxxx"`, where TT = type code (`ENTITY_TYPE_CODES`) and x = 8 random base-36 chars.
  Never renumber codes; new types get the next number.
- Cases and entities are two separate arrays (stored that way on the phone too). Case: `{ caseId, ...any fields }`.
  Entity: `{ entityId, caseId, inputs }`; `caseId` = the one case it belongs to. A case's entities = those with its caseId,
  in entities-array order. Entity type = the TT code in its entityId. The engine receives `inputs`.
- Investment accounts (10 per case): 3 = retirement (all income 401k deposits); 4–12 assigned by masterEngine to
  investing/existingInvestment in entity order (max 9). App-provided account numbers are overwritten.
  Entities never reference each other.
- Gains: account 51 = gains on investment accounts 4–12 only; 53 = gains on retirement (3). Keep them apart: outcomes count
  51 as income-like ("gains on liquid investments"); only "Income + All Gains per Month" adds 53.
- Outcomes: a balance outcome reads the accounts as they stand; a per-month outcome = this month's running total − last month's.
  Value changes (appreciation 52, retirement gains 53, vehicle depreciation 83) are in net worth only, never income or expenses (except 53 in "Income + All Gains per Month").
- Bad input throws a clear error: negative dollar amounts, percents out of range, unknown choices, malformed
  ages (whole years ≥ 0, months 0–11), loan terms < 1 month, sellAge before start (existing) or before purchase.
  Only returnPct, appreciationPct, raisePct (≥ −100) may be negative.
- Investment withdrawals stop at $0 (never negative).
- Hidden (`isHidden`, on cases and entities, must be true / false): a hidden case is left out completely (no computed case).
  A hidden entity is skipped as if it didn't exist (engine not run, inputs not checked, no investment account).
  Hidden ones are still linked and checked like any other.
- Errors: engines and COAHE throw. masterEngine catches per case → `chartOfAccountsHistory: null`,
  `error: { entityId, message }`; other cases still compute. Linking problems throw from masterEngine itself:
  cases/entities not arrays, missing/duplicate caseId or entityId, an entity whose caseId matches no case, a non-boolean isHidden.
- Don't flag negative cash or balances; that's not the engines' job.

## Working with the user
- Ask clarifying questions until confident before building anything new.
- Keep explanations plain and short.


## Other rules writen by human
- prefer simpler, readable code over clever abstractions. 
- this app will be built on top of a lot, check current patters before coming up with new ones. 
- typescript should be strict mode - no 'type: any'
- catch errors fast - when in doubt, throw clear error and dont return invalid data. 