import { Modal, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string; // e.g. "Delete"
  onConfirm: () => void;
  onCancel: () => void;
};

// Small centered popup for actions that can't be undone (deleting). Themed, unlike the system alert.
// The confirm button is filled in danger; Cancel is outlined and on the left, so a quick tap on the
// usual "OK" spot doesn't destroy anything.
export default function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Modal transparent animationType="fade" onRequestClose={props.onCancel}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full max-w-[400px] rounded-3xl bg-surface p-6">
          <Text className="font-inter-bold text-xl text-ink">{props.title}</Text>
          <Text className="mt-2 font-inter text-[15px] leading-[22px] text-muted">{props.message}</Text>
          <View className="mt-6 flex-row gap-3">
            <Pressable
              className="h-12 flex-1 items-center justify-center rounded-2xl border-[1.5px] border-edge active:opacity-70"
              onPress={props.onCancel}
              accessibilityRole="button"
            >
              <Text className="font-inter-semibold text-base text-ink">Cancel</Text>
            </Pressable>
            <Pressable
              className="h-12 flex-1 items-center justify-center rounded-2xl bg-danger active:opacity-80"
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                props.onConfirm();
              }}
              accessibilityRole="button"
            >
              <Text className="font-inter-bold text-base text-onDark">{props.confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
