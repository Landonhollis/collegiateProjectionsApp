import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { EmptyState } from "../components/screenParts";
import { fetchRow, uploadRow } from "../Sync/supabase";
import {
  LEGACY_KEYS,
  checkStartingAge,
  newProjectionsData,
  nextEditedAt,
  nextSyncStep,
  parseLocalSlot,
  readLegacyData,
  slotKey,
} from "../Sync/projectionsData";
import type { Age, Case, Entity, LocalSlot, ProjectionsData } from "../TypesAndVariables/types";

// Holds the signed-in user's data (starting age, cases, entities, onboarded) for the whole app.
// It is one object (ProjectionsData), kept in two places: the phone (the main copy) and the user's row in Supabase.
// Every change goes through the functions below, which update the app, save to the phone straight away, and
// upload a moment later. With no connection the app works as normal and uploads when it next can.
// The rules for keeping the two copies in step are in Sync/projectionsData.ts.
//
// Nobody signed in = no data: useAppData() throws, and the root layout only shows the sign-in screen.

/** How long after the last change the upload starts, so a burst of changes is one upload. */
const UPLOAD_DELAY_MS = 2000;

type AppData = {
  /** True once the user has finished onboarding. Saved with the rest of their data. */
  onboarded: boolean;
  completeOnboarding: () => void;
  /** Shows the walkthrough again (Settings). The user's data is left as it is. */
  restartOnboarding: () => void;
  /** The user's age today: where every case's projection starts. 20 years 0 months until the user sets it. */
  startingAge: Age;
  setStartingAge: (age: Age) => void;
  cases: Case[];
  entities: Entity[];
  /**
   * The case a new entity starts out in: the case used last (made, edited, or one of its entities made or edited).
   * With none used yet, the top case on the cases screen. null only when there are no cases.
   */
  defaultCaseId: string | null;
  setCases: (cases: Case[]) => void;
  setEntities: (entities: Entity[]) => void;
  /** Adds the entity, or replaces the one with the same entityId (keeps its place in the order). */
  saveEntity: (entity: Entity) => void;
  deleteEntity: (entityId: string) => void;
  toggleEntityHidden: (entityId: string) => void;
  /**
   * Puts these entities in this order. They may be only some of the entities (e.g. one type):
   * they swap among the places they already hold in the list, and every other entity stays where it is.
   */
  reorderEntities: (entityIds: string[]) => void;
  /** Adds the case, or replaces the one with the same caseId. */
  saveCase: (c: Case) => void;
  /** Removes the case AND its entities (an entity can't exist without its case). */
  deleteCase: (caseId: string) => void;
  toggleCaseHidden: (caseId: string) => void;
  /** Sets the display order: caseIndex becomes each case's place in this list. Must name every case once. */
  reorderCases: (caseIds: string[]) => void;
  /** Uploads anything that's waiting, right now (e.g. before signing out). Resolves when it has tried. */
  syncNow: () => Promise<void>;
};

/** The parts of the data the app changes. schemaVersion and editedAt are set for it. */
type Change = Partial<Pick<ProjectionsData, "onboarded" | "startingAge" | "cases" | "entities" | "recentCaseIds">>;

const AppDataContext = createContext<AppData | null>(null);

function findEntityIndex(entities: Entity[], entityId: string): number {
  const index = entities.findIndex((e) => e.entityId === entityId);
  if (index === -1) throw new Error(`No entity with entityId "${entityId}"`);
  return index;
}

function findCaseIndex(cases: Case[], caseId: string): number {
  const index = cases.findIndex((c) => c.caseId === caseId);
  if (index === -1) throw new Error(`No case with caseId "${caseId}"`);
  return index;
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  if (userId === null) return <AppDataContext.Provider value={null}>{children}</AppDataContext.Provider>;
  // Keyed by user, so signing in as someone else starts this over with nothing left from the last user.
  return (
    <UserData key={userId} userId={userId}>
      {children}
    </UserData>
  );
}

