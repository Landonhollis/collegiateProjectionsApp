# Open items

## Just built, not yet seen on a phone: the Outcomes chart
See decisions.md → Outcomes chart. Things to check with the user:
- **Does a sideways drag on the chart ever change tab?** The swipe lock is set when the finger lands, which should beat the pager, but it's a race.
- **Per-month outcomes are spiky:** a one-time expense is one tall month, and it sets the top of the y-axis. The user chose monthly points; yearly totals are the fallback if it reads badly.
- **Many cases:** every case gets a line and a row; nothing limits how many.

## Undecided (ask the user)
- **What the outcomes count** was picked by the AI, not the user (all in `OUTCOME_RULES`, one line each to change):
  - Income is gross pay, with taxes counted as expenses. Take-home pay is the other option.
  - Vehicle depreciation is not an expense (it's a value change, like home appreciation isn't income).
  - Retirement (account 3) is not a "liquidable investment", and its gains aren't in "Income + Gains" (they are in "Income + All Gains", which the user asked for).
- **Sale ages aren't checked against the starting age in the cards.** An existing home or vehicle with a sell age before the starting age saves fine, then its case fails in the engine ("already sold"). The Outcomes screen will need to show case errors.
- **`startingAge` is stored as an age, not a birthday,** so it doesn't move forward as time passes; the user has to update it. Ask if they'd rather enter a birthday.
- **One storage object:** switch to a single `{ startingAge, cases, entities }` under one key (they are three keys now)? I recommended it: one write means a case and its entities can't get out of sync. The user hasn't said yes.

## Not built
- **Drag to reorder has no auto-scroll:** scrolling is off during a drag, so a card can only be dropped in a slot that's on screen.
- **Chart extras:** no zoom, no pan, no animation when the outcome changes (kept simple on purpose).
- **Undo** for deletes (deletes confirm, but can't be undone).

## Known risks
- **Deleting a case** writes cases, then entities, under two keys. If the app dies in between, orphan entities are left, and the engine throws on them. The one-storage-object switch fixes this.
- **The AI can't run the app** (no simulator on the user's Mac). Everything is type-checked, bundled and tested, then the user tries it on their phone. They have confirmed drag to reorder works; the 20 newest edit cards, the floating row and the pull-out menu had not been confirmed when this was written.
