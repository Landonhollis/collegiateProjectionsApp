import { View } from "react-native";
import { EmptyState } from "../../components/screenParts";

// Outcomes tab: placeholder until the projection charts are built.
export default function OutcomesScreen() {
  return (
    <View className="flex-1 bg-canvas">
      <EmptyState
        icon="trending-up-outline"
        title="Outcomes are coming"
        message="Your cases' projections will show here, side by side by age."
      />
    </View>
  );
}
