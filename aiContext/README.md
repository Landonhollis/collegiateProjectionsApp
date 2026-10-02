# aiContext: start here

Handoff for the next AI. Read in this order:
1. `README.md`: what this is, file map, how to run and verify
2. `decisions.md`: how things work and why, plus gotchas
3. `design.md`: the look and the UI rules
4. `openItems.md`: what's undecided or not built
5. `appMap.json`: every route, navigation, state, operation and component, each with a build status

Also read `../CLAUDE.md` (engine rules, working rules). Design sources: `../../ColorsGuide.md` and `../../FontsGuide.md`.

## The app
CollegiateProjections: an Expo React Native app for financial projections.
- The user makes **cases** (scenarios, e.g. "Buy a house at 30").
- Each case is made of **entities** (income, a home, food spending, … 23 types).
- The engine turns each case into a month-by-month balance history so cases can be compared by age.
- Money is in whole 2026 dollars, with no inflation.

## Stack
Expo SDK 57, RN 0.86, React 19, TS strict, Expo Router (file-based, headless UI), NativeWind v4, AsyncStorage,
@expo/vector-icons (Ionicons), Inter (@expo-google-fonts/inter), expo-haptics. npm. `app.json` userInterfaceStyle = "automatic" (needed for dark mode).

## File map
```
app/                      routes (Expo Router)
  _layout.tsx             fonts → SafeArea → ThemeProvider → AppDataProvider → root Stack (no header)
  index.tsx               Redirect → /cases
  settings.tsx            Appearance (system / light / dark)
  (tabs)/_layout.tsx      headless Tabs: TopBar + TabSlot + custom bottom menu
  (tabs)/cases.tsx        case list
  (tabs)/entities.tsx     entity grid, one type at a time
  (tabs)/outcomes.tsx     placeholder
components/               UI (see appMap.json → components)
  (editEntityCards)/      one edit card per entity type + index.ts registry (2 of 23 built)
  theme.ts                palettes, CSS vars, lift, case colors, color helpers
context/
  AppDataContext.tsx      cases + entities: load, hold, save, operations
  ThemeContext.tsx        theme mode: load, save, apply
Engines/                  masterEngine, entityEngines (23), coahe (plain TS, no React)
TypesAndVariables/        types.ts (all shared types), presetVars.ts, entityTypeLabels.ts
tests/                    5 engine test files (npx tsx, no framework)
aiContext/                this folder
```

## Run and verify
- Run: `npm start`. There's no simulator on the user's Mac (no Xcode), so the user tests on a phone.
- After any change, run all of these:
  - `npx tsc --noEmit`
  - `npx expo export --platform ios --output-dir <scratch>`: proves it bundles
  - `for f in entityEnginesTest engineSpecTest coaheTest masterEngineTest propertyTest; do npx tsx tests/$f.ts; done`
- Format touched files with `npx prettier --print-width 140 --write <files>`.

## Git
Nothing from this session is committed. The last commit is `6549892 Link EAS project`. Only commit when the user asks.

## The user
- Learning React Native. Wants Feynman-simple, short explanations.
- Builds their own UI: no stock headers, tab bars or menus.
- Wants clarifying questions before you build something new, simple readable code, no `any`, and clear errors thrown early.
- Moves fast: often sends rough "code-English" for you to turn into real code.
