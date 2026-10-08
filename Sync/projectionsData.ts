// projectionsData.ts
// ─────────────────────────────────────────────────────────────────────────────
// The one object this app saves for each user (ProjectionsData), and the rules for keeping the phone's copy
// and the server's copy in step. No React, React Native or Supabase in here, so tests/syncTest.ts can run it.
//
// WHERE IT LIVES
//   • Phone:  AsyncStorage key slotKey(userId) → LocalSlot { data, uploadWaiting, syncedVersion }
//             One slot per user, so signing in as someone else never touches another user's data.
//   • Server: table app_data, one row per user per app → { data, version }
//             The server adds 1 to version on every save.
//
// THE RULES (nextSyncStep)
//   • The phone is the main copy. Every change is saved there first, with uploadWaiting = true.
//   • Nothing waiting, and the server's version has moved on → take the server's copy (another device saved).
//   • Something waiting, and the server's version hasn't moved → upload.
//   • Something waiting AND the server's version has moved (a conflict) → the copy edited most recently wins.
//
// Saved data is checked when it's read and throws on anything malformed, except recentCaseIds, which is only
// a convenience: anything wrong with it is dropped.
// ─────────────────────────────────────────────────────────────────────────────
import { exampleCases } from "../TypesAndVariables/exampleCases";
import type { Age, Case, Entity, LocalSlot, ProjectionsData, ServerRow } from "../TypesAndVariables/types";

/** This app's name in the app_data table. Every Collegiate app has its own. */
export const APP_NAME = "projections";
/** The shape of ProjectionsData. Add 1 when the shape changes, and upgrade older saved objects when reading them. */
export const SCHEMA_VERSION = 1;
/** Used until the user sets their own, so the starting age is never empty. */
export const DEFAULT_STARTING_AGE: Age = { years: 20, months: 0 };

/** The phone storage key for one user's slot. */
export function slotKey(userId: string): string {
  if (userId === "") throw new Error("slotKey: userId is empty");
  return `${APP_NAME}:${userId}`;
}

/** What a brand new user starts with: not onboarded, and the two example cases (TypesAndVariables/exampleCases.ts). */
export function newProjectionsData(now: number): ProjectionsData {
  const { cases, entities } = exampleCases();
  return {
    schemaVersion: SCHEMA_VERSION,
    editedAt: now,
    onboarded: false,
    startingAge: DEFAULT_STARTING_AGE,
    cases,
    entities,
    recentCaseIds: [],
  };
}

// ── checking saved data ──────────────────────────────────────────────────────
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Throws unless it's whole years ≥ 0 and months 0–11 (the same rule the engines use). */
export function checkStartingAge(value: unknown): Age {
  if (
    !isObject(value) ||
    typeof value.years !== "number" ||
    typeof value.months !== "number" ||
    !Number.isInteger(value.years) ||
    !Number.isInteger(value.months) ||
    value.years < 0 ||
    value.months < 0 ||
    value.months > 11
  ) {
    throw new Error("Starting age must be whole years (0 or more) and months 0–11");
  }
  return { years: value.years, months: value.months };
}

function checkCases(value: unknown): Case[] {
  if (!Array.isArray(value)) throw new Error("Saved cases is not an array");
  return value.map((item: unknown, i) => {
    if (
      !isObject(item) ||
      typeof item.caseId !== "string" ||
      typeof item.caseName !== "string" ||
      typeof item.caseColor !== "string" ||
      typeof item.caseIndex !== "number" ||
      typeof item.isHidden !== "boolean"
    ) {
      throw new Error(`Saved case ${i} must have caseId, caseName, caseColor, caseIndex and isHidden`);
    }
    return {
      ...item,
      caseId: item.caseId,
      caseName: item.caseName,
      caseColor: item.caseColor,
      caseIndex: item.caseIndex,
      isHidden: item.isHidden,
    };
  });
}

function checkEntities(value: unknown): Entity[] {
  if (!Array.isArray(value)) throw new Error("Saved entities is not an array");
  return value.map((item: unknown, i) => {
    if (
      !isObject(item) ||
      typeof item.entityId !== "string" ||
      typeof item.caseId !== "string" ||
      typeof item.name !== "string" ||
      typeof item.isHidden !== "boolean" ||
      !isObject(item.inputs)
    ) {
      throw new Error(`Saved entity ${i} must have entityId, caseId, name, isHidden and inputs`);
    }
    return { entityId: item.entityId, caseId: item.caseId, name: item.name, isHidden: item.isHidden, inputs: item.inputs };
  });
}

