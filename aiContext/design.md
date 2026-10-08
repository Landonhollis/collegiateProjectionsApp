# Design

Sources: `../../ColorsGuide.md` and `../../FontsGuide.md`. A reference design the user pasted (EntityCard / EditEntityCard / theme) was adopted for its look, not its code. Files and props are in `appMap.json`.

## Theme mechanics
- **`components/theme.ts` is the only place hex values live:** the light and dark palettes, case colors, lift.
- **Classes switch with the theme on their own:** `tailwind.config.js` maps every color class to `rgb(var(--token) / <alpha-value>)`, and `ThemeProvider` sets the vars on the root View. Never write `dark:` classes.
- **Where a class can't reach** (icon colors, placeholders, shadows, Skia): `const { colors, lift, scheme, caseBorderWidth } = useTheme()`.
- **Tokens:** canvas, surface, bar, inset, hairline, edge, rowEdge (no class; `colors.rowEdge` only), slate, charcoal, ink, muted, onDark, onAccent, danger, green, accent `{DEFAULT, tint, ink}`.
  - Dark mode, back to front: `canvas` `#16191E` → `surface` `#242930` → `bar` `#2B3037` → `inset` `#31373E`. These are the
    standard (the user set them on 2026-10-08, darker than before, and had `ColorsGuide.md` changed to match).
  - `bar` (top bar, bottom menu): white in light mode, a step lighter than surface in dark mode (the user wanted the bars lighter).
  - `green` is for add buttons only. It's its own green, not a guide accent.
- **The app accent is sky.** Change it in `theme.ts`.
- **Case colors** are the 11 guide accents (`CASE_COLORS`). Helpers: `caseColorName`, `withAlpha`, `textOnColor`.
- **Fonts:** `font-inter`, `font-inter-medium`, `font-inter-semibold`, `font-inter-bold`. Don't use `font-bold`.

