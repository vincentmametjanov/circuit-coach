import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../../theme';
import { Icon, type IconName } from './Icons';

export function TitleBar({ title }: { title: string }) {
  return (
    <View style={styles.titleBar}>
      <Text style={styles.titleText} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

type ToolbarProps = {
  busy: boolean;
  compact: boolean;
  running: boolean;
  onVerify: () => void;
  onUpload: () => void;
  onReset: () => void;
};

/** Teal toolbar with round Verify / Upload buttons, like the Arduino IDE. */
export function Toolbar({ busy, compact, running, onVerify, onUpload, onReset }: ToolbarProps) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <View style={styles.toolbar}>
      <RoundButton icon="verify" label="Verify" disabled={busy} onPress={onVerify} onHover={setHover} />
      <RoundButton icon="upload" label="Upload" disabled={busy} onPress={onUpload} onHover={setHover} />
      {!compact ? <Text style={styles.hoverLabel}>{hover ?? ''}</Text> : null}

      <View style={styles.boardPill}>
        <Icon name="usb" size={14} color={colors.tealPale} />
        <Text style={styles.boardText} numberOfLines={1}>
          Arduino Uno
        </Text>
        {!compact ? <Text style={styles.portText}>sim-usb0</Text> : null}
        <View style={[styles.portDot, running && styles.portDotLive]} />
      </View>

      <View style={styles.flex} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reset lab"
        onPress={onReset}
        style={({ pressed, hovered }) => [styles.resetButton, (pressed || hovered) && styles.resetButtonActive]}
      >
        <Icon name="reset" size={16} color={colors.tealPale} />
        {!compact ? <Text style={styles.resetText}>Reset lab</Text> : null}
      </Pressable>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  disabled,
  onPress,
  onHover,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
  onHover: (label: string | null) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => onHover(label)}
      onHoverOut={() => onHover(null)}
      style={({ pressed, hovered }) => [
        styles.roundButton,
        (pressed || hovered) && !disabled && styles.roundButtonActive,
        disabled && styles.roundButtonDisabled,
      ]}
    >
      <Icon name={icon} size={18} color={colors.toolbarButtonIcon} />
    </Pressable>
  );
}

export type Tab = { id: string; label: string };

export function TabStrip({ tabs, active, onSelect }: { tabs: Tab[]; active: string; onSelect: (id: string) => void }) {
  return (
    <View style={styles.tabStrip}>
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(tab.id)}
            style={[styles.tab, selected && styles.tabActive]}
          >
            <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type Activity = { id: string; icon: IconName; label: string };

/** Vertical icon bar on the far left, as in Arduino IDE 2. */
export function ActivityBar({
  items,
  active,
  onSelect,
}: {
  items: Activity[];
  active: string[];
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.activityBar}>
      {items.map((item) => {
        const on = active.includes(item.id);
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => onSelect(item.id)}
            style={({ hovered }) => [styles.activityItem, hovered && styles.activityItemHover]}
          >
            <View style={[styles.activityIndicator, on && styles.activityIndicatorOn]} />
            <Icon name={item.icon} size={22} color={on ? colors.teal : colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function StatusBar({ left, right }: { left: string; right: string }) {
  return (
    <View style={styles.statusBar}>
      <Text style={styles.statusText} numberOfLines={1}>
        {left}
      </Text>
      <Text style={[styles.statusText, styles.statusRight]} numberOfLines={1}>
        {right}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleBar: {
    height: 28,
    backgroundColor: colors.titleBar,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  titleText: {
    color: colors.tealPale,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  toolbar: {
    minHeight: 54,
    backgroundColor: colors.toolbar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  roundButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.toolbarButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonActive: {
    backgroundColor: colors.toolbarButtonHover,
  },
  roundButtonDisabled: {
    opacity: 0.5,
  },
  hoverLabel: {
    width: 64,
    color: colors.tealPale,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  boardPill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#00494C',
    borderWidth: 1,
    borderColor: '#2E8A8E',
  },
  boardText: {
    color: '#FFFFFF',
    fontFamily: fonts.ui,
    fontSize: 13,
    fontWeight: '600',
  },
  portText: {
    color: '#9CCFD1',
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  portDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#9CCFD1',
  },
  portDotLive: {
    backgroundColor: '#3BE36B',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2E8A8E',
  },
  resetButtonActive: {
    backgroundColor: '#00494C',
  },
  resetText: {
    color: colors.tealPale,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  tabStrip: {
    flexDirection: 'row',
    backgroundColor: colors.tabStrip,
    paddingTop: 6,
    paddingHorizontal: 8,
    gap: 3,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: colors.tabInactive,
  },
  tabActive: {
    backgroundColor: colors.editor,
  },
  tabText: {
    color: colors.tabText,
    fontFamily: fonts.ui,
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.tabActiveText,
    fontWeight: '600',
  },
  activityBar: {
    width: 48,
    backgroundColor: colors.activityBar,
    borderRightWidth: 1,
    borderRightColor: colors.panelBorder,
    paddingTop: 6,
  },
  activityItem: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityItemHover: {
    backgroundColor: '#D6E2E2',
  },
  activityIndicator: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  activityIndicatorOn: {
    backgroundColor: colors.teal,
  },
  statusBar: {
    minHeight: 24,
    backgroundColor: colors.statusBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  statusText: {
    color: colors.statusText,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  statusRight: {
    flex: 1,
    textAlign: 'right',
  },
});
