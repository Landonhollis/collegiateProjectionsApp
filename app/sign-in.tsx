import { useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

// Sign-in screen (boilerplate: it works, the real design comes later).
// Email and password, to sign in or to make an account, or Continue with Google.
// A new account made with an email has to tap the link in its email first, so it gets a "Check your email" message.
// Tapping anywhere that isn't a box or a button puts the keyboard away.
// It doesn't navigate anywhere itself: once someone is signed in, the root layout takes this screen away and
// app/index.tsx sends them on (to onboarding, or to their cases).
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { colors, lift, scheme } = useTheme();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** The email a confirmation link was just sent to, or null. While set, the "Check your email" message shows instead of the form. */
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);

  const canSubmit = email.trim() !== "" && password !== "" && busy === null;

  async function submit() {
    Keyboard.dismiss();
    setBusy("email");
    setProblem(null);
    if (isNewAccount) {
      const result = await signUp(email.trim(), password);
      setProblem(result.error);
      if (result.confirmEmail) setLinkSentTo(email.trim());
    } else {
      setProblem(await signIn(email.trim(), password));
    }
    setBusy(null);
  }

  async function withGoogle() {
    Keyboard.dismiss();
    setBusy("google");
    setProblem(null);
    setProblem(await signInWithGoogle());
    setBusy(null);
  }

  if (linkSentTo !== null) {
    return (
      <View className="flex-1 bg-canvas px-6" style={{ paddingTop: insets.top + 48 }}>
        <View className="mb-5 h-16 w-16 items-center justify-center rounded-full bg-inset">
          <Ionicons name="mail-outline" size={28} color={colors.ink} />
        </View>
        <Text className="font-inter-bold text-[32px] leading-[40px] tracking-tight text-ink">Check your email</Text>
        <Text className="mt-2 font-inter text-[15px] leading-[22px] text-muted">We sent a link to</Text>
        <Text className="font-inter-semibold text-[15px] leading-[22px] text-ink">{linkSentTo}</Text>
        <Text className="mt-3 font-inter text-[15px] leading-[22px] text-muted">
          Tap the link to confirm your account, then come back here and sign in. If it isn't there in a minute, look in your spam folder.
        </Text>
        <Pressable
          className="mt-8 h-14 flex-row items-center justify-center gap-1.5 rounded-2xl bg-accent active:opacity-80"
          style={lift}
          onPress={() => {
            // Back to the form, ready to sign in: the email stays, the password is typed again.
            setLinkSentTo(null);
            setIsNewAccount(false);
            setPassword("");
          }}
          accessibilityRole="button"
        >
          <Text className="font-inter-bold text-[17px] text-onAccent">Back to sign in</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.onAccent} />
        </Pressable>
      </View>
    );
  }

  return (
    // The whole screen is the "tap away" area. Boxes and buttons take their own taps, so only the empty parts reach it.
    <Pressable className="flex-1 bg-canvas px-6" style={{ paddingTop: insets.top + 48 }} onPress={Keyboard.dismiss} accessible={false}>
      <Text className="font-inter-bold text-[32px] leading-[40px] tracking-tight text-ink">
        {isNewAccount ? "Make your account" : "Sign in"}
      </Text>
      <Text className="mb-8 mt-1 font-inter text-[15px] leading-[22px] text-muted">
        One Collegiate account works in every Collegiate app.
      </Text>

      <Text className="mb-2 font-inter-semibold text-[13px] text-muted">Email</Text>
      <TextInput
        className="mb-5 h-14 rounded-2xl bg-inset px-4 font-inter text-base text-ink"
        value={email}
        onChangeText={setEmail}
        placeholder="you@school.edu"
        placeholderTextColor={colors.muted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        accessibilityLabel="Email"
      />
      <Text className="mb-2 font-inter-semibold text-[13px] text-muted">Password</Text>
      <TextInput
        className="h-14 rounded-2xl bg-inset px-4 font-inter text-base text-ink"
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={colors.muted}
        secureTextEntry
        autoCapitalize="none"
        textContentType={isNewAccount ? "newPassword" : "password"}
        accessibilityLabel="Password"
      />

      {problem ? <Text className="mt-3 font-inter-medium text-sm text-danger">{problem}</Text> : null}

      <Pressable
        className={`mt-6 h-14 items-center justify-center rounded-2xl bg-accent active:opacity-80 ${canSubmit ? "" : "opacity-40"}`}
        style={canSubmit ? lift : undefined}
        onPress={submit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
      >
        {busy === "email" ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text className="font-inter-bold text-[17px] text-onAccent">{isNewAccount ? "Make account" : "Sign in"}</Text>
        )}
      </Pressable>

      <View className="my-5 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-hairline" />
        <Text className="font-inter-semibold text-xs uppercase tracking-widest text-muted">or</Text>
        <View className="h-px flex-1 bg-hairline" />
      </View>

      {/* Secondary, so outlined. The outline is why it only lifts in light mode (the dark lift would cover it). */}
      <Pressable
        className={`h-14 flex-row items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-edge bg-surface active:opacity-70 ${busy === null ? "" : "opacity-40"}`}
        style={busy === null && scheme === "light" ? lift : undefined}
        onPress={withGoogle}
        disabled={busy !== null}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy !== null }}
      >
        {busy === "google" ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color={colors.ink} />
            <Text className="font-inter-semibold text-[17px] text-ink">Continue with Google</Text>
          </>
        )}
      </Pressable>

      <Pressable
        className="mt-4 h-12 items-center justify-center active:opacity-60"
        onPress={() => {
          setIsNewAccount(!isNewAccount);
          setProblem(null);
        }}
        accessibilityRole="button"
      >
        <Text className="font-inter-semibold text-[15px] text-accent-ink">
          {isNewAccount ? "I already have an account" : "I need an account"}
        </Text>
      </Pressable>
    </Pressable>
  );
}
