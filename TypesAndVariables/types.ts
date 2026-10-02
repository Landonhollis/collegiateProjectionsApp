// types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Every shared type in one place: the data contract between the app, the entity
// engines, the COAHE and the master engine. Types only; no runtime code.
// Engine-internal types (OwnedAssetSpec, InvestmentSpec, LoanTerms, …) stay in
// their own files.
// ─────────────────────────────────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════════════════════
// Basics
// ═════════════════════════════════════════════════════════════════════════════
export type Age = { years: number; months: number };
export type Frequency = 'monthly' | 'yearly';
export type FilingStatus = 'single' | 'married';
export type HealthInsuranceType =
  | 'employerIndividual'
  | 'employerFamily'
  | 'marketplaceIndividual'
  | 'marketplaceFamily'
  | 'medicare'
  | 'none';

// ═════════════════════════════════════════════════════════════════════════════
// Journal entries (entity engine output → COAHE input)
// ═════════════════════════════════════════════════════════════════════════════
export type LineEntry = { account: number; amount: number }; // debit +, credit −, whole dollars
export type JournalEntry = { caseId: string; month: number; lineEntries: LineEntry[] };
export type EngineCtx = { caseId: string; startAge: Age; endMonth?: number }; // endMonth defaults to 960
export type Engine<I> = (input: I, ctx: EngineCtx) => JournalEntry[];

/** history[month · 150 + account] = balance after that month posts. */
export type ChartOfAccountsHistory = Float64Array;

// ═════════════════════════════════════════════════════════════════════════════
// Entity inputs (one per entity type)
// ═════════════════════════════════════════════════════════════════════════════
export type OpeningCashInput = { amount: number };

export type ExistingHomeInput = {
  totalPropertyValue: number; // ORIGINAL purchase price
  downPaymentPct: number;
  mortgageTermYears: number;
  interestRatePct: number;
  remainingBalance: number; // independent input; 0 = paid off
  /** Optional. When given, it sets how long you've owned it (value growth). Needed if paid off. */
  purchaseAge?: Age | null;
  sellAge?: Age | null;
  // Presets (blue): property tax, appreciation, maintenance, insurance, utilities
};

export type BuyingHomeInput = {
  purchaseAge: Age; // added: when the home is bought
  totalPropertyValue: number;
  downPaymentPct: number; // 100 = paid in cash
  mortgageTermYears: number;
  interestRatePct: number;
  utilitiesMonthly?: number | null; // user input; falls back to the preset
  sellAge?: Age | null;
  // Presets (blue): property tax, appreciation, maintenance, insurance
};

export type ExistingVehicleInput = {
  financing: 'loan' | 'full';
  totalVehicleValue: number; // ORIGINAL purchase price
  // loan only:
  downPaymentPct?: number | null;
  loanTermMonths?: number | null;
  interestRatePct?: number | null;
  remainingBalance?: number | null; // independent input
  // bought in full (or to override the loan-derived age):
  purchaseAge?: Age | null;
  sellAge?: Age | null;
  // Presets (blue): insurance, maintenance. Depreciation preset (17%/yr real).
};

export type BuyingCarInput = {
  purchaseAge: Age; // added: when the car is bought
  financing: 'loan' | 'full';
  totalVehicleValue: number;
  downPaymentPct?: number | null;
  loanTermMonths?: number | null;
  interestRatePct?: number | null;
  sellAge?: Age | null;
  insuranceMonthly?: number | null; // user input; falls back to the preset
  maintenanceMonthly?: number | null; // user input; falls back to the preset
};

export type ExistingCreditCardInput = {
  currentBalance: number;
  aprPct: number;
  monthlyPayment: number; // "monthly contribution"
  paymentStartAge?: Age | null; // "start age"; missing = now
};

/** Existing student loans and other existing loans. */
export type ExistingLoanInput = {
  remainingBalance?: number | null;
  interestRatePct?: number | null;
  remainingTermMonths?: number | null;
  monthlyPayment?: number | null;
  // any 3 of the 4 are required; the 4th is computed
};

export type OtherExistingAssetInput = {
  assetValue: number; // ORIGINAL purchase value
  appreciationPct: number; // real; negative = depreciation
  purchaseAge: Age; // added: needed to value it today
  financedWithLoan: boolean;
  // loan (any 3 of 4) when financedWithLoan:
  remainingBalance?: number | null;
  interestRatePct?: number | null;
  remainingTermMonths?: number | null;
  monthlyPayment?: number | null;
};

export type ExistingInvestmentInput = {
  account: number; // 4–12, set by masterEngine (any app value is overwritten)
  currentInvested: number;
  returnPct: number; // yoy, real
  monthlyContribution?: number | null;
  contributionStartAge?: Age | null; // missing = now
  contributionEndAge?: Age | null;
  monthlyWithdrawal?: number | null;
  withdrawalStartAge?: Age | null;
  withdrawalEndAge?: Age | null;
};

export type InvestingInput = {
  account: number; // 4–12, set by masterEngine (any app value is overwritten)
  initialContribution: number; // paid at contributionStartAge
  returnPct: number;
  monthlyContribution?: number | null;
  contributionStartAge: Age;
  contributionEndAge?: Age | null;
  monthlyWithdrawal?: number | null;
  withdrawalStartAge?: Age | null;
  withdrawalEndAge?: Age | null;
};

export type IncomeInput = {
  salary: number; // annual, today's dollars
  startAge?: Age | null; // missing = now
  endAge?: Age | null;
  raisePct: number; // yoy REAL raise
  charityPct?: number | null; // % of gross → acct 93 (not tax-deducted)
  retirementContributionPct?: number | null; // % of gross, pre-tax, capped at the 401k limit
  retirementAccount?: number | null; // set by masterEngine to 3 (retirement)
  retirementReturnPct?: number | null; // real; defaults to preset
  filingStatus: FilingStatus;
  incomeTaxRatePct?: number | null; // federal + state override; null = calculate
};

