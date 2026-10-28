import { getWebUrl } from "@/lib/web-links";

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  priceInCents: number;
  image: string | null;
  category: string | null;
  businessName: string;
  businessSlug: string;
  city: string | null;
};

export type PublicProfessional = {
  id: string;
  name: string;
  bio: string | null;
  specialties: string[];
  image: string | null;
  rating: number | null;
  reviewCount: number;
  serviceNames: string[];
  businessName: string;
  businessSlug: string;
  city: string | null;
};

export type PublicDiscovery = {
  services: PublicService[];
  professionals: PublicProfessional[];
  hasMoreServices: boolean;
  hasMoreProfessionals: boolean;
  categories: string[];
  cities: string[];
};

export type PublicDiscoveryOptions = {
  query?: string;
  category?: string;
  city?: string;
  serviceOffset?: number;
  professionalOffset?: number;
};

export async function fetchPublicDiscovery(options: PublicDiscoveryOptions = {}, signal?: AbortSignal): Promise<PublicDiscovery> {
  const url = getWebUrl("/api/public/discovery");
  if (!url) throw new Error("Defina o endereço do site Belora no ficheiro .env.");

  const parsedUrl = new URL(url);
  if (options.query) parsedUrl.searchParams.set("q", options.query);
  if (options.category) parsedUrl.searchParams.set("category", options.category);
  if (options.city) parsedUrl.searchParams.set("city", options.city);
  if (options.serviceOffset) parsedUrl.searchParams.set("serviceOffset", String(options.serviceOffset));
  if (options.professionalOffset) parsedUrl.searchParams.set("professionalOffset", String(options.professionalOffset));

  let response: Response;
  try {
    response = await fetch(parsedUrl.toString(), { signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("Não foi possível ligar ao site. Verifique a internet e o endereço configurado.");
  }

  if (!response.ok) throw new Error("Não foi possível carregar os resultados agora.");
  const data = await response.json().catch(() => null) as PublicDiscovery | null;
  if (
    !data || !Array.isArray(data.services) || !Array.isArray(data.professionals) ||
    !Array.isArray(data.categories) || !Array.isArray(data.cities) ||
    typeof data.hasMoreServices !== "boolean" || typeof data.hasMoreProfessionals !== "boolean"
  ) {
    throw new Error("Os resultados recebidos do site têm um formato inesperado.");
  }

  return data;
}
