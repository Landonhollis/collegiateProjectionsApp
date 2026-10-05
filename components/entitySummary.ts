import { HEALTH_PREMIUM_MONTHLY } from "../TypesAndVariables/presetVars";
import { HEALTH_PLAN_LABELS } from "../TypesAndVariables/entityTypeLabels";
import { formatDollars } from "./formParsing";
import type { Age, EntityTypeKey, HealthInsuranceType } from "../TypesAndVariables/types";

// The one or two facts shown on an entity card, so you can tell entities apart without opening them:
//   entitySummary(type, entity.inputs) → up to 2 short lines, the most important first.
// It reads saved inputs, which may be missing things or hold the wrong kind of value. Like the edit forms,
// anything it can't read is left out rather than thrown (the card still shows; the edit card is where it gets fixed).
// Lines are kept short (about 22 characters) because the card is half a phone wide.
// No React in here, so tests/entitySummaryTest.ts can run it.

type Saved = Record<string, unknown>;

/** A saved number, or null when it's missing or not a number. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A saved age, or null when it's missing or malformed. */
function age(value: unknown): Age | null {
  if (typeof value !== "object" || value === null) return null;
  const { years, months } = value as { years?: unknown; months?: unknown };
  return typeof years === "number" && typeof months === "number" ? { years, months } : null;
}

/** 320000 → "$320,000" (whole dollars). */
function dollars(n: number): string {
  return `$${formatDollars(Math.round(n))}`;
}

/** { years: 30, months: 0 } → "30"; { years: 30, months: 4 } → "30y 4m". */
function ageText(a: Age): string {
  return a.months === 0 ? String(a.years) : `${a.years}y ${a.months}m`;
}

/** When something runs: "Age 22 to 65", "From age 22", "Until age 65", or null when no ages are set (it runs the whole time). */
function ageWindow(start: unknown, end: unknown): string | null {
  const from = age(start);
  const to = age(end);
  if (from && to) return `Age ${ageText(from)} to ${ageText(to)}`;
  if (from) return `From age ${ageText(from)}`;
  if (to) return `Until age ${ageText(to)}`;
  return null;
}

/** What is still owed on something you already have: "Owes $14,000", or "Paid off" at 0 / blank. */
function owes(balance: unknown): string {
  const owed = num(balance);
  return owed !== null && owed > 0 ? `Owes ${dollars(owed)}` : "Paid off";
}

/** Existing loans take any 3 of balance, rate, time left and payment, so show the first two of those that were given. */
function loanFacts(i: Saved): (string | null)[] {
  const balance = num(i.remainingBalance);
  const rate = num(i.interestRatePct);
  const payment = num(i.monthlyPayment);
  const term = num(i.remainingTermMonths);
  return [
    balance === null ? null : rate === null ? `Owes ${dollars(balance)}` : `Owes ${dollars(balance)} at ${rate}%`,
    payment === null ? null : `Pays ${dollars(payment)}/mo`,
    term === null ? null : `${term} months left`,
  ];
}

/** An amount that's entered per month or per year: "$100/mo" or "$1,200/yr". */
function amountPerPeriod(i: Saved): string | null {
  const amount = num(i.amount);
  if (amount === null) return null;
  return `${dollars(amount)}${i.frequency === "yearly" ? "/yr" : "/mo"}`;
}

