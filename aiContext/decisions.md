# How it works and why

## Routing (Expo Router, headless)
- **Root `_layout`:** a Stack with no header. `settings` slides over `(tabs)`; its back button calls `router.back()`.
- **`index` is the router** (the user's design): not signed in → `/sign-in`; signed in, not onboarded → `/onboarding`; else → `/cases`.
  It reads `useAuth().userId` and `useOnboarded()`.
- **The root Stack guards its screens** (`Stack.Protected`): `sign-in` exists only while signed out, `onboarding` only while signed in
  and not onboarded, `(tabs)` + `settings` only while signed in and onboarded. `index` always exists.
  - Why both: a redirect alone leaves the old screens mounted underneath (after a sign-out, `(tabs)` would still be in the stack,
    calling `useAppData()` with no user). A guard takes them out of the stack; whoever was on one lands on `index`.
  - So sign-in, onboarding and sign-out never navigate themselves. They change the state and the screens follow.
- **`(tabs)/_layout`:** headless `Tabs` from `expo-router/ui` (`TabList` / `TabTrigger asChild` around our `TabButton`). There is no `TabSlot`.
- **The pager:** the layout imports the three tab screens and lays them side by side in a horizontal paging `Animated.ScrollView`. All three stay mounted.
  - The route is still the source of truth for the bottom menu. Swipe past halfway → `router.navigate(href)`. Route changed another way (tab press, a "Go to cases" button) → the pager slides to it.
  - `fingerSwiping` (a ref) tells the two apart, so a tab press's own slide doesn't navigate through the tabs it passes.
  - The `TopBar` is outside the pager and the bottom menu floats over it, so neither moves with the swipe.
  - The pager's `onScroll` writes `scrollX` natively; the bottom menu's marker is `scrollX` interpolated to an x (clamped at the ends).
  - Past the first or last tab it bounces (iOS) or stretches (Android).
  - `swipeLocked` (TabPagerContext) turns swiping off while a card is dragged or a finger is on the chart.
- **The tab screens are flat files.** No per-tab Stack, because nothing is pushed inside a tab yet.
- **The entity types menu is not a Modal and not in the entities screen.** The layout draws it (only on `/entities`) after the bottom menu, so it can overlap both bars and be dragged out continuously. `EntityMenuContext` holds `groupKey` and `menuOpen` so the entities screen can read and open it. Its left 14px edge strip pulls it out; a swipe from anywhere else changes tab.
- **Outcomes has no side menu.** Seven options were too few for one, so its floating bar opens `OutcomesDropdown`. `outcomeKey` is local state in the screen. `sideMenu.tsx` is generic, but only `EntityTypesMenu` uses it.
- **Popups are local state, not routes** (edit cards, confirm dialog, dropdowns): a `useState` in the screen holds `null | add | edit+item`.

## Data model (`TypesAndVariables/types.ts`)
- **Two separate arrays, not nested:**
  - `Case { caseId, caseName, caseColor(hex), caseIndex, isHidden, ...any }`
  - `Entity { entityId, caseId(FK), name, isHidden, inputs }`
- **IDs:** `entityId` = `"TT-xxxxxxxx"` (TT = type code from `ENTITY_TYPE_CODES`; never renumber). The entity type is derived with `entityTypeOf(entityId)`, not stored. `caseId` = `"case-xxxxxxxx"` (`makeCaseId`).
- **Order:** cases display by `caseIndex` (new = max + 1; gaps OK). Entity order = array order, which also decides investment accounts 4–12.
- **The engines ignore** `name`, `caseName`, `caseColor` and `caseIndex`.
- **`isHidden`** (must be true or false, or masterEngine throws): a hidden case gets no computed case; a hidden entity is skipped as if it didn't exist (engine not run, inputs not checked, no investment account). Both are still linked and checked (IDs, caseId).

## Entity groups (UI only, `TypesAndVariables/entityTypeLabels.ts`)
- **A group = one row in the type menu = one entities screen** (`ENTITY_GROUPS`, `entityGroupOf`, `entityGroupByKey`). 22 groups for 23 types.
- **Every group holds one type, except Housing** (`renting` + `buyingHome`). They are still two types everywhere else (IDs, engines, edit cards, storage), and each card shows its own type label.
- **Adding:** a one-type group opens that type's edit card; Housing opens `AddOptionsMenu` under the plus first.
- **To bundle more types,** add a group like `HOUSING` and leave its extra types out of the generated list.

## Onboarding walkthrough (`app/onboarding.tsx`, `TypesAndVariables/exampleCases.ts`)
- **The user's design:** a look-alike of the real app that walks through its basic flow in ten steps, with only the current
  step's control working, and clear words and graphics for each step. Kept light and out of the real app's way.
- **It's a picture, not a second app.** The top bar, the three screens and the bottom menu are drawn with the real components
  (`TopBar`, `FloatingRow`, `CaseCard`, `EntityCard`, `OutcomeChart`, `TabButton`) inside views with touches turned off
  (`pointerEvents="none"`). The step's control is an invisible button (`Target`) laid exactly over the real one, so nothing has
  to be disabled piece by piece. Only the chart is truly live, on the last step.
- **One file (about 1,170 lines), and no real screen was changed.** The cost is repeated layout (each screen's list, the outcomes rows, the
  bottom menu, the two popups): if a real screen's layout changes, its picture here must be changed to match.
- **What the user makes is real** (the user's call): the case goes through `saveCase` and the income through `useEntityCard` /
  `saveEntity`, so both are in the app afterwards. Skipping part-way keeps whatever was made so far.
- **The ten steps** (`Step`; the words are in `STEPS`): tap the plus on Cases → Save the prefilled "Life case N" → swipe to
  Entities → tap the plus (the screen shows Income) → type a salary and both ages → tap Add → swipe to Outcomes → tap the
  outcomes bar → pick an outcome → drag the chart. Then a "Start using the app" button.
  - Swipes must be swipes: the pager only scrolls on those two steps, and the bottom menu can't be pressed. A swipe the wrong way slides back.
  - Closing a popup without saving goes back one step, so the plus can be tapped again.
- **The guide must not look like part of the app** (the user's call, after the first pass used cards that did). It is a
  `Callout`: a box filled in the accent color with one side pushed out into a point, and a thick curved arrow growing out of
  the point to the thing to press. Drawn with Skia as one shape and one arrow in one color; the words are Text laid over it.
  - **It always floats and never takes room inside a popup** (the first pass put the words inside the popups, which made them
    taller and look like app content).
  - Everything is placed on a "layer" in px: the area under the top bar, or a popup's own area. A callout is given where its
    box goes, which side points, and where the arrowhead ends. The arrow leaves the point sideways and arrives straight up or down.
- **Both popups are drawn again here on the real `PopupLayer`,** not with the real popup components. A popup is a Modal, and
  only what is inside the Modal can be drawn over it, so the guide has to be a sibling of the card inside `PopupLayer`.
  The cost: the frame's layout from `editEntityCard.tsx` and `editCaseCard.tsx` is repeated, and must be kept matching.
  - New case: name and color filled in and locked; the callout sits under the card with its arrow into Save.
  - New income: saved through the real hook (`useEntityCard`) and `incomeForm`, with the real card's boxes in the real order.
    **One box at a time** (the user's call): salary, start age, end age, then Add (`IncomeStop`). For each, the popup scrolls
    itself to put that box at the top (a finger can't scroll it), the callout sits over the popup's title with its arrow hooking
    down into the box, and a "Next" button in the callout moves on once what's typed is valid. "Next" is there because typing has
    no natural end: the box is valid after the first digit. Every other box, the name and the case are shown locked.
    Both ages are required here, unlike the real card.
- **The chart steps put the callout at the top** (one line, over the floating bar), so each case's number under the chart stays in view.
- **Step is local state:** leaving the app part-way starts the walkthrough over at step 1.
- **Finishing or skipping** calls `completeOnboarding()`; Settings → "Show it again" calls `restartOnboarding()`. Neither navigates
  (see Routing: the guards do).
- **Example cases:** every new account starts with "Example life case 1" (renting) and "Example life case 2" (buys a home at 28),
  sharing the same cash, income and food (`exampleCases()`, called by `newProjectionsData`). They are ordinary data the user can
  change or delete. They exist so a new user has something to work with and the walkthrough has cards and chart lines to show.
  - Start ages are blank ("now") where they can be, so they run whatever starting age the user sets (tested from 18 to 70).
  - The contents were the AI's pick; the names were the user's.

## Edit card data flow
- **Text → inputs:** a card holds text; its form's `toInputs` gives the engine inputs, or null while anything is missing or invalid. Add / Save is enabled only when the name, the case and the inputs are all there.
- **Default name:** a new entity's name box starts filled in with its type label ("Food"), so nobody has to think of one (the user asked). While it's still the default, tapping the box selects it all, so typing replaces it. Same-named entities are fine: nothing relies on names being unique.
- **Default case:** a new entity's case box starts on `defaultCaseId` (see Storage and state), to cut friction (the user asked).
- **Save:** `useEntityCard` calls `saveEntity({ entityId, caseId, name, isHidden, inputs })`. A new entity gets `makeEntityId(type)`; an edit keeps its id, place and hidden flag.
- **Edit:** the form's `read` turns saved inputs back into text. Anything missing or of the wrong kind comes back blank rather than throwing, so the user can fix it.
- **Type safety:** `useEntityCard(props, type, form)` only compiles when the form's inputs are that type's engine inputs (`FormInputs<K>`), and it throws if a card is opened for an entity of another type.
- **`tests/entityFormsTest.ts`** runs every form: expected inputs, through masterEngine with no error, read back to the same text, and each way of getting it wrong refused.

## Popups and the keyboard (`components/popupLayer.tsx`)
- **All three edit popups (entity, case, starting age) sit on `PopupLayer`:** the Modal, the dim, and the card centered in the space above the keyboard.
- **The slide:** iOS `keyboardWillShow` / `keyboardWillHide` start an `Animated.timing` that grows or shrinks the layer's bottom padding to the keyboard's height. JS-driven, because padding is layout. Android is left with nothing added, as before.
  - It takes `SLIDE_MS` (420ms) with a gentle ease, slower than the keyboard's own 250ms. Matching the keyboard exactly felt too snappy (the user's call).
- **The dim** closes the popup without saving, keyboard up or not.
- **Only Add / Save saves** (the user's call; the button was renamed from "Done" to say so). Save-on-tap-outside was considered and dropped.
- **Tried and undone (it broke scrolling on the phone):** making each card a `Pressable` that hides the keyboard on a tap of its empty space, with the ScrollView on `keyboardShouldPersistTaps="always"`. A drag that started anywhere but an input box no longer scrolled, and the keyboard still went away on scroll. The ScrollView is back on `"handled"`.
- **Dropdowns** open `SETTLE_AFTER_KEYBOARD_MS` after `keyboardDidHide`, so the box is measured once the popup has finished sliding back. Change `SLIDE_MS` and this follows.

## Spending guides (`TypesAndVariables/costGuides.ts`, `components/costGuidePopup.tsx`)
- **What:** an "i" beside a box's label opens a popup of what people typically spend, for users who have never paid for the thing (the user: most are students). On: kid cost per year, groceries, dining out, pet food, pet vet.
- **How:** `Field` / `NumberField` take `guide={SOME_GUIDE}`. The guide is plain data (title, intro, tables, notes, sources); `CostGuidePopup` draws any guide. It only informs: nothing fills the box.
- **Every shown number is worked out in code from source numbers** kept as constants with their source beside them, so updating a source is one edit. `tests/costGuidesTest.ts` has hand calcs.
- **Southeast first, U.S. where there's nothing regional,** and each guide says which. Everything is in 2026 dollars: older sources are brought forward with the price index for that kind of spending.
- **Sources and method:**
  - Groceries: USDA Official Food Plans (Low-cost, Moderate, Liberal), July 2026, U.S. (no regional version), with USDA's own household-size adjustment.
  - Dining out: BLS Consumer Expenditure Surveys 2024, food away from home by kind of household (U.S.), × the South's share of the U.S. average (BLS has no household kind within a region), × the South's restaurant price index since 2024. "Rarely" and "Often" are half and double the average, and the guide says so.
  - Kids: USDA Expenditures on Children by Families 2015, urban South, each category brought to August 2026 with its own South price index. Housing and food are left out (the user's rule: other entities hold them) and so is transportation (the car and gas entities), which was the AI's call by the same rule.
  - Kids, bigger choices: Child Care Aware 2024 (daycare by state), College Transitions 2024–25 (private school by state), over the same 12 states as `presetVars`. Sports, school shopping and vacation are U.S. figures; vacation is the weakest source.
  - Pets: Synchrony 2025 Lifetime of Care (food), AVMA 2025 Sourcebook (average yearly vet spending), CareCredit price research (visit prices). All U.S.
- **Not read by the engines.** Guide numbers are separate from `presetVars`.

## Accounts and saved data (`context/AuthContext.tsx`, `context/AppDataContext.tsx`, `Sync/`)
- **One Supabase project for every Collegiate app,** so one account signs in to all of them (like a Google account).
  Signing in is required: email + password, or Google (both boilerplate screens).
- **Google sign-in is the browser kind** (`signInWithGoogle` in `AuthContext`): Supabase gives a Google URL, `expo-web-browser`
  opens it over the app, and Google returns to the app with a link carrying the login (`#access_token…`), which `setSession` takes.
  - Chosen over Google's native SDK because that needs a native module (no Expo Go) and an OAuth client per platform.
  - It returns to `collegiateprojections://` (a constant, `RETURN_TO`), which is on the Redirect URLs list in the Supabase dashboard.
    Not `Linking.createURL()`: in Expo Go that is `exp://<the computer's IP>…`, and Supabase won't return to an IP address even
    with `exp://**` on the list (found on the phone: it fell back to the Site URL, a blank page). On iOS the sign-in page hands the
    link straight back to the app that opened it, so Expo Go works. Android only gets it as a deep link, so it needs a real build.
  - Needs the Google provider switched on in the Supabase dashboard with a Google Cloud "Web application" client id and secret.
- **A new email account gets a "Check your email" message** in place of the form (Supabase's "Confirm email" is on).
  A Google account needs no confirming.
- **One object per user per app** (`ProjectionsData`: `schemaVersion`, `editedAt`, `onboarded`, `startingAge`, `cases`, `entities`,
  `recentCaseIds`). Chosen over cases / entities tables (the user's idea, kept after talking it through) because the data is
  private, small (well under 100 KB) and always loaded whole: the engine needs all of it.
  - Not one object for all apps: every app would load and overwrite every other app's data.
  - Sharing a case with another user would need tables. The user said to build as if that never happens.
- **Server:** table `app_data`, one row per `(user_id, app)`: `data` (jsonb), `version`, `updated_at`. This app's `app` is `"projections"`.
  - Row level security: a signed-in user reaches only their own rows; signed-out reaches nothing.
  - A trigger owns `version` (1 on insert, +1 on every update) and `updated_at`, so a client can't set them.
  - A save is "update where version = the one I last saw". No row changed = another device saved first.
- **Phone:** AsyncStorage key `projections:<userId>` holds a `LocalSlot` `{ data, uploadWaiting, syncedVersion }`.
  - One slot per user, so switching accounts never overwrites anyone's data (a slot with uploads waiting just sits until
    that user signs back in). Slots are never deleted: they're small (the user's call).
  - `uploadWaiting` = the phone has changes the server doesn't. It is set by a change, never by a failed download.
- **The phone is the main copy** (the app must work offline). Every change goes through `change()` in `AppDataContext`:
  update state, save the slot, upload 2 seconds after the last change (`UPLOAD_DELAY_MS`). Not a timer: only changes upload.
  - It also syncs when the app goes to the background or comes back, and before signing out (`syncNow`).
- **Sync rules** (`nextSyncStep`, tested in `tests/syncTest.ts`):
  - Nothing waiting, server's version moved → take the server's copy.
  - Something waiting, server's version unchanged → upload.
  - Both changed → the copy with the later `editedAt` wins and the other's changes are dropped, without asking (the user's call).
  - `editedAt` is stamped by the device that made the change, and always moves forward (`nextEditedAt`), so a phone with a slow clock can't lose to its own older copy.
- **App start:** show the phone's slot at once, then sync in the background. No slot (first time on this phone) → read the row
  from the server; no row → a new account. No slot and no connection → a "Connect to load your data" screen with a retry.
- **Failures:** no connection, 401, 408, 429 and 5xx mean "try again later" and are quiet. Anything else from Supabase is a bug and throws.
- **Saved data is checked when read** (from the phone and from the server) and throws on anything malformed. `recentCaseIds` is the
  exception: it's a convenience, so anything wrong is dropped.
- **Changing the object's shape:** add 1 to `SCHEMA_VERSION` and upgrade older objects in `checkProjectionsData`. Until then, a
  different version throws.
- **Data from before accounts** (AsyncStorage keys `cases`, `entities`, `startingAge`, `recentCaseIds`) is given to the first
  brand new account that signs in on the phone, then removed (`readLegacyData`). Delete that code once nobody has such a phone.
- **`onboarded` is in the object,** so it follows the account to every phone.
- **Recent cases** (`recentCaseIds`): caseIds, most recently used first, each at most once. `saveCase` and `saveEntity` move
  their case to the front; `deleteCase` takes it out. The context only hands out `defaultCaseId`: the first recent case that
  still exists, else the top case by `caseIndex`, else null.
- **`ThemeContext`** stores `themeMode` (`system | light | dark`, default system) on the phone only: it's needed before anyone signs in.
- **The Supabase URL and publishable key are constants in `Sync/supabase.ts`,** not env vars: both are public, and a constant
  can't go missing from an EAS build.
- **Async errors** are put in state, then thrown during render, so they surface instead of failing silently.

## Engine (`Engines/`, plain TS; rules in `../CLAUDE.md`)
- **Call:** `masterEngine({ startingAge, cases, entities })` → `{ startingAge, computedCases }`. Each entity's engine gets only `inputs` + `ctx {caseId, startAge}`; one `coahe()` call per case.
- **Linking problems throw for the whole call** (bad arrays, missing / duplicate IDs, an entity with no case). **Everything else only fails its own case:** `error` set, `chartOfAccountsHistory` null.
- **Don't store histories.** About 1.1 MB per case; recomputing takes about 5 ms per case. The inputs are tiny.

## Outcomes (`Engines/outcomes.ts`, `app/(tabs)/outcomes.tsx`)
- **Flow:** `masterEngine` (cases sorted by `caseIndex`), then `outcomeSeries(history, outcomeKey, months)` per case. Nothing is stored.
  - A sync that takes the server's copy swaps in new arrays, so Outcomes re-runs. An upload doesn't touch them.
- **The engine only runs while the Outcomes tab is showing** (`usePathname() === "/outcomes"`), and only when startingAge, cases or entities are not the same objects as last time. Every tab stays mounted, so running it on every edit slowed the whole app (the user noticed).
  - The result is held as a `Projection` (computed cases + the data they came from). Out of date → a spinner where the chart goes.
  - The run is in a `setTimeout(0)` so the spinner is on screen first.
- **Every outcome is one rule** (`OUTCOME_RULES`): accounts to add up, `credit` (flip the sign: income is held as −) and `perMonth`.
  - A balance outcome is the sum as it stands that month. A per-month outcome is this month's sum − last month's, because income and expense accounts are running totals that never reset.
- **The seven:**
  - Net Worth = accounts 0–39 (debts are −, so they subtract).
  - Liquid Cash = account 1.
  - Liquid Cash + Investments = 1 + 4–12. Retirement (3) isn't liquid.
  - Expenses per Month = 70 and up, except vehicle depreciation (83).
  - Income per Month = 50 (gross pay; taxes are expenses).
  - Income + Gains per Month = 50 + 51.
  - Income + All Gains per Month = 50 + 51 + 53 (adds retirement gains; the user asked for it).
- **Value changes are in net worth only:** appreciation (52), retirement gains (53), vehicle depreciation (83). No money moves. Same for loan principal, down payments and moving money into an investment.
- **Why account 53 exists:** retirement gains used to share 51, so "gains on liquid investments" couldn't be read from a history.
- **Different lengths:** `months` pads a series (a balance holds; a per-month number is 0). The screen pads every case to the longest, so every line runs the whole chart.
  - Tried and undone (the user's call): stopping each line at its own case's end. A case with only opening cash is one month long and had no line at all.
  - Known look: a per-month line drops to 0 where a case's entities stop. That is what the inputs say.
- **Month 0** is the opening balances. A per-month outcome there is only what posted in month 0.
- **Failed cases** get a card each above the chart (case, entity, the engine's message without its `[source]` prefix).

## Outcomes chart (`components/outcomeChart.tsx`, `components/chartMaths.ts`)
- **Skia, chosen with the user over react-native-svg.** Kept as simple as possible (the user's wish): one `Canvas`, no chart library, no animation.
- **On the canvas:** grid lines, one `Path` per case, the selector line, two circles per case (a surface-colored ring, then the dot). **Not on it:** the dollar and age labels, which are normal `Text` (no Skia fonts; theme classes work).
- **x:** every month, 0 to the longest case's last. Every month is a point (the user: "everything is based on months").
- **y:** `yAxisFor(min, max)`: always includes 0, goes below it when the data does, round steps (1, 2 or 5 × a power of ten).
- **The selector is plain React state** (`pickedMonth` in `OutcomesView`; null = the last month). The paths are in a `useMemo` that doesn't depend on it, so a drag only redraws the line, the dots and the rows.
- **Dragging:** a transparent View over the chart with a `PanResponder`. x = where the finger landed (`locationX`) + how far it moved (`dx`). It sets `swipeLocked` the moment the finger lands.

## Drag to reorder (`components/reorderableGrid.tsx`)
- **Hand-built with `PanResponder` + `Animated`,** like every gesture in the app. No gesture-handler.
- **Not a FlatList:** a ScrollView with absolutely positioned cards. Every cell is the same size, so slot → x / y is maths. Lists are small, so no virtualization.
- **Each card has an animated x / y kept per key.** During a drag a working copy of the order changes; cards whose slot changed spring to it.
- **Scrolling is off during a drag,** because a JS responder can't stop the native scroll on iOS. So is tab swiping.
- **The expanded panel** (`expanded` prop, columns = 1 only; a case's entities) is the one exception to equal cells.
  - It's drawn before the cards (so they sit on top), its top `overlap` px behind its card. The grid measures its height and pushes every later card down by height − overlap, so a slot is still maths.
  - It closes while a card is dragged and comes back on drop.
- **Saving:** `reorderCases(caseIds)` rewrites `caseIndex`. `reorderEntities(entityIds)` gets only the shown group's ids and swaps them among the places they already hold, so other types don't move.

## Gotchas found the hard way
- **`TabList` must be a direct child of `Tabs`** (a Fragment is OK). Wrapped in a View, expo-router throws "Couldn't find any screens for the navigator". Extras for the bottom menu (the marker) go inside the `TabList`'s own View.
- **A child of `TabList asChild` (or any expo-router `Slot`) can't take an array of styles.** Spread the pieces into one object.
- **`TabTrigger` injects `style={{flexDirection:'row', justifyContent:'space-between'}}`** into its child, and `TabList` defaults to space-between. `TabButton` drops that style; the `TabList` View sets its own row style.
- **NativeWind on `Animated.View` is unverified.** Animated views get plain styles; put classes on an inner View.
- **`active:` works on Pressable in NativeWind v4.** Focus outlines use `onFocus` / `onBlur` state, because the box isn't the TextInput.
- **Dark-mode lift is a top border.** Don't combine it with a colored border on the same view (see `ActionWell`, `CaseCard`, `FloatingRow`).
- **`overflow-hidden` clips iOS shadows.** A view that needs a shadow and clipping uses two views (see the dropdown lists).
- **The edit popup's height cap is in px, not %,** so the keyboard doesn't shrink it.
- **`KeyboardAvoidingView` snapped the edit popups up and down** (the user found it uncomfortable). `PopupLayer` listens for the keyboard itself and animates its own bottom padding instead (see Popups and the keyboard).
- **Installing packages:** use `npx expo install`. `react-dom` is pinned to match React (19.2.3) to avoid an npm peer conflict.
- **Test helpers with default params:** passing `undefined` triggers the default. Call `masterEngine` directly to test a missing argument.
