import * as WebBrowser from "expo-web-browser";
import { Alert, Platform } from "react-native";

const webOrigin = process.env.EXPO_PUBLIC_SALAOX_WEB_URL?.replace(/\/$/, "");

export function getWebUrl(path = "/") {
  if (!webOrigin) return null;

  try {
    const origin = new URL(webOrigin);
    if (!["http:", "https:"].includes(origin.protocol) || origin.hostname.endsWith(".example")) return null;
    const target = new URL(path, origin);
    if (target.origin !== origin.origin) return null;
    return target.toString();
  } catch {
    return null;
  }
}

export async function openLink(path: string) {
  const url = getWebUrl(path);
  if (!url) {
    Alert.alert("Configuração necessária", "Defina EXPO_PUBLIC_SALAOX_WEB_URL com o endereço real do site Belora.");
    return;
  }

  try {
    if (Platform.OS === "web") {
      window.location.assign(url);
      return;
    }

    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
    });
  } catch {
    Alert.alert("Não foi possível abrir a página", "Tente novamente dentro de momentos.");
  }
}
