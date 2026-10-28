import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CalendarDays, Clock3, MapPin, RotateCcw, Search, Sparkles, UserRound } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { PublicProfessionalCard, PublicServiceCard } from "@/components/discovery-cards";
import { openLink } from "@/lib/web-links";
import { fetchPublicDiscovery, type PublicDiscovery } from "@/services/public-catalog";
import { mobileApi } from "@/services/mobile-api";
import { getMobileIdToken, signInWithWeb } from "@/services/mobile-auth";

const ink = "#24151d";
const muted = "#7b6c74";
const rose = "#a72e68";

type PreviewBooking = { id: string; startsAt: string; status: string; title: string; subtitle: string; audience: "business" | "customer" };
type CustomerBookingsResponse = { appointments: { id: string; startsAt: string; status: string; isUpcoming: boolean; business: { name: string }; service: { name: string }; professional: { name: string } }[] };
type BusinessAgendaResponse = { appointments: { id: string; startsAt: string; status: string; customer: { name: string }; service: { name: string }; professional: { name: string } }[] };

function AppointmentsPreview() {
  const router = useRouter();
  const [items, setItems] = useState<PreviewBooking[]>([]);
  const [audience, setAudience] = useState<"business" | "customer">("customer");
  const [loading, setLoading] = useState(true);
  const [guest, setGuest] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (!(await getMobileIdToken())) { setGuest(true); setItems([]); return; }
      try {
        const business = await mobileApi<BusinessAgendaResponse>("/api/mobile/agenda");
        const upcoming = business.appointments.filter((appointment) => new Date(appointment.startsAt) > new Date()).slice(0, 3);
        setAudience("business"); setGuest(false);
        setItems(upcoming.map((appointment) => ({ id: appointment.id, startsAt: appointment.startsAt, status: appointment.status, title: appointment.customer.name, subtitle: `${appointment.service.name} · ${appointment.professional.name}`, audience: "business" })));
        return;
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "";
        if (message.toLowerCase().includes("inicie sessão") || message.toLowerCase().includes("sessão expirou")) { setGuest(true); setItems([]); return; }
      }
      const customer = await mobileApi<CustomerBookingsResponse>("/api/mobile/customer-bookings");
      const upcoming = customer.appointments.filter((appointment) => appointment.isUpcoming).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 3);
      setAudience("customer"); setGuest(false);
      setItems(upcoming.map((appointment) => ({ id: appointment.id, startsAt: appointment.startsAt, status: appointment.status, title: appointment.business.name, subtitle: `${appointment.service.name} · ${appointment.professional.name}`, audience: "customer" })));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Não foi possível carregar as marcações.";
      if (message.toLowerCase().includes("inicie sessão") || message.toLowerCase().includes("sessão expirou")) { setGuest(true); setItems([]); }
      else setError(message);
    }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const login = async () => { try { await signInWithWeb(); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível iniciar sessão."); } };
  return <View style={styles.bookingPanel}>
    <View style={styles.bookingPanelHeader}><View style={styles.bookingIcon}><CalendarDays color={rose} size={18}/></View><View style={styles.bookingPanelCopy}><Text style={styles.eyebrow}>ACOMPANHAMENTO</Text><Text style={styles.bookingPanelTitle}>{audience === "business" ? "Pedidos e agenda" : "As minhas marcações"}</Text></View>
      <Pressable accessibilityRole="button" onPress={() => router.navigate((audience === "business" ? "/agenda" : "/my-bookings") as never)}><Text style={styles.panelLink}>{audience === "business" ? "Abrir agenda" : "Ver todas"}</Text></Pressable>
    </View>
    {loading ? <View style={styles.panelState}><ActivityIndicator color={rose}/><Text style={styles.stateText}>A atualizar marcações…</Text></View>
      : guest ? <View style={styles.panelState}><Text style={styles.stateText}>Entre na sua conta para acompanhar pedidos e horários.</Text><Pressable onPress={login} style={styles.panelButton}><Text style={styles.panelButtonText}>Entrar na Belora</Text></Pressable></View>
      : error ? <View style={styles.panelState}><Text style={styles.inlineError}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.panelLink}>Tentar novamente</Text></Pressable></View>
      : items.length ? <View style={styles.previewList}>{items.map((item) => <Pressable key={item.id} onPress={() => router.push((`/booking/${encodeURIComponent(item.id)}?audience=${item.audience}`) as never)} style={({ pressed }) => [styles.previewRow, pressed && styles.pressed]}><View style={styles.previewTime}><Clock3 color={rose} size={13}/><Text style={styles.previewTimeText}>{new Intl.DateTimeFormat("pt-MZ", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.startsAt))}</Text></View><Text numberOfLines={1} style={styles.previewTitle}>{item.title}</Text><Text numberOfLines={1} style={styles.previewSubtitle}>{item.subtitle}</Text></Pressable>)}</View>
      : <View style={styles.panelState}><Text style={styles.stateText}>{audience === "business" ? "Não há pedidos ou marcações para hoje." : "Ainda não tem marcações próximas."}</Text></View>}
  </View>;
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [signingIn, setSigningIn] = useState(false);
  const [data, setData] = useState<PublicDiscovery | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const filterKey = `${query}\u0000${category}\u0000${city}`;
  const filterKeyRef = useRef(filterKey);
  const prepareFilterUpdate = useCallback(() => { setLoading(true); setLoadingMore(false); setError(null); }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextQuery = queryInput.trim();
      if (nextQuery !== query) { prepareFilterUpdate(); setQuery(nextQuery); }
    }, 250);
    return () => clearTimeout(timeout);
  }, [queryInput, query, prepareFilterUpdate]);

  useEffect(() => {
    const controller = new AbortController();
    filterKeyRef.current = filterKey;
    fetchPublicDiscovery({ query, category, city }, controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setData(null);
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar os resultados.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, category, city, filterKey, retryKey]);

  const loadMore = useCallback(async () => {
    if (!data || loadingMore || (!data.hasMoreServices && !data.hasMoreProfessionals)) return;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await fetchPublicDiscovery({
        query,
        category,
        city,
        serviceOffset: data.services.length,
        professionalOffset: data.professionals.length,
      });
      if (filterKeyRef.current !== filterKey) return;
      setData((current) => current ? {
        ...next,
        services: [...current.services, ...next.services],
        professionals: [...current.professionals, ...next.professionals],
      } : next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar mais resultados.");
    } finally {
      setLoadingMore(false);
    }
  }, [category, city, data, filterKey, loadingMore, query]);

  const retry = useCallback(() => { prepareFilterUpdate(); setRetryKey((current) => current + 1); }, [prepareFilterUpdate]);

  const openAccount = async () => {
    if (signingIn) return;
    setSigningIn(true);
    try {
      if ((await getMobileIdToken()) || (await signInWithWeb())) {
        await openLink("/perfil");
      }
    } catch (reason) {
      Alert.alert("Iniciar sessão", reason instanceof Error ? reason.message : "Não foi possível iniciar sessão.");
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topline}>
        <Text style={styles.wordmark}>belora<Text style={styles.wordmarkDot}>.</Text></Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Ver os meus dados pessoais no site" accessibilityState={{ busy: signingIn, disabled: signingIn }} disabled={signingIn} onPress={() => void openAccount()} style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}>
          {signingIn ? <ActivityIndicator color={rose} size="small" /> : <UserRound color={rose} size={16} />}<Text style={styles.accountText}>{signingIn ? "A entrar…" : "A minha conta"}</Text>
        </Pressable>
      </View>

      <AppointmentsPreview />

      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroOrb} />
        <View style={styles.heroEyebrow}><Sparkles color="#f6d5e4" size={15} /><Text style={styles.heroEyebrowText}>BELEZA E BEM-ESTAR PERTO DE SI</Text></View>
        <Text style={styles.heroTitle}>Encontre o serviço certo para si.</Text>
        <Text style={styles.heroDescription}>Explore serviços e profissionais. Reserve o seu horário na Belora.</Text>
        <View style={styles.searchBox}>
          <Search color={muted} size={19} />
          <TextInput
            accessibilityLabel="Pesquisar serviços, profissionais ou salões"
            value={queryInput}
            onChangeText={setQueryInput}
            placeholder="Serviço, profissional ou salão"
            placeholderTextColor="#9b8b93"
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
        <View style={styles.citySearch}>
          <MapPin color="#f6d5e4" size={15} />
          <TextInput accessibilityLabel="Filtrar por cidade" value={city} onChangeText={(value) => { prepareFilterUpdate(); setCity(value); }} placeholder="Todas as cidades" placeholderTextColor="#ecd4df" style={styles.cityInput} />
        </View>
      </View>

      {!!data?.categories.length && (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <FilterChip label="Todas as categorias" selected={!category} onPress={() => { prepareFilterUpdate(); setCategory(""); }} />
          {data.categories.map((name) => <FilterChip key={name} label={name} selected={category === name} onPress={() => { prepareFilterUpdate(); setCategory((current) => current === name ? "" : name); }} />)}
        </ScrollView>
      )}
      {!!data?.cities.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <FilterChip label="Todas as cidades" selected={!city} onPress={() => { prepareFilterUpdate(); setCity(""); }} />
          {data.cities.map((name) => <FilterChip key={name} label={name} selected={city.toLocaleLowerCase("pt-MZ") === name.toLocaleLowerCase("pt-MZ")} onPress={() => { prepareFilterUpdate(); setCity(name); }} />)}
        </ScrollView>
      )}

      {loading && !data ? (
        <View style={styles.stateCard}><ActivityIndicator color={rose} /><Text style={styles.stateText}>A procurar opções para si…</Text></View>
      ) : error && !data ? (
        <View style={styles.stateCard}><Text style={styles.stateTitle}>Não foi possível carregar</Text><Text style={styles.stateText}>{error}</Text><Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}><RotateCcw color="white" size={15} /><Text style={styles.retryText}>Tentar novamente</Text></Pressable></View>
      ) : data ? (
        <>
          {loading && <View style={styles.refreshing}><ActivityIndicator color={rose} size="small" /><Text style={styles.refreshingText}>A atualizar resultados…</Text></View>}

          <View style={styles.sectionHeading}>
            <View><Text style={styles.eyebrow}>PARA RESERVAR</Text><Text style={styles.sectionTitle}>Serviços</Text></View>
            <Text style={styles.resultCount}>{data.services.length}{data.hasMoreServices ? "+" : ""}</Text>
          </View>
          {data.services.length ? <View style={styles.list}>{data.services.map((service) => <PublicServiceCard key={service.id} service={service} />)}</View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Ainda não encontrámos serviços</Text><Text style={styles.stateText}>Experimente outra pesquisa ou cidade.</Text></View>}

          <View style={styles.sectionHeading}>
            <View><Text style={styles.eyebrow}>QUEM PODE ATENDER</Text><Text style={styles.sectionTitle}>Profissionais</Text></View>
            <Text style={styles.resultCount}>{data.professionals.length}{data.hasMoreProfessionals ? "+" : ""}</Text>
          </View>
          {data.professionals.length ? <View style={styles.list}>{data.professionals.map((professional) => <PublicProfessionalCard key={professional.id} professional={professional} />)}</View> : <View style={styles.emptyCard}><Text style={styles.emptyTitle}>Sem profissionais para mostrar</Text><Text style={styles.stateText}>Tente outra categoria ou cidade.</Text></View>}

          {error && <Text style={styles.inlineError}>{error}</Text>}
          {(data.hasMoreServices || data.hasMoreProfessionals) && <Pressable accessibilityRole="button" onPress={loadMore} disabled={loadingMore} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>{loadingMore ? <ActivityIndicator color={rose} size="small" /> : null}<Text style={styles.moreButtonText}>{loadingMore ? "A carregar…" : "Ver mais serviços e profissionais"}</Text></Pressable>}
          <Text style={styles.note}>Ao escolher uma opção, a reserva continua no site Belora.</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbf8f9" },
  content: { width: "100%", maxWidth: 720, alignSelf: "center", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40, gap: 17 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { color: ink, fontSize: 25, fontWeight: "800", letterSpacing: -1.6 },
  wordmarkDot: { color: rose },
  accountButton: { minHeight: 39, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 13, backgroundColor: "#f1e9ed", paddingHorizontal: 11 },
  accountText: { color: rose, fontSize: 11, fontWeight: "700" },
  hero: { overflow: "hidden", borderRadius: 27, backgroundColor: "#571d3b", padding: 21, gap: 12 },
  heroOrb: { position: "absolute", width: 200, height: 200, borderRadius: 100, right: -100, top: -95, backgroundColor: "#8c3d67", opacity: 0.42 },
  heroEyebrow: { flexDirection: "row", alignItems: "center", gap: 7 },
  heroEyebrowText: { color: "#f6d5e4", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { maxWidth: 390, color: "white", fontSize: 30, lineHeight: 35, fontWeight: "700", letterSpacing: -1 },
  heroDescription: { maxWidth: 380, color: "#eadde4", fontSize: 13, lineHeight: 19 },
  searchBox: { minHeight: 49, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 15, backgroundColor: "white", paddingHorizontal: 13, marginTop: 3 },
  searchInput: { flex: 1, minHeight: 47, color: ink, fontSize: 13 },
  citySearch: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", minHeight: 30 },
  cityInput: { minWidth: 150, color: "white", fontSize: 12, paddingVertical: 4 },
  chips: { gap: 7, paddingRight: 20 },
  chip: { minHeight: 34, justifyContent: "center", borderWidth: 1, borderColor: "#e9dce2", borderRadius: 99, backgroundColor: "white", paddingHorizontal: 12 },
  chipSelected: { borderColor: "#571d3b", backgroundColor: "#571d3b" },
  chipText: { color: "#634d59", fontSize: 10, fontWeight: "600" },
  chipTextSelected: { color: "white" },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 },
  eyebrow: { color: rose, fontSize: 9, fontWeight: "800", letterSpacing: 1.1 },
  sectionTitle: { marginTop: 4, color: ink, fontSize: 21, fontWeight: "700", letterSpacing: -0.5 },
  resultCount: { color: muted, fontSize: 11, fontWeight: "600", paddingBottom: 3 },
  list: { gap: 10 },
  stateCard: { minHeight: 140, alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: "#eee5e9", borderRadius: 20, padding: 22, backgroundColor: "white" },
  stateTitle: { color: ink, fontSize: 16, fontWeight: "700", textAlign: "center" },
  stateText: { color: muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  emptyCard: { borderRadius: 18, backgroundColor: "white", padding: 17, gap: 4 },
  emptyTitle: { color: ink, fontSize: 13, fontWeight: "700", textAlign: "center" },
  retryButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 13, backgroundColor: "#571d3b", paddingHorizontal: 14 },
  retryText: { color: "white", fontSize: 12, fontWeight: "700" },
  refreshing: { flexDirection: "row", alignItems: "center", gap: 7 },
  refreshingText: { color: muted, fontSize: 11 },
  inlineError: { color: "#a52f43", fontSize: 12 },
  moreButton: { minHeight: 47, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "#ead6e0", borderRadius: 15, backgroundColor: "white", paddingHorizontal: 14 },
  moreButtonText: { color: rose, fontSize: 12, fontWeight: "700" },
  note: { color: muted, fontSize: 10, lineHeight: 16, textAlign: "center", paddingHorizontal: 18 },
  bookingPanel: { borderWidth: 1, borderColor: "#eee5e9", borderRadius: 20, backgroundColor: "white", padding: 14, gap: 11 },
  bookingPanelHeader: { flexDirection: "row", alignItems: "center", gap: 9 },
  bookingIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#fbf0f5" },
  bookingPanelCopy: { flex: 1, gap: 2 },
  bookingPanelTitle: { color: ink, fontSize: 15, fontWeight: "700" },
  panelLink: { color: rose, fontSize: 11, fontWeight: "700" },
  panelState: { minHeight: 50, alignItems: "center", justifyContent: "center", gap: 8 },
  panelButton: { minHeight: 38, justifyContent: "center", borderRadius: 12, backgroundColor: "#571d3b", paddingHorizontal: 14 },
  panelButtonText: { color: "white", fontSize: 11, fontWeight: "700" },
  previewList: { gap: 7 },
  previewRow: { borderRadius: 13, backgroundColor: "#fbf8f9", padding: 10, gap: 4 },
  previewTime: { flexDirection: "row", alignItems: "center", gap: 5 },
  previewTimeText: { color: rose, fontSize: 10, fontWeight: "700", textTransform: "capitalize" },
  previewTitle: { color: ink, fontSize: 12, fontWeight: "700" },
  previewSubtitle: { color: muted, fontSize: 10 },
  pressed: { opacity: 0.76 },
});
