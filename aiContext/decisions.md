# How it works and why

## Routing (Expo Router, headless)
- **Root `_layout`** is a Stack with headerShown false. `settings` slides over `(tabs)`; its back button calls `router.back()`.
- **`(tabs)/_layout`** uses headless `Tabs` from `expo-router/ui`: `TabSlot` plus `TabList`/`TabTrigger asChild` wrapping our `TabButton`.
- **The tab screens are flat files.** No per-tab Stack, because nothing is pushed inside a tab yet.
- **Popups are local state, not routes.** That covers the edit cards, the type menu and the confirm dialog: a `useState` in the screen holds `null | add | edit+item`.
- **Addresses:** `/cases`, `/entities`, `/outcomes`, `/settings`. `index` redirects to `/cases`.

## Data model (`TypesAndVariables/types.ts`)
- **Two separate arrays, not nested:**
  - `Case { caseId, caseName, caseColor(hex), caseIndex, isHidden, ...any }`
  - `Entity { entityId, caseId(FK), name, isHidden, inputs }`
- **IDs:**
  - `entityId` = `"TT-xxxxxxxx"`. TT is the type code from `ENTITY_TYPE_CODES`. Never renumber the codes.
  - The entity type is derived with `entityTypeOf(entityId)`. It's not stored separately.
  - `caseId` = `"case-xxxxxxxx"` (`makeCaseId`).
- **Order:**
  - Cases are displayed by `caseIndex`. New cases get max + 1, and gaps are OK.
  - Entity order = array order. It also decides investment accounts 4–12.
- **The engines ignore** `name`, `isHidden`, `caseName`, `caseColor` and `caseIndex`.

## Storage and state
- **`AppDataContext`** loads AsyncStorage keys `cases` and `entities` on start.
  - No screen renders until both are loaded.
  - Saved data is validated, and it throws on anything malformed.
  - Every change goes through the context operations, which update state and save:
    - `saveEntity` / `deleteEntity` / `toggleEntityHidden`
    - `saveCase` / `deleteCase` / `toggleCaseHidden`
  - `deleteCase` also deletes that case's entities.
- **`ThemeContext`** stores the key `themeMode` (`system | light | dark`, default system).
- **Async errors** are put in state, then thrown during render so they surface instead of failing silently.

## Engine (`Engines/`, plain TS)
- **Call:** `masterEngine({ startingAge, cases, entities })` returns `{ startingAge, computedCases }`.
- **Flow:**
  - Group entities by `caseId`.
  - For each case: each entity → its engine (it gets only `inputs` + `ctx {caseId, startAge}`) → journal entries.
  - One `coahe()` call per case.
- **Linking problems throw for the whole call:**
  - an entity whose caseId matches no case
  - a duplicate caseId or entityId
  - a missing ID
  - cases or entities not being arrays
- **Everything else only fails its own case:** that case gets `error`, and its `chartOfAccountsHistory` is null.
- **Don't store histories.** They're about 1.1 MB per case; recompute them, at about 5 ms per case. The inputs are tiny (10 cases × 50 entities ≈ 170 KB).

## Gotchas found the hard way
- **`TabTrigger` injects `style={{flexDirection:'row', justifyContent:'space-between'}}`** into its child, and `TabList` defaults to space-between. `TabButton` drops that style and sets its own layout, and the `TabList` View has an explicit row style.
- **NativeWind on `Animated.View`, and alongside Pressable's function-style `style`, is unverified.** Animated views get plain styles; put classes on an inner View.
- **`active:` (pressed) works on Pressable in NativeWind v4.** Focus outlines use `onFocus`/`onBlur` state, because the box isn't the TextInput.
- **Dark-mode lift is a top border.** Don't combine it with a colored border on the same view (see `ActionWell`).
- **`overflow-hidden` clips iOS shadows.** The case card's color bar rounds its own corners instead.
- **Installing packages:** use `npx expo install`. `react-dom` is pinned to match React (19.2.3) to avoid an npm peer conflict.
- **`runOne`-style test helpers with default params:** passing `undefined` triggers the default. Call `masterEngine` directly to test a missing argument.
