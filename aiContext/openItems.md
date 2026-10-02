# Open items

## Undecided (ask the user)
- **`startingAge`:** store it as an age `{years, months}`, or as a birthday? It's not stored anywhere yet. It should sit beside cases and entities.
- **One storage object:** switch to a single `{ startingAge, cases, entities }` under one key? I recommended it: one write means a case and its entities can't get out of sync. The user hasn't said yes.
- **What `isHidden` does to projections** (entities and cases). Right now it's UI only.
- **Add button placement:** it's in each screen's toolbar row. The user once said "in the top bar"; doing that means the shared TopBar has to talk to the open screen.

## Not built
- **Drag to reorder:**
  - Entities: rewrites the entities array order.
  - Cases: rewrites `caseIndex`.
  - Only the lift animation exists now (grip callbacks `onPickUp` / `onPutDown`).
- **21 of the 23 edit entity cards.** Built so far: `openingCash` (file `editExistingCashCard.tsx`) and `existingHome`. The rest are listed in appMap.json.
- **Outcomes screen:** run `masterEngine` and chart the cases side by side by age.
- **Undo** for deletes (deletes confirm, but can't be undone).

## Known risks
- **Deleting a case** writes cases, then entities, under two keys. If the app dies in between, orphan entities are left, and the engine throws on them. The one-storage-object switch fixes this.
- **Nothing has been seen running on a device in this session.** Everything is type-checked and bundles, but visuals and gestures (edge pull, swipe to close, grip) are unverified on hardware.
