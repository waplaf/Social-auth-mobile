import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, Clock3, Images, MapPin, Phone, Plus, Scissors, Share2, Sparkles, Star, UserRound, X } from "lucide-react-native";
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { getWebUrl } from "@/lib/web-links";

const ink = "#281b24", rose = "#a72e68", muted = "#82747d";
type Service = { id: string; name: string; description: string | null; duration: number; priceInCents: number; image: string | null; category: { name: string } | null };
type Business = {
  id: string; name: string; slug: string; description: string | null; category: string;
  address: string | null; city: string | null; province: string | null; phone?: string | null; timezone?: string; logo: string | null;
  images: { id: string; url: string | null; alt?: string | null }[];
  schedules: { dayOfWeek: string; openTime: string; closeTime: string; closed: boolean }[];
  services: Service[];
  professionals: { id: string; name: string; bio: string | null; image: string | null; rating: number | null; reviewCount: number; specialties: string[] }[];
};
const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const dayNames: Record<string, string> = { MONDAY: "Segunda-feira", TUESDAY: "Terça-feira", WEDNESDAY: "Quarta-feira", THURSDAY: "Quinta-feira", FRIDAY: "Sexta-feira", SATURDAY: "Sábado", SUNDAY: "Domingo" };
const categoryNames: Record<string, string> = { BARBERSHOP: "Barbearia", BEAUTY_SALON: "Salão de beleza", AESTHETICS: "Estética", SPA: "Spa & bem-estar", INDEPENDENT: "Profissional independente", OTHER: "Beleza & bem-estar" };
const tabs = ["Serviços", "Equipa", "Sobre", "Horários"] as const;
type Tab = typeof tabs[number];
const money = (value: number) => (value / 100).toLocaleString("pt-MZ", { maximumFractionDigits: 2 });

export default function BusinessProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <BusinessProfile key={slug} slug={slug ?? ""} />;
}

