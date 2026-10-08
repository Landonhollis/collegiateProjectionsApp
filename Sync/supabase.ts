import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { APP_NAME, checkServerRow } from "./projectionsData";
import type { ProjectionsData, ServerRow } from "../TypesAndVariables/types";

// The app's one connection to Supabase (the Collegiate project, shared by every Collegiate app), and the three
// things this app asks of it: read my row, add my row, replace my row.
// The login is kept on the phone (AsyncStorage), so the app still knows who is signed in with no connection.

// Both of these are safe to ship in the app: the key only lets a signed-in user reach their own rows (row level security).
const SUPABASE_URL = "https://vwefydubhejeocprbzec.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Rp9K4k_Wkw3W35r43QmrrA_TENLSDTc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // there is no URL to read a login from in a phone app
    lock: processLock,
  },
});

// Keep the login fresh only while the app is on screen (Supabase's own advice for React Native).
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** The server couldn't be reached (or is having trouble). Nothing is wrong with the data: try again later. */
export type Unreachable = "unreachable";

/**
 * True for a failure that says nothing about our request: no connection (0), the login needs refreshing (401),
 * too slow or too busy (408, 429), or the server is down (500 and up). Anything else is a bug and is thrown.
 */
function isTemporary(status: number): boolean {
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
}

/** This user's row for this app, or null when they have none yet. */
export async function fetchRow(userId: string): Promise<ServerRow | null | Unreachable> {
  const { data, error, status } = await supabase
    .from("app_data")
    .select("data, version")
    .eq("user_id", userId)
    .eq("app", APP_NAME)
    .maybeSingle();
  if (error) {
    if (isTemporary(status)) return "unreachable";
    throw new Error(`Supabase: reading app data failed: ${error.message}`);
  }
  return data === null ? null : checkServerRow(data);
}

/** The version the server gave the row it just saved. */
function savedVersion(rows: unknown): number {
  const row: unknown = Array.isArray(rows) ? rows[0] : undefined;
  if (typeof row !== "object" || row === null || !("version" in row) || typeof row.version !== "number") {
    throw new Error("Supabase: saving app data didn't return the new version");
  }
  return row.version;
}

/**
 * Saves the data as this user's row and returns the row's new version.
 * expectedVersion = the version the server's row must still be at (null = there must be no row yet).
 * "rejected" = it wasn't: another device saved first, and nothing was changed.
 */
export async function uploadRow(
  userId: string,
  data: ProjectionsData,
  expectedVersion: number | null,
): Promise<number | "rejected" | Unreachable> {
  if (expectedVersion === null) {
    const {
      data: rows,
      error,
      status,
    } = await supabase.from("app_data").insert({ user_id: userId, app: APP_NAME, data }).select("version");
    if (error) {
      if (error.code === "23505") return "rejected"; // the row already exists
      if (isTemporary(status)) return "unreachable";
      throw new Error(`Supabase: adding app data failed: ${error.message}`);
    }
    return savedVersion(rows);
  }

  const {
    data: rows,
    error,
    status,
  } = await supabase
    .from("app_data")
    .update({ data })
    .eq("user_id", userId)
    .eq("app", APP_NAME)
    .eq("version", expectedVersion)
    .select("version");
  if (error) {
    if (isTemporary(status)) return "unreachable";
    throw new Error(`Supabase: saving app data failed: ${error.message}`);
  }
  if (rows.length === 0) return "rejected"; // no row at that version
  return savedVersion(rows);
}
