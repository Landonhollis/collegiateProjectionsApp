// entityForms.ts
// ─────────────────────────────────────────────────────────────────────────────
// One form per entity type: the link between an edit card's boxes and its engine's inputs.
//
//   read(saved)     saved entity.inputs (undefined for a new entity) → the text in the boxes
//   toInputs(text)  the text → the engine's inputs, or null while anything is missing or not valid
//
// Every form's inputs are exactly its engine's input type (types.ts), so what a card saves is what
// its engine reads. The cards only draw the boxes; all the rules about what is valid live here.
// No React or React Native in here, so tests/entityFormsTest.ts can run every form through its engine.
//
// Conventions:
//   • A box the engine needs is required. A box the engine can do without is optional: blank saves null.
//   • A choice that hides boxes (loan / paid in full, …) saves null for the hidden ones.
//   • Fields masterEngine fills in are never asked for: investment `account`, income `retirementAccount`.
// ─────────────────────────────────────────────────────────────────────────────
import {
  NO_LOAN,
  ageInMonths,
  optional,
  parseAgeWindow,
  parseDecimal,
  parseDollars,
  parseLoanText,
  parseOptionalAge,
  parsePercent,
  parsePositiveDecimal,
  parseRequiredAge,
  parseSignedPercent,
  parseWholeFrom1,
  readAgeText,
  readChoice,
  readDollarsText,
  readLoanText,
  readNumberText,
  type AgeText,
  type LoanText,
} from "../formParsing";
import type {
  Age,
  BirthdayChristmasInput,
  BuyingCarInput,
  BuyingHomeInput,
  EducationInput,
  EntityInputs,
  EntityTypeKey,
  ExistingCreditCardInput,
  ExistingHomeInput,
  ExistingInvestmentInput,
  ExistingLoanInput,
  ExistingVehicleInput,
  FilingStatus,
  FoodInput,
  Frequency,
  GasInput,
  HealthInsuranceInput,
  HealthInsuranceType,
  IncomeInput,
  InvestingInput,
  KidInput,
  OneTimeExpenseInput,
  OpeningCashInput,
  OtherExistingAssetInput,
  PersonalInput,
  PetInput,
  RecurringPaymentInput,
  RentingInput,
} from "../../TypesAndVariables/types";

type Saved = Record<string, unknown> | undefined;

export type EntityForm<Text, Inputs> = {
  read: (saved: Saved) => Text;
  toInputs: (text: Text) => Inputs | null;
};

/** What a card saves for entity type K: its engine's inputs, minus the fields masterEngine fills in. */
export type FormInputs<K extends EntityTypeKey> = Omit<EntityInputs[K], "account" | "retirementAccount">;

/** True when a sale age is given and it's before the purchase age (the engines throw on that). */
function sellsBeforeBuying(sellAge: Age | null, purchaseAge: Age | null): boolean {
  return !!sellAge && !!purchaseAge && ageInMonths(sellAge) < ageInMonths(purchaseAge);
}

// ═════════════════════════════════════════════════════════════════════════════
// What you have now
// ═════════════════════════════════════════════════════════════════════════════

// ── Existing cash (openingCash) ──────────────────────────────────────────────
export type OpeningCashText = { amount: string };
export const openingCashForm: EntityForm<OpeningCashText, OpeningCashInput> = {
  read: (saved) => ({ amount: readDollarsText(saved?.amount) }),
  toInputs: (t) => {
    const amount = parseDollars(t.amount);
    return amount === null ? null : { amount };
  },
};

