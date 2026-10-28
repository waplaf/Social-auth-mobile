import { useEffect } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function MobileAuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // openAuthSessionAsync receives the code and completes the session in mobile-auth.
    // Restore the screen that opened the browser instead of leaving an unmatched route.
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#a72e68" />
      <Text>A regressar à app…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#fbf8f9" },
});
