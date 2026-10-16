import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, syntax } from '../../theme';

const TYPES = new Set(['const', 'int', 'void']);
const STRUCTURE = new Set(['setup', 'loop']);
const FUNCTIONS = new Set(['pinMode', 'digitalWrite', 'digitalRead', 'delay', 'if', 'else']);
const CONSTANTS = new Set(['HIGH', 'LOW', 'OUTPUT', 'INPUT', 'INPUT_PULLUP']);

function tokenColor(token: string) {
  if (token.startsWith('//')) return syntax.comment;
  if (TYPES.has(token)) return syntax.type;
  if (STRUCTURE.has(token)) return syntax.structure;
  if (FUNCTIONS.has(token)) return syntax.function;
  if (CONSTANTS.has(token)) return syntax.constant;
  if (/^\d+$/.test(token)) return syntax.number;
  return syntax.text;
}

function tokenize(line: string) {
  return line.match(/\/\/.*$|[A-Za-z_]\w*|\d+|\s+|./g) ?? [];
}

/** Read-only sketch with Arduino IDE syntax colors. */
export function CodeView({ sketch }: { sketch: { name: string; code: string; highlightLine?: number } }) {
  const lines = sketch.code.split('\n');
  return (
    <View style={styles.editor}>
      <View style={styles.readOnly}>
        <Text style={styles.readOnlyText}>Read-only — this is the program the Upload button sends to the board.</Text>
      </View>
      <ScrollView horizontal contentContainerStyle={styles.scrollContent}>
        <View style={styles.lines}>
          {lines.map((line, index) => (
            <View key={index} style={[styles.line, index + 1 === sketch.highlightLine && styles.lineHighlight]}>
              <Text style={styles.gutter}>{index + 1}</Text>
              <Text style={styles.code}>
                {tokenize(line).map((token, i) => (
                  <Text key={i} style={{ color: tokenColor(token) }}>
                    {token}
                  </Text>
                ))}
                {line.length === 0 ? ' ' : null}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: {
    flex: 1,
    backgroundColor: colors.editor,
  },
  readOnly: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.tealPale,
    borderBottomWidth: 1,
    borderBottomColor: colors.panelBorder,
  },
  readOnlyText: {
    color: colors.tealDark,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  scrollContent: {
    paddingVertical: 10,
    minWidth: '100%',
  },
  lines: {
    flexGrow: 1,
  },
  line: {
    flexDirection: 'row',
    paddingRight: 24,
  },
  lineHighlight: {
    backgroundColor: '#FFF8DC',
  },
  gutter: {
    width: 44,
    paddingRight: 12,
    textAlign: 'right',
    color: colors.gutterText,
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 21,
  },
  code: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 21,
  },
});