function BusinessProfile({ slug }: { slug: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pageWidth = Math.min(width, 760);
  const scroll = useRef<ScrollView>(null);
  const tabsY = useRef(0);
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("Serviços");
  const [category, setCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const url = getWebUrl("/api/public/businesses/" + encodeURIComponent(slug));
      if (!url) throw new Error("Não foi possível ligar à Belora. Verifique o endereço do site configurado.");
      const response = await fetch(url, { signal: controller.signal });
      const payload = await response.json() as { business?: Business; error?: string };
      if (!response.ok || !payload.business) throw new Error(payload.error || "Não foi possível carregar o negócio.");
      return { business: payload.business };
    };
    load()
      .then(({ business: result }) => { if (!controller.signal.aborted) setBusiness(result); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o negócio."); });
    return () => controller.abort();
  }, [slug, retry]);

  const back = () => router.canGoBack() ? router.back() : router.replace("/");
  const openExternal = async (url: string) => {
    try { await Linking.openURL(url); } catch { Alert.alert("Não foi possível abrir", "Tente novamente dentro de momentos."); }
  };

  if (!business) return <View style={[s.emptyPage, { paddingTop: insets.top + 20 }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={back} style={s.lightCircle}><ArrowLeft color={ink} size={21} /></Pressable>
    <View style={s.loadingContent}><View style={s.loadingMark}><Sparkles color={rose} size={30} /></View>
      <Text style={s.loadingTitle}>{error ? "O seu próximo cuidado pode esperar um instante." : "Um espaço para cuidar de si."}</Text>
      <Text style={s.body}>{error || "Estamos a preparar todos os detalhes deste espaço."}</Text>
      {error ? <Pressable style={s.retryButton} onPress={() => { setError(""); setRetry((value) => value + 1); }}><Text style={s.whiteButtonText}>Tentar novamente</Text></Pressable> : <ActivityIndicator color={rose} style={{ marginTop: 20 }} />}
    </View>
  </View>;

  const photos = business.images.filter((photo): photo is typeof photo & { url: string } => !!photo.url);
  if (!photos.length && business.logo) photos.push({ id: "logo", url: business.logo, alt: business.name });
  const selected = business.services.find((service) => service.id === selectedId);
  const minPrice = business.services.length ? Math.min(...business.services.map((service) => service.priceInCents)) : null;
  const categories = [...new Set(business.services.map((service) => service.category?.name).filter((name): name is string => !!name))];
  const visibleServices = category ? business.services.filter((service) => service.category?.name === category) : business.services;
  const address = [business.address, business.city, business.province].filter(Boolean).join(", ");
  const today = new Intl.DateTimeFormat("en-US", { timeZone: business.timezone || "Africa/Maputo", weekday: "long" }).format(new Date()).toUpperCase();
  const todaySchedule = business.schedules.find((schedule) => schedule.dayOfWeek === today);
  const reviews = business.professionals.reduce((sum, professional) => sum + (professional.rating !== null ? professional.reviewCount : 0), 0);
  const rating = reviews ? business.professionals.reduce((sum, professional) => sum + (professional.rating ?? 0) * professional.reviewCount, 0) / reviews : null;
  const showServices = () => { setActiveTab("Serviços"); scroll.current?.scrollTo({ y: tabsY.current, animated: true }); };
  const reserve = () => {
    if (!selected) { showServices(); return; }
    router.push({ pathname: "/reserve", params: { slug: business.slug, serviceId: selected.id } });
  };
  const share = async () => {
    const url = getWebUrl("/" + encodeURIComponent(business.slug));
    if (!url) return;
    try { await Share.share({ title: business.name, message: `${business.name} · Descubra e reserve na Belora\n${url}` }); }
    catch { Alert.alert("Partilhar espaço", "Não foi possível partilhar. Tente novamente."); }
  };

  return <View style={s.screen}>
    <View style={[s.page, { width: pageWidth, paddingTop: insets.top }]}>
      <ScrollView ref={scroll} stickyHeaderIndices={[2]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 135 + insets.bottom }}>
        <View style={s.hero}>
          {photos.length ? <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setPhotoIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth))}>
            {photos.map((photo) => <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel="Abrir galeria de fotos" onPress={() => setGalleryVisible(true)} style={{ width: pageWidth, height: 350 }}>
              <Image source={{ uri: photo.url }} contentFit="cover" transition={250} accessibilityLabel={photo.alt || business.name} style={StyleSheet.absoluteFill} />
            </Pressable>)}
          </ScrollView> : <LinearGradient colors={["#35162c", "#8a3c63", "#d7a798"]} style={[s.heroFallback, { height: 350 }]}><View style={s.heroOrb} /><Sparkles color="#f4d9df" size={52} strokeWidth={1} /><Text style={s.fallbackWordmark}>{business.name}</Text></LinearGradient>}
          <LinearGradient pointerEvents="none" colors={["rgba(18,10,17,0.36)", "transparent", "rgba(18,10,17,0.62)"]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
          <View style={[s.heroToolbar, { top: 14 }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={back} style={({ pressed }) => [s.glassCircle, pressed && s.pressed]}><ArrowLeft color="white" size={21} /></Pressable>
            <Text style={s.heroBrand}>belora<Text style={{ color: "#f0b9d1" }}>.</Text></Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Partilhar este negócio" onPress={() => void share()} style={({ pressed }) => [s.glassCircle, pressed && s.pressed]}><Share2 color="white" size={19} /></Pressable>
          </View>
          <View pointerEvents="box-none" style={s.heroBottom}>
            <View style={s.heroCaption}><View style={s.smallLine} /><Text style={s.heroCaptionText}>O SEU PRÓXIMO MOMENTO DE CUIDADO</Text></View>
            {!!photos.length && <View style={s.photoControls}><View style={s.dots}>{photos.map((photo, index) => <View key={photo.id} style={[s.dot, photoIndex === index && s.activeDot]} />)}</View><Pressable accessibilityRole="button" accessibilityLabel={`Ver ${photos.length} fotos`} onPress={() => setGalleryVisible(true)} style={s.photoPill}><Images color="white" size={14} /><Text style={s.photoCount}>{photoIndex + 1} / {photos.length}</Text></Pressable></View>}
          </View>
        </View>

        <View style={s.intro}>
          <View style={s.introTop}><Text style={s.eyebrow}>{categoryNames[business.category] || "Beleza & bem-estar"}</Text>{!!business.city && <View style={s.cityPill}><MapPin size={11} color={muted} /><Text style={s.cityText}>{business.city}</Text></View>}</View>
          <Text style={s.businessName}>{business.name}</Text>
          {rating !== null && <View style={s.ratingRow}><Star size={14} fill="#b37d3a" color="#b37d3a" /><Text style={s.ratingNumber}>{rating.toFixed(1)}</Text><Text style={s.smallMuted}>{reviews} {reviews === 1 ? "avaliação da equipa" : "avaliações da equipa"}</Text></View>}
          {!!address && <Pressable accessibilityRole="link" accessibilityLabel="Ver localização no mapa" onPress={() => void openExternal(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)} style={s.locationRow}><MapPin size={15} color={muted} /><Text numberOfLines={2} style={s.locationText}>{address}</Text><ChevronRight size={15} color={rose} /></Pressable>}
          <View style={s.introFacts}><View style={s.fact}><CalendarDays size={14} color={rose} /><Text style={s.factText}>Reserva online</Text></View>{todaySchedule && <View style={s.fact}><View style={[s.statusDot, todaySchedule.closed && { backgroundColor: muted }]} /><Text style={s.factText}>{todaySchedule.closed ? "Fechado hoje" : `Hoje · ${todaySchedule.openTime}–${todaySchedule.closeTime}`}</Text></View>}</View>
        </View>

        <View onLayout={(event) => { tabsY.current = event.nativeEvent.layout.y; }} style={s.tabs}>
          {tabs.map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }} onPress={() => { setActiveTab(tab); scroll.current?.scrollTo({ y: tabsY.current, animated: true }); }} style={[s.tab, activeTab === tab && s.activeTab]}><Text style={[s.tabText, activeTab === tab && s.activeTabText]}>{tab}</Text></Pressable>)}
        </View>

        <View style={s.content}>
          {activeTab === "Serviços" && <>
            <View style={s.sectionHeading}><View><Text style={s.sectionEyebrow}>ESCOLHA O SEU CUIDADO</Text><Text style={s.sectionTitle}>Feito para si.</Text></View><Text style={s.sectionCount}>{business.services.length} serviços</Text></View>
            {!!categories.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryList}><Pressable accessibilityRole="button" accessibilityState={{ selected: category === null }} onPress={() => setCategory(null)} style={[s.chip, category === null && s.activeChip]}><Text style={[s.chipText, category === null && s.activeChipText]}>Todos</Text></Pressable>{categories.map((name) => <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: category === name }} onPress={() => setCategory(name)} style={[s.chip, category === name && s.activeChip]}><Text style={[s.chipText, category === name && s.activeChipText]}>{name}</Text></Pressable>)}</ScrollView>}
            <View style={s.serviceList}>{visibleServices.map((service) => {
              const picked = selectedId === service.id;
              return <Pressable key={service.id} accessibilityRole="radio" accessibilityState={{ checked: picked }} accessibilityLabel={`${service.name}, ${money(service.priceInCents)} MZN, ${service.duration} minutos`} onPress={() => setSelectedId(picked ? null : service.id)} style={({ pressed }) => [s.service, picked && s.selectedService, pressed && s.pressed]}>
                {service.image ? <Image source={{ uri: service.image }} contentFit="cover" transition={200} style={s.serviceImage} /> : <View style={s.serviceImageFallback}><Scissors size={24} color="#b590a3" strokeWidth={1.3} /></View>}
                <View style={s.serviceCopy}><Text style={s.serviceName}>{service.name}</Text><Text style={s.serviceMeta}>{service.duration} min{service.category ? ` · ${service.category.name}` : ""}</Text>{!!service.description && <Text numberOfLines={2} style={s.serviceDescription}>{service.description}</Text>}<Text style={s.servicePrice}>{money(service.priceInCents)} <Text style={s.currency}>MZN</Text></Text></View>
                <View style={[s.selectCircle, picked && s.selectedCircle]}>{picked ? <Check size={17} color="white" /> : <Plus size={18} color={ink} />}</View>
              </Pressable>;
            })}</View>
            {!business.services.length && <View style={s.emptyCard}><Scissors color={rose} size={25} /><Text style={s.cardTitle}>O catálogo está a ser preparado.</Text><Text style={s.body}>Volte em breve para descobrir os serviços deste espaço.</Text></View>}
            {!!business.services.length && <View style={s.bookingNote}><Sparkles color={rose} size={17} /><Text style={s.bookingNoteText}>O seu tempo merece cuidado. Escolha um serviço e encontre o horário ideal.</Text></View>}
          </>}

          {activeTab === "Equipa" && <>
            <Text style={s.sectionEyebrow}>QUEM CUIDA DE SI</Text><Text style={s.sectionTitle}>Conheça a equipa.</Text><Text style={s.body}>Descubra os profissionais e as suas especialidades.</Text>
            <View style={s.teamGrid}>{business.professionals.map((professional) => <View key={professional.id} style={s.teamCard}>
              {professional.image ? <Image source={{ uri: professional.image }} contentFit="cover" style={s.teamImage} /> : <View style={[s.teamImage, s.teamPlaceholder]}><UserRound color="#af8f9f" size={48} strokeWidth={1} /></View>}
              <Text style={s.teamName}>{professional.name}</Text><Text style={s.teamSpecialties}>{professional.specialties.join(" · ") || "Profissional de beleza"}</Text>{!!professional.bio && <Text numberOfLines={3} style={s.teamBio}>{professional.bio}</Text>}
              {professional.rating !== null && <View style={s.teamRating}><Star size={12} fill="#b37d3a" color="#b37d3a" /><Text style={s.ratingNumber}>{professional.rating.toFixed(1)}</Text><Text style={s.smallMuted}>({professional.reviewCount})</Text></View>}
            </View>)}</View>
            {!business.professionals.length && <Text style={s.body}>A equipa será apresentada aqui em breve.</Text>}
          </>}

          {activeTab === "Sobre" && <>
            <Text style={s.sectionEyebrow}>MAIS DO QUE UM ESPAÇO</Text><Text style={s.sectionTitle}>Um momento seu.</Text><Text style={s.aboutText}>{business.description || `Conheça ${business.name} e descubra os serviços de beleza e bem-estar disponíveis para si.`}</Text>
            {!!address && <Pressable accessibilityRole="link" onPress={() => void openExternal(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)} style={s.infoCard}><View style={s.infoIcon}><MapPin color={rose} size={21} /></View><View style={s.flex}><Text style={s.cardTitle}>Encontre-nos</Text><Text style={s.body}>{address}</Text><Text style={s.textLink}>Como chegar</Text></View><ArrowRight size={18} color={rose} /></Pressable>}
            {!!business.phone && <Pressable accessibilityRole="link" onPress={() => void openExternal(`tel:${business.phone!.replace(/[^+\d]/g, "")}`)} style={s.infoCard}><View style={s.infoIcon}><Phone color={rose} size={20} /></View><View style={s.flex}><Text style={s.cardTitle}>Vamos conversar</Text><Text style={s.body}>{business.phone}</Text></View><ArrowRight size={18} color={rose} /></Pressable>}
          </>}

          {activeTab === "Horários" && <>
            <Text style={s.sectionEyebrow}>PLANEIE A SUA VISITA</Text><Text style={s.sectionTitle}>Há tempo para si.</Text><Text style={s.body}>Horário de funcionamento do espaço. A disponibilidade de cada serviço é apresentada ao reservar.</Text>
            <View style={s.scheduleCard}>{[...business.schedules].sort((a, b) => days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek)).map((schedule) => <View key={schedule.dayOfWeek} style={[s.scheduleRow, today === schedule.dayOfWeek && s.todayRow]}><View style={s.scheduleDay}><Text style={[s.dayName, today === schedule.dayOfWeek && s.todayText]}>{dayNames[schedule.dayOfWeek] || schedule.dayOfWeek}</Text>{today === schedule.dayOfWeek && <Text style={s.todayBadge}>HOJE</Text>}</View><Text style={[s.scheduleTime, schedule.closed && s.closedText]}>{schedule.closed ? "Fechado" : `${schedule.openTime} – ${schedule.closeTime}`}</Text></View>)}</View>
            {!business.schedules.length && <Text style={s.body}>Os horários ainda não foram publicados. Consulte a disponibilidade ao reservar um serviço.</Text>}
            <View style={s.bookingNote}><Clock3 color={rose} size={17} /><Text style={s.bookingNoteText}>Horários locais do estabelecimento.</Text></View>
          </>}
          <View style={s.signature}><View style={s.signatureLine} /><Text style={s.signatureText}>um espaço descoberto na <Text style={s.signatureBrand}>belora.</Text></Text><View style={s.signatureLine} /></View>
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={s.footerPrice}><Text numberOfLines={1} style={s.footerLabel}>{selected ? selected.name : minPrice !== null ? "Serviços a partir de" : "O seu momento de cuidado"}</Text>{minPrice !== null && <Text style={s.footerAmount}>{money(selected?.priceInCents ?? minPrice)} <Text style={s.footerCurrency}>MZN</Text></Text>}{selected && <Text style={s.footerDuration}>{selected.duration} min · 1 serviço</Text>}</View>
        <Pressable accessibilityRole="button" disabled={!business.services.length} onPress={reserve} style={({ pressed }) => [s.reserveButton, !business.services.length && { opacity: 0.45 }, pressed && s.pressed]}><Text style={s.whiteButtonText}>{selected ? "Continuar" : "Escolher serviço"}</Text><ArrowRight color="white" size={18} /></Pressable>
      </View>
    </View>

    <Modal visible={galleryVisible} animationType="fade" onRequestClose={() => setGalleryVisible(false)}>
      <View style={s.galleryScreen}><View style={[s.galleryHeader, { paddingTop: insets.top + 16 }]}><View style={s.flex}><Text style={s.galleryTitle}>{business.name}</Text><Text style={s.gallerySubtitle}>{photos.length} {photos.length === 1 ? "fotografia" : "fotografias"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Fechar galeria" onPress={() => setGalleryVisible(false)} style={s.glassCircle}><X color="white" size={22} /></Pressable></View>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: photoIndex * width, y: 0 }}>{photos.map((photo) => <View key={photo.id} style={{ width, height: height - insets.top - 130, justifyContent: "center" }}><Image source={{ uri: photo.url }} contentFit="contain" style={{ width, height: "100%" }} accessibilityLabel={photo.alt || business.name} /></View>)}</ScrollView>
        <Text style={[s.galleryHint, { paddingBottom: insets.bottom + 20 }]}>Deslize para explorar o espaço</Text>
      </View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f2f4", alignItems: "center" }, page: { flex: 1, backgroundColor: "#fffdfb" },
  hero: { backgroundColor: "#582b44", position: "relative" }, heroFallback: { alignItems: "center", justifyContent: "center", gap: 18, overflow: "hidden" }, heroOrb: { width: 300, height: 300, borderRadius: 150, borderWidth: 1, borderColor: "#ffffff20", position: "absolute", right: -100, top: -50 }, fallbackWordmark: { color: "#fff5ed", fontSize: 29, fontWeight: "500", letterSpacing: -1 },
  heroToolbar: { position: "absolute", left: 22, right: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, glassCircle: { width: 44, height: 44, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff26", borderWidth: 1, borderColor: "#ffffff40" }, heroBrand: { fontSize: 26, fontWeight: "700", letterSpacing: -1.5, color: "white" },
  heroBottom: { position: "absolute", bottom: 40, left: 24, right: 24, gap: 18 }, heroCaption: { flexDirection: "row", alignItems: "center", gap: 9 }, smallLine: { width: 20, height: 1, backgroundColor: "#f0bfd2" }, heroCaptionText: { fontSize: 9, letterSpacing: 1.6, color: "#fff4f8", fontWeight: "600", flex: 1 }, photoControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, dots: { flexDirection: "row", gap: 5, flexShrink: 1, overflow: "hidden" }, dot: { width: 5, height: 5, borderRadius: 4, backgroundColor: "#ffffff70" }, activeDot: { width: 22, backgroundColor: "white" }, photoPill: { flexDirection: "row", gap: 7, alignItems: "center", backgroundColor: "#ffffff20", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: "#ffffff40" }, photoCount: { color: "white", fontSize: 11, fontWeight: "600" },
  intro: { marginTop: -23, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#fffdfb", paddingHorizontal: 24, paddingTop: 27, paddingBottom: 23, gap: 13 }, introTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }, eyebrow: { color: rose, fontSize: 10, fontWeight: "700", letterSpacing: 1.8, textTransform: "uppercase", flex: 1 }, cityPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: "#f5f0f2", borderRadius: 20, maxWidth: "45%" }, cityText: { color: muted, fontSize: 10, flexShrink: 1 }, businessName: { color: ink, fontSize: 35, lineHeight: 40, letterSpacing: -1.5, fontWeight: "700" }, ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 }, ratingNumber: { color: ink, fontWeight: "700", fontSize: 12 }, smallMuted: { color: muted, fontSize: 11 }, locationRow: { flexDirection: "row", alignItems: "center", gap: 7 }, locationText: { color: muted, fontSize: 12, lineHeight: 18, flex: 1 }, introFacts: { flexDirection: "row", flexWrap: "wrap", gap: 14, paddingTop: 3 }, fact: { flexDirection: "row", alignItems: "center", gap: 6 }, factText: { color: "#6d5d67", fontSize: 10 }, statusDot: { width: 5, height: 5, borderRadius: 4, backgroundColor: "#55866a" },
  tabs: { flexDirection: "row", backgroundColor: "#fffdfb", borderBottomWidth: 1, borderColor: "#ede6e9", paddingHorizontal: 20 }, tab: { flex: 1, alignItems: "center", paddingVertical: 18, borderBottomWidth: 2, borderBottomColor: "transparent" }, activeTab: { borderBottomColor: rose }, tabText: { color: muted, fontSize: 12, fontWeight: "500" }, activeTabText: { color: ink, fontWeight: "700" }, content: { paddingHorizontal: 22, paddingTop: 28, gap: 16, minHeight: 300 }, sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }, sectionEyebrow: { color: rose, fontSize: 8, fontWeight: "700", letterSpacing: 1.9 }, sectionTitle: { color: ink, fontSize: 27, letterSpacing: -0.9, fontWeight: "600", marginTop: 4 }, sectionCount: { color: muted, fontSize: 10, paddingBottom: 4 },
  categoryList: { gap: 8, paddingVertical: 4 }, chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: "#e9e0e5", backgroundColor: "#fffdfb" }, activeChip: { backgroundColor: ink, borderColor: ink }, chipText: { color: "#72616c", fontSize: 11, fontWeight: "500" }, activeChipText: { color: "white" }, serviceList: { gap: 10 }, service: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 18, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: "#eee7e9", backgroundColor: "white" }, selectedService: { borderColor: "#ba6f93", backgroundColor: "#fcf4f8" }, serviceImage: { width: 66, height: 78, borderRadius: 13, backgroundColor: "#f1eaee" }, serviceImageFallback: { width: 54, height: 65, borderRadius: 13, backgroundColor: "#f7f1f4", alignItems: "center", justifyContent: "center" }, serviceCopy: { flex: 1, gap: 5 }, serviceName: { color: ink, fontSize: 14, lineHeight: 20, fontWeight: "600" }, serviceMeta: { color: muted, fontSize: 10, lineHeight: 15 }, serviceDescription: { color: muted, fontSize: 11, lineHeight: 16 }, servicePrice: { color: ink, fontSize: 15, fontWeight: "700", marginTop: 3 }, currency: { fontSize: 9, fontWeight: "500", color: muted }, selectCircle: { width: 32, height: 32, borderRadius: 18, borderWidth: 1, borderColor: "#e3d9df", alignItems: "center", justifyContent: "center" }, selectedCircle: { backgroundColor: rose, borderColor: rose },
  bookingNote: { flexDirection: "row", gap: 10, alignItems: "center", padding: 16, backgroundColor: "#f6eff2", borderRadius: 15 }, bookingNoteText: { flex: 1, color: "#8d6d7d", fontSize: 11, lineHeight: 18 }, teamGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, paddingTop: 8 }, teamCard: { width: "47%", gap: 7, paddingBottom: 14 }, teamImage: { width: "100%", aspectRatio: 0.9, borderRadius: 22, backgroundColor: "#f2eaee", marginBottom: 6 }, teamPlaceholder: { alignItems: "center", justifyContent: "center" }, teamName: { color: ink, fontSize: 15, fontWeight: "600" }, teamSpecialties: { color: rose, fontSize: 10, lineHeight: 16 }, teamBio: { color: muted, fontSize: 11, lineHeight: 17 }, teamRating: { flexDirection: "row", alignItems: "center", gap: 5 }, aboutText: { color: "#6d5d67", fontSize: 14, lineHeight: 25, marginBottom: 8 }, infoCard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: "#ede4e9", padding: 18, borderRadius: 20, backgroundColor: "white" }, infoIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: "#f9eff4", alignItems: "center", justifyContent: "center" }, flex: { flex: 1, gap: 5 }, cardTitle: { color: ink, fontSize: 14, fontWeight: "600" }, body: { color: muted, fontSize: 12, lineHeight: 21 }, textLink: { color: rose, fontSize: 11, fontWeight: "600", paddingTop: 4 },
  scheduleCard: { borderWidth: 1, borderColor: "#eee5e9", borderRadius: 20, overflow: "hidden", marginTop: 8 }, scheduleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, paddingHorizontal: 15, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#eee5e9", backgroundColor: "white" }, todayRow: { backgroundColor: "#f9eff4" }, scheduleDay: { flexDirection: "row", gap: 7, alignItems: "center" }, dayName: { color: "#6d5d67", fontSize: 12 }, todayText: { color: rose, fontWeight: "600" }, todayBadge: { color: rose, fontSize: 7, fontWeight: "700", letterSpacing: 0.6, backgroundColor: "#eddae4", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5 }, scheduleTime: { color: ink, fontSize: 12, fontWeight: "500" }, closedText: { color: "#aa99a3" }, signature: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 25, marginBottom: 10 }, signatureLine: { flex: 1, height: 1, backgroundColor: "#eee5e9" }, signatureText: { color: "#b19aa7", fontSize: 8 }, signatureBrand: { color: "#9e7389", fontWeight: "700" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 15, paddingHorizontal: 22, paddingTop: 16, backgroundColor: "#fffdfb", borderTopWidth: 1, borderTopColor: "#eee5e9", boxShadow: "0px -6px 30px rgba(52, 23, 42, 0.04)" }, footerPrice: { flex: 1, gap: 4 }, footerLabel: { color: muted, fontSize: 10 }, footerAmount: { color: ink, fontSize: 23, fontWeight: "700", letterSpacing: -0.6 }, footerCurrency: { color: muted, fontSize: 10, fontWeight: "500", letterSpacing: 0 }, footerDuration: { color: muted, fontSize: 9 }, reserveButton: { minHeight: 52, flexDirection: "row", gap: 13, alignItems: "center", justifyContent: "center", borderRadius: 28, paddingHorizontal: 22, backgroundColor: "#382131", maxWidth: "58%" }, whiteButtonText: { color: "white", fontSize: 12, fontWeight: "600" },
  galleryScreen: { flex: 1, backgroundColor: "#171016" }, galleryHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingBottom: 20, gap: 15 }, galleryTitle: { color: "white", fontSize: 18, fontWeight: "600" }, gallerySubtitle: { color: "#c5afbb", fontSize: 11, marginTop: 5 }, galleryHint: { color: "#c5afbb", fontSize: 11, textAlign: "center", paddingTop: 15 }, emptyPage: { flex: 1, backgroundColor: "#fffdfb", padding: 24 }, lightCircle: { width: 44, height: 44, borderRadius: 24, backgroundColor: "#f4ecf0", alignItems: "center", justifyContent: "center" }, loadingContent: { flex: 1, justifyContent: "center", alignItems: "center", gap: 15, paddingHorizontal: 20, paddingBottom: 60 }, loadingMark: { height: 78, width: 78, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: "#f9eef3", marginBottom: 8 }, loadingTitle: { color: ink, fontSize: 26, lineHeight: 34, letterSpacing: -0.6, textAlign: "center", fontWeight: "600" }, retryButton: { backgroundColor: ink, paddingHorizontal: 24, paddingVertical: 15, borderRadius: 25, marginTop: 12 }, emptyCard: { gap: 12, padding: 24, borderRadius: 20, backgroundColor: "#f8f0f4" }, pressed: { opacity: 0.72 },
});
