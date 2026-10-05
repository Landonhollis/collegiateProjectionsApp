// formParsing.ts
// Text ↔ number helpers for the edit cards. Inputs hold text; these turn it into numbers and back.
//   required parse:  null = not valid (yet)
//   optional parse:  null = left blank (not given), undefined = not valid
// No React or React Native in here, so the tests can run it.
import type { Age } from "../TypesAndVariables/types";

// ── parsing ──────────────────────────────────────────────────────────────────
/** Whole dollars ≥ 0, e.g. "350000" or "350,000". */
export function parseDollars(text: string): number | null {
  const clean = text.replace(/,/g, "").trim();
  return /^\d+$/.test(clean) ? Number(clean) : null;
}

/** Percent 0–100, decimals allowed, e.g. "6.5". */
export function parsePercent(text: string): number | null {
  const clean = text.trim();
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return n <= 100 ? n : null;
}

/** Whole number ≥ min, e.g. a loan term in years. */
export function parseWhole(text: string, min = 0): number | null {
  const clean = text.trim();
  if (!/^\d+$/.test(clean)) return null;
  const n = Number(clean);
  return n >= min ? n : null;
}

export type AgeText = { years: string; months: string };
export const EMPTY_AGE: AgeText = { years: "", months: "" };

export function ageToText(age: Age | null | undefined): AgeText {
  return age ? { years: String(age.years), months: String(age.months) } : EMPTY_AGE;
}

/** Saved age (from entity.inputs, typed unknown) → text boxes. Anything that isn't an age → blank. */
export function readAgeText(value: unknown): AgeText {
  if (typeof value !== "object" || value === null) return EMPTY_AGE;
  const { years, months } = value as Record<string, unknown>;
  return typeof years === "number" && typeof months === "number" ? ageToText({ years, months }) : EMPTY_AGE;
}

/** Saved number (from entity.inputs, typed unknown) → text box. */
export function readNumberText(value: unknown): string {
  return typeof value === "number" ? String(value) : "";
}

/** Saved dollars → text box with thousands commas, e.g. 350000 → "350,000". */
export function readDollarsText(value: unknown): string {
  return typeof value === "number" ? formatDollars(value) : "";
}

/** 350000 → "350,000". */
export function formatDollars(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Optional age: both blank → null (not given). undefined = invalid. Blank months = 0. */
export function parseOptionalAge(text: AgeText): Age | null | undefined {
  if (text.years.trim() === "" && text.months.trim() === "") return null;
  const years = parseWhole(text.years);
  const months = text.months.trim() === "" ? 0 : parseWhole(text.months);
  if (years === null || months === null || months > 11) return undefined;
  return { years, months };
}

/** Percent from −100 to 100, decimals allowed, e.g. "7" or "-2.5". For rates that may be negative. */
export function parseSignedPercent(text: string): number | null {
  const clean = text.trim().replace("−", "-");
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return n >= -100 && n <= 100 ? n : null;
}

/** Number ≥ 0, decimals allowed, e.g. "3.59". */
export function parseDecimal(text: string): number | null {
  const clean = text.replace(/,/g, "").trim();
  return /^\d+(\.\d+)?$/.test(clean) ? Number(clean) : null;
}

/** Number above 0, decimals allowed, e.g. miles per gallon. */
export function parsePositiveDecimal(text: string): number | null {
  const n = parseDecimal(text);
  return n !== null && n > 0 ? n : null;
}

/** Whole number ≥ 1, e.g. a loan term. */
export function parseWholeFrom1(text: string): number | null {
  return parseWhole(text, 1);
}

/** Makes any parse optional: blank → null (not given), not valid → undefined. */
export function optional(text: string, parse: (text: string) => number | null): number | null | undefined {
  if (text.trim() === "") return null;
  return parse(text) ?? undefined;
}

/** Required age: blank or not valid → null. Blank months = 0. */
export function parseRequiredAge(text: AgeText): Age | null {
  return parseOptionalAge(text) ?? null;
}

export function ageInMonths(age: Age): number {
  return age.years * 12 + age.months;
}

/** { years: 22, months: 4 } → "22 yrs 4 mos"; months are left off when 0. */
export function ageLabel(age: Age): string {
  return age.months === 0 ? `${age.years} yrs` : `${age.years} yrs ${age.months} mos`;
}

/**
 * A start age and an end age, both optional. null = not valid: either box doesn't parse,
 * or the end isn't after the start (nothing would ever happen).
 */
export function parseAgeWindow(start: AgeText, end: AgeText): { startAge: Age | null; endAge: Age | null } | null {
  const startAge = parseOptionalAge(start);
  const endAge = parseOptionalAge(end);
  if (startAge === undefined || endAge === undefined) return null;
  if (startAge && endAge && ageInMonths(endAge) <= ageInMonths(startAge)) return null;
  return { startAge, endAge };
}

/** True when both ages parse and `later` is before `earlier` (e.g. selling before buying). */
export function isBefore(later: AgeText, earlier: AgeText): boolean {
  const a = parseOptionalAge(later);
  const b = parseOptionalAge(earlier);
  return !!a && !!b && ageInMonths(a) < ageInMonths(b);
}

/** Saved choice (typed unknown) → one of the options, or the fallback. */
export function readChoice<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.find((o) => o === value) ?? fallback;
}

