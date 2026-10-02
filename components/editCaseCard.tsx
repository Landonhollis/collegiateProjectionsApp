import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppData } from "../context/AppDataContext";
import { useTheme } from "../context/ThemeContext";
import { makeCaseId } from "../Engines/masterEngine";
import { ColorDropdown, TextField } from "./formFields";
import { CASE_COLORS } from "./theme";
import type { Case } from "../TypesAndVariables/types";

type EditCaseCardProps =
  { editType: "add"; existingCase?: undefined; onClose: () => void } | { editType: "edit"; existingCase: Case; onClose: () => void };

// Popup for making or editing a case: a wide (landscape) card centered on the screen.
//   top:    color stripe (live preview of the chosen color), "New case" / "Edit case", close
//   middle: name and color, side by side
//   bottom: Cancel (closes, changes nothing) and Done (saves)
export default function EditCaseCard(props: EditCaseCardProps) {
  const { cases, saveCase } = useAppData();
  const { colors, lift } = useTheme();
  const isAdd = props.editType === "add";

  // New cases start with the first color no other case uses yet.
  const unusedColor = CASE_COLORS.find((c) => !cases.some((x) => x.caseColor === c.hex))?.hex ?? CASE_COLORS[0].hex;
  const [name, setName] = useState(props.existingCase?.caseName ?? "");
  const [color, setColor] = useState(props.existingCase?.caseColor ?? unusedColor);
  const canSubmit = name.trim() !== "";

  function submit() {
    if (!canSubmit) throw new Error("EditCaseCard: submit while invalid");
    if (props.editType === "edit") {
      saveCase({ ...props.existingCase, caseName: name.trim(), caseColor: color });
    } else {
      const nextIndex = cases.length === 0 ? 0 : Math.max(...cases.map((c) => c.caseIndex)) + 1; // new cases go last
      saveCase({ caseId: makeCaseId(), caseName: name.trim(), caseColor: color, caseIndex: nextIndex, isHidden: false });
    }
    props.onClose();
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={props.onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 items-center justify-center bg-black/40 px-4"
      >
        <View className="w-full max-w-[520px] overflow-hidden rounded-[28px] bg-canvas">
          <View style={{ height: 6, backgroundColor: color }} />
          <View className="px-5 pb-5 pt-4">
            <View className="mb-4 flex-row items-center">
              <Text className="flex-1 font-inter-bold text-[24px] tracking-tight text-ink">{isAdd ? "New case" : "Edit case"}</Text>
              <Pressable
                onPress={props.onClose}
                hitSlop={8}
                className="h-10 w-10 items-center justify-center rounded-full bg-inset active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={colors.ink} />
              </Pressable>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField label="Name" value={name} onChange={setName} placeholder="e.g. Buy at 30" />
              </View>
              <View className="flex-1">
                <ColorDropdown value={color} onChange={setColor} />
              </View>
            </View>

            <View className="flex-row gap-3">
              <Pressable
                className="h-14 flex-1 items-center justify-center rounded-2xl border-[1.5px] border-edge active:opacity-70"
                onPress={props.onClose}
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
