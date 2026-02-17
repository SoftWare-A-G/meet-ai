import { useMemo } from 'react'
import { Platform } from 'react-native'

import { useTheme } from '@/hooks/use-theme'

const monoFont = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

export function useMarkdownStyles(theme: ReturnType<typeof useTheme>) {
  return useMemo(
    () => ({
      body: { color: theme.text, fontSize: 15, lineHeight: 21 },
      heading1: { color: theme.text, fontSize: 24, fontWeight: 'bold' as const, marginVertical: 4 },
      heading2: { color: theme.text, fontSize: 20, fontWeight: 'bold' as const, marginVertical: 4 },
      heading3: { color: theme.text, fontSize: 17, fontWeight: '600' as const, marginVertical: 2 },
      strong: { fontWeight: 'bold' as const },
      em: { fontStyle: 'italic' as const },
      link: { color: '#3b82f6', textDecorationLine: 'underline' as const },
      blockquote: {
        backgroundColor: theme.backgroundElement,
        borderColor: theme.textSecondary,
        borderLeftWidth: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginVertical: 4,
      },
      code_inline: {
        backgroundColor: theme.backgroundElement,
        borderColor: theme.backgroundSelected,
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
        fontFamily: monoFont,
        fontSize: 13,
      },
      code_block: {
        backgroundColor: theme.backgroundElement,
        borderColor: theme.backgroundSelected,
        borderWidth: 1,
        borderRadius: 6,
        padding: 8,
        fontFamily: monoFont,
        fontSize: 13,
      },
      fence: {
        backgroundColor: theme.backgroundElement,
        borderColor: theme.backgroundSelected,
        borderWidth: 1,
        borderRadius: 6,
        padding: 8,
        fontFamily: monoFont,
        fontSize: 13,
      },
      paragraph: {
        marginTop: 0,
        marginBottom: 4,
        flexWrap: 'wrap' as const,
        flexDirection: 'row' as const,
        alignItems: 'flex-start' as const,
        justifyContent: 'flex-start' as const,
        width: '100%' as const,
      },
      bullet_list_icon: { color: theme.text, marginLeft: 4, marginRight: 8 },
      ordered_list_icon: { color: theme.text, marginLeft: 4, marginRight: 8 },
      hr: { backgroundColor: theme.textSecondary, height: 1, marginVertical: 8 },
      table: { borderWidth: 1, borderColor: theme.backgroundSelected, borderRadius: 4 },
      tr: { borderBottomWidth: 1, borderColor: theme.backgroundSelected, flexDirection: 'row' as const },
      td: { flex: 1, padding: 4 },
      th: { flex: 1, padding: 4, fontWeight: 'bold' as const },
    }),
    [theme],
  )
}
