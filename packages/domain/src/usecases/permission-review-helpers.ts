import { Result } from 'better-result'
import { PermissionRequestInputSchema } from '../entities/hooks'
import type { PermissionRequestInput } from '../entities/hooks'
import type { HookOutput, ReviewStatus } from '../entities/review'
import { ParseError, ValidationError } from '../entities/errors'

export const EXCLUDED_TOOLS = ['ExitPlanMode', 'AskUserQuestion']

export function parsePermissionInput(
  raw: string,
): Result<PermissionRequestInput, ParseError | ValidationError> {
  const parsed = Result.try({
    try: () => JSON.parse(raw),
    catch: () => new ParseError({ message: 'Invalid JSON' }),
  })
  if (parsed.isErr()) return parsed

  const result = PermissionRequestInputSchema.safeParse(parsed.value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const field = String(issue.path[0] ?? 'input')
    const message = issue.code === 'too_small' ? `${field} is required` : issue.message
    return Result.err(new ValidationError({ field, message }))
  }

  return Result.ok(result.data)
}

export function isExcludedTool(toolName: string): boolean {
  return EXCLUDED_TOOLS.includes(toolName)
}

export function formatPermissionRequest(
  toolName: string,
  toolInput?: Record<string, unknown>,
): string {
  let text = `**Permission request: ${toolName}**\n`

  if (toolInput) {
    const entries = Object.entries(toolInput)
    if (entries.length > 0) {
      for (const [key, value] of entries) {
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value)
        const truncated = valueStr.length > 200 ? `${valueStr.slice(0, 200)}...` : valueStr
        text += `\n**${key}:** \`${truncated}\``
      }
    }
  }

  return text
}

export function buildAllowOutput(): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'allow' },
    },
  }
}

export function buildDenyOutput(message: string): HookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: { behavior: 'deny', message },
    },
  }
}

export function resolveDecisionOutput(
  status: ReviewStatus,
  feedback?: string | null,
): Result<HookOutput | null, never> {
  if (status === 'approved') return Result.ok(buildAllowOutput())
  if (status === 'denied') return Result.ok(buildDenyOutput(feedback || 'Permission denied by user.'))
  return Result.ok(null)
}
