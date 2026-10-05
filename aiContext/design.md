# Design

Sources: `../../ColorsGuide.md` and `../../FontsGuide.md`. A reference design the user pasted (EntityCard / EditEntityCard / theme) was adopted for its look, not its code.

## Theme mechanics
- **`components/theme.ts` is the only place hex values live:** the light and dark palettes, case colors and lift.
- **Classes switch with the theme on their own:**
  - `tailwind.config.js` maps every color class to `rgb(var(--token) / <alpha-value>)`.
  - `ThemeProvider` sets those vars on the root View (NativeWind `vars()`).
  - So never write `dark:` classes.
- **Where a class can't reach** (icon colors, placeholders, shadows): use `const { colors, lift, scheme } = useTheme()`.
- **Tokens:** canvas, surface, bar (the top bar and bottom menu: white in light mode, a step lighter than surface in dark mode, because the user wanted the bars lighter), inset, hairline, edge, slate, charcoal, ink, muted, onDark, onAccent, danger, green (add buttons; its own green, not a guide accent), and accent `{DEFAULT, tint, ink}`.
- **The app accent is sky.** Change it in `theme.ts`.
- **Case colors** are the 11 guide accents (`CASE_COLORS`). Helpers: `caseColorName`, `withAlpha`, `textOnColor`.
- **Fonts:** classes `font-inter`, `font-inter-medium`, `font-inter-semibold`, `font-inter-bold`. Don't use `font-bold`.

## Rules in use
- **Fill vs outline:** fill what matters, outline what's secondary.
  - Entity tiles and case cards both have a border in their case color (fainter when hidden).
  - **Every case-color outline is `useTheme().caseBorderWidth` thick:** 1px in dark mode, 1.5px in light mode (`CASE_BORDER_WIDTHS` in `theme.ts`). That covers the cards, the edit popups and the line under the entity popup's header, the outcome rows and error cards, and the hide button's outline (1.5px dark, 2.25px light).
  - Case cards also get the lift in light mode only (the dark lift is a top border, which would cover the colored one).
  - Primary buttons are filled accent. Cancel is outlined.
- **Pressables:** every one gets a lift (light: soft shadow; dark: 1px lit top edge) and `active:opacity-*` feedback.
  - Anything that opens something else gets a chevron.
- **Accent goes only on small things:** buttons, the active tab icon, selected segments and rows, focus outlines.
- **Inputs:**
  - Filled `bg-inset`, h-14, rounded-2xl.
  - Accent outline on focus.
  - On invalid input: a danger outline plus plain error text (`ERRORS` in formParsing).
  - Dollar amounts format with commas when you leave the box.