// ── Existing home ────────────────────────────────────────────────────────────
export type ExistingHomeText = {
  price: string;
  downPct: string;
  termYears: string;
  ratePct: string;
  remaining: string; // 0 = paid off
  purchaseAge: AgeText; // optional
  sellAge: AgeText; // optional
};
export const existingHomeForm: EntityForm<ExistingHomeText, ExistingHomeInput> = {
  read: (saved) => ({
    price: readDollarsText(saved?.totalPropertyValue),
    downPct: readNumberText(saved?.downPaymentPct),
    termYears: readNumberText(saved?.mortgageTermYears),
    ratePct: readNumberText(saved?.interestRatePct),
    remaining: readDollarsText(saved?.remainingBalance),
    purchaseAge: readAgeText(saved?.purchaseAge),
    sellAge: readAgeText(saved?.sellAge),
  }),
  toInputs: (t) => {
    const price = parseDollars(t.price);
    const downPct = parsePercent(t.downPct);
    const termYears = parseWholeFrom1(t.termYears);
    const ratePct = parsePercent(t.ratePct);
    const remaining = parseDollars(t.remaining);
    const purchaseAge = parseOptionalAge(t.purchaseAge);
    const sellAge = parseOptionalAge(t.sellAge);
    if (price === null || downPct === null || termYears === null || ratePct === null || remaining === null) return null;
    if (purchaseAge === undefined || sellAge === undefined || sellsBeforeBuying(sellAge, purchaseAge)) return null;
    return {
      totalPropertyValue: price,
      downPaymentPct: downPct,
      mortgageTermYears: termYears,
      interestRatePct: ratePct,
      remainingBalance: remaining,
      purchaseAge,
      sellAge,
    };
  },
};

// ── Existing vehicle ─────────────────────────────────────────────────────────
// "loan" shows the loan boxes. "full" hides them and needs the age you bought it instead
// (that's how the engine knows how much value the vehicle has lost).
export type ExistingVehicleText = {
  financing: "loan" | "full";
  price: string;
  downPct: string; // loan only
  termMonths: string; // loan only
  ratePct: string; // loan only
  remaining: string; // loan only; 0 = paid off
  purchaseAge: AgeText; // optional with a loan, required when paid in full
  sellAge: AgeText; // optional
};
export const existingVehicleForm: EntityForm<ExistingVehicleText, ExistingVehicleInput> = {
  read: (saved) => ({
    financing: readChoice(saved?.financing, ["loan", "full"], "loan"),
    price: readDollarsText(saved?.totalVehicleValue),
    downPct: readNumberText(saved?.downPaymentPct),
    termMonths: readNumberText(saved?.loanTermMonths),
    ratePct: readNumberText(saved?.interestRatePct),
    remaining: readDollarsText(saved?.remainingBalance),
    purchaseAge: readAgeText(saved?.purchaseAge),
    sellAge: readAgeText(saved?.sellAge),
  }),
  toInputs: (t) => {
    const price = parseDollars(t.price);
    const purchaseAge = parseOptionalAge(t.purchaseAge);
    const sellAge = parseOptionalAge(t.sellAge);
    if (price === null || purchaseAge === undefined || sellAge === undefined || sellsBeforeBuying(sellAge, purchaseAge)) return null;
    const shared = { totalVehicleValue: price, purchaseAge, sellAge };

    if (t.financing === "full") {
      if (purchaseAge === null) return null;
      return { financing: "full", ...shared, downPaymentPct: null, loanTermMonths: null, interestRatePct: null, remainingBalance: null };
    }
    const downPct = parsePercent(t.downPct);
    const termMonths = parseWholeFrom1(t.termMonths);
    const ratePct = parsePercent(t.ratePct);
    const remaining = parseDollars(t.remaining);
    if (downPct === null || termMonths === null || ratePct === null || remaining === null) return null;
    return {
      financing: "loan",
      ...shared,
      downPaymentPct: downPct,
      loanTermMonths: termMonths,
      interestRatePct: ratePct,
      remainingBalance: remaining,
    };
  },
};

// ── Existing credit card ─────────────────────────────────────────────────────
export type ExistingCreditCardText = { balance: string; aprPct: string; payment: string; paymentStartAge: AgeText };
export const existingCreditCardForm: EntityForm<ExistingCreditCardText, ExistingCreditCardInput> = {
  read: (saved) => ({
    balance: readDollarsText(saved?.currentBalance),
    aprPct: readNumberText(saved?.aprPct),
    payment: readDollarsText(saved?.monthlyPayment),
    paymentStartAge: readAgeText(saved?.paymentStartAge),
  }),
  toInputs: (t) => {
    const balance = parseDollars(t.balance);
    const aprPct = parsePercent(t.aprPct);
    const payment = parseDollars(t.payment);
    const paymentStartAge = parseOptionalAge(t.paymentStartAge);
    if (balance === null || aprPct === null || payment === null || paymentStartAge === undefined) return null;
    return { currentBalance: balance, aprPct, monthlyPayment: payment, paymentStartAge };
  },
};

