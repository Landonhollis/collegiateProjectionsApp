import { View } from "react-native";
import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TopBar from "../../components/TopBar";
import TabButton from "../../components/TabButton";

// Headless tabs: the tab logic comes from expo-router, every visual is ours.
// Top bar above, current tab's screen in the middle, bottom menu below.
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TopBar />
      <TabSlot />
      <TabList asChild>
        {/* Explicit row style: TabList's own default is space-between, which pushes the end buttons to the screen edges. */}
        <View
          className="border-t border-hairline bg-surface"
          style={{ flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 8) }}
        >
          <TabTrigger name="cases" href="/cases" asChild>
            <TabButton label="Cases" icon="folder-open-outline" activeIcon="folder-open" />
          </TabTrigger>
          <TabTrigger name="entities" href="/entities" asChild>
            <TabButton label="Entities" icon="grid-outline" activeIcon="grid" />
          </TabTrigger>
          <TabTrigger name="outcomes" href="/outcomes" asChild>
            <TabButton label="Outcomes" icon="trending-up-outline" activeIcon="trending-up" />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}
