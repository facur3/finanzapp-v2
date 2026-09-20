import { Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View } from 'react-native';
import { AppText, DetailRow, Screen, SectionTitle, Surface } from '../src/ui/components';
import { usePalette } from '../src/ui/theme';

export default function AssistantPreviewScreen() {
  const p = usePalette();
  return <Screen>
    <Stack.Screen options={{ title: 'Asistente' }} />
    <View style={{ alignItems: 'center', gap: 14, paddingTop: 16 }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: p.accentSoft }}>
        <Ionicons name="sparkles" size={32} color={p.accent} accessible={false} />
      </View>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <AppText accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.8 }}>
          Tu dinero, en palabras simples
        </AppText>
        <AppText secondary style={{ textAlign: 'center', fontSize: 15 }}>
          La interfaz está preparada, pero la IA todavía no está activada. Por ahora no se envían tus datos financieros a ningún modelo.
        </AppText>
      </View>
    </View>

    <Surface>
      <SectionTitle>Qué va a poder hacer</SectionTitle>
      <View style={{ gap: 12 }}>
        <PreviewPrompt icon="chatbubble-ellipses-outline" title="Registrar con lenguaje natural"
          detail="“Gasté 18.500 en el súper con Visa” → borrador revisable antes de guardar." />
        <PreviewPrompt icon="stats-chart-outline" title="Responder sobre tus finanzas"
          detail="“¿Cuánto gasté en comida este mes?” usando únicamente movimientos que realmente existan." />
        <PreviewPrompt icon="sparkles-outline" title="Explicar sin inventar"
          detail="Resúmenes de presupuesto, recurrentes y tendencias con enlaces a los movimientos que sustentan la respuesta." />
      </View>
    </Surface>

    <Surface grouped>
      <DetailRow label="Estado" value="Próximamente" icon="hourglass-outline" />
      <DetailRow label="Control" value="Siempre revisable" icon="checkmark-circle-outline" />
      <DetailRow label="Privacidad" value="Opt-in antes de nube" icon="lock-closed-outline" last />
    </Surface>

    <AppText secondary style={{ fontSize: 13, textAlign: 'center' }}>
      La activación real llegará después de terminar el núcleo financiero y configurar autenticación, consentimiento y claves del servidor.
    </AppText>
  </Screen>;
}

function PreviewPrompt({ icon, title, detail }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }) {
  const p = usePalette();
  return <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
    <View style={{ width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: p.inset }}>
      <Ionicons name={icon} size={20} color={p.accent} accessible={false} />
    </View>
    <View style={{ flex: 1, gap: 3 }}>
      <AppText style={{ fontWeight: '600' }}>{title}</AppText>
      <AppText secondary style={{ fontSize: 14 }}>{detail}</AppText>
    </View>
  </View>;
}
