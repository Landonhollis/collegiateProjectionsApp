// costGuides.ts
// The spending guides behind the "i" buttons on the kid, food and pet edit cards: what people in the Southeast
// typically spend, so someone who has never paid for these (a student) has something to go on.
// Plain data, no React. The source numbers are copied from the sources named beside them; every number a guide
// shows is worked out from those below, so a source can be updated in one place. tests/costGuidesTest.ts checks the maths.
//
// Everything is in 2026 dollars. Older sources are brought forward with the price index for that kind of spending.
// Where a source has no Southeast figure, the U.S. figure is used and the guide says so.

/** One table in a guide. Every row has one cell per column. */
export type GuideTable = {
  title: string;
  note?: string; // a line under the title, e.g. what the columns mean
  columns: string[];
  rows: { label: string; cells: string[] }[];
};

/** What an "i" button shows: a title, a line of what it is, tables, things to know, and where the numbers come from. */
export type CostGuide = {
  title: string;
  intro: string;
  tables: GuideTable[];
  notes: string[];
  sources: string[];
};

// ── helpers ──────────────────────────────────────────────────────────────────
/** 1390 → "$1,390". */
function usd(n: number): string {
  return `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function average(numbers: number[]): number {
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

const NONE = '—'; // a cell with no number

// ── Groceries ────────────────────────────────────────────────────────────────
// USDA Official Food Plans: Cost of Food at Home at Three Levels, U.S. Average, July 2026 (issued August 2026).
// $/month for one person in a 4-person household, [Low-Cost, Moderate-Cost, Liberal]. USDA has no regional version.
const FOOD_PLAN_MONTHLY = {
  child2to3: [173.8, 207.4, 252.6],
  child6to8: [262.8, 305.1, 357.0],
  child9to11: [271.6, 350.2, 408.2],
  girl14to18: [271.1, 324.6, 400.6],
  boy14to18: [322.1, 403.7, 474.7],
  woman19to50: [276.1, 337.1, 430.2],
  man19to50: [317.4, 398.7, 487.5],
};
const FOOD_PLAN_LEVELS = ['Low-cost', 'Moderate', 'Liberal'];
/** USDA's adjustment for household size (same report, footnote 2): small homes pay more per person. */
const HOUSEHOLD_SIZE_FACTOR: Record<number, number> = { 1: 1.2, 2: 1.1, 3: 1.05, 4: 1, 5: 0.95, 6: 0.95 };

/** An adult = the average of a man and a woman aged 19–50; a kid = the average of a 6–8 and a 9–11 year old. */
const ADULT_FOOD = FOOD_PLAN_LEVELS.map((_, i) => (FOOD_PLAN_MONTHLY.man19to50[i] + FOOD_PLAN_MONTHLY.woman19to50[i]) / 2);
const KID_FOOD = FOOD_PLAN_LEVELS.map((_, i) => (FOOD_PLAN_MONTHLY.child6to8[i] + FOOD_PLAN_MONTHLY.child9to11[i]) / 2);

/** Groceries per month for a household, at each of the three levels, to the nearest $10. */
export function groceriesMonthly(adults: number, kids: number): number[] {
  const factor = HOUSEHOLD_SIZE_FACTOR[adults + kids];
  if (factor === undefined) throw new Error(`groceriesMonthly: no household size factor for ${adults + kids} people`);
  return FOOD_PLAN_LEVELS.map((_, i) => roundTo((adults * ADULT_FOOD[i] + kids * KID_FOOD[i]) * factor, 10));
}

const GROCERY_HOUSEHOLDS: { label: string; adults: number; kids: number }[] = [
  { label: '1 adult', adults: 1, kids: 0 },
  { label: '2 adults', adults: 2, kids: 0 },
  { label: '1 adult, 1 kid', adults: 1, kids: 1 },
  { label: '1 adult, 2 kids', adults: 1, kids: 2 },
  { label: '2 adults, 1 kid', adults: 2, kids: 1 },
  { label: '2 adults, 2 kids', adults: 2, kids: 2 },
  { label: '2 adults, 3 kids', adults: 2, kids: 3 },
];

export const GROCERIES_GUIDE: CostGuide = {
  title: 'Groceries per month',
  intro: 'What it costs to feed a household a healthy diet when every meal is made at home, at three levels of spending.',
  tables: [
    {
      title: 'By who is in the home',
      note: 'Low-cost = careful shopping. Moderate = in the middle. Liberal = the most generous.',
      columns: FOOD_PLAN_LEVELS,
      rows: GROCERY_HOUSEHOLDS.map((h) => ({ label: h.label, cells: groceriesMonthly(h.adults, h.kids).map(usd) })),
    },
    {
      title: 'One person, by age',
      note: 'For a different mix of ages. Per person in a family of four; add about 10% in a home of two, 20% living alone.',
      columns: FOOD_PLAN_LEVELS,
      rows: [
        { label: 'Child, 2–3', cells: FOOD_PLAN_MONTHLY.child2to3.map((n) => usd(roundTo(n, 10))) },
        { label: 'Child, 6–8', cells: FOOD_PLAN_MONTHLY.child6to8.map((n) => usd(roundTo(n, 10))) },
        { label: 'Teen girl', cells: FOOD_PLAN_MONTHLY.girl14to18.map((n) => usd(roundTo(n, 10))) },
        { label: 'Teen boy', cells: FOOD_PLAN_MONTHLY.boy14to18.map((n) => usd(roundTo(n, 10))) },
        { label: 'Woman', cells: FOOD_PLAN_MONTHLY.woman19to50.map((n) => usd(roundTo(n, 10))) },
        { label: 'Man', cells: FOOD_PLAN_MONTHLY.man19to50.map((n) => usd(roundTo(n, 10))) },
      ],
    },
  ],
  notes: [
    'These assume you cook every meal. If you eat out a lot, you will buy fewer groceries, so lean toward the lower number.',
    'In the first table an adult is the average of a man and a woman, and a kid is about 6 to 11 years old.',
    'These are U.S. averages. USDA does not publish them for the Southeast alone.',
  ],
  sources: ['USDA Official Food Plans: Cost of Food at Home at Three Levels, U.S. Average, July 2026.'],
};

// ── Dining out ───────────────────────────────────────────────────────────────
// BLS Consumer Expenditure Surveys, 2024, "food away from home", $/year per household.
// By kind of household (U.S.): composition of consumer unit and size of consumer unit tables.
const FOOD_AWAY_2024_US = {
  onePerson: 2249,
  couple: 4469,
  coupleOldestKidUnder6: 5139,
  coupleOldestKid6to17: 6177,
  oneParent: 3529,
};
// BLS does not publish kind of household within a region, so the U.S. numbers are scaled by the South's share:
// all households, South $3,501 against U.S. $3,945 (same survey, 2024).
const SOUTH_SHARE_OF_US = 3501 / 3945;
// Restaurant prices since then: CPI-U, food away from home, South region, 2024 average 363.289 → August 2026 390.710.
const FOOD_AWAY_PRICE_UPDATE = 390.71 / 363.289;

/** What a southern household of this kind spends eating out per month, in 2026 dollars: [half, the average, double], to the nearest $5. */
export function diningOutMonthly(annual2024US: number): number[] {
  const monthly = (annual2024US * SOUTH_SHARE_OF_US * FOOD_AWAY_PRICE_UPDATE) / 12;
  return [monthly / 2, monthly, monthly * 2].map((n) => roundTo(n, 5));
}

export const DINING_OUT_GUIDE: CostGuide = {
  title: 'Dining out per month',
  intro: 'What households in the South spend on restaurants, fast food, takeout, delivery, coffee, and meals bought at school or work.',
  tables: [
    {
      title: 'By who is in the home',
      note: 'Average = what these households really spend. Rarely is half of that; often is double.',
      columns: ['Rarely', 'Average', 'Often'],
      rows: [
        { label: '1 adult', cells: diningOutMonthly(FOOD_AWAY_2024_US.onePerson).map(usd) },
        { label: '2 adults', cells: diningOutMonthly(FOOD_AWAY_2024_US.couple).map(usd) },
        { label: '1 adult with kids', cells: diningOutMonthly(FOOD_AWAY_2024_US.oneParent).map(usd) },
        { label: '2 adults, kids under 6', cells: diningOutMonthly(FOOD_AWAY_2024_US.coupleOldestKidUnder6).map(usd) },
        { label: '2 adults, kids 6–17', cells: diningOutMonthly(FOOD_AWAY_2024_US.coupleOldestKid6to17).map(usd) },
      ],
    },
  ],
  notes: [
    'Only the Average column comes from the survey. Rarely and Often are just half and double, to help you place yourself.',
    'The more you eat out, the less you need for groceries, and the other way round.',
    'Southern households spend about 11% less eating out than the U.S. average. That is already taken off here.',
  ],
  sources: [
    'U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys 2024: food away from home by kind of household, and for the South.',
    'Brought up to August 2026 with the South region price index for food away from home (up 7.5% since 2024).',
  ],
};

// ── Kids ─────────────────────────────────────────────────────────────────────
// USDA, Expenditures on Children by Families, 2015, Table 5: married-couple families, urban South, $/year in 2015 dollars,
// for the younger child in a two-child family. One row per age band; three household income groups.
// Housing and food are left out (the Housing and Food entities hold them) and so is transportation (the car and gas entities).
type ChildCosts = { clothing: number; healthCare: number; careAndSchool: number; activities: number; transportation: number };
const KID_AGE_BANDS = ['0–2', '3–5', '6–8', '9–11', '12–14', '15–17'];
const row = (clothing: number, healthCare: number, careAndSchool: number, activities: number, transportation: number): ChildCosts => ({
  clothing,
  healthCare,
  careAndSchool,
  activities,
  transportation,
});
const KID_COSTS_2015: { lower: ChildCosts[]; middle: ChildCosts[]; higher: ChildCosts[] } = {
  // household income before tax under $59,200
  lower: [
    row(790, 770, 2220, 390, 1260),
    row(660, 720, 2220, 510, 1310),
    row(660, 740, 1040, 620, 1370),
    row(820, 850, 1040, 680, 1410),
    row(880, 820, 610, 530, 1560),
    row(850, 860, 890, 500, 1750),
  ],
  // $59,200 to $107,400
  middle: [
    row(860, 1120, 2970, 760, 1850),
    row(720, 1050, 2970, 880, 1900),
    row(720, 1080, 1800, 990, 1950),
    row(910, 1220, 1800, 1050, 2000),
    row(990, 1180, 1560, 900, 2140),
    row(960, 1240, 2270, 870, 2330),
  ],
  // over $107,400
  higher: [
    row(1230, 1520, 5200, 1580, 2650),
    row(1070, 1440, 5200, 1700, 2700),
    row(1070, 1390, 4030, 1810, 2760),
    row(1310, 1730, 4030, 1870, 2800),
    row(1450, 1680, 4340, 1710, 2950),
    row(1410, 1750, 6320, 1690, 3140),
  ],
};
// 2015 average → August 2026, with the price index for each kind of spending (CPI-U, South region, except where noted).
const KID_PRICE_UPDATE: ChildCosts = {
  clothing: 146.391 / 134.19, // apparel
  healthCare: 555.384 / 424.4, // medical care
  careAndSchool: 927.005 / 688.31, // tuition, other school fees and childcare (U.S. city average)
  activities: 143.944 / 116.183, // recreation
  transportation: 288.242 / 197.22, // transportation
};
const ALL_ITEMS_UPDATE = 323.394 / 230.326; // all items, for the income groups' dollar limits
const KID_INCOME_LIMITS = [roundTo(59_200 * ALL_ITEMS_UPDATE, 1000), roundTo(107_400 * ALL_ITEMS_UPDATE, 1000)]; // ≈ $83,000 and $151,000

/** One age band's costs in 2026 dollars. */
function inToday(costs: ChildCosts): ChildCosts {
  return {
    clothing: costs.clothing * KID_PRICE_UPDATE.clothing,
    healthCare: costs.healthCare * KID_PRICE_UPDATE.healthCare,
    careAndSchool: costs.careAndSchool * KID_PRICE_UPDATE.careAndSchool,
    activities: costs.activities * KID_PRICE_UPDATE.activities,
    transportation: costs.transportation * KID_PRICE_UPDATE.transportation,
  };
}

/** What the kid entity's "cost per year" covers: everything but housing, food and the car. */
function kidTotal(costs: ChildCosts): number {
  return costs.clothing + costs.healthCare + costs.careAndSchool + costs.activities;
}

/** A child's yearly cost in 2026 dollars at each age band (not rounded), for one income group. */
export function kidYearlyCosts(group: keyof typeof KID_COSTS_2015): number[] {
  return KID_COSTS_2015[group].map((costs) => kidTotal(inToday(costs)));
}

const KID_GROUPS = ['lower', 'middle', 'higher'] as const;
const MIDDLE_TODAY = KID_COSTS_2015.middle.map(inToday);

// Child Care Aware of America, Child Care in America: 2024 Affordability Analysis, Table I:
// average yearly price of full-time center-based care, 2024. Order: AL AR FL GA KY LA MS NC SC TN VA WV.
const DAYCARE_INFANT = [8632, 9178, 13011, 11066, 12740, 10847, 7696, 12370, 10474, 13126, 16796, 10439];
const DAYCARE_AGE_4 = [8008, 8320, 9409, 9573, 10712, 9378, 6864, 10381, 9691, 10840, 13884, 9368];
const AFTER_SCHOOL = [5226, 3397, 5238, 6568, 5850, 5841, 4290, 5811, 8277, 4402, 5772]; // West Virginia did not report
// Average private school tuition by state, 2024–25 (College Transitions, from Private School Review). Same state order.
const PRIVATE_SCHOOL = [8308, 6269, 11403, 12750, 7435, 7666, 6759, 11105, 8372, 11886, 15311, 5258];

/** [lowest state, average of the states, highest state], to the nearest $100. */
function lowTypicalHigh(byState: number[]): string[] {
  return [Math.min(...byState), average(byState), Math.max(...byState)].map((n) => usd(roundTo(n, 100)));
}

export const KID_COST_GUIDE: CostGuide = {
  title: 'What a kid costs per year',
  intro:
    'For one child in the South. Housing, food and the family car are left out on purpose: your Housing, Food, car and gas entities already hold them.',
  tables: [
    {
      title: 'Per child, per year',
      note: `By household income before tax. Lower = under ${usd(KID_INCOME_LIMITS[0])}. Middle = up to ${usd(KID_INCOME_LIMITS[1])}. Higher = above that.`,
      columns: ['Lower', 'Middle', 'Higher'],
      rows: [
        ...KID_AGE_BANDS.map((ages, i) => ({
          label: `Age ${ages}`,
          cells: KID_GROUPS.map((group) => usd(roundTo(kidYearlyCosts(group)[i], 100))),
        })),
        { label: 'Average', cells: KID_GROUPS.map((group) => usd(roundTo(average(kidYearlyCosts(group)), 100))) },
      ],
    },
    {
      title: "What's in the Middle column",
      note: 'Averaged over all ages.',
      columns: ['Per year'],
      rows: [
        { label: 'Child care and school', cells: [usd(roundTo(average(MIDDLE_TODAY.map((c) => c.careAndSchool)), 100))] },
        { label: 'Health care', cells: [usd(roundTo(average(MIDDLE_TODAY.map((c) => c.healthCare)), 100))] },
        { label: 'Activities, toys, haircuts', cells: [usd(roundTo(average(MIDDLE_TODAY.map((c) => c.activities)), 100))] },
        { label: 'Clothing', cells: [usd(roundTo(average(MIDDLE_TODAY.map((c) => c.clothing)), 100))] },
      ],
    },
    {
      title: 'Bigger choices',
      note: 'Per child, per year. Daycare and private school: the lowest, average and highest southeastern state. The rest: U.S. averages.',
      columns: ['Low', 'Typical', 'High'],
      rows: [
        { label: 'Daycare, baby', cells: lowTypicalHigh(DAYCARE_INFANT) },
        { label: 'Daycare, age 4', cells: lowTypicalHigh(DAYCARE_AGE_4) },
        { label: 'After-school care', cells: lowTypicalHigh(AFTER_SCHOOL) },
        { label: 'Private school', cells: lowTypicalHigh(PRIVATE_SCHOOL) },
        { label: 'Public school', cells: [NONE, '$0', NONE] },
        { label: 'Sports, main sport', cells: [NONE, '$1,000', NONE] },
        { label: 'Sports, all of them', cells: [NONE, '$1,500', NONE] },
        { label: 'School shopping', cells: [NONE, '$860', NONE] },
        { label: 'Vacation, family of 4', cells: [NONE, '$4,700', NONE] },
      ],
    },
  ],
  notes: [
    'The first table holds only an average amount of child care and school, because many families pay little for them. Full-time daycare or private school costs far more: use the Bigger choices table in its place.',
    'The first table already has a normal amount of sports, lessons and toys in it. Add more only for travel teams or costly hobbies.',
    'An only child costs about 27% more than these numbers. With three or more kids, each costs about 24% less.',
    'Vacation is one four-night trip for the whole family, not per child. School shopping is per family each year.',
    `Left out: the child's share of the family car, about ${usd(roundTo(average(MIDDLE_TODAY.map((c) => c.transportation)), 100))} a year for a middle-income family.`,
  ],
  sources: [
    'USDA, Expenditures on Children by Families, 2015: married couples, urban South. Brought up to August 2026 with the price index for each kind of spending.',
    'Child Care Aware of America, 2024 Affordability Analysis: full-time center care by state (2024 prices).',
    'College Transitions, average private school tuition by state, 2024–25.',
    'Aspen Institute Project Play, 2024 parent survey: youth sports spending (U.S.).',
    'National Retail Federation, 2026 back-to-school survey (U.S., per household).',
    'Luxury Link, 2025 family vacation cost analysis (U.S.). The roughest number here.',
  ],
};

