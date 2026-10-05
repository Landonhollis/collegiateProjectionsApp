// chartMathsTest.ts — run with:  npx tsx chartMathsTest.ts
// No test framework needed. Exits non-zero on any failure.
import { ageTicks, money, shortDollars, yAxisFor } from '../components/chartMaths';

// ── tiny harness ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const fails: string[] = [];
function check(cond: boolean, msg: string) {
  if (cond) passed++;
  else { failed++; fails.push(msg); }
}
function test(name: string, fn: () => void) {
  try { fn(); } catch (e) { failed++; fails.push(`${name}: threw ${(e as Error).message}`); }
}
const throws = (fn: () => void): boolean => { try { fn(); return false; } catch { return true; } };

test('dollar labels', () => {
  check(money(1_234_567) === '$1,234,567' && money(-1_234) === '−$1,234' && money(0) === '$0', 'money');
  check(shortDollars(0) === '$0' && shortDollars(950) === '$950', 'under a thousand');
  check(shortDollars(250_000) === '$250k' && shortDollars(1_500) === '$1.5k' && shortDollars(-1_500) === '−$1.5k', 'thousands');
  check(shortDollars(1_200_000) === '$1.2M' && shortDollars(5_000_000) === '$5M' && shortDollars(2_500_000_000) === '$2.5B', 'millions, billions');
});

test('y-axis', () => {
  const a = yAxisFor(120, 870_000);
  check(a.min === 0 && a.max === 1_000_000 && a.ticks.join() === '0,200000,400000,600000,800000,1000000', 'starts at 0, round steps');
  const b = yAxisFor(-40_000, 90_000);
  check(b.min === -40_000 && b.max === 100_000 && b.ticks.includes(0), `goes below 0 when the data does, and labels 0 (${b.ticks.join()})`);
  const c = yAxisFor(-3_000, -500);
  check(c.max === 0 && c.min <= -3_000, 'all-negative data still reaches up to 0');
  const d = yAxisFor(0, 0);
  check(d.min === 0 && d.max > 0 && d.ticks.length >= 2, 'all zeros still gives an axis');
  const e = yAxisFor(0, 3);
  check(e.ticks.every(Number.isInteger) && e.max >= 3, 'tiny data: whole-dollar steps');
  for (const [lo, hi] of [[0, 7], [0, 6_001], [-123_456, 9_876_543], [5_000, 5_000], [-1, 1]]) {
    const axis = yAxisFor(lo, hi);
    check(axis.min <= Math.min(0, lo) && axis.max >= Math.max(0, hi) && axis.ticks.length >= 2 && axis.ticks.length <= 8, `covers ${lo} to ${hi} in a few steps`);
    check(axis.ticks[0] === axis.min && axis.ticks[axis.ticks.length - 1] === axis.max, `ticks run end to end for ${lo} to ${hi}`);
  }
  check(throws(() => yAxisFor(NaN, 1)) && throws(() => yAxisFor(0, Infinity)), 'bad range throws');
});

test('age labels', () => {
  const life = ageTicks(20 * 12, 961); // age 20 to 100
  check(life.map((t) => t.years).join() === '20,30,40,50,60,70,80,90,100', 'a whole life: every 10 years');
  check(life[0].month === 0 && life[1].month === 120 && life[8].month === 960, 'month = how far along the chart');
  const offset = ageTicks(22 * 12 + 4, 961); // starts at 22 yrs 4 mos
  check(offset[0].years === 30 && offset[0].month === 92, 'first label is the first round birthday after the start');
  check(ageTicks(25 * 12, 37).map((t) => t.years).join() === '25,26,27,28', 'a short chart: every year');
  check(ageTicks(25 * 12, 1).map((t) => t.years).join() === '25', 'one month');
  check(ageTicks(25 * 12 + 1, 1).length === 0, 'one month that is not a birthday: no labels');
  check(ageTicks(30 * 12, 241).map((t) => t.years).join() === '30,35,40,45,50', '20 years: every 5');
});

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${passed} checks passed, ${failed} failed`);
if (failed) {
  for (const f of fails.slice(0, 40)) console.log('  ✗ ' + f);
  throw new Error(`${failed} checks failed`);
}
