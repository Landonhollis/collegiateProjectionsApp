import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Keyboard, Modal, Platform, Pressable, View, type ViewStyle } from "react-native";

type PopupLayerProps = {
  /** Tapping the dimmed area, or Android back. */
  onClose: () => void;
  /** Room to keep around the popup, e.g. { paddingHorizontal: 16 }. */
  style?: ViewStyle;
  children: ReactNode; // the popup's card
};

/**
 * How long the card takes to slide when the keyboard comes or goes. The keyboard itself takes about 250ms;
 * the card is slower on purpose, so it glides after it instead of snapping (the user's call).
 */
const SLIDE_MS = 500;
const KEYBOARD_MS = 250;
/** After the keyboard is fully gone, how long until the card has stopped moving (with a little to spare). */
export const SETTLE_AFTER_KEYBOARD_MS = SLIDE_MS - KEYBOARD_MS + 50;

// What every edit popup sits on: the dimmed screen, with the card centered in the space above the keyboard.
// The card glides up as the keyboard comes in and back down as it leaves (no jump).
// Tapping the dimmed area closes the popup (same as Cancel).
export default function PopupLayer({ onClose, style, children }: PopupLayerProps) {
  // How much of the bottom of the screen the keyboard covers, in px. The card is centered in what's left.
  const keyboardSpace = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== "ios") return; // Android is left as it was: nothing is added for the keyboard
    // "Will" events arrive as the keyboard starts to move, so the card sets off with it.
    function slideTo(height: number) {
      Animated.timing(keyboardSpace, {
        toValue: height,
        duration: SLIDE_MS,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1), // gentle start, long soft stop
        useNativeDriver: false, // padding is layout, which the native driver can't animate
      }).start();
    }
    const show = Keyboard.addListener("keyboardWillShow", (e) => slideTo(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardWillHide", () => slideTo(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      {/* Animated.View gets plain styles (the dim + the keyboard's space); the inner View lays the card out. */}
      <Animated.View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.7)", paddingBottom: keyboardSpace }}>
        <View className="flex-1 items-center justify-center" style={style}>
          <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Close" />
          {children}
        </View>
      </Animated.View>
    </Modal>
  );
}