// ── Pets ─────────────────────────────────────────────────────────────────────
// Synchrony, 2025 Pet Lifetime of Care study (U.S.), as reported by CareCredit and GreatPetCare:
// dog food $655 to $1,905 a year; cat food and treats $360 to $1,080 a year.
const DOG_FOOD_YEARLY = [655, 1905];
const CAT_FOOD_YEARLY = [360, 1080];

export const PET_FOOD_GUIDE: CostGuide = {
  title: 'Pet food per month',
  intro: 'What owners spend to feed one dog or one cat.',
  tables: [
    {
      title: 'Per pet, per month',
      columns: ['Low', 'High'],
      rows: [
        { label: 'Dog', cells: DOG_FOOD_YEARLY.map((n) => usd(roundTo(n / 12, 5))) },
        { label: 'Cat', cells: CAT_FOOD_YEARLY.map((n) => usd(roundTo(n / 12, 5))) },
      ],
    },
  ],
  notes: [
    'A small dog on store-brand food is near the low end. A big dog, or premium or fresh food, is near the high end.',
    'The cat numbers include treats.',
    'These are U.S. numbers. There is no survey for the Southeast alone.',
  ],
  sources: ['Synchrony, 2025 Pet Lifetime of Care study, as reported by CareCredit.'],
};

