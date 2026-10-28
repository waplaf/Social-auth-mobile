import { useCallback, useEffect, useState } from "react";
import { AppState, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw, Scissors, UserRound } from "lucide-react-native";
import { getMobileIdToken, signInWithWeb } from "@/services/mobile-auth";
import { mobileApi } from "@/services/mobile-api";

const ink = "#24151d", muted = "#7b6c74", rose = "#a72e68";
type Status = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
type Appointment = { id: string; startsAt: string; endsAt: string; status: Status; priceInCents: number; customer: { name: string }; service: { name: string }; professional: { name: string } };
type AgendaResponse = { businessName: string; timezone: string; date: string; view: "day" | "week"; rangeStart: string; rangeEnd: string; professionals: { id: string; name: string }[]; counts: Partial<Record<Status, number>>; appointments: Appointment[]; hasMore: boolean; nextOffset: number };
type StatusFilter = "ACTIVE" | "ALL" | Status;
const statusNames: Record<Status, string> = { PENDING: "Pendente", CONFIRMED: "Confirmada", COMPLETED: "Concluída", CANCELLED: "Cancelada", NO_SHOW: "Faltou" };
function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function shiftDate(date: string, amount: number) { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + amount); return localDate(next); }
function dateTitle(date: string, view: "day" | "week", timeZone: string) {
  const instant = new Date(`${date}T12:00:00`);
  if (view === "day") return new Intl.DateTimeFormat("pt-MZ", { weekday: "long", day: "numeric", month: "long", timeZone }).format(instant);
  const day = (instant.getDay() + 6) % 7;
  const monday = new Date(instant); monday.setDate(monday.getDate() - day);
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  const fmt = new Intl.DateTimeFormat("pt-MZ", { day: "numeric", month: "short", timeZone });
  return `${fmt.format(monday)} – ${fmt.format(sunday)}`;
}
function dateLabel(value: string, timeZone: string) { return new Intl.DateTimeFormat("pt-MZ", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(value)); }
function timeLabel(value: string, timeZone: string) { return new Intl.DateTimeFormat("pt-MZ", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value)); }
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[s.chip, active && s.chipActive]}><Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text></Pressable>; }
function AppointmentCard({ appointment, timeZone }: { appointment: Appointment; timeZone: string }) {
  const router = useRouter();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Abrir marcação de ${appointment.customer.name}, ${appointment.service.name}`} onPress={() => router.push((`/booking/${encodeURIComponent(appointment.id)}?audience=business`) as never)} style={({ pressed }) => [s.card, pressed && s.pressed]}>
    <View style={s.dateBox}><Text style={s.dateDay}>{dateLabel(appointment.startsAt, timeZone)}</Text><Text style={s.time}>{timeLabel(appointment.startsAt, timeZone)}</Text><Text style={s.endTime}>{timeLabel(appointment.endsAt, timeZone)}</Text></View>
    <View style={s.divider} /><View style={s.cardCopy}>
      <View style={s.cardTitleRow}><Text numberOfLines={1} style={s.customer}>{appointment.customer.name}</Text><View style={[s.statusPill, appointment.status === "PENDING" ? s.pending : appointment.status === "CONFIRMED" ? s.confirmed : s.closed]}><Text style={s.statusText}>{statusNames[appointment.status]}</Text></View></View>
      <View style={s.meta}><Scissors size={13} color={muted}/><Text numberOfLines={1} style={s.metaText}>{appointment.service.name}</Text></View>
      <View style={s.meta}><UserRound size={13} color={muted}/><Text numberOfLines={1} style={s.metaText}>{appointment.professional.name}</Text></View>
      <Text style={s.price}>{(appointment.priceInCents / 100).toLocaleString("pt-MZ")} MZN</Text>
    </View><ChevronRight size={17} color={muted}/>
  </Pressable>;
}
export default function AgendaScreen() {
  const [date, setDate] = useState(localDate(new Date()));
  const [view, setView] = useState<"day" | "week">("day");
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [professionalId, setProfessionalId] = useState("");
  const [data, setData] = useState<AgendaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const query = new URLSearchParams({ date, view, status });
  if (professionalId) query.set("professionalId", professionalId);
  const queryString = query.toString();
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("");
    try {
      const token = await getMobileIdToken();
      if (signal?.aborted) return;
      if (!token) { setData(null); setNeedsLogin(true); return; }
      const result = await mobileApi<AgendaResponse>(`/api/mobile/agenda?${queryString}`, { signal });
      if (!signal?.aborted) { setData(result); setOffset(result.nextOffset); setNeedsLogin(false); }
    } catch (reason) {
      if (signal?.aborted || (reason instanceof Error && reason.name === "AbortError")) return;
      const message = reason instanceof Error ? reason.message : "Não foi possível carregar a agenda.";
      setError(message); setNeedsLogin(message.toLowerCase().includes("inicie sessão") || message.toLowerCase().includes("sessão expirou"));
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [queryString]);
  useFocusEffect(useCallback(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]));
  useEffect(() => { let previous = AppState.currentState; const listener = AppState.addEventListener("change", (next) => { if (previous.match(/inactive|background/) && next === "active") void load(); previous = next; }); return () => listener.remove(); }, [load]);
  const login = async () => { setSigningIn(true); setError(""); try { await signInWithWeb(); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível iniciar sessão."); } finally { setSigningIn(false); } };
  const loadMore = async () => { if (!data || loadingMore) return; setLoadingMore(true); try { const next = await mobileApi<AgendaResponse>(`/api/mobile/agenda?${queryString}&offset=${offset}`); setData((current) => current ? { ...next, appointments: [...current.appointments, ...next.appointments] } : next); setOffset(next.nextOffset); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar mais marcações."); } finally { setLoadingMore(false); } };
  const week = view === "week";
  const empty = !data?.appointments.length;
  const totalActive = (data?.counts.PENDING ?? 0) + (data?.counts.CONFIRMED ?? 0);
  return <ScrollView contentInsetAdjustmentBehavior="automatic" style={s.screen} contentContainerStyle={s.page}>
    <View style={s.header}><View style={s.headerIcon}><CalendarDays color={rose} size={21}/></View><View style={s.headerCopy}><Text style={s.eyebrow}>GESTÃO DO NEGÓCIO</Text><Text style={s.title}>Agenda</Text><Text style={s.subtitle}>{data?.businessName ?? "Pedidos e marcações"}</Text></View></View>
    {loading || signingIn ? <View style={s.state}><ActivityIndicator color={rose}/><Text style={s.muted}>{signingIn ? "A abrir o site Belora…" : "A carregar a agenda…"}</Text></View> : needsLogin ? <View style={s.state}><Text style={s.stateTitle}>Entre com a sua conta da empresa</Text><Text style={s.muted}>O início de sessão é feito no site e regressa ao app.</Text>{!!error && <Text style={s.error}>{error}</Text>}<Pressable style={s.primary} onPress={login}><Text style={s.primaryText}>Entrar no site</Text></Pressable></View> : error && !data ? <View style={s.state}><Text style={s.stateTitle}>A agenda não carregou</Text><Text style={s.error}>{error}</Text><Pressable style={s.secondary} onPress={() => void load()}><RotateCcw size={15} color={rose}/><Text style={s.secondaryText}>Tentar novamente</Text></Pressable></View> : data ? <>
      <View style={s.countRow}><View style={s.countCard}><Text style={s.countValue}>{data.counts.PENDING ?? 0}</Text><Text style={s.countLabel}>Pedidos</Text></View><View style={s.countCard}><Text style={s.countValue}>{data.counts.CONFIRMED ?? 0}</Text><Text style={s.countLabel}>Confirmadas</Text></View><View style={s.countCard}><Text style={s.countValue}>{totalActive}</Text><Text style={s.countLabel}>Em aberto</Text></View></View>
      <View style={s.filterBlock}><Text style={s.filterLabel}>Período</Text><View style={s.segment}><Chip label="Dia" active={!week} onPress={() => setView("day")}/><Chip label="Semana" active={week} onPress={() => setView("week")}/></View></View>
      <View style={s.dateNav}><Pressable accessibilityRole="button" accessibilityLabel="Período anterior" onPress={() => setDate((value) => shiftDate(value, week ? -7 : -1))} style={s.iconButton}><ChevronLeft color={ink} size={19}/></Pressable><Text style={s.rangeTitle}>{dateTitle(date, view, data.timezone)}</Text><Pressable accessibilityRole="button" accessibilityLabel="Próximo período" onPress={() => setDate((value) => shiftDate(value, week ? 7 : 1))} style={s.iconButton}><ChevronRight color={ink} size={19}/></Pressable></View>
      <View style={s.dateActions}><Pressable onPress={() => setDate(localDate(new Date()))} style={s.todayButton}><Text style={s.todayText}>Ir para hoje</Text></Pressable><Pressable onPress={() => setShowDatePicker(true)} style={s.todayButton}><Text style={s.todayText}>Escolher data</Text></Pressable></View>
      {showDatePicker && <DateTimePicker value={new Date(`${date}T12:00:00`)} mode="date" display="default" onChange={(_, selected) => { setShowDatePicker(false); if (selected) setDate(localDate(selected)); }} />}
      <View style={s.filterBlock}><Text style={s.filterLabel}>Estado</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}><Chip label="Pedidos e confirmadas" active={status === "ACTIVE"} onPress={() => setStatus("ACTIVE")}/><Chip label="Todas" active={status === "ALL"} onPress={() => setStatus("ALL")}/>{(Object.keys(statusNames) as Status[]).map((value) => <Chip key={value} label={statusNames[value]} active={status === value} onPress={() => setStatus(value)}/>)}</ScrollView></View>
      <View style={s.filterBlock}><Text style={s.filterLabel}>Profissional</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}><Chip label="Toda a equipa" active={!professionalId} onPress={() => setProfessionalId("")}/>{data.professionals.map((professional) => <Chip key={professional.id} label={professional.name} active={professionalId === professional.id} onPress={() => setProfessionalId(professional.id)}/>)}</ScrollView></View>
      <View style={s.listHeader}><View><Text style={s.eyebrow}>{week ? "ESTA SEMANA" : "MARCAÇÕES DO DIA"}</Text><Text style={s.listTitle}>{data.appointments.length}{data.hasMore ? "+" : ""} {data.appointments.length === 1 ? "marcação" : "marcações"}</Text></View><Pressable onPress={() => load()}><RotateCcw color={rose} size={17}/></Pressable></View>
      {empty ? <View style={s.state}><View style={s.headerIcon}><CalendarDays color={rose} size={21}/></View><Text style={s.stateTitle}>Sem marcações neste período</Text><Text style={s.muted}>Escolha outro dia ou altere os filtros para consultar a agenda.</Text></View> : <View style={s.list}>{data.appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} timeZone={data.timezone}/>)}</View>}
      {!!error && <Text style={s.error}>{error}</Text>}{data.hasMore && <Pressable style={s.secondary} disabled={loadingMore} onPress={loadMore}>{loadingMore ? <ActivityIndicator color={rose}/> : <Text style={s.secondaryText}>Carregar mais marcações</Text>}</Pressable>}
    </> : null}
  </ScrollView>;
}
const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#fbf8f9"},page:{width:"100%",maxWidth:720,alignSelf:"center",padding:20,paddingBottom:40,gap:16},header:{flexDirection:"row",alignItems:"center",gap:12},headerIcon:{width:46,height:46,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:"#fbf0f5"},headerCopy:{flex:1,gap:2},eyebrow:{color:rose,fontSize:9,fontWeight:"800",letterSpacing:1.1},title:{color:ink,fontSize:26,fontWeight:"700",letterSpacing:-.6},subtitle:{color:muted,fontSize:12},state:{minHeight:150,alignItems:"center",justifyContent:"center",gap:10,borderWidth:1,borderColor:"#eee5e9",borderRadius:21,backgroundColor:"white",padding:22},stateTitle:{color:ink,fontSize:16,fontWeight:"700",textAlign:"center"},muted:{color:muted,fontSize:12,lineHeight:18,textAlign:"center"},error:{color:"#a52f43",fontSize:12,lineHeight:18,textAlign:"center"},primary:{minHeight:44,justifyContent:"center",borderRadius:14,backgroundColor:rose,paddingHorizontal:18},primaryText:{color:"white",fontSize:13,fontWeight:"700"},secondary:{minHeight:43,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,borderWidth:1,borderColor:"#ead6e0",borderRadius:14,padding:10},secondaryText:{color:rose,fontSize:12,fontWeight:"700"},countRow:{flexDirection:"row",gap:9},countCard:{flex:1,alignItems:"center",gap:3,borderRadius:16,backgroundColor:"white",padding:13},countValue:{color:ink,fontSize:21,fontWeight:"800"},countLabel:{color:muted,fontSize:10,fontWeight:"600"},filterBlock:{gap:7},filterLabel:{color:ink,fontSize:12,fontWeight:"700"},segment:{flexDirection:"row",alignSelf:"flex-start",gap:5,borderRadius:14,backgroundColor:"#f1e9ed",padding:4},chip:{minHeight:34,justifyContent:"center",borderWidth:1,borderColor:"#eadde3",borderRadius:99,backgroundColor:"white",paddingHorizontal:12},chipActive:{borderColor:"#571d3b",backgroundColor:"#571d3b"},chipText:{color:"#634d59",fontSize:10,fontWeight:"600"},chipTextActive:{color:"white"},chips:{gap:7,paddingRight:18},dateNav:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},iconButton:{width:40,height:40,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:"white"},rangeTitle:{flex:1,color:ink,fontSize:15,fontWeight:"700",textAlign:"center",textTransform:"capitalize"},dateActions:{flexDirection:"row",justifyContent:"center",gap:24},todayButton:{alignSelf:"center",paddingVertical:2},todayText:{color:rose,fontSize:11,fontWeight:"700"},listHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:3},listTitle:{color:ink,fontSize:16,fontWeight:"700",marginTop:3},list:{gap:10},card:{flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:"#eee5e9",borderRadius:18,backgroundColor:"white",padding:12},dateBox:{width:70,alignItems:"center",gap:4},dateDay:{color:muted,fontSize:10,fontWeight:"600",textTransform:"capitalize",textAlign:"center"},time:{color:ink,fontSize:17,fontWeight:"800"},endTime:{color:muted,fontSize:10},divider:{width:1,alignSelf:"stretch",backgroundColor:"#eee5e9"},cardCopy:{flex:1,gap:5},cardTitleRow:{flexDirection:"row",alignItems:"center",gap:5},customer:{flex:1,color:ink,fontSize:13,fontWeight:"700"},statusPill:{borderRadius:99,paddingHorizontal:7,paddingVertical:4},pending:{backgroundColor:"#fff3df"},confirmed:{backgroundColor:"#e8f3eb"},closed:{backgroundColor:"#f1e9ed"},statusText:{color:"#725a46",fontSize:9,fontWeight:"700"},meta:{flexDirection:"row",alignItems:"center",gap:5},metaText:{flex:1,color:muted,fontSize:10},price:{color:rose,fontSize:11,fontWeight:"700"},pressed:{opacity:.75},
});
