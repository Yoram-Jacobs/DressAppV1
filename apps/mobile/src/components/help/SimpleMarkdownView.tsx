import React from 'react';
import { View, Text, StyleSheet, Linking, I18nManager, Platform } from 'react-native';
import { useTheme } from '@mobile/theme';
import { fonts, fontSizes, spacing, radii } from '@mobile/theme/tokens';

interface SimpleMarkdownViewProps {
  markdown: string;
}

export function SimpleMarkdownView({ markdown }: SimpleMarkdownViewProps) {
  const { colors, isDark } = useTheme();
  const isRtl = I18nManager.isRTL;

  if (!markdown) return null;

  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  const parseInline = (text: string) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let keyIdx = 0;

    while ((match = regex.exec(text)) !== null) {
      const matchText = match[0];
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        parts.push(
          <Text key={`txt-${keyIdx++}`} style={{ color: colors.foreground }}>
            {text.substring(lastIndex, matchIndex)}
          </Text>
        );
      }

      if (matchText.startsWith('**') && matchText.endsWith('**')) {
        parts.push(
          <Text key={`b-${keyIdx++}`} style={[styles.bold, { color: colors.foreground }]}>
            {matchText.slice(2, -2)}
          </Text>
        );
      } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
        parts.push(
          <Text
            key={`c-${keyIdx++}`}
            style={[styles.inlineCode, { backgroundColor: colors.secondary, color: colors.accent }]}
          >
            {` ${matchText.slice(1, -1)} `}
          </Text>
        );
      } else if (matchText.startsWith('[') && matchText.includes('](')) {
        const label = matchText.substring(1, matchText.indexOf(']'));
        const href = matchText.substring(matchText.indexOf('](') + 2, matchText.length - 1);
        parts.push(
          <Text
            key={`link-${keyIdx++}`}
            style={[styles.link, { color: colors.primary }]}
            onPress={() => Linking.openURL(href).catch(() => {})}
          >
            {label}
          </Text>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(
        <Text key={`tail-${keyIdx++}`} style={{ color: colors.foreground }}>
          {text.substring(lastIndex)}
        </Text>
      );
    }

    return parts.length > 0 ? parts : text;
  };

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      elements.push(
        <View key={`ul-${key}`} style={styles.listContainer}>
          {listItems.map((item, i) => (
            <View key={i} style={[styles.listItemRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.bullet, { color: colors.primary }]}>•</Text>
              <Text style={[styles.listText, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
                {parseInline(item)}
              </Text>
            </View>
          ))}
        </View>
      );
      listItems = [];
    }
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const line = rawLine.trim();

    if (line.startsWith('```')) {
      if (inCode) {
        elements.push(
          <View key={`code-${idx}`} style={[styles.codeBlock, { backgroundColor: isDark ? '#18181b' : '#f4f4f5', borderColor: colors.border }]}>
            <Text style={[styles.codeText, { color: colors.foreground }]}>
              {codeLines.join('\n')}
            </Text>
          </View>
        );
        inCode = false;
        codeLines = [];
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (line.startsWith('# ')) {
      flushList(idx);
      elements.push(
        <Text key={`h1-${idx}`} style={[styles.h1, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
          {parseInline(line.slice(2))}
        </Text>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      flushList(idx);
      elements.push(
        <Text key={`h2-${idx}`} style={[styles.h2, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
          {parseInline(line.slice(3))}
        </Text>
      );
      continue;
    }

    if (line.startsWith('### ')) {
      flushList(idx);
      elements.push(
        <Text key={`h3-${idx}`} style={[styles.h3, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
          {parseInline(line.slice(4))}
        </Text>
      );
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2));
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      flushList(idx);
      const match = line.match(/^(\d+)\.\s(.*)/);
      if (match) {
        elements.push(
          <View key={`num-${idx}`} style={[styles.numRow, { flexDirection: isRtl ? 'row-reverse' : 'row' }]}>
            <Text style={[styles.numBadge, { color: colors.primary }]}>{match[1]}.</Text>
            <Text style={[styles.numText, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
              {parseInline(match[2])}
            </Text>
          </View>
        );
      }
      continue;
    }

    if (line === '') {
      flushList(idx);
      continue;
    }

    if (line === '---') {
      flushList(idx);
      elements.push(<View key={`hr-${idx}`} style={[styles.hr, { backgroundColor: colors.border }]} />);
      continue;
    }

    if (line.startsWith('> ')) {
      flushList(idx);
      elements.push(
        <View key={`quote-${idx}`} style={[styles.quoteBox, { borderLeftColor: colors.primary, backgroundColor: colors.secondary }]}>
          <Text style={[styles.quoteText, { color: colors.mutedFg, textAlign: isRtl ? 'right' : 'left' }]}>
            {parseInline(line.slice(2))}
          </Text>
        </View>
      );
      continue;
    }

    flushList(idx);
    elements.push(
      <Text key={`p-${idx}`} style={[styles.paragraph, { color: colors.foreground, textAlign: isRtl ? 'right' : 'left' }]}>
        {parseInline(line)}
      </Text>
    );
  }

  flushList(lines.length);

  return <View style={styles.container}>{elements}</View>;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
  },
  h1: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes['2xl'],
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.base,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  paragraph: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 22,
    marginVertical: 4,
  },
  bold: {
    fontFamily: fonts.bodyBold,
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: fontSizes.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  link: {
    fontFamily: fonts.bodyBold,
    textDecorationLine: 'underline',
  },
  listContainer: {
    marginVertical: spacing.xs,
    gap: 6,
  },
  listItemRow: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  bullet: {
    fontSize: fontSizes.base,
    lineHeight: 22,
  },
  listText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
  numRow: {
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginVertical: 4,
    paddingHorizontal: spacing.xs,
  },
  numBadge: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    minWidth: 20,
    lineHeight: 22,
  },
  numText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
  codeBlock: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginVertical: spacing.sm,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
  quoteBox: {
    borderLeftWidth: 3,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    marginVertical: spacing.sm,
  },
  quoteText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  hr: {
    height: 1,
    marginVertical: spacing.md,
  },
});