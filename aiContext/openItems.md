# Open items

## Needs the user (dashboards the AI can't reach)
- **Google sign-in won't work until:** a Google Cloud OAuth client (type "Web application", redirect URI
  `https://vwefydubhejeocprbzec.supabase.co/auth/v1/callback`) exists; the Google provider is on in Supabase with its id and secret;
  and `collegiateprojections://**` is on Supabase's Redirect URLs list. All three are done (the user, 2026-10-06).

## Not confirmed on a phone (the AI can't run the app)
Confirmed by the user: drag to reorder. Not recorded as confirmed when these were written:
- **Chart drag vs tab swipe:** does a fast sideways flick on the chart ever change tab? The swipe lock is set when the finger lands, which should beat the pager, but it's a race. Look in `outcomeChart.tsx`'s `PanResponder`.
- **Scrolling an edit popup hides the keyboard,** and the popup then slides back down. The user wants the keyboard to stay up while scrolling. One fix was tried and undone (decisions.md → Popups and the keyboard); not solved yet.
- **The whole walkthrough:** that each target sits exactly on its control, the swipes, the hints' positions, that the coach card
  doesn't cover what matters on a small phone, and the popups.
- **Everything about accounts and sync:** sign in, sign up, onboarding, sign out, the guarded screens landing on the right
  screen, offline edits uploading later, two devices. The rules and the database are tested; the screens' flow is not.
- **The 20 newest edit cards** (all but the first three built), and the pull-out type menu.

## Undecided (ask the user)
- **The example cases' contents** were picked by the AI (`exampleCases.ts`). They are thin (cash, a $55,000 salary, food, housing),
  so both end up very rich, and their net worth lines sit close together, which makes a dull first chart. The user said they'd refine them.
- **The walkthrough's words and look** are a first pass (the user: "we will refine this").
- **Email confirmation** is on (Supabase's default). The emailed link opens the project's Site URL, which isn't set up, so the user
  sees a dead page (the account is still confirmed, and the app says to come back and sign in). A deep link back into the app would fix it.
- **Where the database's SQL lives:** only in Supabase's migration history. Every Collegiate app shares the database, so its own repo may suit it.
- **Nothing shows whether uploads are waiting.** A "not backed up yet" hint was not asked for.
- **What the outcomes count** was picked by the AI (all in `OUTCOME_RULES`, one line each to change):
  - Income is gross pay, with taxes counted as expenses. Take-home pay is the other option.
  - Vehicle depreciation is not an expense (a value change, like home appreciation isn't income).
  - Retirement (account 3) is not a "liquid investment", and its gains are only in "Income + All Gains".
- **Per-month outcomes are spiky:** a one-time expense is one tall month and sets the top of the y-axis. The user chose monthly points; yearly totals are the fallback if it reads badly.
- **Sale ages aren't checked against the starting age in the cards.** An existing home or vehicle with a sell age before the starting age saves fine, then its case fails in the engine ("already sold") and shows as an error card on Outcomes.
- **`startingAge` is an age, not a birthday,** so it doesn't move forward as time passes. Ask if they'd rather enter a birthday.

## Not built
- **The real sign-in screen** (working boilerplate). No password reset, no "send the link again".
- **A `profiles` table** for what every Collegiate app shares (name, school): not made until it's known what goes in it.
- **Settings** beyond Appearance and Sign out.
- **Drag to reorder has no auto-scroll:** scrolling is off during a drag, so a card can only be dropped in a slot that's on screen.
- **Chart extras:** no zoom, pan or animation (kept simple on purpose). Nothing limits how many cases get a line and a row.
- **Undo** for deletes (they confirm, but can't be undone).

## Known risks
- **A conflict drops one device's changes whole** (the newer copy wins; the user's call). It needs two devices, one edited offline.
- **Taking the server's copy while an edit card is open:** if that copy no longer has the card's case, Save adds an entity with no
  case, and the engine throws on Outcomes. Needs two devices in use at the same moment.
