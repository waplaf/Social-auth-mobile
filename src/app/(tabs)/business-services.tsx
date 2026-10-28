import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Check, ChevronRight, Clock3, FolderKanban, FolderPlus, LogOut, Plus, RotateCcw, Scissors } from "lucide-react-native";

import { getWebUrl, openLink } from "@/lib/web-links";
import { getMobileIdToken, signInWithWeb, signOutMobile } from "@/services/mobile-auth";

const ink = "#24151d";
const muted = "#7b6c74";
const rose = "#a72e68";

type ManagedService = {
  id: string;
  name: string;
  duration: number;
  priceInCents: number;
  active: boolean;
  category: { name: string } | null;
  _count: { appointments: number; professionals: number };
};

type ServiceCategory = { id: string; name: string; _count: { services: number } };
type CatalogResponse = { businessName: string; services: ManagedService[]; categories: ServiceCategory[] };

function ServiceCard({ service }: { service: ManagedService }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Editar serviço ${service.name}`}
      onPress={() => openLink(`/dashboard/servicos/editar?id=${encodeURIComponent(service.id)}`)}
      style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}
    >
      <View style={styles.serviceIcon}><Scissors color={rose} size={19} /></View>
      <View style={styles.serviceCopy}>
        <View style={styles.serviceHeading}>
          <Text numberOfLines={1} style={styles.serviceName}>{service.name}</Text>
          <View style={[styles.statusPill, service.active ? styles.activePill : styles.inactivePill]}>
            {service.active && <Check color="#39764d" size={10} />}
            <Text style={[styles.statusText, service.active ? styles.activeText : styles.inactiveText]}>{service.active ? "Ativo" : "Inativo"}</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={styles.categoryName}>{service.category?.name ?? "Sem categoria"}</Text>
        <View style={styles.metaRow}>
          <Clock3 color={muted} size={13} /><Text style={styles.metaText}>{service.duration} min</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{service._count.professionals} prof.</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.price}>{(service.priceInCents / 100).toLocaleString("pt-MZ")} MZN</Text>
        </View>
      </View>
      <ChevronRight color={muted} size={18} />
    </Pressable>
  );
}

export default function BusinessServicesScreen() {
  const router = useRouter();
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [query, setQuery] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const loadCatalog = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getMobileIdToken();
      if (signal?.aborted) return;
      if (!token) {
        setNeedsLogin(true);
        setData(null);
        return;
      }

      const url = getWebUrl("/api/mobile/services");
      if (!url) throw new Error("Configure o endereço do site Belora no ficheiro .env.");
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
      const payload = await response.json().catch(() => null) as CatalogResponse & { error?: string } | null;
      if (response.status === 401) {
        await signOutMobile();
        setNeedsLogin(true);
        setData(null);
        return;
      }
      if (!response.ok || !payload || !Array.isArray(payload.services) || !Array.isArray(payload.categories)) {
        throw new Error(payload?.error ?? "Não foi possível carregar o catálogo.");
      }
      setNeedsLogin(false);
      setData(payload);
    } catch (reason) {
      if (signal?.aborted || (reason instanceof Error && reason.name === "AbortError")) return;
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar o catálogo.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    void loadCatalog(controller.signal);
    return () => controller.abort();
  }, [loadCatalog, retryKey]));

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (previousState.match(/inactive|background/) && nextState === "active") void loadCatalog();
      previousState = nextState;
    });
    return () => subscription.remove();
  }, [loadCatalog]);

  const visibleServices = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-MZ");
    if (!term) return data?.services ?? [];
    return (data?.services ?? []).filter((service) =>
      `${service.name} ${service.category?.name ?? ""}`.toLocaleLowerCase("pt-MZ").includes(term),
    );
  }, [data, query]);

  const login = async () => {
    setSigningIn(true);
    setError(null);
    try {
      const completed = await signInWithWeb();
      if (completed) {
        setNeedsLogin(false);
        await loadCatalog();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível iniciar sessão.");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerIcon}><Scissors color={rose} size={21} /></View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CATÁLOGO DO NEGÓCIO</Text>
          <Text style={styles.title}>Serviços</Text>
          {data && <Text style={styles.subtitle}>{data.businessName}</Text>}
        </View>
        {data && <Pressable accessibilityRole="button" accessibilityLabel="Terminar sessão" onPress={async () => { await signOutMobile(); setData(null); setNeedsLogin(true); }} style={styles.signOut}><LogOut color={muted} size={18} /></Pressable>}
      </View>

      {loading || signingIn ? (
        <View style={styles.stateCard}><ActivityIndicator color={rose} /><Text style={styles.stateText}>{signingIn ? "A abrir o site Belora…" : "A carregar o catálogo…"}</Text></View>
      ) : needsLogin ? (
        <View style={styles.stateCard}>
          <View style={styles.stateIcon}><Scissors color={rose} size={23} /></View>
          <Text style={styles.stateTitle}>Entre com a sua conta Belora</Text>
          <Text style={styles.stateText}>O início de sessão abre no site; depois, os serviços do seu negócio aparecem aqui.</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Pressable accessibilityRole="button" onPress={login} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Entrar no site</Text></Pressable>
        </View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>O catálogo não carregou</Text><Text style={styles.stateText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => setRetryKey((key) => key + 1)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><RotateCcw color={rose} size={15} /><Text style={styles.secondaryButtonText}>Tentar novamente</Text></Pressable>
        </View>
      ) : data ? (
        <>
          <View style={styles.quickActions}><Pressable accessibilityRole="link" onPress={() => router.push("/business-hours" as never)} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}><View style={styles.quickIcon}><Clock3 color={rose} size={18} /></View><Text style={styles.quickActionText}>Horários</Text><ChevronRight color={muted} size={17} /></Pressable>
            <Pressable accessibilityRole="link" onPress={() => router.push("/service-form" as never)} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
              <View style={styles.quickIcon}><Plus color={rose} size={18} /></View><Text style={styles.quickActionText}>Novo serviço</Text><ChevronRight color={muted} size={17} />
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => router.push("/category-form" as never)} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
              <View style={styles.quickIcon}><FolderPlus color={rose} size={18} /></View><Text style={styles.quickActionText}>Nova categoria</Text><ChevronRight color={muted} size={17} />
            </Pressable>
          </View>

          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionTitle}>Todos os serviços</Text><Text style={styles.sectionSubtitle}>{data.services.length} no catálogo</Text></View>
            <Pressable accessibilityRole="button" onPress={() => router.push("/categories")} style={styles.categoryLink}><FolderKanban color={rose} size={14} /><Text style={styles.categoryLinkText}>Categorias</Text></Pressable>
          </View>

          <View style={styles.searchBox}><Scissors color={muted} size={17} /><TextInput accessibilityLabel="Pesquisar serviços e categorias" value={query} onChangeText={setQuery} placeholder="Pesquisar no catálogo" placeholderTextColor="#9b8b93" returnKeyType="search" style={styles.searchInput} /></View>

          {visibleServices.length ? (
            <View style={styles.serviceList}>{visibleServices.map((service) => <ServiceCard key={service.id} service={service} />)}</View>
          ) : (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>{data.services.length ? "Nenhum resultado" : "O catálogo está vazio"}</Text>
              <Text style={styles.stateText}>{data.services.length ? "Experimente outro nome ou categoria." : "Adicione o primeiro serviço para começar a receber reservas."}</Text>
              {!data.services.length && <Pressable accessibilityRole="link" onPress={() => router.push("/service-form" as never)}><Text style={styles.webLink}>Criar primeiro serviço</Text></Pressable>}
            </View>
          )}

          {data.categories.length > 0 && <View style={styles.categoriesCard}><Text style={styles.categoriesTitle}>Categorias</Text><View style={styles.categoryChips}>{data.categories.map((category) => <View key={category.id} style={styles.categoryChip}><Text style={styles.categoryChipName}>{category.name}</Text><Text style={styles.categoryChipCount}>{category._count.services}</Text></View>)}</View></View>}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbf8f9" },
  content: { width: "100%", maxWidth: 680, alignSelf: "center", paddingHorizontal: 22, paddingTop: 22, paddingBottom: 38, gap: 17 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  headerIcon: { width: 47, height: 47, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#fbf0f5" },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { color: rose, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: ink, fontSize: 27, fontWeight: "700", letterSpacing: -0.8 },
  subtitle: { color: muted, fontSize: 12 },
  signOut: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#f1e9ed" },
  quickActions: { gap: 9 },
  quickAction: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderColor: "#eee5e9", borderRadius: 17, paddingHorizontal: 13, backgroundColor: "white" },
  quickIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "#fbf0f5" },
  quickActionText: { flex: 1, color: ink, fontSize: 13, fontWeight: "700" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  sectionTitle: { color: ink, fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  sectionSubtitle: { color: muted, fontSize: 11, marginTop: 3 },
  categoryLink: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 11, backgroundColor: "#f2ebef", paddingHorizontal: 10 },
  categoryLinkText: { color: rose, fontSize: 11, fontWeight: "700" },
  searchBox: { minHeight: 47, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: "#eee5e9", borderRadius: 14, backgroundColor: "white", paddingHorizontal: 13 },
  searchInput: { flex: 1, minHeight: 45, color: ink, fontSize: 13 },
  serviceList: { gap: 10 },
  serviceCard: { flexDirection: "row", alignItems: "center", gap: 11, borderWidth: 1, borderColor: "#eee5e9", borderRadius: 18, padding: 12, backgroundColor: "white" },
  serviceIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#fbf0f5" },
  serviceCopy: { flex: 1, gap: 5 },
  serviceHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  serviceName: { flex: 1, color: ink, fontSize: 13, fontWeight: "700" },
  categoryName: { color: muted, fontSize: 11 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 99, paddingHorizontal: 6, paddingVertical: 3 },
  activePill: { backgroundColor: "#e8f3eb" },
  inactivePill: { backgroundColor: "#f0ecee" },
  statusText: { fontSize: 9, fontWeight: "700" },
  activeText: { color: "#39764d" },
  inactiveText: { color: muted },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: muted, fontSize: 10 },
  metaDot: { color: "#c6b8bf", fontSize: 11 },
  price: { color: rose, fontSize: 10, fontWeight: "700" },
  categoriesCard: { borderRadius: 17, backgroundColor: "#f2ebef", padding: 14, gap: 10 },
  categoriesTitle: { color: ink, fontSize: 12, fontWeight: "700" },
  categoryChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 99, backgroundColor: "white", paddingHorizontal: 10, paddingVertical: 7 },
  categoryChipName: { color: "#634d59", fontSize: 10, fontWeight: "600" },
  categoryChipCount: { color: rose, fontSize: 9, fontWeight: "800" },
  stateCard: { alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#eee5e9", borderRadius: 21, padding: 22, backgroundColor: "white" },
  stateIcon: { width: 50, height: 50, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#fbf0f5" },
  stateTitle: { color: ink, fontSize: 16, textAlign: "center", fontWeight: "700" },
  stateText: { color: muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  errorText: { color: "#a52f43", fontSize: 12, lineHeight: 18, textAlign: "center" },
  primaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: rose, paddingHorizontal: 18, marginTop: 2 },
  primaryButtonText: { color: "white", fontSize: 13, fontWeight: "700" },
  secondaryButton: { minHeight: 39, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "#ead6e0", borderRadius: 12, paddingHorizontal: 12 },
  secondaryButtonText: { color: rose, fontSize: 12, fontWeight: "700" },
  webLink: { color: rose, fontSize: 13, fontWeight: "700", padding: 7 },
  pressed: { opacity: 0.76 },
});