export type RentingInput = {
  rentMonthly: number;
  utilitiesMonthly?: number | null;
  junkFeesMonthly?: number | null; // parking, pet rent, trash, etc.
  startAge?: Age | null; // added
  endAge?: Age | null; // added
  // Preset (blue): renters insurance
};

export type GasInput = {
  milesPerWeek: number;
  mpg: number;
  gasPricePerGallon?: number | null; // override; default = SE preset
  startAge?: Age | null; // added
  endAge?: Age | null; // added
};

export type KidInput = {
  annualCost: number; // slider, $10k–$25k/yr
  birthAge: Age; // added: YOUR age when this kid is born
};

export type EducationInput = {
  paymentType: 'loan' | 'full';
  costPerSemester: number;
  numberOfSemesters: number;
  startAge: Age; // used for both payment types
  loanRatePct?: number | null; // loan only
  loanTermYears?: number | null; // loan only (10 = standard federal)
};

export type FoodInput = {
  diningOutMonthly: number;
  groceriesMonthly: number;
  startAge?: Age | null;
  endAge?: Age | null;
};

export type HealthInsuranceInput = {
  type: HealthInsuranceType; // picks the preset
  startAge?: Age | null; // added
  endAge?: Age | null; // added
  monthlyPremiumOverride?: number | null; // e.g. a subsidized marketplace price
};

export type PetInput = {
  startAge: Age; // adoption
  lifespanYears: number;
  vetPerYear: number;
  foodPerMonth: number;
  adoptionCost: number;
};

export type PersonalInput = {
  clothing?: number | null; otherPersonalCare?: number | null; entertainment?: number | null;
  gym?: number | null; phonePlan?: number | null; books?: number | null;
  courses?: number | null; events?: number | null; // all $/month
  startAge?: Age | null; // added
  endAge?: Age | null; // added
};

export type BirthdayChristmasInput = {
  amount: number;
  frequency: Frequency; // yearly amounts are spread evenly (÷12)
  startAge?: Age | null;
  endAge?: Age | null;
};

export type OneTimeExpenseInput = { age: Age; amount: number };

export type RecurringPaymentInput = {
  amount: number;
  frequency: Frequency; // yearly amounts are spread evenly (÷12)
  startAge?: Age | null;
  endAge?: Age | null;
};

/** Entity type → its input type. ENGINES (entityEngines.ts) is checked against this. */
export type EntityInputs = {
  openingCash: OpeningCashInput;
  existingHome: ExistingHomeInput;
  existingVehicle: ExistingVehicleInput;
  existingCreditCard: ExistingCreditCardInput;
  existingStudentLoans: ExistingLoanInput;
  existingInvestment: ExistingInvestmentInput;
  otherExistingAsset: OtherExistingAssetInput;
  otherExistingLoan: ExistingLoanInput;
  income: IncomeInput;
  renting: RentingInput;
  buyingHome: BuyingHomeInput;
  buyingCar: BuyingCarInput;
  gas: GasInput;
  kid: KidInput;
  education: EducationInput;
  investing: InvestingInput;
  food: FoodInput;
  healthInsurance: HealthInsuranceInput;
  pet: PetInput;
  personal: PersonalInput;
  birthdayChristmas: BirthdayChristmasInput;
  oneTimeExpense: OneTimeExpenseInput;
  recurringPayment: RecurringPaymentInput;
};
export type EntityTypeKey = keyof EntityInputs;

// ═════════════════════════════════════════════════════════════════════════════
// Cases and entities (app storage ↔ master engine)
// ═════════════════════════════════════════════════════════════════════════════
// Stored as two separate arrays. Each entity belongs to exactly one case: entity.caseId → case.caseId.
// A case's entities are the ones with its caseId, in the order they appear in the entities array.
/** entityId = "TT-xxxxxxxx" (type code + 8 random base-36 chars); see masterEngine.ts. */
export type Entity = {
  entityId: string;
  caseId: string;
  name: string; // shown on the entity card; the engines ignore it
  isHidden: boolean; // UI flag; the engines ignore it
  inputs: Record<string, unknown>;
};
export type Case = {
  caseId: string;
  caseName: string;
  caseColor: string; // hex
  caseIndex: number; // display order on the cases screen (0 = first)
  isHidden: boolean; // UI flag; the engines ignore it
  [field: string]: unknown;
};
export type MasterInput<C extends Case = Case> = { startingAge: Age; cases: C[]; entities: Entity[] };

export type CaseError = { entityId: string | null; message: string }; // null = not tied to one entity
/** The input case plus its results; every case field passes through. */
export type ComputedCase<C extends Case = Case> = C & {
  chartOfAccountsHistory: ChartOfAccountsHistory | null; // null when error is set
  investmentAccounts: Record<string, number>; // entityId → account (4–12)
  error: CaseError | null;
};
export type MasterOutput<C extends Case = Case> = { startingAge: Age; computedCases: ComputedCase<C>[] };

// ═════════════════════════════════════════════════════════════════════════════
// UI: edit entity cards
// ═════════════════════════════════════════════════════════════════════════════
export type EntityEditType = 'add' | 'edit';
/** Props every edit entity card takes. 'edit' comes with the entity being edited. */
export type EditEntityCardProps =
  | { entityEditType: 'add'; entity?: undefined; onClose: () => void }
  | { entityEditType: 'edit'; entity: Entity; onClose: () => void };
