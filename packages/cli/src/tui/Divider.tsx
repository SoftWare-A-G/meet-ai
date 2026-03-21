import { Box, Text } from 'ink'

interface DividerProps {
  title?: string
  dividerChar?: string
  dividerColor?: string
  titleColor?: string
  padding?: number
}

export default function Divider({
  title,
  dividerChar = '─',
  dividerColor = 'gray',
  titleColor = 'white',
  padding = 0,
}: DividerProps) {
  if (!title) {
    return (
      <Box paddingLeft={padding} paddingRight={padding} height={1} overflow="hidden">
        <Text color={dividerColor} wrap="truncate">{dividerChar.repeat(200)}</Text>
      </Box>
    )
  }

  return (
    <Box paddingLeft={padding} paddingRight={padding} gap={1} height={1} overflow="hidden">
      <Box flexGrow={1} overflow="hidden">
        <Text color={dividerColor} wrap="truncate">{dividerChar.repeat(200)}</Text>
      </Box>
      <Text color={titleColor}>{title}</Text>
      <Box flexGrow={1} overflow="hidden">
        <Text color={dividerColor} wrap="truncate">{dividerChar.repeat(200)}</Text>
      </Box>
    </Box>
  )
}
