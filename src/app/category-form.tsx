import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mobileApi } from "@/services/mobile-api";
const rose = "#a72e68", ink = "#24151d";
export default function CategoryFormScreen() {
 const router = useRouter(); const [name, setName] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
 const save = async () => { setSaving(true); setError(""); try { await mobileApi("/api/mobile/service-categories", { method: "POST", body: JSON.stringify({ name }) }); router.back(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar."); } finally { setSaving(false); } };
 return <View style={s.page}><Pressable onPress={() => router.back()}><Text style={s.link}>‹ Voltar</Text></Pressable><Text style={s.title}>Nova categoria</Text><TextInput value={name} onChangeText={setName} placeholder="Ex.: Cabelo" style={s.input} />{error ? <Text style={s.error}>{error}</Text> : null}<Pressable disabled={saving} onPress={save} style={s.button}><Text style={s.buttonText}>{saving ? "A guardar…" : "Criar categoria"}</Text></Pressable></View>;
}
const s = StyleSheet.create({ page: { flex: 1, gap: 13, padding: 20, paddingTop: 30, backgroundColor: "#fbf8f9" }, title: { color: ink, fontSize: 25, fontWeight: "800" }, link: { color: rose, fontWeight: "700" }, input: { minHeight: 45, paddingHorizontal: 12, borderWidth: 1, borderColor: "#eee5e9", borderRadius: 12, backgroundColor: "white" }, error: { color: "#a52f43", fontSize: 12 }, button: { minHeight: 45, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#571d3b" }, buttonText: { color: "white", fontWeight: "700" } });