- **Dropdowns float:** the list opens in its own transparent Modal lined up with the box (under it, or above when there's no room), so it overlays the form instead of pushing it taller. Tap outside to close.
- **Hidden** = faded text (0.45) plus a case-color outline and tint on the hide button.
- **Destructive actions confirm first** (`ConfirmDialog`). A case delete says how many entities go with it.
- **Haptics:** grip pick-up, the hide toggle, delete confirm, opening the edge tab, and holding a card to edit it.
- **Empty states** say why the list is empty and what to do next, with a button where one makes sense.
- **Accessibility:** every icon button has an `accessibilityLabel` and role.

## Components (details in appMap.json)
- **TopBar:** a `bar`-colored bar with a hairline under it, matching the bottom menu. Its settings button is a `canvas` well (an `inset` one would vanish on the dark bar). The tabs layout renders one; it stays still while the screens swipe.
  - Left: the Collegiate wordmark, 16 tall, in `ink` so it follows the theme. Middle: the page title. Right: settings. No plus in it.
  - The wordmark (`components/collegiateLogo.tsx`) is drawn with Skia from the paths of `assets/CollegiateLogo.svg`, copied into the file (no SVG package).
  - The list under it fills the rest of the screen (no toolbar row in the screens).
- **Floating row** (`FloatingRow` in screenParts, on Cases, Entities and Outcomes): floats over the top of the list, and the cards scroll under it. The list's top padding (`FLOATING_ROW_SPACE`) leaves room for it.
  - Left: a green plus, a 44 square. Then a bar of the same height filling the rest.
  - Every bar has a 1.5px `edge` outline (it's the same `surface` as the cards scrolling under it and blended in), and lifts in light mode only.
  - Cases bar: person icon, "Starting age", the age ("22 yrs 4 mos"; 20 yrs by default), chevron. Opens `EditStartingAgeCard` (same frame as EditCaseCard).
  - Entities bar: three lines, the group name, count, chevron. Opens the type menu.
  - Outcomes has no plus (leave out `onAdd`), so its bar fills the row: three lines, the outcome name, a down chevron. Opens the outcomes dropdown.
  - The Outcomes bar is `prominent` (the user asked): 54 tall instead of 44, a 1.5px `edge` outline, a bold `text-lg` name. Lists under it pad with `PROMINENT_ROW_SPACE`.
- **Outcomes loading:** a small muted `ActivityIndicator` centered where the chart goes, while the engine runs (each time you come to the tab after the data changed). The floating bar stays put.
- **Outcomes screen** (a vertical ScrollView under the floating bar):
  - Failed cases first: a card each, outlined in the case color: "… can't be projected", the entity (name and type) and the engine's message.
  - The chart in a surface card, 250 tall: a 2px line per case in its case color, faint grid lines (`hairline`; `edge` at $0), short dollar labels on the left ("$250k"), ages along the bottom with the word "Age" centered under them.
  - The selector: a 1.5px `ink` vertical line with a dot on each case's line. It starts at the oldest age; drag anywhere on the chart to move it.
  - Under the chart: the outcome's name and the age, "Net Worth at", and under it, bigger and bold, "age 45 years 3 months"; then one row per case outlined in its case color: dot, name, dollars at that age (a minus sign in front when negative).
- **Drag to reorder** (`ReorderableGrid`, used by both the cases list and the entities grid): hold a card's grip, drag, and the other cards slide out of the way like home-screen icons. Dropping saves the new order.
- **Lists always bounce,** even when the cards don't fill the screen (`alwaysBounceVertical`, `overScrollMode="always"`, content `flexGrow: 1`).
- **Bottom menu:** a floating, fully rounded bar (`rounded-full`, `bar` color, a 1.5px `edge` outline so it stands apart from the screen behind it, the light-mode shadow) laid over the bottom of the tab screens, like Instagram's. 16px of room on either side and a gap under it (`bottomMenuGap`), so the screen shows around it and scrolls behind it.
  - Every tab screen's scrolling content pads its bottom with `bottomMenuSpace(insets.bottom)` so the last card can be scrolled clear of the bar. A new tab screen must do the same.
  - `TabButton` shows only an icon (no label; the name is still read by screen readers). The active one has a filled ink icon (not accent). A small accent rounded bar (the marker, drawn by `(tabs)/_layout`) sits above the current tab's icon and slides between icons in step with the swipe.
- **EntityCard:** always square, and everything scales with its width.
  - The name runs up to 2 lines, then the type, then "Case:" with the case's color dot and name, then up to 2 facts in ink (the rest is muted).
  - The facts are the entity's main values, so it can be told apart without opening it: `entitySummary(type, inputs)` in `components/entitySummary.ts`. One `case` per entity type; keep each line to about 22 characters (the card is half a phone wide). Examples: "$320,000 at age 30" / "30 yr loan at 6.5%"; "Bought for $28,000" / "Owes $14,000"; "$72,000/yr" / "Until age 65".
  - It reads saved inputs, so a missing or wrong value drops that fact instead of throwing. An age window nobody set shows nothing (it runs the whole time).
  - The sizes are tuned so a 2-line name plus four small lines exactly fill the space above the buttons (padding 7%, name 11.5%, small lines 7% of the card's width). Adding a line means shrinking something.
  - The bottom quarter holds delete / hide / edit wells on the left three-quarters and the grip on the right.
  - Holding the grip lifts the card 10%; then drag it to reorder.
  - Holding the card anywhere else (not a button or the grip) opens its edit popup, same as Edit, with a light haptic.
- **CaseCard:** full width.
  - Middle: the name, then "Color · N entities", then the wells (Edit is wider, with a chevron).
  - The grip sits on the right and lifts the card 3%; then drag it to reorder.
  - Tap the card (not a button or the grip) to show its entities under it; a small chevron after the entity count points down (closed) or up (open). Only one case is open at a time; tapping the open one closes it.
- **CaseEntitiesPanel** (under an open case card): a rounded box, 92% of the card's width (almost as wide, per the user) and centered, outlined in the case color and filled with `inset` (the user wanted it a little lighter than the card in dark mode; `surface` matched the card exactly). Its top 20px is tucked behind the card so it reads as coming out of it, and it adds to the list's length (not a popup).
  - One row per entity, with an `edge` line between rows: name (bold), type, then the same facts as its entity card. A hidden entity is faded and says "Hidden". No buttons: entities are edited on the entities tab.
  - An empty case says "No entities in this case yet."
  - Holding the card anywhere else opens its edit popup, same as Edit, with a light haptic.
- **EditEntityCard:** a rounded popup centered on the screen: 80% wide, only as tall as it needs, at most 60% of the screen height (the body scrolls past that). The cap is in px so the keyboard doesn't shrink it; it only shrinks when the space above the keyboard is smaller.
  - Edit popups (entity and case) dim the screen behind them with `bg-black/70`. Tapping the dimmed area closes them (same as Cancel).
  - Both have a border in the case color, like the cards (the entity popup has none until a case is chosen).
  - The header (same canvas color as the body) shows the type plus "New …" / "Edit …", and a close X, with a line in the case color under it.
  - Body: name, case dropdown, a "Details" divider, then the type's own fields.
  - Footer: Cancel plus a wider Add/Done.
- **EditCaseCard:** a centered landscape popup.
  - Its border previews the chosen color (no stripe).
  - Body: name and color dropdown side by side. Footer: Cancel and Done.
- **AddOptionsMenu:** a small floating list under the floating row's plus, shown when a group has more than one type to add (Housing). Tap outside to close.
- **OutcomesDropdown:** a floating list under the Outcomes floating bar, as wide as the bar: the seven outcomes, the one showing tinted with a check. Outlined in 1px `edge` and, in dark mode, filled `inset` (one step lighter than the cards) so it stands out. Tap a row to switch, tap outside to close.
- **EntityTypesMenu** (a `SideMenu`; entities tab only): a rounded, outlined (1px `edge`) panel on the left, drawn by the tabs layout so it floats over both bars.
  - It is always on screen. Closed: 8px of its right edge shows, plus a small tab (14×44, arrow) joined to it.
  - The tab is part of the panel: pulling it drags the real menu out under the finger. One animated x moves the panel and fades the dim.
  - Open: an 8px gap to the screen edge; it overlaps the top bar and bottom menu by 6px (`TOP_BAR_HEIGHT`, `BOTTOM_MENU_HEIGHT`).
  - Open it by pulling the tab, swiping from the left edge, tapping the tab, or the floating picker. Close it by swiping left, tapping the tab or the dimmed area, or Android back.
  - No title, no X, no group headings. A solid line separates the existing types (codes 01–08) from the rest. Rows are entity groups (Housing = renting + buying) with counts.
- **Shared pieces:**
  - `cardControls` (ActionWell, GripHandle)
  - `formFields` (Field, TextField, NumberField, AgeField, AgeWindowFields, LoanAny3Fields, SectionLabel, Note, CaseDropdown, ColorDropdown, ChoiceDropdown, Segmented)
  - `formParsing` (the text ↔ number helpers and `ERRORS`; no React, re-exported by formFields)
  - `screenParts` (EmptyState)
  - `confirmDialog`

## Edit entity cards (all 23 are built)
Three pieces per entity type, all in `components/(editEntityCards)/`:
1. **A form in `entityForms.ts`** (no React): `read(saved)` turns saved inputs into the text in the boxes; `toInputs(text)` turns the text into the engine's inputs, or null while anything is missing or not valid. All the rules about what's valid live here.
2. **A card file** (`edit…Card.tsx`): calls `useEntityCard(props, type, form)` and draws the boxes from `card.text`, writing with `card.set("box")`.
3. **A line in `index.ts`** (`EDIT_ENTITY_CARDS` is a full `Record`, so a missing card won't compile).

Rules:
- **The boxes are exactly the engine's inputs for that type** (`types.ts`). Anything the engine works out from presets alone is not asked for (e.g. existing vehicle insurance).
- **An engine input with a preset fallback is an optional box:** blank saves null, and the placeholder shows the preset (buying a car's insurance / maintenance, buying a home's utilities, gas price, health premium, retirement return).
- **Fields masterEngine fills in are never asked for or saved:** investment `account`, income `retirementAccount`.
- **Two or three routes = a `Segmented` toggle** that hides the other route's boxes; hidden boxes save null. Used by: existing vehicle and buying a car (loan / paid in full), buying a home (mortgage / cash; cash saves a 100% down payment), education (loan / pay in full), other existing asset (no loan / has a loan), income tax (work it out / my own rate), birthdays and recurring payment (monthly / yearly).
- **More than four choices = `ChoiceDropdown`** (health insurance plan).
- **Existing loans use `LoanAny3Fields`:** any 3 of balance, rate, time left, payment.
- **Boxes check themselves:** `NumberField` (by `kind`) and `AgeField` show their own error once something is typed. Pass `error` only for a check across boxes (sell before buy, end before start).
- **New entities start blank,** except income's raise and investing's starting amount, which start at 0.

To add a card for a new entity type: add its form (and a sample in `tests/entityFormsTest.ts`), copy a small card such as `editRentingCard.tsx`, and register it in `index.ts`.
