import { Box, Text } from 'ink'
import type { ProcessStatus, PaneCapture } from '@meet-ai/cli/lib/process-manager'

const MAX_VISIBLE_PANES = 5

const STATUS_LABELS: Record<ProcessStatus, { label: string; color: string }> = {
  starting: { label: 'starting...', color: 'yellow' },
  running: { label: 'running', color: 'green' },
  exited: { label: 'exited', color: 'gray' },
  error: { label: 'error', color: 'red' },
}

interface MainPaneProps {
  roomName: string
  status: ProcessStatus
  lines: string[]
  panes: PaneCapture[]
  height: number
}

function PaneCell({ pane, height, width }: { pane: PaneCapture; height: number; width?: string | number }) {
  const contentHeight = Math.max(1, height - 3) // minus header + border
  const visibleLines = pane.lines.slice(-contentHeight)
  const title = pane.title || `Pane ${pane.index}`

  return (
    <Box
      flexDirection="column"
      flexGrow={width ? undefined : 1}
      flexBasis={width ? undefined : 0}
      width={width}
      borderStyle="single"
      borderColor={pane.active ? 'cyan' : 'gray'}
      height={height}
    >
      <Box paddingX={1}>
        <Text bold={pane.active} color={pane.active ? 'cyan' : undefined} dimColor={!pane.active}>
          {title}
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {visibleLines.length === 0 ? (
          <Text dimColor>[no output]</Text>
        ) : (
          visibleLines.map((line, i) => (
            <Text key={i} wrap="truncate">{line}</Text>
          ))
        )}
      </Box>
    </Box>
  )
}

function PaneHeader({ roomName, status, totalPanes, visibleCount }: {
  roomName: string
  status: ProcessStatus
  totalPanes: number
  visibleCount: number
}) {
  const { label, color } = STATUS_LABELS[status]
  return (
    <Box paddingX={1} gap={1}>
      <Text bold color="cyan">{roomName}</Text>
      <Text color={color}>[{label}]</Text>
      {totalPanes > 1 && (
        <Text dimColor>
          {totalPanes > visibleCount
            ? `${visibleCount} of ${totalPanes} panes`
            : `${totalPanes} panes`}
        </Text>
      )}
    </Box>
  )
}

/**
 * Grid layouts by pane count:
 *
 * 1 pane:  [    1    ]       — full space
 *
 * 2 panes: [ 1 ][ 2 ]       — side by side
 *
 * 3 panes: [   ][ 2 ]       — 1 is 50% left
 *          [ 1 ][---]         2,3 stacked on right
 *          [   ][ 3 ]
 *
 * 4 panes: [   ][ 2 ]       — 1 is 50% left
 *          [ 1 ][---]         2 on top, 3+4 side by side bottom
 *          [   ][3|4]
 *
 * 5 panes: [   ][2|3]       — 1 is 30% left
 *          [ 1 ][---]         2x2 grid on right
 *          [   ][4|5]
 */
export default function MainPane({ roomName, status, lines, panes, height }: MainPaneProps) {
  const totalPanes = panes.length
  const visiblePanes = panes.slice(0, MAX_VISIBLE_PANES)
  const visibleCount = visiblePanes.length
  const headerHeight = 1
  const gridHeight = height - headerHeight

  // 0-1 panes: original single-pane layout
  if (visibleCount <= 1) {
    const { label, color } = STATUS_LABELS[status]
    const contentHeight = Math.max(1, height - 3)
    const visibleLines = lines.slice(-contentHeight)

    return (
      <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="cyan" height={height}>
        <Box paddingX={1} gap={1}>
          <Text bold color="cyan">{roomName}</Text>
          <Text color={color}>[{label}]</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          {visibleLines.length === 0 ? (
            <Text dimColor>[no output yet]</Text>
          ) : (
            visibleLines.map((line, i) => (
              <Text key={i} wrap="truncate">{line}</Text>
            ))
          )}
        </Box>
      </Box>
    )
  }

  // 2 panes: side by side
  if (visibleCount === 2) {
    return (
      <Box flexDirection="column" flexGrow={1} height={height}>
        <PaneHeader roomName={roomName} status={status} totalPanes={totalPanes} visibleCount={visibleCount} />
        <Box flexDirection="row" flexGrow={1} height={gridHeight}>
          <PaneCell pane={visiblePanes[0]!} height={gridHeight} />
          <PaneCell pane={visiblePanes[1]!} height={gridHeight} />
        </Box>
      </Box>
    )
  }

  // 3 panes: left 50% + right stacked
  if (visibleCount === 3) {
    const rightHeight = Math.floor(gridHeight / 2)
    return (
      <Box flexDirection="column" flexGrow={1} height={height}>
        <PaneHeader roomName={roomName} status={status} totalPanes={totalPanes} visibleCount={visibleCount} />
        <Box flexDirection="row" flexGrow={1} height={gridHeight}>
          <PaneCell pane={visiblePanes[0]!} height={gridHeight} width="50%" />
          <Box flexDirection="column" flexGrow={1}>
            <PaneCell pane={visiblePanes[1]!} height={rightHeight} />
            <PaneCell pane={visiblePanes[2]!} height={gridHeight - rightHeight} />
          </Box>
        </Box>
      </Box>
    )
  }

  // 4 panes: left 50% + right: top 1, bottom 2 side by side
  if (visibleCount === 4) {
    const rightTopHeight = Math.floor(gridHeight / 2)
    return (
      <Box flexDirection="column" flexGrow={1} height={height}>
        <PaneHeader roomName={roomName} status={status} totalPanes={totalPanes} visibleCount={visibleCount} />
        <Box flexDirection="row" flexGrow={1} height={gridHeight}>
          <PaneCell pane={visiblePanes[0]!} height={gridHeight} width="50%" />
          <Box flexDirection="column" flexGrow={1}>
            <PaneCell pane={visiblePanes[1]!} height={rightTopHeight} />
            <Box flexDirection="row" height={gridHeight - rightTopHeight}>
              <PaneCell pane={visiblePanes[2]!} height={gridHeight - rightTopHeight} />
              <PaneCell pane={visiblePanes[3]!} height={gridHeight - rightTopHeight} />
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }

  // 5 panes: left 30% + right 2x2 grid
  const halfHeight = Math.floor(gridHeight / 2)
  return (
    <Box flexDirection="column" flexGrow={1} height={height}>
      <PaneHeader roomName={roomName} status={status} totalPanes={totalPanes} visibleCount={visibleCount} />
      <Box flexDirection="row" flexGrow={1} height={gridHeight}>
        <PaneCell pane={visiblePanes[0]!} height={gridHeight} width="30%" />
        <Box flexDirection="column" flexGrow={1}>
          <Box flexDirection="row" height={halfHeight}>
            <PaneCell pane={visiblePanes[1]!} height={halfHeight} />
            <PaneCell pane={visiblePanes[2]!} height={halfHeight} />
          </Box>
          <Box flexDirection="row" height={gridHeight - halfHeight}>
            <PaneCell pane={visiblePanes[3]!} height={gridHeight - halfHeight} />
            <PaneCell pane={visiblePanes[4]!} height={gridHeight - halfHeight} />
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
