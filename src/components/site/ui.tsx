// Building blocks shared by the homepage and the lab list: the site header,
// a centered page column, section headings, buttons and a responsive grid.

import { router } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '../../theme';

export const MAX_WIDTH = 1080;

/** Breakpoints: phones stack everything, tablets get two columns, desktops three. */
export function useScreen() {
  const { width } = useWindowDimensions();
  return {
    width,
    phone: width < 640,
    wide: width >= 960,
    columns: width >= 960 ? 3 : width >= 640 ? 2 : 1,
    gutter: width < 640 ? 20 : 32,
  };
}

export function SitePage({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ExpoStatusBar style="light" />
      <SiteHeader />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function SiteHeader() {
  const { phone, gutter } = useScreen();
  return (
    <View style={styles.header}>
      <View style={[styles.column, styles.headerRow, { paddingHorizontal: gutter }]}>
        <Pressable accessibilityRole="link" accessibilityLabel="Circuit Coach home" onPress={() => router.navigate('/')}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <View style={styles.brandDot} />
            </View>
            <Text style={styles.brandText}>Circuit Coach</Text>
          </View>
        </Pressable>
        <View style={styles.flex} />
        <Pressable accessibilityRole="link" onPress={() => router.navigate('/labs')} style={styles.navLink}>
          <Text style={styles.navText}>Labs</Text>
        </Pressable>
        {!phone ? <Button label="Open bench" onPress={() => router.navigate('/play')} small /> : null}
      </View>
    </View>
  );
}

/** A full-width band with its content held to the page column. */
export function Band({ children, tint = false, style }: { children: ReactNode; tint?: boolean; style?: StyleProp<ViewStyle> }) {
  const { gutter, phone } = useScreen();
  return (
    <View style={[styles.band, tint && styles.bandTint, { paddingVertical: phone ? 40 : 64 }]}>
      <View style={[styles.column, { paddingHorizontal: gutter }, style]}>{children}</View>
    </View>
  );
}

export function SectionTitle({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
  const { phone } = useScreen();
  return (
    <View style={styles.sectionTitle}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
      <Text style={[styles.h2, phone && styles.h2Phone]} accessibilityRole="header">
        {title}
      </Text>
      {intro ? <Text style={styles.intro}>{intro}</Text> : null}
    </View>
  );
}

/** Lays children out in rows of equal columns; the last row keeps the same column widths. */
export function Grid({ children, columns, gap = 16 }: { children: ReactNode[]; columns: number; gap?: number }) {
  const rows: ReactNode[][] = [];
  for (let i = 0; i < children.length; i += columns) rows.push(children.slice(i, i + columns));
  return (
    <View style={{ gap }}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.gridRow, { gap }]}>
          {Array.from({ length: columns }, (_, c) => (
            <View key={c} style={styles.gridCell}>
              {row[c] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  small = false,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  small?: boolean;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.button,
        small && styles.buttonSmall,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || hovered) && (primary ? styles.buttonPrimaryActive : styles.buttonSecondaryActive),
      ]}
    >
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, !primary && styles.buttonTextSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

export const text = StyleSheet.create({
  body: { color: colors.text, fontFamily: fonts.ui, fontSize: 16, lineHeight: 24 },
  small: { color: colors.textMuted, fontFamily: fonts.ui, fontSize: 13, lineHeight: 19 },
  h3: { color: colors.titleBar, fontFamily: fonts.ui, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  label: { color: colors.teal, fontFamily: fonts.ui, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.titleBar },
  scroll: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1 },
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  header: { backgroundColor: colors.titleBar, paddingVertical: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFD166' },
  brandText: { color: '#FFFFFF', fontFamily: fonts.ui, fontSize: 18, fontWeight: '700' },
  navLink: { paddingHorizontal: 10, paddingVertical: 8 },
  navText: { color: colors.tealPale, fontFamily: fonts.ui, fontSize: 15, fontWeight: '600' },
  band: { backgroundColor: '#FFFFFF' },
  bandTint: { backgroundColor: colors.canvas },
  sectionTitle: { gap: 10, marginBottom: 28, maxWidth: 720 },
  eyebrow: { color: colors.teal, fontFamily: fonts.ui, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  h2: { color: colors.titleBar, fontFamily: fonts.ui, fontSize: 30, lineHeight: 38, fontWeight: '700' },
  h2Phone: { fontSize: 24, lineHeight: 31 },
  intro: { color: colors.text, fontFamily: fonts.ui, fontSize: 17, lineHeight: 26 },
  gridRow: { flexDirection: 'row', alignItems: 'stretch' },
  gridCell: { flex: 1, minWidth: 0 },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    padding: 20,
    gap: 8,
  },
  button: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 13, alignItems: 'center' },
  buttonSmall: { paddingHorizontal: 16, paddingVertical: 8 },
  buttonPrimary: { backgroundColor: colors.teal },
  buttonPrimaryActive: { backgroundColor: colors.tealDark },
  buttonSecondary: { borderWidth: 1.5, borderColor: colors.teal, backgroundColor: 'transparent' },
  buttonSecondaryActive: { backgroundColor: colors.tealPale },
  buttonText: { color: '#FFFFFF', fontFamily: fonts.ui, fontSize: 16, fontWeight: '700' },
  buttonTextSmall: { fontSize: 14 },
  buttonTextSecondary: { color: colors.tealDark },
});
