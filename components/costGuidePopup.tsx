import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import type { CostGuide, GuideTable } from "../TypesAndVariables/costGuides";

type CostGuidePopupProps = {
  guide: CostGuide;
  onClose: () => void;
};

// The popup an "i" button opens (see Field in formFields): a guide to what people typically spend on the box beside it.
// A small card floating over the edit popup: title, one line of what it is, tables, things to know, and the sources.
// It only informs: nothing in it fills the box. Close with the X or a tap outside.
export default function CostGuidePopup({ guide, onClose }: CostGuidePopupProps) {
  const { colors, scheme } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  // One step lighter than the edit popup behind it in dark mode (like the outcomes dropdown), so it stands out.
  const fill = scheme === "dark" ? "bg-inset" : "bg-surface";

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/40 px-4">
        {/* Tap the dimmed area to close */}
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Close guide" />
        <View
          className={`w-full max-w-[520px] overflow-hidden rounded-3xl border border-edge ${fill}`}
          style={{ maxHeight: screenHeight * 0.75 }}
        >
          <View className="flex-row items-center border-b border-hairline px-5 py-3.5">
            <Ionicons name="information-circle" size={20} color={colors.accentInk} />
            <Text className="ml-2 flex-1 font-inter-bold text-lg text-ink" numberOfLines={2}>
              {guide.title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full bg-canvas active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Close guide"
            >
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="px-5 pb-5 pt-4">
            <Text className="mb-4 font-inter text-[15px] leading-[21px] text-ink">{guide.intro}</Text>

            {guide.tables.map((table) => (
              <Table key={table.title} table={table} />
            ))}

            <Text className="mb-1.5 font-inter-semibold text-[13px] text-ink">Good to know</Text>
            {guide.notes.map((note) => (
              <View key={note} className="mb-1.5 flex-row">
                <Text className="mr-2 font-inter text-[13px] leading-[19px] text-muted">•</Text>
                <Text className="flex-1 font-inter text-[13px] leading-[19px] text-muted">{note}</Text>
              </View>
            ))}

            <Text className="mb-1.5 mt-3 font-inter-semibold text-[13px] text-ink">Where the numbers come from</Text>
            {guide.sources.map((source) => (
              <Text key={source} className="mb-1 font-inter text-xs leading-[17px] text-muted">
                {source}
              </Text>
            ))}
            <Text className="mt-2 font-inter text-xs leading-[17px] text-muted">
              Averages in 2026 dollars, as a starting point. Your own costs may be higher or lower.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** One table of a guide: the row names down the left, the numbers right-aligned in equal columns. */
function Table({ table }: { table: GuideTable }) {
  return (
    <View className="mb-5">
      <Text className="font-inter-semibold text-[15px] text-ink">{table.title}</Text>
      {table.note ? <Text className="mt-0.5 font-inter text-xs leading-[17px] text-muted">{table.note}</Text> : null}
      <View className="mt-2 overflow-hidden rounded-2xl border border-hairline">
        <View className="flex-row bg-canvas px-3 py-2">
          <View className="flex-[1.7]" />
          {table.columns.map((column) => (
            <Text key={column} className="flex-1 text-right font-inter-semibold text-xs text-muted" numberOfLines={1}>
              {column}
            </Text>
          ))}
        </View>
        {table.rows.map((row) => (
          <View
            key={row.label}
            className="flex-row items-center border-t border-hairline px-3 py-2.5"
            accessible
            accessibilityLabel={`${row.label}: ${row.cells.map((cell, i) => `${table.columns[i]} ${cell}`).join(", ")}`}
          >
            <Text className="flex-[1.7] pr-2 font-inter text-[13px] leading-[17px] text-ink">{row.label}</Text>
            {row.cells.map((cell, i) => (
              <Text key={table.columns[i]} className="flex-1 text-right font-inter-semibold text-[13px] text-ink" numberOfLines={1}>
                {cell}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