/** Every candidate fact for this entity, most important first; null = that input isn't there. */
function facts(type: EntityTypeKey, i: Saved): (string | null)[] {
  switch (type) {
    case "openingCash": {
      const amount = num(i.amount);
      return [amount === null ? null : dollars(amount)];
    }
    case "existingHome": {
      const price = num(i.totalPropertyValue);
      return [price === null ? null : `Bought for ${dollars(price)}`, owes(i.remainingBalance)];
    }
    case "existingVehicle": {
      const price = num(i.totalVehicleValue);
      return [price === null ? null : `Bought for ${dollars(price)}`, i.financing === "loan" ? owes(i.remainingBalance) : "Paid in full"];
    }
    case "existingCreditCard": {
      const balance = num(i.currentBalance);
      const apr = num(i.aprPct);
      const payment = num(i.monthlyPayment);
      return [
        balance === null ? null : apr === null ? `Owes ${dollars(balance)}` : `Owes ${dollars(balance)} at ${apr}%`,
        payment === null ? null : `Pays ${dollars(payment)}/mo`,
      ];
    }
    case "existingStudentLoans":
    case "otherExistingLoan":
      return loanFacts(i);
    case "existingInvestment": {
      const invested = num(i.currentInvested);
      const rate = num(i.returnPct);
      const adds = num(i.monthlyContribution);
      const takes = num(i.monthlyWithdrawal);
      return [
        invested === null ? null : rate === null ? dollars(invested) : `${dollars(invested)} at ${rate}%`,
        adds ? `Adds ${dollars(adds)}/mo` : null,
        takes ? `Takes ${dollars(takes)}/mo` : null,
      ];
    }
    case "otherExistingAsset": {
      const value = num(i.assetValue);
      const growth = num(i.appreciationPct);
      return [
        value === null ? null : `Bought for ${dollars(value)}`,
        growth === null ? null : growth > 0 ? `Grows ${growth}%/yr` : growth < 0 ? `Loses ${-growth}%/yr` : "Holds its value",
      ];
    }
    case "income": {
      const salary = num(i.salary);
      return [salary === null ? null : `${dollars(salary)}/yr`, ageWindow(i.startAge, i.endAge)];
    }
    case "renting": {
      const rent = num(i.rentMonthly);
      return [rent === null ? null : `${dollars(rent)}/mo rent`, ageWindow(i.startAge, i.endAge)];
    }
    case "buyingHome": {
      const price = num(i.totalPropertyValue);
      const at = age(i.purchaseAge);
      const years = num(i.mortgageTermYears);
      const rate = num(i.interestRatePct);
      const loan = years === null ? null : rate === null ? `${years} yr loan` : `${years} yr loan at ${rate}%`;
      return [
        price === null ? null : at ? `${dollars(price)} at age ${ageText(at)}` : dollars(price),
        num(i.downPaymentPct) === 100 ? "Paid in cash" : loan,
      ];
    }
    case "buyingCar": {
      const price = num(i.totalVehicleValue);
      const at = age(i.purchaseAge);
      const months = num(i.loanTermMonths);
      const rate = num(i.interestRatePct);
      const loan = months === null ? null : rate === null ? `${months} mo loan` : `${months} mo loan at ${rate}%`;
      return [
        price === null ? null : at ? `${dollars(price)} at age ${ageText(at)}` : dollars(price),
        i.financing === "loan" ? loan : "Paid in full",
      ];
    }
    case "gas": {
      const miles = num(i.milesPerWeek);
      const mpg = num(i.mpg);
      return [miles === null || mpg === null ? null : `${miles} mi/wk at ${mpg} mpg`, ageWindow(i.startAge, i.endAge)];
    }
    case "kid": {
      const born = age(i.birthAge);
      const cost = num(i.annualCost);
      return [born ? `Born when you're ${ageText(born)}` : null, cost === null ? null : `${dollars(cost)}/yr`];
    }
    case "education": {
      const cost = num(i.costPerSemester);
      const semesters = num(i.numberOfSemesters);
      const start = age(i.startAge);
      const how = i.paymentType === "loan" ? "Loan" : "Cash";
      return [
        cost === null || semesters === null ? null : `${dollars(cost)} × ${semesters} semesters`,
        start ? `${how}, from age ${ageText(start)}` : how,
      ];
    }
    case "investing": {
      const monthly = num(i.monthlyContribution);
      const first = num(i.initialContribution);
      const rate = num(i.returnPct);
      // The monthly amount when there is one; otherwise it's a single deposit.
      const amount = monthly ? `${dollars(monthly)}/mo` : first ? dollars(first) : null;
      return [
        amount === null ? null : rate === null ? amount : `${amount} at ${rate}%`,
        ageWindow(i.contributionStartAge, i.contributionEndAge),
      ];
    }
    case "food": {
      const groceries = num(i.groceriesMonthly);
      const diningOut = num(i.diningOutMonthly);
      return [
        groceries === null ? null : `Groceries ${dollars(groceries)}/mo`,
        diningOut === null ? null : `Dining out ${dollars(diningOut)}/mo`,
      ];
    }
    case "healthInsurance": {
      const plan = typeof i.type === "string" && i.type in HEALTH_PLAN_LABELS ? (i.type as HealthInsuranceType) : null;
      if (!plan) return [];
      // Your own premium when you typed one, otherwise the plan's average.
      return [HEALTH_PLAN_LABELS[plan], `${dollars(num(i.monthlyPremiumOverride) ?? HEALTH_PREMIUM_MONTHLY[plan])}/mo`];
    }
    case "pet": {
      const start = age(i.startAge);
      const years = num(i.lifespanYears);
      const monthly = (num(i.foodPerMonth) ?? 0) + (num(i.vetPerYear) ?? 0) / 12;
      return [
        start ? (years === null ? `From age ${ageText(start)}` : `From age ${ageText(start)}, ${years} yrs`) : null,
        monthly > 0 ? `About ${dollars(monthly)}/mo` : null,
      ];
    }
    case "personal": {
      const parts = [i.clothing, i.otherPersonalCare, i.entertainment, i.gym, i.phonePlan, i.books, i.courses, i.events];
      const total = parts.reduce<number>((sum, part) => sum + (num(part) ?? 0), 0);
      return [`${dollars(total)}/mo total`, ageWindow(i.startAge, i.endAge)];
    }
    case "birthdayChristmas":
    case "recurringPayment":
      return [amountPerPeriod(i), ageWindow(i.startAge, i.endAge)];
    case "oneTimeExpense": {
      const amount = num(i.amount);
      const at = age(i.age);
      return [amount === null ? null : dollars(amount), at ? `At age ${ageText(at)}` : null];
    }
  }
}

/** Up to 2 short lines about this entity for its card. */
export function entitySummary(type: EntityTypeKey, inputs: Record<string, unknown>): string[] {
  const all = facts(type, inputs);
  if (!all) throw new Error(`entitySummary: unknown entity type "${String(type)}"`);
  return all.filter((fact): fact is string => fact !== null).slice(0, 2);
}
