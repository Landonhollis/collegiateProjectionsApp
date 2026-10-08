import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../Sync/supabase";

// Who is signed in. One Collegiate account works in every Collegiate app (they all share one Supabase project).
// The login is kept on the phone, so this is known straight away on app start, with or without a connection.
// Signing in, signing up and signing out all need a connection.
// Two ways in: email + password, or Google. Either way it's the same Collegiate account when the email is the same.

type Auth = {
  /** The signed-in user's id, or null when nobody is signed in. */
  userId: string | null;
  email: string | null;
  /** Returns what went wrong, in words to show the user, or null when it worked. */
  signIn: (email: string, password: string) => Promise<string | null>;
  /** confirmEmail = the account was made, but the user has to tap the link in their email before they can sign in. */
  signUp: (email: string, password: string) => Promise<{ error: string | null; confirmEmail: boolean }>;
  /** Opens Google's sign-in page over the app. Returns what went wrong, or null when it worked or the user closed it. */
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<string | null>;
};

/**
 * Where Google's sign-in page returns to: this app, by its own scheme (app.json → scheme). It is on the Redirect URLs
 * list in the Supabase dashboard. Not Linking.createURL(): in Expo Go that gives exp://<the computer's IP>…, and
 * Supabase refuses to return to an IP address (it sends the user to a blank page instead). On an iPhone the sign-in
 * page hands this link straight back to whoever opened it, so it works in Expo Go too. Android needs a real build.
 */
const RETURN_TO = "collegiateprojections://";

/** What a sign-in page sent back in the link it returned to the app with: after the "#" when there is one, else after the "?". */
function paramsOf(url: string): URLSearchParams {
  const [beforeHash, hash = ""] = url.split("#");
  return new URLSearchParams(hash !== "" ? hash : (beforeHash.split("?")[1] ?? ""));
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Fires once straight away with the login saved on the phone (or none), then on every sign in and sign out.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session ? { id: session.user.id, email: session.user.email ?? null } : null;
      // Keep the same object when nothing changed (the login refreshes itself every hour), so nothing re-renders.
      setUser((current) => (current?.id === next?.id && current?.email === next?.email ? current : next));
      setIsLoaded(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isLoaded) return null; // screens only render once we know who is signed in

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, confirmEmail: false };
    return { error: null, confirmEmail: data.session === null };
  }

  // Google signs the user in on a web page, which then returns to the app with a link that carries the login.
  // The page is opened over the app (it never leaves); closing it just comes back with nothing changed.
  async function signInWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: RETURN_TO, skipBrowserRedirect: true }, // we open the page ourselves, below
      });
      if (error) return error.message;
      const result = await WebBrowser.openAuthSessionAsync(data.url, RETURN_TO);
      if (result.type !== "success") return null; // the user closed the page

      const params = paramsOf(result.url);
      const problem = params.get("error_description") ?? params.get("error");
      if (problem) return problem;
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (!accessToken || !refreshToken) return "Google sign-in didn't send back a login. Try again.";
      const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      return sessionError ? sessionError.message : null;
    } catch (e: unknown) {
      return e instanceof Error ? e.message : String(e);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    return error ? error.message : null;
  }

  return (
    <AuthContext.Provider value={{ userId: user?.id ?? null, email: user?.email ?? null, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
