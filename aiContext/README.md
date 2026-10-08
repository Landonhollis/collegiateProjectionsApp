# aiContext: start here

Handoff for the next AI. Read in this order:
1. `README.md`: what this is, file map, how to run and verify
2. `decisions.md`: how things work and why, plus gotchas
3. `design.md`: the look and the UI rules
4. `openItems.md`: what's undecided, unconfirmed or not built
5. `appMap.json`: every route, navigation, state, operation and component (file, props, status)

Also read `../CLAUDE.md` (engine rules, working rules). Design sources, one folder above the project: `../../ColorsGuide.md` and `../../FontsGuide.md`.

Each fact lives in one file: **why** in decisions, **look** in design, **where and what** in appMap. Update them when the code changes.

## The app
CollegiateProjections: an Expo React Native app for financial projections.
- The user makes **cases** (scenarios, e.g. "Buy a house at 30").
- Each case is made of **entities** (income, a home, food spending, … 23 types).
- The engine turns each case into a month-by-month balance history, so cases can be compared by age.
- Money is in whole 2026 dollars, with no inflation.

## Stack
Expo SDK 57, RN 0.86, React 19, TypeScript strict, Expo Router (file-based, headless UI), NativeWind v4, AsyncStorage, Supabase (supabase-js: accounts + each user's saved data), expo-web-browser (Google sign-in),
@expo/vector-icons (Ionicons), Inter (@expo-google-fonts/inter), expo-haptics, @shopify/react-native-skia (the outcomes chart
and the logo). npm. `app.json` userInterfaceStyle = "automatic" (needed for dark mode).

## File map
```
app/                      routes (Expo Router)
  _layout.tsx             fonts → SafeArea → ThemeProvider → AuthProvider → AppDataProvider → root Stack (no header, guarded screens)
  index.tsx               the router: not signed in → /sign-in; not onboarded → /onboarding; else → /cases
  sign-in.tsx             email + password (sign in or make an account), Continue with Google, "Check your email" (boilerplate)
  onboarding.tsx          the ten-step walkthrough: a look-alike of the three screens where only the current step's control works (all in this one file)
  settings.tsx            Appearance (system / light / dark); Walkthrough (show it again); Account (email, Sign out)
  (tabs)/_layout.tsx      headless Tabs: one TopBar + swipeable pager of the tab screens + floating bottom menu
  (tabs)/cases.tsx        case list; tap a case to see its entities
  (tabs)/entities.tsx     entity grid, one entity group at a time
  (tabs)/outcomes.tsx     one outcome at a time: chart (a line per case), a draggable age, each case's number at that age
components/               UI (see appMap.json → components)
  (editEntityCards)/      one edit card per entity type (all 23) + index.ts registry; entityForms.ts = each card's
                          text ↔ engine-inputs rules; useEntityCard.ts = the shared hook
  theme.ts                palettes, CSS vars, lift, case colors, color helpers
context/
  AuthContext.tsx         who is signed in (Supabase): userId, email, signIn, signUp, signOut
  AppDataContext.tsx      the signed-in user's data (onboarded, starting age, cases, entities): load, hold, save, sync, operations
  ThemeContext.tsx        theme mode: load, save, apply
  EntityMenuContext.tsx   which entity group is showing + whether the type menu is open
  TabPagerContext.tsx     the swipe lock: tab screens tell the tabs layout when swiping between tabs must stop
Sync/                     projectionsData.ts (the saved object, checks, sync rules; plain TS), supabase.ts (client + row calls)
Engines/                  masterEngine, entityEngines (23), coahe, outcomes (plain TS, no React)
TypesAndVariables/        types.ts (all shared types), presetVars.ts, entityTypeLabels.ts, outcomeLabels.ts,
                          costGuides.ts (the spending guides behind the "i" buttons),
                          exampleCases.ts (the two cases a new account starts with)
tests/                    11 files, no framework (list in ../CLAUDE.md)
aiContext/                this folder (+ appStoreDemoData.json: the three demo cases for the App Store screenshots)
```

## Run and verify
- Run: `npm start`. There's no simulator on the user's Mac (no Xcode), so the AI can't see the app: the user tests on a phone.
- After any code change, run all of these:
  - `npx tsc --noEmit`
  - `npx expo export --platform ios --output-dir <scratch>`: proves it bundles
  - `for f in entityEnginesTest engineSpecTest coaheTest masterEngineTest outcomesTest chartMathsTest propertyTest entityFormsTest entitySummaryTest costGuidesTest syncTest; do npx tsx tests/$f.ts; done`
- Format touched files with `npx prettier --print-width 140 --write <files>`.

## Supabase
One project, "Collegiate" (ref `vwefydubhejeocprbzec`), shared by every Collegiate app: one account works in all of them.
The MCP server is in `.mcp.json`; the Supabase agent skills are in `.agents/` and `.claude/skills/`.
The database is one table so far, `app_data` (see decisions.md → Accounts and saved data). Its SQL is only in Supabase's migration history.

## App Store demo data (`appStoreDemoData.json`)
The three cases used for the App Store screenshots and preview, as one whole `ProjectionsData` object (exactly what goes in
`app_data.data`): "Teach in my hometown" (Coral), "Nursing career" (Gold), "Software engineer" (Sky), 82 entities, starting age 20 yrs 6 mos.
Net worth at the end of the chart (age 100½): about $1.56M, $3.92M and $10.19M. Cash never goes below $0.

To reset the user's account (landonhollis2006@gmail.com) to it, with the Supabase MCP `execute_sql`:
1. Find the row: `select d.user_id, d.version from public.app_data d join auth.users u on u.id = d.user_id where u.email = '…' and d.app = 'projections'`.
2. `update public.app_data set data = $demo$<the file's contents>$demo$::jsonb where user_id = '<id>' and app = 'projections'`,
   with `editedAt` changed to now in ms (the phone keeps its own copy if its `editedAt` is later; see decisions.md → Sync rules).
   The server sets `version` itself. This replaces everything in the account, so ask the user first.
3. The phone takes it the next time the app opens or comes to the foreground.

Why the numbers are what they are: the engine never withdraws from retirement (account 3), so retirement return is 4% in all three
(7% overshoots the targets); Social Security is an Income entity with a 0% tax rate; each case has a spouse's income so cash stays above $0.
Change a number and the end values move: run the cases through `masterEngine` and `outcomeSeries` to check before saving.

## Git
Branch `app-ui-foundation` (PRs go to `main`). Everything described in this folder is committed. Only commit when the user asks; suggest it before starting something big.

## The user
- Learning React Native. Wants Feynman-simple, short explanations.
- Builds their own UI: no stock headers, tab bars or menus.
- Wants clarifying questions before you build something new, simple readable code, no `any`, and clear errors thrown early.
- Moves fast: often sends rough "code-English" for you to turn into real code.
