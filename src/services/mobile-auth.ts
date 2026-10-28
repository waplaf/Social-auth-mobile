import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

import { getWebUrl } from "@/lib/web-links";

const refreshTokenKey = "belora.firebase.refresh-token";
const apiKeyKey = "belora.firebase.api-key";
const callbackUrl = Linking.createURL("mobile-auth");

type FirebaseTokens = {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
};

let currentIdToken: string | null = null;
let currentIdTokenExpiresAt = 0;
let refreshRequest: Promise<string | null> | null = null;
let sessionVersion = 0;

function isTokens(value: unknown): value is FirebaseTokens {
  if (!value || typeof value !== "object") return false;
  const tokens = value as Partial<FirebaseTokens>;
  return typeof tokens.idToken === "string" && !!tokens.idToken &&
    typeof tokens.refreshToken === "string" && !!tokens.refreshToken &&
    Number.isFinite(Number(tokens.expiresIn)) && Number(tokens.expiresIn) > 0;
}

function base64Url(value: string) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function saveTokens(tokens: FirebaseTokens) {
  await SecureStore.setItemAsync(refreshTokenKey, tokens.refreshToken);
  currentIdToken = tokens.idToken;
  currentIdTokenExpiresAt = Date.now() + Math.max(Number(tokens.expiresIn) - 60, 0) * 1000;
}

export async function signInWithWeb() {
  const baseUrl = getWebUrl();
  if (!baseUrl) throw new Error("Configure o endereço do site Belora no ficheiro .env.");

  const verifier = toHex(await Crypto.getRandomBytesAsync(32));
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  const challenge = base64Url(digest);
  const authorizeUrl = getWebUrl(
    `/mobile/authorize?code_challenge=${encodeURIComponent(challenge)}&redirect_uri=${encodeURIComponent(callbackUrl)}`,
  );
  if (!authorizeUrl) throw new Error("Endereço web inválido.");

  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, callbackUrl);
  if (result.type !== "success") return false;

  const callback = new URL(result.url);
  const expectedCallback = new URL(callbackUrl);
  if (callback.protocol !== expectedCallback.protocol || callback.host !== expectedCallback.host || callback.pathname !== expectedCallback.pathname) {
    throw new Error("O endereço de retorno da sessão é inválido.");
  }
  // The token is a single-use authorization code, exchanged below with PKCE.
  const code = callback.searchParams.get("token") ?? callback.searchParams.get("code");
  if (!code) throw new Error("O site não devolveu o token de sessão.");

  const exchangeUrl = getWebUrl("/api/mobile-auth/exchange");
  if (!exchangeUrl) throw new Error("Endereço web inválido.");
  const exchangeResponse = await fetch(exchangeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, codeVerifier: verifier }),
  });
  const exchange = (await exchangeResponse.json().catch(() => null)) as
    | (Partial<FirebaseTokens> & { error?: string })
    | null;
  if (!exchangeResponse.ok || !isTokens(exchange)) {
    throw new Error(exchange?.error ?? "Não foi possível concluir a sessão mobile.");
  }
  sessionVersion += 1;
  await saveTokens(exchange);
  return true;
}

async function refreshSession() {
  const version = sessionVersion;
  const refreshToken = await SecureStore.getItemAsync(refreshTokenKey);
  if (!refreshToken || version !== sessionVersion) return null;
  const refreshUrl = getWebUrl("/api/mobile-auth/refresh");
  if (!refreshUrl) throw new Error("Configure o endereço do site Belora no ficheiro .env.");

  let response: Response;
  try {
    response = await fetch(refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    throw new Error("Não foi possível ligar à autenticação. Verifique a internet.");
  }

  const tokens = (await response.json().catch(() => null)) as
    | (Partial<FirebaseTokens> & { error?: string })
    | null;
  if (version !== sessionVersion) return null;
  if (!response.ok || !isTokens(tokens)) {
    if (response.status === 400 || response.status === 401) await signOutMobile();
    throw new Error(tokens?.error ?? "Não foi possível renovar a sessão. Tente novamente.");
  }

  await saveTokens(tokens);
  return tokens.idToken;
}

export async function getMobileIdToken() {
  if (currentIdToken && currentIdTokenExpiresAt > Date.now()) return currentIdToken;
  if (!refreshRequest) {
    refreshRequest = refreshSession().finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
}

export async function signOutMobile() {
  sessionVersion += 1;
  currentIdToken = null;
  currentIdTokenExpiresAt = 0;
  await Promise.all([
    SecureStore.deleteItemAsync(refreshTokenKey),
    SecureStore.deleteItemAsync(apiKeyKey),
  ]);
}
