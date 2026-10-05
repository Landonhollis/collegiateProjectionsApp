import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppData } from "../context/AppDataContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { CaseDropdown, TextField } from "./formFields";
import type { EntityEditType } from "../TypesAndVariables/types";

type EditEntityCardProps = {
  entityEditType: EntityEditType;
  typeLabel: string; // e.g. "Existing Home"
  entityName: string;
  onChangeEntityName: (name: string) => void;
  caseId: string | null;
  onChangeCaseId: (caseId: string) => void;
  canSubmit: boolean; // Add/Done is disabled until the card's inputs are valid
  onCancel: () => void;
  onSubmit: () => void;
  children: ReactNode; // the type's own inputs
};

// The shared frame for all 23 edit entity cards: a rounded popup centered on the screen
// (80% of its width, only as tall as it needs, at most 60% of its height).
// The 23 cards differ only in `children`, so the form always feels like the same screen.
//   header: type + "New …" / "Edit …", close button, then a line in the case color
//   body:   name, case, then the type's own inputs; scrolls
//   footer: Cancel (closes, changes nothing) and Add / Done
export default function EditEntityCard(props: EditEntityCardProps) {
  const { cases } = useAppData();
  const { colors, lift, caseBorderWidth } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const isAdd = props.entityEditType === "add";
  const lowerType = props.typeLabel.toLowerCase();
  // The chosen case's color outlines the popup (like the entity's card) and draws the line under the header.
  // Until a case is chosen: no outline, and a plain hairline under the header.
  const caseColor = cases.find((c) => c.caseId === props.caseId)?.caseColor;

  return (
    <Modal transparent animationType="fade" onRequestClose={props.onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 items-center justify-center bg-black/70"
        style={{ paddingTop: insets.top + 8, paddingBottom: 8 }}
      >
        {/* Tap the dimmed area to close (same as Cancel) */}
        <Pressable className="absolute inset-0" onPress={props.onCancel} accessibilityLabel="Close" />
        {/* Only as tall as its inputs need, up to 60% of the whole screen; past that the body scrolls.
            The cap is in px, not %, so the keyboard doesn't shrink it. It only shrinks (flexShrink) when the
            space above the keyboard is smaller than the popup. */}
        <View
          className="w-[80%] max-w-[520px] overflow-hidden rounded-[28px] border bg-canvas"
          style={{ maxHeight: screenHeight * 0.6, flexShrink: 1, borderWidth: caseBorderWidth, borderColor: caseColor ?? "transparent" }}
        >
          <View
            className="flex-row items-start px-5 pb-4 pt-5"
            style={{ borderBottomWidth: caseColor ? caseBorderWidth : 1, borderBottomColor: caseColor ?? colors.hairline }}
          >
            <View className="flex-1 pr-3">
              <Text className="font-inter-semibold text-[13px] text-muted">{props.typeLabel}</Text>
              <Text className="mt-1 font-inter-bold text-[26px] leading-[32px] tracking-tight text-ink" numberOfLines={2}>
                {isAdd ? `New ${lowerType}` : `Edit ${lowerType}`}
              </Text>
            </View>
            <Pressable
              onPress={props.onCancel}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center rounded-full bg-inset active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView style={{ flexShrink: 1 }} contentContainerClassName="px-5 pb-4 pt-5" keyboardShouldPersistTaps="handled">
            <TextField
              label="Name"
              value={props.entityName}
              onChange={props.onChangeEntityName}
              placeholder={`What do you call this ${lowerType}?`}
            />
            <CaseDropdown cases={cases} caseId={props.caseId} onChange={props.onChangeCaseId} />

            <View className="mb-5 mt-1 flex-row items-center gap-3">
              <Text className="font-inter-semibold text-xs uppercase tracking-widest text-muted">Details</Text>
              <View className="h-px flex-1 bg-hairline" />
            </View>
            {props.children}
          </ScrollView>

          <View className="flex-row gap-3 border-t border-hairline bg-surface px-5 py-3">
            <Pressable
              className="h-14 flex-1 items-center justify-center rounded-2xl border-[1.5px] border-edge active:opacity-70"
              onPress={props.onCancel}
              accessibilityRole="button"
            >
              <Text className="font-inter-semibold text-[17px] text-ink">Cancel</Text>
            </Pressable>
            <Pressable
              className={`h-14 flex-[1.4] flex-row items-center justify-center gap-1.5 rounded-2xl bg-accent active:opacity-80 ${props.canSubmit ? "" : "opacity-40"}`}
              style={props.canSubmit ? lift : undefined}
              onPress={props.onSubmit}
              disabled={!props.canSubmit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !props.canSubmit }}
            >
              <Text className="font-inter-bold text-[17px] text-onAccent">{isAdd ? "Add" : "Done"}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.onAccent} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
