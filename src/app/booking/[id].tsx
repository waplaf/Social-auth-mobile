import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, ChevronLeft, Clock3, MapPin, Scissors, UserRound, X } from "lucide-react-native";
import { mobileApi } from "@/services/mobile-api";
const ink = "#24151d", muted = "#7b6c74", rose = "#a72e68";
type Status = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
type Details = { id: string; startsAt: string; endsAt: string; status: Status; paymentStatus: string; priceInCents: number; paymentAmountInCents: number | null; customer: { name: string }; service: { name: string; duration: number }; professional: { name: string }; business: { name: string; slug: string; timezone: string; address: string | null; city: string | null }; allowedActions: Exclude<Status, "PENDING">[]; canReschedule: boolean };
type Payload = { appointment: Details; slots: string[] };
type Action = Exclude<Status, "PENDING">;
const statusNames: Record<Status, string> = { PENDING: "Pendente de confirmação", CONFIRMED: "Confirmada", CANCELLED: "Cancelada", COMPLETED: "Concluída", NO_SHOW: "Não compareceu" };
function dateOnly(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
function businessDate(value: string, timeZone: string) { const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value)); const values = Object.fromEntries(parts.map(({ type, value }) => [type, value])); return `${values.year}-${values.month}-${values.day}`; }
function when(value: string, timeZone: string) { return new Intl.DateTimeFormat("pt-MZ", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value)); }
export default function BookingDetailsScreen() {
  const params = useLocalSearchParams<{ id: string; audience?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const audience: "business" | "customer" = params.audience === "business" ? "business" : "customer";
  const router = useRouter();
  const [date, setDate] = useState(dateOnly(new Date()));
  const initialDateSet = useRef(false);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const path = `/api/mobile/appointments/${encodeURIComponent(id)}?audience=${audience}&date=${date}`;
  const load = useCallback(async () => { setLoading(true); setError(""); try { const result = await mobileApi<Payload>(path); setPayload(result); if (!initialDateSet.current) { initialDateSet.current = true; setDate(businessDate(result.appointment.startsAt, result.appointment.business.timezone)); } } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar a marcação."); } finally { setLoading(false); } }, [path]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const changeStatus = (status: Action) => {
    const words: Record<Action, string> = { CONFIRMED: "Confirmar esta marcação?", CANCELLED: "Cancelar esta marcação?", COMPLETED: "Marcar este atendimento como concluído?", NO_SHOW: "Registar que o cliente não compareceu?" };
    const submit = async () => { setBusy(true); setError(""); try { await mobileApi(`/api/mobile/appointments/${encodeURIComponent(id)}?audience=${audience}`, { method: "PATCH", body: JSON.stringify({ action: "status", status }) }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a marcação."); } finally { setBusy(false); } };
    Alert.alert(words[status], "", [{ text: "Voltar", style: "cancel" }, { text: status === "CANCELLED" ? "Cancelar marcação" : "Confirmar", style: status === "CANCELLED" ? "destructive" : "default", onPress: () => void submit() }]);
  };
  const reschedule = async (time: string) => { setBusy(true); setError(""); try { await mobileApi(`/api/mobile/appointments/${encodeURIComponent(id)}?audience=${audience}`, { method: "PATCH", body: JSON.stringify({ action: "reschedule", date, time }) }); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível reagendar."); } finally { setBusy(false); } };
  const appointment = payload?.appointment;
  const currency = ((appointment?.paymentAmountInCents ?? appointment?.priceInCents ?? 0) / 100).toLocaleString("pt-MZ");
  return <ScrollView contentInsetAdjustmentBehavior="automatic" style={s.screen} contentContainerStyle={s.page}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={s.back}><ChevronLeft color={rose} size={18}/><Text style={s.backText}>Voltar</Text></Pressable>
    {loading ? <View style={s.state}><ActivityIndicator color={rose}/><Text style={s.muted}>A carregar os detalhes…</Text></View> : !appointment ? <View style={s.state}><Text style={s.title}>Não foi possível abrir a marcação</Text><Text style={s.error}>{error}</Text><Pressable style={s.secondary} onPress={() => void load()}><Text style={s.secondaryText}>Tentar novamente</Text></Pressable></View> : <>
      <View style={s.hero}><Text style={s.eyebrow}>{audience === "business" ? "GESTÃO DO NEGÓCIO" : "A SUA RESERVA"}</Text><Text style={s.title}>{statusNames[appointment.status]}</Text><Text style={s.date}>{when(appointment.startsAt, appointment.business.timezone)}</Text></View>
      <View style={s.card}><Text style={s.sectionTitle}>Detalhes</Text>
        {audience === "business" ? <Row icon={<UserRound color={rose} size={17}/>} label="Cliente" value={appointment.customer.name}/> : <Row icon={<MapPin color={rose} size={17}/>} label="Estabelecimento" value={appointment.business.name}/>}
        <Row icon={<Scissors color={rose} size={17}/>} label="Serviço" value={appointment.service.name}/><Row icon={<UserRound color={rose} size={17}/>} label="Profissional" value={appointment.professional.name}/><Row icon={<Clock3 color={rose} size={17}/>} label="Duração" value={`${appointment.service.duration} min`}/><Row icon={<MapPin color={rose} size={17}/>} label="Local" value={[appointment.business.address, appointment.business.city].filter(Boolean).join(", ") || "Consulte o estabelecimento"}/>
        <View style={s.priceRow}><Text style={s.priceLabel}>Pagamento · {appointment.paymentStatus}</Text><Text style={s.price}>{currency} MZN</Text></View>
      </View>
      {!!appointment.allowedActions.length && <View style={s.card}><Text style={s.sectionTitle}>{audience === "business" ? "Gerir marcação" : "Opções da reserva"}</Text>
        {appointment.allowedActions.map((status) => <Pressable key={status} disabled={busy} onPress={() => changeStatus(status)} style={[s.actionButton, status === "CANCELLED" ? s.cancelButton : status === "CONFIRMED" ? s.confirmButton : s.completeButton]}>{status === "CANCELLED" ? <X color="#a52f43" size={16}/> : <Check color="white" size={16}/>}<Text style={[s.actionText, status === "CANCELLED" && s.cancelText]}>{status === "CONFIRMED" ? "Confirmar pedido" : status === "CANCELLED" ? "Cancelar marcação" : status === "COMPLETED" ? "Concluir atendimento" : "Registar falta"}</Text></Pressable>)}
      </View>}
      {appointment.canReschedule && <View style={s.card}><Text style={s.sectionTitle}>Reagendar</Text><Text style={s.muted}>Escolha uma data para ver horários livres.</Text><DateTimePicker value={new Date(`${date}T12:00:00`)} mode="date" display="default" minimumDate={new Date()} onChange={(_, selected) => { if (selected) setDate(dateOnly(selected)); }}/><Text style={s.selectedDate}>{new Intl.DateTimeFormat("pt-MZ", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00`))}</Text>
        {payload?.slots.length ? <View style={s.slots}>{payload.slots.map((time) => <Pressable key={time} disabled={busy} onPress={() => void reschedule(time)} style={({ pressed }) => [s.slot, pressed && s.pressed]}><Text style={s.slotText}>{time}</Text></Pressable>)}</View> : <Text style={s.muted}>Sem horários disponíveis nesta data.</Text>}{busy && <ActivityIndicator color={rose}/>}<Text style={s.smallNote}>Ao reagendar, a reserva passa a aguardar confirmação do estabelecimento.</Text>
      </View>}
      {!!error && <Text style={s.error}>{error}</Text>}
    </>}
  </ScrollView>;
}
function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <View style={s.row}><View style={s.rowIcon}>{icon}</View><View style={s.rowCopy}><Text style={s.rowLabel}>{label}</Text><Text style={s.rowValue}>{value}</Text></View></View>; }
const s = StyleSheet.create({screen:{flex:1,backgroundColor:"#fbf8f9"},page:{width:"100%",maxWidth:700,alignSelf:"center",padding:20,paddingBottom:40,gap:14},back:{minHeight:35,flexDirection:"row",alignItems:"center",gap:2,alignSelf:"flex-start"},backText:{color:rose,fontSize:12,fontWeight:"700"},hero:{borderRadius:21,backgroundColor:"#571d3b",padding:20,gap:9},eyebrow:{color:"#f6d5e4",fontSize:9,fontWeight:"800",letterSpacing:1},title:{color:ink,fontSize:22,fontWeight:"700",letterSpacing:-.5},date:{color:"white",fontSize:15,lineHeight:23,textTransform:"capitalize"},card:{borderWidth:1,borderColor:"#eee5e9",borderRadius:20,backgroundColor:"white",padding:16,gap:11},sectionTitle:{color:ink,fontSize:15,fontWeight:"700"},row:{flexDirection:"row",alignItems:"center",gap:10},rowIcon:{width:34,height:34,alignItems:"center",justifyContent:"center",borderRadius:11,backgroundColor:"#fbf0f5"},rowCopy:{flex:1,gap:2},rowLabel:{color:muted,fontSize:10},rowValue:{color:ink,fontSize:12,fontWeight:"600"},priceRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderTopWidth:1,borderTopColor:"#eee5e9",paddingTop:11},priceLabel:{color:muted,fontSize:11},price:{color:rose,fontSize:14,fontWeight:"800"},actionButton:{minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,borderRadius:13,paddingHorizontal:12},confirmButton:{backgroundColor:rose},completeButton:{backgroundColor:"#571d3b"},cancelButton:{borderWidth:1,borderColor:"#f2c9d0",backgroundColor:"#fff7f8"},actionText:{color:"white",fontSize:12,fontWeight:"700"},cancelText:{color:"#a52f43"},state:{minHeight:180,alignItems:"center",justifyContent:"center",gap:11,borderRadius:20,backgroundColor:"white",padding:22},muted:{color:muted,fontSize:12,lineHeight:18},error:{color:"#a52f43",fontSize:12,textAlign:"center"},secondary:{minHeight:40,alignItems:"center",justifyContent:"center",borderRadius:12,backgroundColor:"#f1e9ed",paddingHorizontal:15},secondaryText:{color:rose,fontSize:12,fontWeight:"700"},selectedDate:{color:ink,fontSize:12,fontWeight:"700",textAlign:"center",textTransform:"capitalize"},slots:{flexDirection:"row",flexWrap:"wrap",gap:8},slot:{minWidth:67,minHeight:39,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#ead6e0",borderRadius:11,backgroundColor:"#fbf8f9",paddingHorizontal:12},slotText:{color:rose,fontSize:12,fontWeight:"700"},smallNote:{color:muted,fontSize:10,lineHeight:15},pressed:{opacity:.7}});