// ── Existing student loans, other existing loan ──────────────────────────────
// Both use the same "any 3 of 4" loan boxes (and the same engine, posting to different accounts).
export const existingLoanForm: EntityForm<LoanText, ExistingLoanInput> = {
  read: readLoanText,
  toInputs: parseLoanText,
};

// ── Existing investment ──────────────────────────────────────────────────────
export type InvestmentFlowText = {
  contribution: string; // $/month, optional
  contributionEndAge: AgeText;
  withdrawal: string; // $/month, optional
  withdrawalStartAge: AgeText;
  withdrawalEndAge: AgeText;
};
export type ExistingInvestmentText = InvestmentFlowText & {
  invested: string;
  returnPct: string;
  contributionStartAge: AgeText; // optional: blank = now
};
/** `account` is left out: masterEngine assigns it (4–12). */
export const existingInvestmentForm: EntityForm<ExistingInvestmentText, Omit<ExistingInvestmentInput, "account">> = {
  read: (saved) => ({
    invested: readDollarsText(saved?.currentInvested),
    returnPct: readNumberText(saved?.returnPct),
    contribution: readDollarsText(saved?.monthlyContribution),
    contributionStartAge: readAgeText(saved?.contributionStartAge),
    contributionEndAge: readAgeText(saved?.contributionEndAge),
    withdrawal: readDollarsText(saved?.monthlyWithdrawal),
    withdrawalStartAge: readAgeText(saved?.withdrawalStartAge),
    withdrawalEndAge: readAgeText(saved?.withdrawalEndAge),
  }),
  toInputs: (t) => {
    const invested = parseDollars(t.invested);
    const returnPct = parseSignedPercent(t.returnPct);
    const contribution = optional(t.contribution, parseDollars);
    const withdrawal = optional(t.withdrawal, parseDollars);
    const contributing = parseAgeWindow(t.contributionStartAge, t.contributionEndAge);
    const withdrawing = parseAgeWindow(t.withdrawalStartAge, t.withdrawalEndAge);
    if (invested === null || returnPct === null || contribution === undefined || withdrawal === undefined) return null;
    if (contributing === null || withdrawing === null) return null;
    return {
      currentInvested: invested,
      returnPct,
      monthlyContribution: contribution,
      contributionStartAge: contributing.startAge,
      contributionEndAge: contributing.endAge,
      monthlyWithdrawal: withdrawal,
      withdrawalStartAge: withdrawing.startAge,
      withdrawalEndAge: withdrawing.endAge,
    };
  },
};

