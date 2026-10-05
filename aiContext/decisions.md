# How it works and why

## Routing (Expo Router, headless)
- **Root `_layout`** is a Stack with headerShown false. `settings` slides over `(tabs)`; its back button calls `router.back()`.
- **`(tabs)/_layout`** uses headless `Tabs` from `expo-router/ui`: `TabList`/`TabTrigger asChild` wrapping our `TabButton`. There is no `TabSlot`.
- **Swiping between tabs:** the layout imports the three tab screens and lays them side by side in a horizontal paging `ScrollView` (the pager). All three stay mounted.
  - The route is still the source of truth for the bottom menu. Swipe past halfway → `router.navigate(href)`. Route changed some other way (tab press) → the pager slides to it.
  - `fingerSwiping` (a ref) tells the two apart, so a tab press's own slide doesn't navigate through the tabs it passes.
  - The top bar is outside the pager and the bottom menu floats over it (`position: absolute` on the `TabList`'s own View, which is still a direct child of `Tabs`), so neither moves with the swipe. One `TopBar` in the layout (title + settings). Each screen's plus is in its own `FloatingRow`, so it needs nothing from the layout.
  - The pager is an `Animated.ScrollView`: its `onScroll` writes `scrollX` natively, and the bottom menu's marker is `scrollX` interpolated to an x (clamped at the ends).
  - Pulling past the first or last tab bounces back on iOS (`bounces`) and stretches on Android (`overScrollMode="always"`).
  - Swiping is off while a card is dragged (`swipeLocked`), for the same reason the list's own scrolling is.
  - On entities, the left 14px edge still pulls out the type menu; a swipe from anywhere else changes tab.
- **The tab screens are flat files.** No per-tab Stack, because nothing is pushed inside a tab yet.
- **The entity types menu is not a Modal and not in the entities screen.** `(tabs)/_layout` draws it (only on `/entities`) after the bottom menu, so it can overlap both bars and be dragged out continuously. `EntityMenuContext` holds `groupKey` and `menuOpen` so the entities screen can read and open it.
- **Outcomes has no side menu.** Seven options were too few for one, so tapping the floating bar (the chart's title) opens `OutcomesDropdown`, a floating list under the bar. `outcomeKey` and whether the list is open are local state in the outcomes screen (no context). `components/sideMenu.tsx` still holds the panel, tab and gestures; only `EntityTypesMenu` uses it now.
- **Popups are local state, not routes.** That covers the edit cards and the confirm dialog: a `useState` in the screen holds `null | add | edit+item`.
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
- **The engines ignore** `name`, `caseName`, `caseColor` and `caseIndex`.
- **`isHidden` (must be true or false, or masterEngine throws):**
  - A hidden case is left out completely: no computed case for it.
  - A hidden entity is skipped as if it didn't exist: its engine doesn't run, its inputs aren't checked, and it takes no investment account.
  - Hidden cases and entities are still linked and checked (IDs, caseId).

## Entity groups (UI only, `TypesAndVariables/entityTypeLabels.ts`)
- **A group = one row in the type menu = one entities screen.** `ENTITY_GROUPS`, `entityGroupOf(type)`, `entityGroupByKey(key)`.
- **Every group holds one entity type, except Housing,** which holds `renting` and `buyingHome`.
  - They are still two entity types everywhere else: IDs, engines, edit cards, storage.
  - Each card still shows its own type label ("Renting" / "Buying a Home"), not "Housing".
- **Adding:** a group with one type opens that type's edit card. A group with more opens `AddOptionsMenu` under the plus ("Renting" / "Buying").
- **To bundle more types,** add a group like `HOUSING` and leave its extra types out of the generated list.

## Edit card data flow
- **Text → inputs:** a card holds text; its form's `toInputs` gives the engine inputs or null. Add / Done is enabled only when the name, the case and the inputs are all there.
- **Save:** `useEntityCard` calls `saveEntity({ entityId, caseId, name, isHidden, inputs })`. A new entity gets `makeEntityId(type)`; an edit keeps its id, place and hidden flag.
- **Edit:** the form's `read` turns the saved inputs back into text. Anything missing or of the wrong kind comes back blank rather than throwing, so the user can fix it.
- **Type safety:** `useEntityCard(props, type, form)` only compiles when the form's inputs are that type's engine inputs (`FormInputs<K>`), and it throws if a card is opened for an entity of another type.
- **`tests/entityFormsTest.ts`** runs every form: expected inputs, through masterEngine with no error, read back to the same text, and each way of getting it wrong refused.

## Storage and state
- **`AppDataContext`** loads AsyncStorage keys `cases`, `entities` and `startingAge` on start.
  - `startingAge` is `Age {years, months}`. It defaults to 20 years 0 months until the user sets it, so it's never empty. `setStartingAge(age)` checks it (whole years ≥ 0, months 0–11) and saves.
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

## Outcomes (`Engines/outcomes.ts`, `app/(tabs)/outcomes.tsx`)
- **Flow:** the screen calls `masterEngine` (cases sorted by `caseIndex`), then `outcomeSeries(history, outcomeKey, months)` per case. Nothing is stored.
- **The engine only runs while the Outcomes tab is showing** (`usePathname() === "/outcomes"`), and only when startingAge, cases or entities are not the same objects as last time. Every tab screen stays mounted, so running it on every edit slowed the whole app (the user noticed).
  - The result is held in state as a `Projection` (the computed cases plus the data they came from). Out of date or not made yet → a spinner in place of the chart; the floating bar stays.
  - The run is in a `setTimeout(0)` so the spinner is on screen first. A throw from `masterEngine` is put in state and thrown during render.
- **Every outcome is one rule:** a list of accounts to add up, `credit` (flip the sign: income is held as −) and `perMonth` (`OUTCOME_RULES`).
  - A balance outcome is the sum as it stands that month.
  - A per-month outcome is this month's sum − last month's, because income and expense accounts are running totals that never reset.
- **The seven:**
  - Net Worth = accounts 0–39 (assets + debts; debts are − so they subtract).
  - Liquid Cash = account 1.
  - Liquid Cash + Investments = account 1 + accounts 4–12. Retirement (3) is not liquid, so it's left out.
  - Expenses per Month = accounts 70 and up, except vehicle depreciation (83).
  - Income per Month = account 50, which is gross pay. Taxes are expenses, so income − expenses still comes out right.
  - Income + Gains per Month = accounts 50 + 51.
  - Income + All Gains per Month = accounts 50 + 51 + 53 (adds retirement gains; the user asked for it).
- **Value changes are in net worth only:** appreciation (52), retirement gains (53), vehicle depreciation (83). No money moves, so they're neither income nor an expense (53 is counted only in Income + All Gains per Month). Same for loan principal, down payments and moving money into an investment: one balance swapped for another.
- **Why account 53 exists:** retirement gains used to share 51 with the other investments, so "gains on liquid investments" couldn't be read from a history. The income engine now posts its retirement growth to 53.
- **Different lengths:** `months` pads a series. Past the end of a history nothing posts, so a balance holds and a per-month number is 0. The screen pads every case to the longest one, so every line runs the whole chart.
  - Tried and undone (the user's call): stopping each line at its own case's end. A case with only opening cash is one month long, so it had no line at all.
  - Known look: a per-month line drops to 0 where a case's entities stop (e.g. expenses ending at 80 while another case runs to 100). That is what the inputs say.
- **Month 0** is the opening balances. A per-month outcome there is only what posted in month 0 (a one-time cost dated today).
- **`tests/outcomesTest.ts`** checks each outcome by hand, then on a full case: net worth = −(equity + income + expenses), and each month's net worth change = income + gains − expenses + value changes.

## Outcomes chart (`components/outcomeChart.tsx`, `components/chartMaths.ts`)
- **Skia (`@shopify/react-native-skia`), chosen with the user over react-native-svg.** It's in Expo Go, and its needs (Reanimated 4, worklets) were already installed. The user wants it kept as simple as possible: one `Canvas`, no chart library, no animation.
- **On the canvas:** a grid line per y label (stronger at $0), one stroked `Path` per case, the selector line, and two circles per case (a background-colored ring, then the dot).
- **Not on the canvas:** the dollar and age labels. They are normal `Text` placed around it, so there's no Skia font loading and the theme classes work.
- **x:** every month in the data, month 0 (the starting age) to the last month of the longest case. Shorter cases are padded to it (see Outcomes → Different lengths). Every month is a point (the user: "everything is based on months").
- **y:** `yAxisFor(min, max)`: always includes 0, goes below it when the data does, round steps (1, 2 or 5 × a power of ten).
- **The selector is plain React state** in `OutcomesView` (`pickedMonth`, null = the last month). The paths are in a `useMemo` that doesn't depend on it, so a drag only redraws the line, the dots and the rows.
- **Dragging:** a transparent View over the chart with a `PanResponder` (no gesture-handler). x = where the finger went down (`locationX`) + how far it has moved (`dx`).
  - It calls `setSwipeLocked(true)` the moment a finger lands, because the chart sits inside the tab pager. Not confirmed on a phone when written: if a fast sideways flick on the chart still changes tab, this is the place to look.
  - A vertical drag that starts on the chart still scrolls the page (the native scroll takes the touch; the responder's terminate unlocks).
- **`tests/chartMathsTest.ts`** covers `yAxisFor`, `ageTicks`, `shortDollars` and `money`.

## Drag to reorder (`components/reorderableGrid.tsx`)
- **Hand-built with `PanResponder` + `Animated`,** like the app's other gestures. No gesture-handler (it's a native module the app doesn't have).
- **Not a FlatList:** a ScrollView with absolutely positioned cards. Every cell is the same size, so slot → x / y is maths. Lists are small, so no virtualization.
- **Each card has an animated x / y kept per key.** During a drag a working copy of the order changes; cards whose slot changed spring to it.
- **Scrolling is off during a drag** (`scrollEnabled`), because a JS responder can't stop the native scroll on iOS. Swiping between tabs is too (`setSwipeLocked`).
- **The expanded panel** (`expanded` prop, lists only; used by the cases screen for a case's entities): the one exception to equal cells.
  - It's an absolutely positioned view drawn before the cards (so they sit on top of it), its top `overlap` px behind its card. The grid measures its height; every card after it is pushed down by height − overlap, so a slot is still maths.
  - Opening, closing or a height change springs the pushed cards to their new places. The panel's content slides down 24px and fades in (`SlideOut`).
  - It closes while a card is dragged (plain rows again, so the drag maths is unchanged) and comes back on drop.
  - Which case is open is `expandedId` in the cases screen: one at a time, not saved.
- **Saving:** `reorderCases(caseIds)` rewrites `caseIndex`. `reorderEntities(entityIds)` gets only the shown type's ids and swaps them among the places they already hold, so other types don't move.

## Gotchas found the hard way
- **`TabList` must be a direct child of `Tabs`** (a Fragment is OK). Wrap it in a View and expo-router finds no `TabTrigger`s and throws "Couldn't find any screens for the navigator". Extra things for the bottom menu (the marker) go inside the `TabList`'s own View.
- **A child of `TabList asChild` (or any expo-router `Slot`) can't take an array of styles.** It throws "You are passing an array of styles to a child of <Slot>". Spread the pieces into one object instead (the bottom menu's View does).
- **`TabTrigger` injects `style={{flexDirection:'row', justifyContent:'space-between'}}`** into its child, and `TabList` defaults to space-between. `TabButton` drops that style and sets its own layout, and the `TabList` View has an explicit row style.
- **NativeWind on `Animated.View`, and alongside Pressable's function-style `style`, is unverified.** Animated views get plain styles; put classes on an inner View.
- **`active:` (pressed) works on Pressable in NativeWind v4.** Focus outlines use `onFocus`/`onBlur` state, because the box isn't the TextInput.
- **Dark-mode lift is a top border.** Don't combine it with a colored border on the same view (see `ActionWell`).
- **`overflow-hidden` clips iOS shadows.** So a view that needs both a shadow and clipping uses two views (see the dropdown list in formFields).
- **Installing packages:** use `npx expo install`. `react-dom` is pinned to match React (19.2.3) to avoid an npm peer conflict.
- **`runOne`-style test helpers with default params:** passing `undefined` triggers the default. Call `masterEngine` directly to test a missing argument.