/** Only a convenience, so anything wrong is dropped instead of thrown: not a list, not text, a case that's gone, a repeat. */
function readRecentCaseIds(value: unknown, cases: Case[]): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const id of value) {
    if (typeof id === "string" && !ids.includes(id) && cases.some((c) => c.caseId === id)) ids.push(id);
  }
  return ids;
}

/** Saved data (from the phone or the server, typed unknown) → ProjectionsData. Throws on anything malformed. */
export function checkProjectionsData(value: unknown): ProjectionsData {
  if (!isObject(value)) throw new Error("Saved data is not an object");
  if (value.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Saved data is version ${String(value.schemaVersion)}, but this app reads version ${SCHEMA_VERSION}`);
  }
  if (typeof value.editedAt !== "number" || !Number.isFinite(value.editedAt)) throw new Error("Saved data needs a number editedAt");
  if (typeof value.onboarded !== "boolean") throw new Error("Saved data needs onboarded to be true or false");
  const cases = checkCases(value.cases);
  return {
    schemaVersion: SCHEMA_VERSION,
    editedAt: value.editedAt,
    onboarded: value.onboarded,
    startingAge: checkStartingAge(value.startingAge),
    cases,
    entities: checkEntities(value.entities),
    recentCaseIds: readRecentCaseIds(value.recentCaseIds, cases),
  };
}

/** The text saved on the phone → LocalSlot. Throws on anything malformed. */
export function parseLocalSlot(json: string): LocalSlot {
  const value: unknown = JSON.parse(json);
  if (!isObject(value)) throw new Error("Saved slot is not an object");
  if (typeof value.uploadWaiting !== "boolean") throw new Error("Saved slot needs uploadWaiting to be true or false");
  const { syncedVersion } = value;
  if (syncedVersion !== null && (typeof syncedVersion !== "number" || !Number.isInteger(syncedVersion))) {
    throw new Error("Saved slot needs syncedVersion to be a whole number or null");
  }
  return { data: checkProjectionsData(value.data), uploadWaiting: value.uploadWaiting, syncedVersion };
}

/** A row read from app_data (typed unknown) → ServerRow. Throws on anything malformed. */
export function checkServerRow(value: unknown): ServerRow {
  if (!isObject(value)) throw new Error("Server row is not an object");
  if (typeof value.version !== "number" || !Number.isInteger(value.version)) throw new Error("Server row needs a whole number version");
  return { data: checkProjectionsData(value.data), version: value.version };
}

// ── the sync rules ───────────────────────────────────────────────────────────
/** "done" = the two copies match. "takeServer" = replace the phone's copy. "upload" = replace the server's copy. */
export type SyncStep = "done" | "takeServer" | "upload";

/** What to do with the phone's copy and the server's copy (see THE RULES at the top). */
export function nextSyncStep(local: LocalSlot, server: ServerRow): SyncStep {
  const serverMoved = server.version !== local.syncedVersion;
  if (!local.uploadWaiting) return serverMoved ? "takeServer" : "done";
  if (!serverMoved) return "upload";
  // Both changed. The one edited most recently wins; the other one's changes are dropped (the user's call).
  return local.data.editedAt >= server.data.editedAt ? "upload" : "takeServer";
}

/** The time to stamp on a change: now, but always later than the copy being changed (a phone's clock can be behind). */
export function nextEditedAt(now: number, previous: number): number {
  return Math.max(now, previous + 1);
}

// ── data saved before accounts existed ───────────────────────────────────────
/** The four phone storage keys the app used before accounts. */
export const LEGACY_KEYS = ["cases", "entities", "startingAge", "recentCaseIds"] as const;

/**
 * What the app saved on this phone before accounts, as a ProjectionsData, or null when there's none.
 * It's given to the first new account that signs in on the phone (see AppDataContext), then removed.
 */
export function readLegacyData(saved: Record<(typeof LEGACY_KEYS)[number], string | null>, now: number): ProjectionsData | null {
  if (saved.cases === null && saved.entities === null && saved.startingAge === null) return null;
  const cases = checkCases(saved.cases === null ? [] : JSON.parse(saved.cases));
  let recent: unknown = [];
  try {
    recent = saved.recentCaseIds === null ? [] : JSON.parse(saved.recentCaseIds);
  } catch {
    recent = [];
  }
  return {
    ...newProjectionsData(now),
    startingAge: saved.startingAge === null ? DEFAULT_STARTING_AGE : checkStartingAge(JSON.parse(saved.startingAge)),
    cases,
    entities: checkEntities(saved.entities === null ? [] : JSON.parse(saved.entities)),
    recentCaseIds: readRecentCaseIds(recent, cases),
  };
}
