import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, Clock3, MapPin, Scissors, Star, UserRound } from "lucide-react-native";

import { useRouter } from "expo-router";
import type { PublicProfessional, PublicService } from "@/services/public-catalog";

const ink = "#24151d";
const muted = "#7b6c74";
const rose = "#a72e68";

export function PublicServiceCard({ service }: { service: PublicService }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver e reservar ${service.name} em ${service.businessName}`}
      onPress={() => router.push(("/business-profile/" + encodeURIComponent(service.businessSlug)) as never)}
      style={({ pressed }) => [styles.card, styles.serviceCard, pressed && styles.pressed]}
    >
      {service.image ? (
        <Image source={{ uri: service.image }} accessibilityIgnoresInvertColors style={styles.serviceImage} />
      ) : (
        <View style={styles.serviceImageFallback}><Scissors color={rose} size={23} /></View>
      )}
      <View style={styles.copy}>
        <View style={styles.labels}>
          {service.category && <Text numberOfLines={1} style={styles.category}>{service.category}</Text>}
          {service.city && <Text numberOfLines={1} style={styles.city}>{service.city}</Text>}
        </View>
        <Text numberOfLines={1} style={styles.title}>{service.name}</Text>
        <Text numberOfLines={1} style={styles.business}>{service.businessName}</Text>
        <View style={styles.footer}>
          <View style={styles.meta}><Clock3 color={muted} size={13} /><Text style={styles.metaText}>{service.duration} min</Text></View>
          <Text style={styles.price}>{(service.priceInCents / 100).toLocaleString("pt-MZ")} MZN</Text>
        </View>
      </View>
      <ChevronRight color={muted} size={19} />
    </Pressable>
  );
}

export function PublicProfessionalCard({ professional }: { professional: PublicProfessional }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver ${professional.name} e os seus serviços em ${professional.businessName}`}
      onPress={() => router.push(("/business-profile/" + encodeURIComponent(professional.businessSlug)) as never)}
      style={({ pressed }) => [styles.card, styles.professionalCard, pressed && styles.pressed]}
    >
      {professional.image ? (
        <Image source={{ uri: professional.image }} accessibilityIgnoresInvertColors style={styles.professionalImage} />
      ) : (
        <View style={styles.professionalImageFallback}><UserRound color={rose} size={23} /></View>
      )}
      <View style={styles.copy}>
        <View style={styles.professionalHeading}>
          <Text numberOfLines={1} style={styles.title}>{professional.name}</Text>
          {professional.rating !== null && (
            <View style={styles.rating}><Star color="#c18132" fill="#c18132" size={12} /><Text style={styles.ratingText}>{professional.rating.toFixed(1)}</Text></View>
          )}
        </View>
        <Text numberOfLines={1} style={styles.business}>{professional.businessName}</Text>
        <View style={styles.labels}>
          {professional.specialties.slice(0, 2).map((specialty) => <Text key={specialty} numberOfLines={1} style={styles.specialty}>{specialty}</Text>)}
          {professional.city && <View style={styles.cityLine}><MapPin color={muted} size={11} /><Text numberOfLines={1} style={styles.city}>{professional.city}</Text></View>}
        </View>
        {!!professional.serviceNames.length && <Text numberOfLines={1} style={styles.serviceNames}>{professional.serviceNames.join(" · ")}</Text>}
        <Text style={styles.linkText}>Ver serviços e reservar</Text>
      </View>
      <ChevronRight color={muted} size={19} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#eee5e9", borderRadius: 20, padding: 13, backgroundColor: "white" },
  serviceCard: { minHeight: 108 },
  professionalCard: { minHeight: 112 },
  serviceImage: { width: 76, height: 76, borderRadius: 17, backgroundColor: "#f2ebef" },
  serviceImageFallback: { width: 76, height: 76, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#fbf0f5" },
  professionalImage: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#f2ebef" },
  professionalImageFallback: { width: 66, height: 66, alignItems: "center", justifyContent: "center", borderRadius: 33, backgroundColor: "#fbf0f5" },
  copy: { flex: 1, gap: 4 },
  labels: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  category: { color: rose, fontSize: 10, fontWeight: "700" },
  city: { color: muted, fontSize: 10 },
  title: { color: ink, fontSize: 14, fontWeight: "700" },
  business: { color: muted, fontSize: 11 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7, marginTop: 3 },
  meta: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: muted, fontSize: 10 },
  price: { color: rose, fontSize: 11, fontWeight: "800" },
  professionalHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { color: "#74532a", fontSize: 10, fontWeight: "700" },
  specialty: { overflow: "hidden", borderRadius: 99, backgroundColor: "#fbf0f5", color: rose, fontSize: 9, fontWeight: "600", paddingHorizontal: 7, paddingVertical: 3 },
  cityLine: { flexDirection: "row", alignItems: "center", gap: 3 },
  serviceNames: { color: muted, fontSize: 10 },
  linkText: { color: rose, fontSize: 10, fontWeight: "700", marginTop: 1 },
  pressed: { opacity: 0.76 },
});
