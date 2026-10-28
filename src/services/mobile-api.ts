import { getMobileIdToken, signOutMobile } from "@/services/mobile-auth";
import { getWebUrl } from "@/lib/web-links";
export async function mobileApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = getWebUrl(path);
  if (!url) throw new Error("Configure o endereço do site Belora no ficheiro .env.");
  const token = await getMobileIdToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", "Bearer " + token);
  if (init.body) headers.set("Content-Type", "application/json");
  let response: Response;
  try { response = await fetch(url, { ...init, headers }); } catch { throw new Error("Não foi possível ligar ao site."); }
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (response.status === 401) { await signOutMobile(); throw new Error(payload?.error ?? "A sessão expirou. Entre novamente."); }
  if (!response.ok || payload === null) throw new Error(payload?.error ?? "Não foi possível concluir o pedido.");
  return payload;
}