// ── Other existing asset ─────────────────────────────────────────────────────
// "loan" shows the "any 3 of 4" loan boxes; "none" hides them.
export type OtherExistingAssetText = {
  value: string;
  appreciationPct: string; // may be negative (loses value)
  purchaseAge: AgeText; // required
  financed: "none" | "loan";
  loan: LoanText; // loan only
};
export const otherExistingAssetForm: EntityForm<OtherExistingAssetText, OtherExistingAssetInput> = {
  read: (saved) => ({
    value: readDollarsText(saved?.assetValue),
    appreciationPct: readNumberText(saved?.appreciationPct),
    purchaseAge: readAgeText(saved?.purchaseAge),
    financed: saved?.financedWithLoan === true ? "loan" : "none",
    loan: readLoanText(saved),
  }),
  toInputs: (t) => {
    const value = parseDollars(t.value);
    const appreciationPct = parseSignedPercent(t.appreciationPct);
    const purchaseAge = parseRequiredAge(t.purchaseAge);
    if (value === null || appreciationPct === null || purchaseAge === null) return null;
    const shared = { assetValue: value, appreciationPct, purchaseAge };

    if (t.financed === "none") return { ...shared, financedWithLoan: false, ...NO_LOAN };
    const loan = parseLoanText(t.loan);
    return loan === null ? null : { ...shared, financedWithLoan: true, ...loan };
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// Plans & spending
// ═════════════════════════════════════════════════════════════════════════════

// ── Income ───────────────────────────────────────────────────────────────────
// Income tax: "calculated" lets the engine work it out (federal + state); "rate" uses your own combined rate.
export type IncomeText = {
  salary: string; // per year
  raisePct: string; // may be negative
  filingStatus: FilingStatus;
  startAge: AgeText; // optional: blank = now
  endAge: AgeText; // optional: blank = never ends
  charityPct: string; // optional
  retirementPct: string; // optional
  retirementReturnPct: string; // optional: blank = the preset
  taxMode: "calculated" | "rate";
  taxRatePct: string; // rate only
};
/** `retirementAccount` is left out: masterEngine sets it (account 3). */
export const incomeForm: EntityForm<IncomeText, Omit<IncomeInput, "retirementAccount">> = {
  read: (saved) => ({
    salary: readDollarsText(saved?.salary),
    raisePct: saved ? readNumberText(saved.raisePct) : "0", // a new income starts with no raise
    filingStatus: readChoice(saved?.filingStatus, ["single", "married"], "single"),
    startAge: readAgeText(saved?.startAge),
    endAge: readAgeText(saved?.endAge),
    charityPct: readNumberText(saved?.charityPct),
    retirementPct: readNumberText(saved?.retirementContributionPct),
    retirementReturnPct: readNumberText(saved?.retirementReturnPct),
    taxMode: typeof saved?.incomeTaxRatePct === "number" ? "rate" : "calculated",
    taxRatePct: readNumberText(saved?.incomeTaxRatePct),
  }),
  toInputs: (t) => {
    const salary = parseDollars(t.salary);
    const raisePct = parseSignedPercent(t.raisePct);
    const working = parseAgeWindow(t.startAge, t.endAge);
    const charityPct = optional(t.charityPct, parsePercent);
    const retirementPct = optional(t.retirementPct, parsePercent);
    const retirementReturnPct = optional(t.retirementReturnPct, parseSignedPercent);
    const taxRatePct = t.taxMode === "rate" ? parsePercent(t.taxRatePct) : null;
    if (salary === null || raisePct === null || working === null) return null;
    if (charityPct === undefined || retirementPct === undefined || retirementReturnPct === undefined) return null;
    if (t.taxMode === "rate" && taxRatePct === null) return null;
    return {
      salary,
      raisePct,
      filingStatus: t.filingStatus,
      startAge: working.startAge,
      endAge: working.endAge,
      charityPct,
      retirementContributionPct: retirementPct,
      retirementReturnPct,
      incomeTaxRatePct: taxRatePct,
    };
  },
};

// ── Renting ──────────────────────────────────────────────────────────────────
export type RentingText = { rent: string; utilities: string; junkFees: string; startAge: AgeText; endAge: AgeText };
export const rentingForm: EntityForm<RentingText, RentingInput> = {
  read: (saved) => ({
    rent: readDollarsText(saved?.rentMonthly),
    utilities: readDollarsText(saved?.utilitiesMonthly),
    junkFees: readDollarsText(saved?.junkFeesMonthly),
    startAge: readAgeText(saved?.startAge),
    endAge: readAgeText(saved?.endAge),
  }),
  toInputs: (t) => {
    const rent = parseDollars(t.rent);
    const utilities = optional(t.utilities, parseDollars);
    const junkFees = optional(t.junkFees, parseDollars);
    const window = parseAgeWindow(t.startAge, t.endAge);
    if (rent === null || utilities === undefined || junkFees === undefined || window === null) return null;
    return { rentMonthly: rent, utilitiesMonthly: utilities, junkFeesMonthly: junkFees, ...window };
  },
};

// ── Buying a home ────────────────────────────────────────────────────────────
// "mortgage" shows the down payment, term and rate. "cash" hides them: it saves a 100% down payment,
// which is how the engine knows there is no loan (it then never reads the term or the rate).
export type BuyingHomeText = {
  payment: "mortgage" | "cash";
  purchaseAge: AgeText; // required
  price: string;
  downPct: string; // mortgage only
  termYears: string; // mortgage only
  ratePct: string; // mortgage only
  utilities: string; // optional: blank = the preset
  sellAge: AgeText; // optional
};
export const buyingHomeForm: EntityForm<BuyingHomeText, BuyingHomeInput> = {
  read: (saved) => {
    const isCash = saved?.downPaymentPct === 100;
    return {
      payment: isCash ? "cash" : "mortgage",
      purchaseAge: readAgeText(saved?.purchaseAge),
      price: readDollarsText(saved?.totalPropertyValue),
      downPct: isCash ? "" : readNumberText(saved?.downPaymentPct),
      termYears: isCash ? "" : readNumberText(saved?.mortgageTermYears),
      ratePct: isCash ? "" : readNumberText(saved?.interestRatePct),
      utilities: readDollarsText(saved?.utilitiesMonthly),
      sellAge: readAgeText(saved?.sellAge),
    };
  },
  toInputs: (t) => {
    const purchaseAge = parseRequiredAge(t.purchaseAge);
    const price = parseDollars(t.price);
    const utilities = optional(t.utilities, parseDollars);
    const sellAge = parseOptionalAge(t.sellAge);
    if (purchaseAge === null || price === null || utilities === undefined || sellAge === undefined) return null;
    if (sellsBeforeBuying(sellAge, purchaseAge)) return null;
    const shared = { purchaseAge, totalPropertyValue: price, utilitiesMonthly: utilities, sellAge };

    if (t.payment === "cash") return { ...shared, downPaymentPct: 100, mortgageTermYears: 0, interestRatePct: 0 }; // term / rate unused: no loan
    const downPct = parsePercent(t.downPct);
    const termYears = parseWholeFrom1(t.termYears);
    const ratePct = parsePercent(t.ratePct);
    if (downPct === null || termYears === null || ratePct === null) return null;
    return { ...shared, downPaymentPct: downPct, mortgageTermYears: termYears, interestRatePct: ratePct };
  },
};

// ── Buying a car ─────────────────────────────────────────────────────────────
// "loan" shows the loan boxes; "full" hides them.
export type BuyingCarText = {
  financing: "loan" | "full";
  purchaseAge: AgeText; // required
  price: string;
  downPct: string; // loan only
  termMonths: string; // loan only
  ratePct: string; // loan only
  sellAge: AgeText; // optional
  insurance: string; // optional: blank = the preset
  maintenance: string; // optional: blank = the preset
};
export const buyingCarForm: EntityForm<BuyingCarText, BuyingCarInput> = {
  read: (saved) => ({
    financing: readChoice(saved?.financing, ["loan", "full"], "loan"),
    purchaseAge: readAgeText(saved?.purchaseAge),
    price: readDollarsText(saved?.totalVehicleValue),
    downPct: readNumberText(saved?.downPaymentPct),
    termMonths: readNumberText(saved?.loanTermMonths),
    ratePct: readNumberText(saved?.interestRatePct),
    sellAge: readAgeText(saved?.sellAge),
    insurance: readDollarsText(saved?.insuranceMonthly),
    maintenance: readDollarsText(saved?.maintenanceMonthly),
  }),
  toInputs: (t) => {
    const purchaseAge = parseRequiredAge(t.purchaseAge);
    const price = parseDollars(t.price);
    const sellAge = parseOptionalAge(t.sellAge);
    const insurance = optional(t.insurance, parseDollars);
    const maintenance = optional(t.maintenance, parseDollars);
    if (purchaseAge === null || price === null || sellAge === undefined || insurance === undefined || maintenance === undefined)
      return null;
    if (sellsBeforeBuying(sellAge, purchaseAge)) return null;
    const shared = { purchaseAge, totalVehicleValue: price, sellAge, insuranceMonthly: insurance, maintenanceMonthly: maintenance };

    if (t.financing === "full") return { financing: "full", ...shared, downPaymentPct: null, loanTermMonths: null, interestRatePct: null };
    const downPct = parsePercent(t.downPct);
    const termMonths = parseWholeFrom1(t.termMonths);
    const ratePct = parsePercent(t.ratePct);
    if (downPct === null || termMonths === null || ratePct === null) return null;
    return { financing: "loan", ...shared, downPaymentPct: downPct, loanTermMonths: termMonths, interestRatePct: ratePct };
  },
};

// ── Gas ──────────────────────────────────────────────────────────────────────
export type GasText = { milesPerWeek: string; mpg: string; gasPrice: string; startAge: AgeText; endAge: AgeText };
export const gasForm: EntityForm<GasText, GasInput> = {
  read: (saved) => ({
    milesPerWeek: readNumberText(saved?.milesPerWeek),
    mpg: readNumberText(saved?.mpg),
    gasPrice: readNumberText(saved?.gasPricePerGallon),
    startAge: readAgeText(saved?.startAge),
    endAge: readAgeText(saved?.endAge),
  }),
  toInputs: (t) => {
    const milesPerWeek = parseDecimal(t.milesPerWeek);
    const mpg = parsePositiveDecimal(t.mpg);
    const gasPrice = optional(t.gasPrice, parseDecimal);
    const window = parseAgeWindow(t.startAge, t.endAge);
    if (milesPerWeek === null || mpg === null || gasPrice === undefined || window === null) return null;
    return { milesPerWeek, mpg, gasPricePerGallon: gasPrice, ...window };
  },
};

// ── Kid ──────────────────────────────────────────────────────────────────────
export type KidText = { annualCost: string; birthAge: AgeText };
export const kidForm: EntityForm<KidText, KidInput> = {
  read: (saved) => ({ annualCost: readDollarsText(saved?.annualCost), birthAge: readAgeText(saved?.birthAge) }),
  toInputs: (t) => {
    const annualCost = parseDollars(t.annualCost);
    const birthAge = parseRequiredAge(t.birthAge);
    return annualCost === null || birthAge === null ? null : { annualCost, birthAge };
  },
};

// ── Education ────────────────────────────────────────────────────────────────
// "loan" shows the loan rate and term; "full" hides them.
export type EducationText = {
  paymentType: "loan" | "full";
  costPerSemester: string;
  semesters: string;
  startAge: AgeText; // required
  loanRatePct: string; // loan only
  loanTermYears: string; // loan only
};
export const educationForm: EntityForm<EducationText, EducationInput> = {
  read: (saved) => ({
    paymentType: readChoice(saved?.paymentType, ["loan", "full"], "loan"),
    costPerSemester: readDollarsText(saved?.costPerSemester),
    semesters: readNumberText(saved?.numberOfSemesters),
    startAge: readAgeText(saved?.startAge),
    loanRatePct: readNumberText(saved?.loanRatePct),
    loanTermYears: readNumberText(saved?.loanTermYears),
  }),
  toInputs: (t) => {
    const costPerSemester = parseDollars(t.costPerSemester);
    const semesters = parseWholeFrom1(t.semesters);
    const startAge = parseRequiredAge(t.startAge);
    if (costPerSemester === null || semesters === null || startAge === null) return null;
    const shared = { costPerSemester, numberOfSemesters: semesters, startAge };

    if (t.paymentType === "full") return { paymentType: "full", ...shared, loanRatePct: null, loanTermYears: null };
    const loanRatePct = parsePercent(t.loanRatePct);
    const loanTermYears = parseWholeFrom1(t.loanTermYears);
    if (loanRatePct === null || loanTermYears === null) return null;
    return { paymentType: "loan", ...shared, loanRatePct, loanTermYears };
  },
};

// ── Investing (a new account) ────────────────────────────────────────────────
export type InvestingText = InvestmentFlowText & {
  initial: string; // paid at the start age
  returnPct: string;
  contributionStartAge: AgeText; // required: when the account opens
};
/** `account` is left out: masterEngine assigns it (4–12). */
export const investingForm: EntityForm<InvestingText, Omit<InvestingInput, "account">> = {
  read: (saved) => ({
    initial: saved ? readDollarsText(saved.initialContribution) : "0", // a new account starts with nothing paid in up front
    returnPct: readNumberText(saved?.returnPct),
    contributionStartAge: readAgeText(saved?.contributionStartAge),
    contribution: readDollarsText(saved?.monthlyContribution),
    contributionEndAge: readAgeText(saved?.contributionEndAge),
    withdrawal: readDollarsText(saved?.monthlyWithdrawal),
    withdrawalStartAge: readAgeText(saved?.withdrawalStartAge),
    withdrawalEndAge: readAgeText(saved?.withdrawalEndAge),
  }),
  toInputs: (t) => {
    const initial = parseDollars(t.initial);
    const returnPct = parseSignedPercent(t.returnPct);
    const startAge = parseRequiredAge(t.contributionStartAge);
    const contribution = optional(t.contribution, parseDollars);
    const withdrawal = optional(t.withdrawal, parseDollars);
    const contributing = parseAgeWindow(t.contributionStartAge, t.contributionEndAge);
    const withdrawing = parseAgeWindow(t.withdrawalStartAge, t.withdrawalEndAge);
    if (initial === null || returnPct === null || startAge === null || contribution === undefined || withdrawal === undefined) return null;
    if (contributing === null || withdrawing === null) return null;
    // With no withdrawal start age the engine starts withdrawals when the account opens, so the end must be after that.
    if (!withdrawing.startAge && withdrawing.endAge && ageInMonths(withdrawing.endAge) <= ageInMonths(startAge)) return null;
    return {
      initialContribution: initial,
      returnPct,
      contributionStartAge: startAge,
      monthlyContribution: contribution,
      contributionEndAge: contributing.endAge,
      monthlyWithdrawal: withdrawal,
      withdrawalStartAge: withdrawing.startAge,
      withdrawalEndAge: withdrawing.endAge,
    };
  },
};

// ── Food ─────────────────────────────────────────────────────────────────────
export type FoodText = { diningOut: string; groceries: string; startAge: AgeText; endAge: AgeText };
export const foodForm: EntityForm<FoodText, FoodInput> = {
  read: (saved) => ({
    diningOut: readDollarsText(saved?.diningOutMonthly),
    groceries: readDollarsText(saved?.groceriesMonthly),
    startAge: readAgeText(saved?.startAge),
    endAge: readAgeText(saved?.endAge),
  }),
  toInputs: (t) => {
    const diningOut = parseDollars(t.diningOut);
    const groceries = parseDollars(t.groceries);
    const window = parseAgeWindow(t.startAge, t.endAge);
    if (diningOut === null || groceries === null || window === null) return null;
    return { diningOutMonthly: diningOut, groceriesMonthly: groceries, ...window };
  },
};

// ── Health insurance ─────────────────────────────────────────────────────────
export const HEALTH_INSURANCE_TYPES: readonly HealthInsuranceType[] = [
  "employerIndividual",
  "employerFamily",
  "marketplaceIndividual",
  "marketplaceFamily",
  "medicare",
  "none",
];
export type HealthInsuranceText = { type: HealthInsuranceType; premium: string; startAge: AgeText; endAge: AgeText };
export const healthInsuranceForm: EntityForm<HealthInsuranceText, HealthInsuranceInput> = {
  read: (saved) => ({
    type: readChoice(saved?.type, HEALTH_INSURANCE_TYPES, "employerIndividual"),
    premium: readDollarsText(saved?.monthlyPremiumOverride),
    startAge: readAgeText(saved?.startAge),
    endAge: readAgeText(saved?.endAge),
  }),
  toInputs: (t) => {
    const premium = optional(t.premium, parseDollars);
    const window = parseAgeWindow(t.startAge, t.endAge);
    if (premium === undefined || window === null) return null;
    return { type: t.type, monthlyPremiumOverride: premium, ...window };
  },
};

// ── Pet ──────────────────────────────────────────────────────────────────────
export type PetText = { startAge: AgeText; lifespanYears: string; vetPerYear: string; foodPerMonth: string; adoptionCost: string };
export const petForm: EntityForm<PetText, PetInput> = {
  read: (saved) => ({
    startAge: readAgeText(saved?.startAge),
    lifespanYears: readNumberText(saved?.lifespanYears),
    vetPerYear: readDollarsText(saved?.vetPerYear),
    foodPerMonth: readDollarsText(saved?.foodPerMonth),
    adoptionCost: readDollarsText(saved?.adoptionCost),
  }),
  toInputs: (t) => {
    const startAge = parseRequiredAge(t.startAge);
    const lifespanYears = parseWholeFrom1(t.lifespanYears);
    const vetPerYear = parseDollars(t.vetPerYear);
    const foodPerMonth = parseDollars(t.foodPerMonth);
    const adoptionCost = parseDollars(t.adoptionCost);
    if (startAge === null || lifespanYears === null || vetPerYear === null || foodPerMonth === null || adoptionCost === null) return null;
    return { startAge, lifespanYears, vetPerYear, foodPerMonth, adoptionCost };
  },
};

// ── Personal ─────────────────────────────────────────────────────────────────
/** The eight monthly amounts, in the order the card shows them. Every one is optional. */
export const PERSONAL_KEYS = ["clothing", "otherPersonalCare", "entertainment", "gym", "phonePlan", "books", "courses", "events"] as const;
export type PersonalKey = (typeof PERSONAL_KEYS)[number];
export type PersonalText = Record<PersonalKey, string> & { startAge: AgeText; endAge: AgeText };
export const personalForm: EntityForm<PersonalText, PersonalInput> = {
  read: (saved) => ({
    clothing: readDollarsText(saved?.clothing),
    otherPersonalCare: readDollarsText(saved?.otherPersonalCare),
    entertainment: readDollarsText(saved?.entertainment),
    gym: readDollarsText(saved?.gym),
    phonePlan: readDollarsText(saved?.phonePlan),
    books: readDollarsText(saved?.books),
    courses: readDollarsText(saved?.courses),
    events: readDollarsText(saved?.events),
    startAge: readAgeText(saved?.startAge),
    endAge: readAgeText(saved?.endAge),
  }),
  toInputs: (t) => {
    const window = parseAgeWindow(t.startAge, t.endAge);
    if (window === null) return null;
    const inputs: PersonalInput = { ...window };
    for (const key of PERSONAL_KEYS) {
      const amount = optional(t[key], parseDollars);
      if (amount === undefined) return null;
      inputs[key] = amount;
    }
    return inputs;
  },
};

// ── Birthdays & Christmas, recurring payment ─────────────────────────────────
// Both are an amount, how often (a yearly amount is spread over 12 months), and an age window.
export type AmountFrequencyText = { amount: string; frequency: Frequency; startAge: AgeText; endAge: AgeText };
const amountFrequencyForm: EntityForm<AmountFrequencyText, RecurringPaymentInput> = {
  read: (saved) => ({
    amount: readDollarsText(saved?.amount),
    frequency: readChoice(saved?.frequency, ["monthly", "yearly"], "monthly"),
    startAge: readAgeText(saved?.startAge),
    endAge: readAgeText(saved?.endAge),
  }),
  toInputs: (t) => {
    const amount = parseDollars(t.amount);
    const window = parseAgeWindow(t.startAge, t.endAge);
    if (amount === null || window === null) return null;
    return { amount, frequency: t.frequency, ...window };
  },
};
export const recurringPaymentForm: EntityForm<AmountFrequencyText, RecurringPaymentInput> = amountFrequencyForm;
export const birthdayChristmasForm: EntityForm<AmountFrequencyText, BirthdayChristmasInput> = amountFrequencyForm;

// ── One-time expense ─────────────────────────────────────────────────────────
export type OneTimeExpenseText = { age: AgeText; amount: string };
export const oneTimeExpenseForm: EntityForm<OneTimeExpenseText, OneTimeExpenseInput> = {
  read: (saved) => ({ age: readAgeText(saved?.age), amount: readDollarsText(saved?.amount) }),
  toInputs: (t) => {
    const age = parseRequiredAge(t.age);
    const amount = parseDollars(t.amount);
    return age === null || amount === null ? null : { age, amount };
  },
};