// AVMA, 2025 Pet Ownership and Demographics Sourcebook (U.S.): average yearly veterinary spending, dog owners $598, cat owners $529.
const VET_YEARLY = { dog: 598, cat: 529 };

export const PET_VET_GUIDE: CostGuide = {
  title: 'Vet costs per year',
  intro: 'What owners spend at the vet in a year, and what the usual visits cost.',
  tables: [
    {
      title: 'An average year',
      columns: ['Per year'],
      rows: [
        { label: 'Dog', cells: [usd(VET_YEARLY.dog)] },
        { label: 'Cat', cells: [usd(VET_YEARLY.cat)] },
      ],
    },
    {
      // CareCredit (research by ASQ360°, 2023–24, U.S.) and Synchrony's 2025 study.
      title: 'What a visit costs',
      columns: ['Low', 'Typical', 'High'],
      rows: [
        { label: 'Checkup, dog', cells: ['$56', '$89', '$129'] },
        { label: 'Checkup, cat', cells: ['$57', '$68', '$130'] },
        { label: 'One vaccine', cells: ['$25', NONE, '$50'] },
        { label: 'Teeth cleaning, dog', cells: ['$300', NONE, '$687'] },
        { label: 'Teeth cleaning, cat', cells: [NONE, '$430', NONE] },
        { label: 'Emergency visit fee', cells: ['$113', NONE, '$260'] },
      ],
    },
  ],
  notes: [
    'A healthy young pet with one checkup and its vaccines costs less than the average. An older pet, or a year with teeth cleaning, costs more.',
    'The average year includes the surprise bills some owners had. About 3 in 4 owners have faced an unexpected bill over $250, so leave some room.',
    'The emergency fee is only for being seen. Treatment is on top of it.',
    'These are U.S. numbers. There is no survey for the Southeast alone.',
  ],
  sources: [
    'AVMA, 2025 Pet Ownership and Demographics Sourcebook: average yearly spending on veterinary care.',
    'CareCredit average veterinary prices (ASQ360° research, 2023–24) and Synchrony, 2025 Pet Lifetime of Care study.',
  ],
};
