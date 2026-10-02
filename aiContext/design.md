# Design

Sources: `../../ColorsGuide.md` and `../../FontsGuide.md`. A reference design the user pasted (EntityCard / EditEntityCard / theme) was adopted for its look, not its code.

## Theme mechanics
- **`components/theme.ts` is the only place hex values live:** the light and dark palettes, case colors and lift.
- **Classes switch with the theme on their own:**
  - `tailwind.config.js` maps every color class to `rgb(var(--token) / <alpha-value>)`.
  - `ThemeProvider` sets those vars on the root View (NativeWind `vars()`).
  - So never write `dark:` classes.
- **Where a class can't reach** (icon colors, placeholders, shadows): use `const { colors, lift, scheme } = useTheme()`.
- **Tokens:** canvas, surface, inset, hairline, edge, slate, charcoal, ink, muted, onDark, onAccent, danger, and accent `{DEFAULT, tint, ink}`.
- **The app accent is sky.** Change it in `theme.ts`.
- **Case colors** are the 11 guide accents (`CASE_COLORS`). Helpers: `caseColorName`, `withAlpha`, `textOnColor`.
- **Fonts:** classes `font-inter`, `font-inter-medium`, `font-inter-semibold`, `font-inter-bold`. Don't use `font-bold`.

## Rules in use
- **Fill vs outline:** fill what matters, outline what's secondary.
  - Entity tiles are outlined (1.5px edge).
  - Case cards are filled, with a lift.
  - Primary buttons are filled accent. Cancel is outlined.
- **Pressables:** every one gets a lift (light: soft shadow; dark: 1px lit top edge) and `active:opacity-*` feedback.
  - Anything that opens something else gets a chevron.
- **Accent goes only on small things:** buttons, the active tab icon, selected segments and rows, focus outlines.
- **Inputs:**
  - Filled `bg-inset`, h-14, rounded-2xl.
  - Accent outline on focus.
  - On invalid input: a danger outline plus plain error text (`ERRORS` in formFields).
  - Dollar amounts format with commas when you leave the box.
- **Hidden** = faded text (0.45) plus a case-color outline and tint on the hide button.
- **Destructive actions confirm first** (`ConfirmDialog`). A case delete says how many entities go with it.
- **Haptics:** grip pick-up, the hide toggle, delete confirm, and opening the edge tab.
- **Empty states** say why the list is empty and what to do next, with a button where one makes sense.
- **Accessibility:** every icon button has an `accessibilityLabel` and role.

## Components (details in appMap.json)
- **TopBar:** a large section title from the pathname, plus a settings button. It sits on the canvas with no box.
- **Bottom menu:** `TabButton` shows an icon over its label. The active one has a filled accent icon.
- **EntityCard:** always square, and everything scales with its width.
  - The name runs up to 2 lines, then the type and case (with a dot) below.
  - The bottom quarter holds delete / hide / edit wells on the left three-quarters and the grip on the right.
  - Holding the grip lifts the card 10%.
- **CaseCard:** full width.
  - A 10px case-color bar runs down the left edge.
  - Middle: the name, then "Color · N entities", then the wells (Edit is wider, with a chevron).
  - The grip sits on the right and lifts the card 3%.
- **EditEntityCard:** a sheet that slides up.
  - A slate header block shows the type plus "New …" / "Edit …", and a close X.
  - Body: name, case dropdown, a "Details" divider, then the type's own fields.
  - Footer: Cancel plus a wider Add/Done.
- **EditCaseCard:** a centered landscape popup.
  - A color stripe across the top previews the chosen color.
  - Body: name and color dropdown side by side. Footer: Cancel and Done.
- **EntityTypesMenu:** a left panel with the types in 2 groups ("What you have now" = codes 01–08, "Plans & spending") and counts.
  - Close it with the X, a tap on the dimmed area, or a swipe left.
- **EdgePullTab:** a tab on the left edge with an arrow. Pull it, swipe from the edge, or tap it to open the type menu.
- **Shared pieces:**
  - `cardControls` (ActionWell, GripHandle)
  - `formFields` (Field, TextField, NumberField, AgeField, CaseDropdown, ColorDropdown, Segmented, parsers)
  - `screenParts` (AddButton, EmptyState)
  - `confirmDialog`

## Building a new edit entity card
1. Copy `components/(editEntityCards)/editExistingHomeCard.tsx`.
2. Keep each input's text in `useState`, parse it with the `parse*` helpers, and set `canSubmit` from those results.
3. On submit, build the typed input from `types.ts` and call `saveEntity` with `makeEntityId(type)` for a new entity, then `onClose()`.
4. Register it in `components/(editEntityCards)/index.ts`. The Add button turns on automatically for that type.