## Rules in use
- **Fill vs outline:** fill what matters, outline what's secondary. Primary buttons are filled accent; Cancel is outlined (1.5px `edge`).
- **Case-color outlines** go on entity tiles, case cards, the case entities panel, edit popups (and the line under the entity popup's header), outcome rows and error cards.
  - All are `caseBorderWidth` thick: 1px dark, 1.5px light (a thin colored line gets lost on white). The hide button's active outline is 1.5× that.
- **Pressables** get a lift (light: soft shadow; dark: 1px lit top edge) and `active:opacity-*` feedback. Anything that opens something else gets a chevron.
  - A view with a colored or `edge` border lifts in light mode only (the dark lift would cover the border).
- **Accent goes only on small things:** buttons, the tab marker, selected segments and rows, focus outlines.
- **Inputs:** filled `bg-inset`, h-14, rounded-2xl. Accent outline on focus; danger outline plus plain error text when invalid (`ERRORS` in formParsing). Dollar amounts get commas when you leave the box.
- **Dropdowns float:** the list opens in its own transparent Modal lined up with the box (under it, or above when there's no room), so it overlays the form instead of pushing it taller. Tap outside to close.
- **Popups dim the screen:** edit popups 70% black (tap the dim to close, same as Cancel); the confirm dialog `bg-black/40` (buttons only).
- **Hidden** = faded text (0.45), a fainter outline, and a case-color outline and tint on the hide button.
- **The keyboard:** an edit popup glides up after it and back down (a little slower than the keyboard, on purpose), staying centered in the space above it.
- **Only Add / Save saves.** Cancel, the X and the dim all close without saving.
- **Destructive actions confirm first** (`ConfirmDialog`: Cancel on the left, danger-filled confirm). A case delete says how many entities go with it.
- **Haptics:** grip pick-up, hide toggle, delete confirm, opening the type menu, tapping a case card, holding a card to edit it.
- **Empty states** say why the list is empty and what to do next, with a button where one makes sense.
- **Lists always bounce,** even when the cards don't fill the screen.
- **Accessibility:** every icon button has an `accessibilityLabel` and role.

## Screen frame
- **TopBar:** `bar`-colored with a hairline under it. Left: the Collegiate wordmark (16 tall, `ink`, drawn with Skia from the paths of `assets/CollegiateLogo.svg`). Middle: the page title. Right: settings, a `canvas` well (an `inset` one would vanish on the dark bar). One instance; it stays still while the screens swipe.
- **Bottom menu:** a floating, fully rounded bar (`bar` color, 1.5px `edge` outline, light-mode shadow) laid over the bottom of the tab screens, like Instagram's. 16px either side and a gap under it (`bottomMenuGap`).
  - Icons only. The active one is a filled `ink` icon (not accent). A small accent bar (the marker) sits above it and slides in step with the swipe.
  - Every tab screen's scrolling content pads its bottom with `bottomMenuSpace(insets.bottom)`. A new tab screen must do the same.
- **Floating row** (`FloatingRow`, on all three tabs): floats over the top of the list; the cards scroll under it. Lists pad their top with `FLOATING_ROW_SPACE`.
  - A `surface` bar, 54 tall on all three screens, with a `rowEdge` outline (1.5px in light mode, 1px in dark mode) (it's the same color as the cards scrolling
    under it), filling the row. `rowEdge` is its own token: `edge` in light mode; in dark mode the same as `ink`,
    the text color (`#F2F3F5`; the user asked, after trying lighter greys, so the three bars are easy to notice). Then, on the right, a green plus: a 54 square. The bars were 44 on Cases and Entities; the user had
    them made about 25% taller, to match Outcomes, so they're hard to miss.
  - The plus is on the right for the thumb (the user's call). Tried and undone: on the left of the bar, and a 56px button in the bottom right corner above the bottom menu.
  - Cases bar: person icon, "Starting age", the age ("22 yrs 4 mos"), chevron. Opens `EditStartingAgeCard`.
  - Entities bar: made to stand out (the user's call), because it's the only way to the other entity types. In the middle:
    the group name in bold 22px with a down chevron (22, `ink`) right beside it, to say it opens a list. Nothing else: no icon
    on the left, no count, no right chevron (the counts are still on the menu's rows). Opens the type menu.
    Tried and undone (the user's call): outlining it in the `accent`. Its outline is the same as the other two bars'.
    Tried and undone (the user: "it looks off"): filling the bar in `edge` with no outline.
  - Outcomes bar: no plus. Three lines, a bold `text-lg` name, a down chevron. Opens the outcomes dropdown.


## Cards
- **EntityCard:** always square; everything scales with its width.
  - Top: the name (up to 2 lines), the type, "Case:" with the color dot and name, then up to 2 facts in `ink` (the rest is `muted`).
  - The sizes are tuned so a 2-line name plus four small lines exactly fill the space above the buttons (padding 7%, name 11.5%, small lines 7% of the width). Adding a line means shrinking something.
  - Bottom quarter: delete / hide / edit wells on the left three-quarters, the grip on the right.
  - Hold the grip → the card lifts 10%, then drag to reorder. Hold anywhere else → its edit popup (light haptic).
- **Facts** (`entitySummary(type, inputs)`): the entity's main values, so it can be told apart without opening it. One `case` per type; keep each line to about 22 characters. Examples: "$320,000 at age 30" / "30 yr loan at 6.5%"; "$72,000/yr" / "Until age 65". A missing or wrong value drops that fact instead of throwing.
- **CaseCard:** full width. The name, then "Color · N entities" and a small chevron (down = closed, up = open), then the wells (Edit is wider, with a chevron). The grip is on the right and lifts the card 3% (10% would push it off-screen).
  - Tap → its entities show under it (one case open at a time; not saved). Hold → its edit popup.
- **CaseEntitiesPanel:** a rounded box under the open case card, 92% of its width, outlined in the case color and filled `inset` (the user wanted it a little lighter than the card in dark mode). Its top 20px is tucked behind the card, and it adds to the list's length (not a popup).
  - One row per entity with an `edge` line between: name, type, the same facts as its card. Hidden ones are faded and say "Hidden". No buttons: entities are edited on the entities tab.

## Popups and menus
- **EditEntityCard** (the frame for all 23): centered, 80% wide, only as tall as it needs, at most 60% of the screen height (the body scrolls past that).
  - Outlined in the chosen case's color (none until a case is chosen).
  - Header: the type, "New …" / "Edit …", a close X, then a line in the case color. Body: name, case dropdown, a "Details" divider, the type's own fields. Footer: Cancel plus a wider Add / Save with a chevron.
- **EditCaseCard:** a centered landscape popup. Its border previews the chosen color. Name and color dropdown side by side; Cancel and Save.
- **EditStartingAgeCard:** the same frame without the colored border: years + months, Cancel and Save.
- **The "i" guide button:** a small `information-circle-outline` icon in `accentInk` right after a box's label. It closes the keyboard and opens `CostGuidePopup`.
- **CostGuidePopup:** a card centered over the edit popup, at most 75% of the screen tall (the body scrolls), outlined in 1px `edge` and filled `inset` in dark mode (like the outcomes dropdown), over a 40% dim. Close with the X or a tap outside.
  - Header: info icon, title, X. Body: one line of what it is, the tables, "Good to know" bullets, then the sources in small muted text.
  - Tables: a rounded hairline box; row names on the left, up to 3 right-aligned number columns (more won't fit a phone). No cell wraps.
- **AddOptionsMenu:** a small floating list under the plus (right-aligned with it), for a group with more than one type to add (Housing).
- **OutcomesDropdown:** a floating list under the Outcomes bar, as wide as the bar. The outcome showing is tinted with a check. Outlined in 1px `edge`; filled `inset` in dark mode so it stands out.
- **EntityTypesMenu** (a `SideMenu`): a rounded, outlined (1px `edge`) panel on the left, floating over both bars.
  The panel and its tab are filled `canvas`, the page's own color, not `surface` (the user asked).
  Tried and undone (the user: "also looks off"): filling the panel and its tab in `edge` with no outline. An `edge` fill
  has now been dropped on both the entities bar and this menu, so don't suggest it again.
  - Always on screen. Closed: 8px of its right edge shows, plus a small tab (14×44, arrow) joined to it. Open: an 8px gap to the screen edge, overlapping the top bar and bottom menu by 6px.
  - The tab is part of the panel: pulling it drags the real menu out under the finger. One animated x moves the panel and fades the dim.
  - Open: pull or tap the tab, swipe from the left edge, or the floating bar. Close: swipe left, tap the tab or the dim, Android back.
  - No title, no X, no headings. Rows show counts. Plans and spending are on top, starting with Income; a line; then the
    existing types (codes 01–08) at the bottom (the user's call). Income is the group showing when the app starts.

## Outcomes screen
- A vertical ScrollView under the floating bar. While the engine runs: a small muted spinner where the chart goes.
- **Failed cases first:** a card each, outlined in the case color: "… can't be projected", the entity (name and type), the engine's message.
- **Chart:** in a `surface` card, 250 tall. A 2px line per case in its color, faint grid lines (`hairline`; `edge` at $0), short dollar labels on the left ("$250k"), ages along the bottom with "Age" centered under them.
- **Selector:** a 1.5px `ink` vertical line with a dot on each case's line. It starts at the oldest age; drag anywhere on the chart to move it.
- **Under the chart:** "Net Worth at", then bigger and bold "age 45 years 3 months"; then one row per case outlined in its color: dot, name, dollars at that age (a minus sign in front when negative).

## Onboarding walkthrough
- **The guide is deliberately unlike the app:** nothing else in the app is a filled accent shape with a point.
- **Callout:** a box filled `accent`, corners rounded 18 on one side, the other side pushed out 22px into a point. Text is
  `onAccent`: "STEP 3 OF 10" small caps, an underlined "Skip", a thin dark progress bar, a bold title, then a line or two.
- **Arrow:** the same accent, 9px thick with a 22 × 28 head, growing out of the callout's point and curving to stop 8px short
  of the thing to press. On swipe steps it's short and straight, pointing right: where the user is going (the next screen), not the way the finger moves (the user's call).
- **Target:** a 2.5px accent ring on the control to press, and a second ring pulsing out from it.
- **Swipe and drag hint:** an accent circle with a hand, sliding right to left (swipe) or back and forth (drag the chart).
- **"Next":** a dark (`onAccent`) pill with accent text inside the callout, faded until the box is filled in.
- **Locked boxes** are faded to 55%.
- **The end:** a full-width, fully rounded accent "Start using the app" button where the bottom menu is.

## Edit entity cards
Three pieces per entity type, all in `components/(editEntityCards)/`:
1. **A form in `entityForms.ts`** (no React): `read(saved)` → the text in the boxes; `toInputs(text)` → the engine's inputs, or null. All the rules about what's valid live here.
2. **A card file** (`edit…Card.tsx`): calls `useEntityCard(props, type, form)` and draws the boxes from `card.text`, writing with `card.set("box")`.
3. **A line in `index.ts`** (`EDIT_ENTITY_CARDS` is a full `Record`, so a missing card won't compile).

Rules:
- **The boxes are exactly the engine's inputs for that type** (`types.ts`). Anything the engine works out from presets alone is not asked for.
- **An input with a preset fallback is an optional box:** blank saves null, and the placeholder shows the preset (a car's insurance / maintenance, a home's utilities, gas price, health premium, retirement return).
- **Utilities start filled in** on a new renting or buying entity with the average bill (`HOME.utilitiesMonthly`, about $427), so nobody has to look one up (the user asked). Renting has no preset in the engine (blank = none), so there the filled-in number is what's saved.
- **Fields masterEngine fills in are never asked for or saved:** investment `account`, income `retirementAccount`.
- **Two to four routes = a `Segmented` toggle** that hides the other route's boxes; hidden boxes save null (loan / paid in full, mortgage / cash, monthly / yearly, work out tax / my own rate, …).
- **More than four choices = `ChoiceDropdown`** (health insurance plan).
- **Existing loans use `LoanAny3Fields`:** any 3 of balance, rate, time left, payment.
- **Boxes check themselves:** `NumberField` (by `kind`) and `AgeField` show their own error once something is typed. Pass `error` only for a check across boxes (sell before buy, end before start).
- **A loan / pay in full toggle starts on pay in full** for a new vehicle (existing or buying) or education, so debt is a choice, not the default (the user asked). Buying a home still starts on Mortgage.
- **Yearly returns** (investing, existing investment, retirement) use `kind="returnPercent"`: the number pad, per the user. It has no minus key, so a negative return can't be typed there. Income's raise and an asset's appreciation keep `signedPercent` and the punctuation keyboard.
- **A box people can't be expected to know gets a guide:** pass `guide` to its `NumberField` (kid cost, groceries, dining out, pet food, pet vet). To add one, write a `CostGuide` in `costGuides.ts` with its sources.
- **New entities start blank,** except the name (the type's label), the case (the one used last), housing's utilities (the average), income's raise and investing's starting amount (both 0).
- **Labels are one or two words;** the detail goes in the `hint` on the right ("per month, blank = average").

To add a card for a new entity type: add its form (and a sample in `tests/entityFormsTest.ts`), copy a small card such as `editRentingCard.tsx`, and register it in `index.ts`.
