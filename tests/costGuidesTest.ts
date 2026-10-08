// costGuidesTest.ts: the spending guides behind the "i" buttons (TypesAndVariables/costGuides.ts).
// Hand calcs from the source numbers, and every table is well formed.
// Run: npx tsx tests/costGuidesTest.ts
import {
  DINING_OUT_GUIDE, GROCERIES_GUIDE, KID_COST_GUIDE, PET_FOOD_GUIDE, PET_VET_GUIDE,
  diningOutMonthly, groceriesMonthly, kidYearlyCosts, type CostGuide,
} from '../TypesAndVariables/costGuides';

let passed = 0;
let failed = 0;
function check(ok: boolean, what: string) {
  if (ok) passed++;
  else { failed++; console.log(`FAIL: ${what}`); }
}
const same = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i]);
const approx = (a: number, b: number, within: number) => Math.abs(a - b) <= within;

// ── Groceries: USDA July 2026. Man 317.40 / 398.70 / 487.50, woman 276.10 / 337.10 / 430.20,
//    child 6–8 262.80 / 305.10 / 357.00, child 9–11 271.60 / 350.20 / 408.20.
// 2 adults + 2 kids (no size change): 317.4 + 276.1 + 262.8 + 271.6 = 1,127.90 → 1,130; 1,391.10 → 1,390; 1,682.90 → 1,680.
check(same(groceriesMonthly(2, 2), [1130, 1390, 1680]), 'groceries: 2 adults + 2 kids is the sum of the four USDA costs');
// 1 adult (+20%): (317.4 + 276.1) / 2 × 1.2 = 356.10 → 360; 367.9 × 1.2 = 441.48 → 440; 458.85 × 1.2 = 550.62 → 550.
check(same(groceriesMonthly(1, 0), [360, 440, 550]), 'groceries: 1 adult adds 20%');
// 2 adults (+10%): 593.5 × 1.1 = 652.85 → 650; 735.8 × 1.1 = 809.38 → 810; 917.7 × 1.1 = 1,009.47 → 1,010.
check(same(groceriesMonthly(2, 0), [650, 810, 1010]), 'groceries: 2 adults adds 10%');
// 2 adults + 3 kids (−5%): (593.5 + 3 × 267.2) × 0.95 = 1,325.35 → 1,330.
check(groceriesMonthly(2, 3)[0] === 1330, 'groceries: 5 people take off 5%');
let threw = false;
try { groceriesMonthly(4, 4); } catch { threw = true; }
check(threw, 'groceries: a household size with no USDA factor throws');

// ── Dining out: BLS 2024 × the South's share (3,501 / 3,945) × prices since (390.710 / 363.289), per month.
// 1 person: 2,249 × 0.88745 × 1.07548 / 12 = 178.9 → 180; half 89.4 → 90; double 357.8 → 360.
check(same(diningOutMonthly(2249), [90, 180, 360]), 'dining out: one person');
// Couple with kids 6–17: 6,177 × 0.88745 × 1.07548 / 12 = 491.3 → 490; half 245.6 → 245; double 982.6 → 985.
check(same(diningOutMonthly(6177), [245, 490, 985]), 'dining out: couple with school-age kids');

// ── Kids: USDA 2015 urban South, middle income, age 0–2: clothing 860, health 1,120, care and school 2,970, misc 760.
// × apparel 1.0909, medical 1.3086, tuition and childcare 1.3468, recreation 1.2389 = 938 + 1,466 + 4,000 + 942 = 7,346.
check(approx(kidYearlyCosts('middle')[0], 7346, 3), 'kids: middle income, age 0–2');
// Lower income, age 12–14: 880, 820, 610, 530 → 960 + 1,073 + 822 + 657 = 3,511.
check(approx(kidYearlyCosts('lower')[4], 3511, 3), 'kids: lower income, age 12–14');
// Higher income, age 15–17: 1,410, 1,750, 6,320, 1,690 → 1,538 + 2,290 + 8,512 + 2,094 = 14,434.
check(approx(kidYearlyCosts('higher')[5], 14434, 3), 'kids: higher income, age 15–17');
const kidTable = KID_COST_GUIDE.tables[0];
check(kidTable.rows[0].cells.join(' ') === '$5,300 $7,300 $12,300', 'kids: the first row shows age 0–2 to the nearest $100');
check(kidTable.rows[kidTable.rows.length - 1].cells.join(' ') === '$4,400 $6,600 $12,100', 'kids: the last row is the average over the ages');
// Bigger choices: baby daycare over the 12 states = lowest 7,696 (MS), average 11,364.6, highest 16,796 (VA).
check(KID_COST_GUIDE.tables[2].rows[0].cells.join(' ') === '$7,700 $11,400 $16,800', 'kids: baby daycare low / typical / high');
check(KID_COST_GUIDE.tables[2].rows[3].cells.join(' ') === '$5,300 $9,400 $15,300', 'kids: private school low / typical / high');

// ── Pets: dog food 655 to 1,905 a year = 54.6 to 158.8 a month → 55 to 160; cat 360 to 1,080 → 30 to 90.
check(PET_FOOD_GUIDE.tables[0].rows[0].cells.join(' ') === '$55 $160', 'pets: dog food per month');
check(PET_FOOD_GUIDE.tables[0].rows[1].cells.join(' ') === '$30 $90', 'pets: cat food per month');
check(PET_VET_GUIDE.tables[0].rows[0].cells[0] === '$598' && PET_VET_GUIDE.tables[0].rows[1].cells[0] === '$529', 'pets: an average year at the vet');

// ── Every guide is well formed: text everywhere, one cell per column, no repeated rows or tables (they're React keys).
const guides: [string, CostGuide][] = [
  ['groceries', GROCERIES_GUIDE], ['dining out', DINING_OUT_GUIDE], ['kids', KID_COST_GUIDE], ['pet food', PET_FOOD_GUIDE], ['vet', PET_VET_GUIDE],
];
for (const [name, guide] of guides) {
  check(guide.title !== '' && guide.intro !== '', `${name}: has a title and an intro`);
  check(guide.tables.length > 0 && guide.notes.length > 0 && guide.sources.length > 0, `${name}: has tables, notes and sources`);
  check(new Set(guide.tables.map((t) => t.title)).size === guide.tables.length, `${name}: no two tables share a title`);
  check(new Set(guide.notes).size === guide.notes.length, `${name}: no note is repeated`);
  for (const table of guide.tables) {
    check(table.columns.length >= 1 && table.columns.length <= 3, `${name} / ${table.title}: 1 to 3 columns (it has to fit a phone)`);
    check(new Set(table.rows.map((r) => r.label)).size === table.rows.length, `${name} / ${table.title}: no two rows share a label`);
    for (const row of table.rows) {
      check(row.cells.length === table.columns.length, `${name} / ${table.title} / ${row.label}: one cell per column`);
      check(row.cells.every((cell) => /^\$\d{1,3}(,\d{3})*$/.test(cell) || cell === '—'), `${name} / ${table.title} / ${row.label}: cells are dollars or a dash`);
    }
  }
}

console.log(`${passed} checks passed, ${failed} failed`);
if (failed > 0) process.exit(1);
