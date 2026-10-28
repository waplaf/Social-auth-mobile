import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { RotateCcw, Scissors, Search } from "lucide-react-native";

import { PublicServiceCard } from "@/components/discovery-cards";
import { fetchPublicDiscovery, type PublicDiscovery } from "@/services/public-catalog";

const ink = "#24151d";
const muted = "#7b6c74";
const rose = "#a72e68";

export default function ServicesScreen() {
  const [data, setData] = useState<PublicDiscovery | null>(null);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const filterKey = `${query}\u0000${category}`;
  const filterKeyRef = useRef(filterKey);
  const prepareFilterUpdate = useCallback(() => {
    setLoading(true);
    setLoadingMore(false);
    setError(null);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextQuery = queryInput.trim();
      if (nextQuery !== query) {
        prepareFilterUpdate();
        setQuery(nextQuery);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [queryInput, query, prepareFilterUpdate]);

  useEffect(() => {
    const controller = new AbortController();
    filterKeyRef.current = filterKey;
    fetchPublicDiscovery({ query, category }, controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setData(null);
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar os serviços.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, category, filterKey, retryKey]);

  const loadMore = useCallback(async () => {
    if (!data?.hasMoreServices || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const next = await fetchPublicDiscovery({ query, category, serviceOffset: data.services.length });
      if (filterKeyRef.current !== filterKey) return;
      setData((current) => current ? { ...next, services: [...current.services, ...next.services] } : next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar mais serviços.");
    } finally {
      setLoadingMore(false);
    }
  }, [category, data, filterKey, loadingMore, query]);

  const retry = useCallback(() => { prepareFilterUpdate(); setRetryKey((current) => current + 1); }, [prepareFilterUpdate]);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerIcon}><Scissors color={rose} size={21} /></View>
        <Text style={styles.eyebrow}>ENCONTRE O PRÓXIMO CUIDADO</Text>
        <Text style={styles.title}>Todos os serviços</Text>
        <Text style={styles.subtitle}>Explore o catálogo publicado pelos negócios na Belora.</Text>
      </View>

      <View style={styles.searchBox}><Search color={muted} size={18} /><TextInput accessibilityLabel="Pesquisar serviços, salões ou profissionais" value={queryInput} onChangeText={setQueryInput} placeholder="Pesquisar serviço, salão ou profissional" placeholderTextColor="#9b8b93" returnKeyType="search" style={styles.searchInput} /></View>

      {!!data?.categories.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: !category }} onPress={() => { if (category) { prepareFilterUpdate(); setCategory(""); } }} style={[styles.chip, !category && styles.chipSelected]}><Text style={[styles.chipText, !category && styles.chipTextSelected]}>Todas</Text></Pressable>
        {data.categories.map((name) => <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: category === name }} onPress={() => { prepareFilterUpdate(); setCategory((current) => current === name ? "" : name); }} style={[styles.chip, category === name && styles.chipSelected]}><Text style={[styles.chipText, category === name && styles.chipTextSelected]}>{name}</Text></Pressable>)}
      </ScrollView>}

      {loading && !data ? (
        <View style={styles.stateCard}><ActivityIndicator color={rose} /><Text style={styles.stateText}>A carregar serviços…</Text></View>
      ) : error && !data ? (
        <View style={styles.stateCard}><Text style={styles.stateTitle}>Não foi possível carregar</Text><Text style={styles.stateText}>{error}</Text><Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}><RotateCcw color="white" size={15} /><Text style={styles.retryText}>Tentar novamente</Text></Pressable></View>
      ) : data ? (
        <>
          <View style={styles.listHeader}><Text style={styles.listTitle}>Opções para reservar</Text><Text style={styles.count}>{data.services.length}{data.hasMoreServices ? "+" : ""}</Text></View>
          {loading && <View style={styles.refreshing}><ActivityIndicator color={rose} size="small" /><Text style={styles.stateText}>A atualizar…</Text></View>}
          {data.services.length ? <View style={styles.list}>{data.services.map((service) => <PublicServiceCard key={service.id} service={service} />)}</View> : <View style={styles.stateCard}><Text style={styles.stateTitle}>Nenhum serviço encontrado</Text><Text style={styles.stateText}>Experimente outro termo ou categoria.</Text></View>}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {data.hasMoreServices && <Pressable accessibilityRole="button" disabled={loadingMore} onPress={loadMore} style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>{loadingMore && <ActivityIndicator color={rose} size="small" />}<Text style={styles.moreText}>{loadingMore ? "A carregar…" : "Ver mais serviços"}</Text></Pressable>}
          <Text style={styles.note}>Escolha um serviço para consultar os detalhes e reservar o seu horário.</Text>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbf8f9" },
  content: { width: "100%", maxWidth: 680, alignSelf: "center", paddingHorizontal: 22, paddingTop: 22, paddingBottom: 38, gap: 17 },
  header: { gap: 6 },
  headerIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#fbf0f5", marginBottom: 3 },
  eyebrow: { color: rose, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  title: { color: ink, fontSize: 28, fontWeight: "700", letterSpacing: -0.8 },
  subtitle: { color: muted, fontSize: 13, lineHeight: 19 },
  searchBox: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: "#eee5e9", borderRadius: 15, backgroundColor: "white", paddingHorizontal: 13 },
  searchInput: { flex: 1, minHeight: 46, color: ink, fontSize: 13 },
  chips: { gap: 7, paddingRight: 20 },
  chip: { minHeight: 33, justifyContent: "center", borderWidth: 1, borderColor: "#e9dce2", borderRadius: 99, backgroundColor: "white", paddingHorizontal: 11 },
  chipSelected: { borderColor: "#571d3b", backgroundColor: "#571d3b" },
  chipText: { color: "#634d59", fontSize: 10, fontWeight: "600" },
  chipTextSelected: { color: "white" },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  listTitle: { color: ink, fontSize: 16, fontWeight: "700" },
  count: { color: muted, fontSize: 11 },
  list: { gap: 10 },
  stateCard: { minHeight: 140, alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 1, borderColor: "#eee5e9", borderRadius: 20, padding: 22, backgroundColor: "white" },
  stateTitle: { color: ink, fontSize: 16, fontWeight: "700", textAlign: "center" },
  stateText: { color: muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  retryButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 13, backgroundColor: "#571d3b", paddingHorizontal: 14 },
  retryText: { color: "white", fontSize: 12, fontWeight: "700" },
  refreshing: { flexDirection: "row", alignItems: "center", gap: 7 },
  moreButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "#ead6e0", borderRadius: 14, backgroundColor: "white" },
  moreText: { color: rose, fontSize: 12, fontWeight: "700" },
  errorText: { color: "#a52f43", fontSize: 12 },
  note: { color: muted, fontSize: 10, lineHeight: 16, textAlign: "center", paddingHorizontal: 18 },
  pressed: { opacity: 0.76 },
});
