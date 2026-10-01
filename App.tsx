import "./global.css";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-blue-600">CollegiateProjections</Text>
      <Text className="mt-2 text-gray-500">NativeWind is working.</Text>
      <StatusBar style="auto" />
    </View>
  );
}
