import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CanvasLayout } from '../../lab/geometry';
import { colors } from '../../theme';

type Props = {
  layout: CanvasLayout;
  scale: number;
  categories: string[];
  category: string;
  onChange: (category: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Free play: a dropdown in the bin's corner that picks which category of parts it shows. */
export function BinPicker({ layout, scale, categories, category, onChange, open, onOpenChange }: Props) {
  const frame = (x: number, y: number, w: number, h: number) => ({ left: x * scale, top: y * scale, width: w * scale, height: h * scale });
  return (
    <View style={[styles.picker, frame(layout.bin.x + 6, layout.bin.y + 4, 128, 18)]}>
      {open ? (
        <Pressable
          accessibilityLabel="Close the category picker"
          style={{
            position: 'absolute',
            left: -(layout.bin.x + 6) * scale,
            top: -(layout.bin.y + 4) * scale,
            width: layout.width * scale,
            height: layout.height * scale,
          }}
          onPress={() => onOpenChange(false)}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Parts bin: showing ${category}. Tap to choose another category.`}
        onPress={() => onOpenChange(!open)}
        style={styles.pickerButton}
      >
        <Text style={styles.pickerText} numberOfLines={1}>
          {category} ▾
        </Text>
      </Pressable>
      {open ? (
        <View style={[styles.pickerMenu, layout.id === 'landscape' ? styles.pickerMenuUp : styles.pickerMenuDown]}>
          {categories.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Show ${c}`}
              onPress={() => {
                onChange(c);
                onOpenChange(false);
              }}
              style={[styles.pickerItem, c === category && styles.pickerItemActive]}
            >
              <Text style={[styles.pickerItemText, c === category && styles.pickerItemTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    position: 'absolute',
    zIndex: 20,
  },
  pickerButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.panel,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pickerText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  pickerMenu: {
    position: 'absolute',
    left: 0,
    backgroundColor: colors.panel,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    minWidth: 128,
    overflow: 'hidden',
    zIndex: 21,
  },
  // The bin sits at the top of the canvas on phones and at the bottom on wide screens.
  pickerMenuDown: {
    top: 26,
  },
  pickerMenuUp: {
    bottom: 26,
  },
  pickerItem: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pickerItemActive: {
    backgroundColor: colors.teal,
  },
  pickerItemText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  pickerItemTextActive: {
    color: '#FFFFFF',
  },
});
