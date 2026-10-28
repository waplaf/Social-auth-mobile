import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { mobileApi } from "@/services/mobile-api";
import { signInWithWeb } from "@/services/mobile-auth";

type Category = { id: string; name: string; _count: { services: number } };

export default function CategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await mobileApi<{ categories: Category[] }>("/api/mobile/services");
      setCategories(data.categories);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as categorias.");
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const visible = useMemo(() => categories.filter((category) => category.name.toLocaleLowerCase("pt-MZ").includes(query.trim().toLocaleLowerCase("pt-MZ"))), [categories, query]);

  const login = async () => {
    setLoading(true);
    try {
      if (await signInWithWeb()) await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível iniciar sessão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.link}>‹ Voltar</Text></Pressable>
      <Text style={styles.title}>Categorias de serviços</Text>
      <Text style={styles.muted}>Organize os serviços prestados pelo seu negócio.</Text>
      {loading ? <ActivityIndicator color="#a72e68" /> : error ? <View style={styles.card}>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={() => void load()}><Text style={styles.link}>Tentar novamente</Text></Pressable>
        <Pressable onPress={() => void login()}><Text style={styles.link}>Entrar pelo site</Text></Pressable>
      </View> : <>
        <Pressable style={styles.button} onPress={() => router.push("/category-form")}><Text style={styles.buttonText}>Nova categoria</Text></Pressable>
        <TextInput accessibilityLabel="Pesquisar categorias" placeholder="Pesquisar categorias" value={query} onChangeText={setQuery} style={styles.input} />
        {visible.map((category) => <View key={category.id} style={styles.card}>
          <Text style={styles.name}>{category.name}</Text>
          <Text style={styles.muted}>{category._count.services} {category._count.services === 1 ? "serviço" : "serviços"}</Text>
        </View>)}
        {!visible.length && <Text style={styles.muted}>{categories.length ? "Nenhuma categoria corresponde à pesquisa." : "Ainda não existem categorias. Crie a primeira categoria."}</Text>}
      </>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fbf8f9" },
  page: { padding: 22, paddingBottom: 42, gap: 16, width: "100%", maxWidth: 680, alignSelf: "center" },
  title: { fontSize: 25, fontWeight: "700", color: "#24151d" },
  link: { color: "#a72e68", fontWeight: "600", paddingVertical: 8 },
  muted: { color: "#7b6c74", lineHeight: 21 },
  error: { color: "#a12645", lineHeight: 21 },
  name: { color: "#24151d", fontSize: 16, fontWeight: "600" },
  card: { padding: 18, borderRadius: 16, backgroundColor: "#fff", gap: 8 },
  input: { padding: 14, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee5e9" },
  button: { padding: 16, borderRadius: 14, backgroundColor: "#a72e68", alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
});