/** One signed-in user's data: loads their slot from the phone (or the server the first time), holds it, saves it, syncs it. */
function UserData({ userId, children }: { userId: string; children: ReactNode }) {
  const [slot, setSlot] = useState<LocalSlot | null>(null); // null until loaded
  const [needsConnection, setNeedsConnection] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Syncing runs outside of rendering (timers, replies from the server), so it reads the latest slot from a ref.
  const latest = useRef<LocalSlot | null>(null);
  const alive = useRef(true); // false once this user's data is no longer on screen (signed out)
  const uploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncing = useRef<Promise<void> | null>(null); // the sync that's running, if any
  const syncAgain = useRef(false); // something changed while it ran

  // Errors from async loading/saving are thrown during render (below) so they show up instead of failing silently.
  const fail = (e: unknown) => setError(toError(e));

  /** Replaces the slot: in the app and on the phone. */
  function putSlot(next: LocalSlot) {
    latest.current = next;
    setSlot(next);
    AsyncStorage.setItem(slotKey(userId), JSON.stringify(next)).catch(fail);
  }

  /** What this phone saved before accounts existed, or null. It goes to the first new account, then it's removed. */
  async function takeLegacyData(): Promise<ProjectionsData | null> {
    const [cases, entities, startingAge, recentCaseIds] = await Promise.all(LEGACY_KEYS.map((key) => AsyncStorage.getItem(key)));
    const legacy = readLegacyData({ cases, entities, startingAge, recentCaseIds }, Date.now());
    if (legacy) await Promise.all(LEGACY_KEYS.map((key) => AsyncStorage.removeItem(key)));
    return legacy;
  }

  async function load() {
    setNeedsConnection(false);
    const saved = await AsyncStorage.getItem(slotKey(userId));
    if (!alive.current) return;
    if (saved !== null) {
      // The usual start: show the phone's copy now, then check it against the server.
      const loaded = parseLocalSlot(saved);
      latest.current = loaded;
      setSlot(loaded);
      void sync();
      return;
    }

    // This user's first time on this phone: their data, if they have any, is only on the server.
    const row = await fetchRow(userId);
    if (!alive.current) return;
    if (row === "unreachable") {
      setNeedsConnection(true);
      return;
    }
    if (row !== null) {
      putSlot({ data: row.data, uploadWaiting: false, syncedVersion: row.version });
      return;
    }
    // A brand new account.
    const legacy = await takeLegacyData();
    if (!alive.current) return;
    putSlot({ data: legacy ?? newProjectionsData(Date.now()), uploadWaiting: true, syncedVersion: null });
    void sync();
  }

  /** One pass at making the phone's copy and the server's copy match. Stops quietly when the server can't be reached. */
  async function syncOnce() {
    // A few tries, because another device can save between our look and our upload.
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = latest.current;
      if (!before || !alive.current) return;

      if (before.uploadWaiting) {
        const version = await uploadRow(userId, before.data, before.syncedVersion);
        const now = latest.current;
        if (!now || !alive.current || version === "unreachable") return;
        if (version !== "rejected") {
          // Uploaded. If the data changed while it was uploading, that change is still waiting.
          putSlot({ ...now, syncedVersion: version, uploadWaiting: now.data !== before.data });
          return;
        }
        // Rejected: the server's row isn't at the version we last saw. Look at it and decide.
      }

      const row = await fetchRow(userId);
      const now = latest.current;
      if (!now || !alive.current || row === "unreachable") return;
      if (row === null) {
        putSlot({ ...now, uploadWaiting: true, syncedVersion: null }); // no row on the server: add ours
        continue;
      }
      const step = nextSyncStep(now, row);
      if (step === "done") return;
      if (step === "takeServer") {
        putSlot({ data: row.data, uploadWaiting: false, syncedVersion: row.version });
        return;
      }
      putSlot({ ...now, syncedVersion: row.version }); // ours wins: upload it over the server's
    }
  }

  /** Syncs now. Only one runs at a time; a call made while one is running makes it go round once more. */
  function sync(): Promise<void> {
    if (syncing.current) {
      syncAgain.current = true;
      return syncing.current;
    }
    const run = (async () => {
      try {
        do {
          syncAgain.current = false;
          await syncOnce();
        } while (syncAgain.current && alive.current);
      } catch (e: unknown) {
        fail(e);
      } finally {
        syncing.current = null;
      }
    })();
    syncing.current = run;
    return run;
  }

  function syncNow(): Promise<void> {
    if (uploadTimer.current) clearTimeout(uploadTimer.current);
    uploadTimer.current = null;
    return sync();
  }

  useEffect(() => {
    alive.current = true;
    load().catch(fail);
    // Leaving the app: upload what's waiting before it's closed. Coming back: pick up changes from other devices.
    const appState = AppState.addEventListener("change", () => void syncNow());
    return () => {
      alive.current = false;
      appState.remove();
      if (uploadTimer.current) clearTimeout(uploadTimer.current);
    };
  }, []);

  if (error) throw new Error(`App data: ${error.message}`);
  if (needsConnection) {
    return (
      <View className="flex-1 justify-center bg-canvas pb-24">
        <EmptyState
          icon="cloud-offline-outline"
          title="Connect to load your data"
          message="This is your first time signing in on this phone, so your data has to come from your account. Check your connection and try again."
          action={{ label: "Try again", onPress: () => load().catch(fail) }}
        />
      </View>
    );
  }
  if (!slot) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas" accessibilityLabel="Loading your data">
        <ActivityIndicator />
      </View>
    );
  }

  const { onboarded, startingAge, cases, entities, recentCaseIds } = slot.data;

  /** Every change to the data comes through here: update the app, save to the phone, and upload a moment later. */
  function change(patch: Change) {
    const current = latest.current;
    if (!current) throw new Error("App data: changed before it was loaded");
    const data = { ...current.data, ...patch, editedAt: nextEditedAt(Date.now(), current.data.editedAt) };
    putSlot({ ...current, data, uploadWaiting: true });
    if (uploadTimer.current) clearTimeout(uploadTimer.current);
    uploadTimer.current = setTimeout(() => void sync(), UPLOAD_DELAY_MS);
  }

  /** The recent list with this case moved to the front (it was just used). */
  function withCaseUsed(caseId: string): string[] {
    return [caseId, ...recentCaseIds.filter((id) => id !== caseId)];
  }

  // The most recent case that still exists; with none, the top case on the cases screen (lowest caseIndex).
  const topCase = cases.length === 0 ? null : cases.reduce((top, c) => (c.caseIndex < top.caseIndex ? c : top));
  const defaultCaseId = recentCaseIds.find((id) => cases.some((c) => c.caseId === id)) ?? topCase?.caseId ?? null;

  function completeOnboarding() {
    change({ onboarded: true });
  }

  function restartOnboarding() {
    change({ onboarded: false });
  }

  function setStartingAge(next: Age) {
    change({ startingAge: checkStartingAge(next) });
  }

  function setCases(next: Case[]) {
    change({ cases: next });
  }

  function setEntities(next: Entity[]) {
    change({ entities: next });
  }

  function saveEntity(entity: Entity) {
    const index = entities.findIndex((e) => e.entityId === entity.entityId);
    const next = index === -1 ? [...entities, entity] : entities.map((e, i) => (i === index ? entity : e));
    change({ entities: next, recentCaseIds: withCaseUsed(entity.caseId) });
  }

  function deleteEntity(entityId: string) {
    const index = findEntityIndex(entities, entityId);
    change({ entities: entities.filter((_, i) => i !== index) });
  }

  function toggleEntityHidden(entityId: string) {
    const index = findEntityIndex(entities, entityId);
    change({ entities: entities.map((e, i) => (i === index ? { ...e, isHidden: !e.isHidden } : e)) });
  }

  function reorderEntities(entityIds: string[]) {
    if (new Set(entityIds).size !== entityIds.length) throw new Error("reorderEntities: an entityId is listed twice");
    const moving = entityIds.map((id) => entities[findEntityIndex(entities, id)]);
    // Walk the list; each time we reach one of the moving entities' places, drop in the next one in the new order.
    let next = 0;
    change({ entities: entities.map((e) => (entityIds.includes(e.entityId) ? moving[next++] : e)) });
  }

  function saveCase(c: Case) {
    const index = cases.findIndex((x) => x.caseId === c.caseId);
    const next = index === -1 ? [...cases, c] : cases.map((x, i) => (i === index ? c : x));
    change({ cases: next, recentCaseIds: withCaseUsed(c.caseId) });
  }

  function deleteCase(caseId: string) {
    const index = findCaseIndex(cases, caseId);
    // One change, so the case and its entities go together or not at all.
    change({
      cases: cases.filter((_, i) => i !== index),
      entities: entities.filter((e) => e.caseId !== caseId),
      recentCaseIds: recentCaseIds.filter((id) => id !== caseId), // so a new entity never starts out in a deleted case
    });
  }

  function toggleCaseHidden(caseId: string) {
    const index = findCaseIndex(cases, caseId);
    change({ cases: cases.map((x, i) => (i === index ? { ...x, isHidden: !x.isHidden } : x)) });
  }

  function reorderCases(caseIds: string[]) {
    if (caseIds.length !== cases.length || new Set(caseIds).size !== caseIds.length) {
      throw new Error("reorderCases: must list every case exactly once");
    }
    const placeOf = new Map(caseIds.map((id, i) => [id, i]));
    change({
      cases: cases.map((c) => {
        const place = placeOf.get(c.caseId);
        if (place === undefined) throw new Error(`reorderCases: case "${c.caseId}" is missing from the new order`);
        return { ...c, caseIndex: place };
      }),
    });
  }

  return (
    <AppDataContext.Provider
      value={{
        onboarded,
        completeOnboarding,
        restartOnboarding,
        startingAge,
        setStartingAge,
        cases,
        entities,
        defaultCaseId,
        setCases,
        setEntities,
        saveEntity,
        deleteEntity,
        toggleEntityHidden,
        reorderEntities,
        saveCase,
        deleteCase,
        toggleCaseHidden,
        reorderCases,
        syncNow,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const data = useContext(AppDataContext);
  if (!data) throw new Error("useAppData must be used inside AppDataProvider, with a user signed in");
  return data;
}

/** True when a user is signed in and has finished onboarding. False when nobody is signed in. For routing (app/index.tsx). */
export function useOnboarded(): boolean {
  return useContext(AppDataContext)?.onboarded ?? false;
}
