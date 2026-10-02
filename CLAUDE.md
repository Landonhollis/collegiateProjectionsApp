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
- `aiContext/`: handoff docs for the app (start with `aiContext/README.md`). `aiContext/appMap.json` = routes, navigation,
  state, operations, components with build status. Update these when any of those change.
- Tests (`npx tsx <file>.ts`, no framework). Run all five after any change:
  `entityEnginesTest`, `engineSpecTest` (hand calcs + reference models), `coaheTest`, `masterEngineTest`,
  `propertyTest` (seeded random fuzz; `SEED=`, `PER_TYPE=`, `CASES=` env vars).

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
- Bad input throws a clear error: negative dollar amounts, percents out of range, unknown choices, malformed
  ages (whole years ≥ 0, months 0–11), loan terms < 1 month, sellAge before start (existing) or before purchase.
  Only returnPct, appreciationPct, raisePct (≥ −100) may be negative.
- Investment withdrawals stop at $0 (never negative).
- Errors: engines and COAHE throw. masterEngine catches per case → `chartOfAccountsHistory: null`,
  `error: { entityId, message }`; other cases still compute. Linking problems throw from masterEngine itself:
  cases/entities not arrays, missing/duplicate caseId or entityId, an entity whose caseId matches no case.
- Don't flag negative cash or balances; that's not the engines' job.

## Working with the user
- Ask clarifying questions until confident before building anything new.
- Keep explanations plain and short.


## Other rules writen by human
- prefer simpler, readable code over clever abstractions. 
- this app will be built on top of a lot, check current patters before coming up with new ones. 
- typescript should be strict mode - no 'type: any'
- catch errors fast - when in doubt, throw clear error and dont return invalid data. 