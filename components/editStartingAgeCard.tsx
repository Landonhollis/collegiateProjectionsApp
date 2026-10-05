import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppData } from "../context/AppDataContext";
import { useTheme } from "../context/ThemeContext";
import { AgeField, ERRORS, ageToText, parseOptionalAge } from "./formFields";

// Popup for setting the starting age: the age every case's projection starts from. Same frame as EditCaseCard.
//   top:    "Starting age", close
//   middle: years and months
//   bottom: Cancel (closes, changes nothing) and Done (saves)
export default function EditStartingAgeCard({ onClose }: { onClose: () => void }) {
  const { startingAge, setStartingAge } = useAppData();
  const { colors, lift } = useTheme();
  const [age, setAge] = useState(ageToText(startingAge));

  const ageValue = parseOptionalAge(age); // null = blank, undefined = invalid
  const canSubmit = ageValue !== null && ageValue !== undefined;

  function submit() {
    if (ageValue === null || ageValue === undefined) throw new Error("EditStartingAgeCard: submit while invalid");
    setStartingAge(ageValue);
    onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 items-center justify-center bg-black/70 px-4"
      >
        {/* Tap the dimmed area to close (same as Cancel) */}
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Close" />
        <View className="w-full max-w-[520px] overflow-hidden rounded-[28px] bg-canvas p-5">
          <View className="mb-1 flex-row items-center">
            <Text className="flex-1 font-inter-bold text-[24px] tracking-tight text-ink">Starting age</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full bg-inset active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>
          <Text className="mb-4 font-inter text-[15px] leading-[22px] text-muted">
            Your age today. Every case's projection starts from here.
          </Text>

          <AgeField label="Age" value={age} onChange={setAge} error={ageValue === undefined ? ERRORS.age : null} />

          <View className="flex-row gap-3">
            <Pressable
              className="h-14 flex-1 items-center justify-center rounded-2xl border-[1.5px] border-edge active:opacity-70"
              onPress={onClose}
              accessibilityRole="button"
            >
              <Text className="font-inter-semibold text-[17px] text-ink">Cancel</Text>
            </Pressable>
            <Pressable
              className={`h-14 flex-[1.4] flex-row items-center justify-center gap-1.5 rounded-2xl bg-accent active:opacity-80 ${canSubmit ? "" : "opacity-40"}`}
              style={canSubmit ? lift : undefined}
              onPress={submit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
            >
              <Text className="font-inter-bold text-[17px] text-onAccent">Done</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.onAccent} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
