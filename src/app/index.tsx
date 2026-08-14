import * as Device from "expo-device";
import { useState } from "react";
import
  {
    Alert,
    Image,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
  } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedIcon } from "@/components/animated-icon";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { WebBadge } from "@/components/web-badge";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { GoogleProfile, signInWithGoogle } from "@/services/google-auth";

function getDevMenuHint() {
  if (Platform.OS === "web") {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === "android" ? "cmd+m (or ctrl+m)" : "cmd+d";
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  const [profile, setProfile] = useState<GoogleProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      setProfile(await signInWithGoogle());
    } catch (error: any) {
      Alert.alert(
        "Google indisponível",
        error?.message || "Não foi possível entrar com Google.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Autenticação Google
          </ThemedText>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <ThemedText>
              {loading ? "A entrar..." : "Continuar com Google"}
            </ThemedText>
          </TouchableOpacity>
          {profile && (
            <View style={styles.profile}>
              {profile.avatar && (
                <Image source={{ uri: profile.avatar }} style={styles.avatar} />
              )}
              <ThemedText>{profile.name}</ThemedText>
              <ThemedText type="small">ID: {profile.id}</ThemedText>
              <ThemedText type="small">
                Token recebido: {profile.token ?? "sim"}
              </ThemedText>
            </View>
          )}
        </ThemedView>

        {Platform.OS === "web" && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: "center",
  },
  code: {
    textTransform: "uppercase",
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: "stretch",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  googleButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#E8F0FE",
  },
  profile: {
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
});