// ── an existing loan ("any 3 of 4") ──────────────────────────────────────────
/** Text of the four boxes that describe an existing loan. */
export type LoanText = { balance: string; ratePct: string; termMonths: string; payment: string };
export const EMPTY_LOAN: LoanText = { balance: "", ratePct: "", termMonths: "", payment: "" };

/** The engines' names for those four boxes. */
export type LoanInputs = {
  remainingBalance: number | null;
  interestRatePct: number | null;
  remainingTermMonths: number | null;
  monthlyPayment: number | null;
};
export const NO_LOAN: LoanInputs = { remainingBalance: null, interestRatePct: null, remainingTermMonths: null, monthlyPayment: null };

export function readLoanText(saved: Record<string, unknown> | undefined): LoanText {
  return {
    balance: readDollarsText(saved?.remainingBalance),
    ratePct: readNumberText(saved?.interestRatePct),
    termMonths: readNumberText(saved?.remainingTermMonths),
    payment: readDollarsText(saved?.monthlyPayment),
  };
}

/** null unless every filled box is valid and at least 3 of the 4 are filled (the engine works out the 4th). */
export function parseLoanText(text: LoanText): LoanInputs | null {
  const remainingBalance = optional(text.balance, parseDollars);
  const interestRatePct = optional(text.ratePct, parsePercent);
  const remainingTermMonths = optional(text.termMonths, parseWholeFrom1);
  const monthlyPayment = optional(text.payment, parseDollars);
  if (
    remainingBalance === undefined ||
    interestRatePct === undefined ||
    remainingTermMonths === undefined ||
    monthlyPayment === undefined
  ) {
    return null;
  }
  const filled = [remainingBalance, interestRatePct, remainingTermMonths, monthlyPayment].filter((v) => v !== null).length;
  return filled >= 3 ? { remainingBalance, interestRatePct, remainingTermMonths, monthlyPayment } : null;
}

// ── error text ───────────────────────────────────────────────────────────────
/** Error to show under a box: only once something is typed and it doesn't parse (null). */
export function fieldError(text: string, parsed: number | null, message: string): string | null {
  return text.trim() !== "" && parsed === null ? message : null;
}

export const ERRORS = {
  dollars: "Enter a whole dollar amount",
  percent: "Enter a percent from 0 to 100",
  signedPercent: "Enter a percent from −100 to 100",
  years: "Enter whole years, 1 or more",
  months: "Enter whole months, 1 or more",
  whole: "Enter a whole number, 1 or more",
  decimal: "Enter a number, 0 or more",
  number: "Enter a whole number",
  positive: "Enter a number above 0",
  age: "Whole years; months 0–11",
  endBeforeStart: "Must be after the start age",
  sellBeforeBuy: "Must be after the age you buy it",
};
