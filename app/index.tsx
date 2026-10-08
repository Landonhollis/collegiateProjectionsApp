import { Redirect } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { useOnboarded } from "../context/AppDataContext";

// Where the app starts, and where it decides which screen a user belongs on:
//   not signed in             → the sign-in screen
//   signed in, not onboarded  → onboarding
//   signed in and onboarded   → the app (cases)
// The root layout (app/_layout.tsx) takes away the screens the user shouldn't be on, which brings them back here
// whenever one of those two answers changes (signing in, finishing onboarding, signing out).
export default function Index() {
  const signedIn = useAuth().userId !== null;
  const onboarded = useOnboarded();

  if (!signedIn) return <Redirect href="/sign-in" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/cases" />;
}
