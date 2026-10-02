import { Redirect } from "expo-router";

// Front door: decides where the app opens. Sign-in / onboarding checks go here later.
export default function Index() {
  return <Redirect href="/cases" />;
}
