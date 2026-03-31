import { Result } from 'better-result'
import { ParseError, ValidationError } from '../entities/errors'
import { QuestionRequestInputSchema } from '../entities/hooks'
import { AnswersRecordSchema } from '../entities/review'
import type { IHookTransport } from '../adapters/IHookTransport'
import type {
  TimeoutError,
  ReviewCreateError,
  ReviewPollError,
  RoomResolveError,
} from '../entities/errors'
import type { QuestionRequestInput, QuestionItem } from '../entities/hooks'
import type { HookOutput, QuestionReviewAnswer } from '../entities/review'
import type { IQuestionReviewRepository } from '../repositories/IQuestionReviewRepository'
import type { IRoomResolver } from '../services/IRoomResolver'

export type ProcessQuestionReviewError =
  | ParseError
  | ValidationError
  | RoomResolveError
  | ReviewCreateError
  | ReviewPollError
  | TimeoutError

export default class ProcessQuestionReview {
  constructor(
    private readonly questionReviewRepository: IQuestionReviewRepository,
    private readonly hookTransport: IHookTransport,
    private readonly roomResolver: IRoomResolver
  ) {}

  async execute(rawInput: string): Promise<Result<HookOutput | null, ProcessQuestionReviewError>> {
    // 1. Parse & validate
    const parsed = this.parseQuestionInput(rawInput)
    if (parsed.isErr()) return parsed

    const input = parsed.value

    // 2. Resolve room
    const roomResult = await this.roomResolver.findRoomForSession(
      input.session_id,
      input.transcript_path
    )
    if (roomResult.isErr()) return roomResult

    const roomId = roomResult.value

    // 3. Format & create review
    const formattedContent = this.formatQuestionContent(input.tool_input.questions)
    const reviewResult = await this.questionReviewRepository.createQuestionReview(
      roomId,
      input.tool_input.questions,
      formattedContent
    )
    if (reviewResult.isErr()) return reviewResult

    const review = reviewResult.value

    // 4. Poll for answer
    const answerResult = await this.questionReviewRepository.getQuestionReviewStatus(
      roomId,
      review.id
    )
    if (answerResult.isErr()) {
      // Only run cleanup on actual timeout — not on 404s or other poll failures
      if (answerResult.error._tag === 'TimeoutError') {
        void (await this.questionReviewRepository.expireQuestionReview(roomId, review.id))
        void (await this.hookTransport.sendTimeoutMessage(
          roomId,
          '_Question timed out — answer in terminal instead._',
          '#f59e0b'
        ))
      }
      return answerResult
    }

    // 5. Resolve output
    return this.resolveAnswerOutput(answerResult.value, input.tool_input.questions)
  }

  private parseQuestionInput(
    raw: string
  ): Result<QuestionRequestInput, ParseError | ValidationError> {
    const parsed = Result.try({
      try: () => JSON.parse(raw),
      catch: () => new ParseError({ message: 'Invalid JSON' }),
    })
    if (parsed.isErr()) return parsed

    const result = QuestionRequestInputSchema.safeParse(parsed.value)
    if (!result.success) {
      const issue = result.error.issues[0]
      const field = String(issue.path[0] ?? 'input')
      const message = issue.code === 'too_small' ? `${field} is required` : issue.message
      return Result.err(new ValidationError({ field, message }))
    }

    return Result.ok(result.data)
  }

  private formatQuestionContent(questions: QuestionItem[]): string {
    return questions
      .map(question => {
        const lines = [`**${question.question}**`]

        for (let index = 0; index < question.options.length; index += 1) {
          const option = question.options[index]
          let line = `${index + 1}. **${option.label}**`
          if (option.description) line += ` — ${option.description}`
          lines.push(line)
        }

        if (question.multiSelect) {
          lines.push('', '_Multiple choices allowed._')
        }

        return lines.join('\n')
      })
      .join('\n\n')
  }

  private resolveAnswerOutput(
    answer: QuestionReviewAnswer,
    questions: QuestionItem[]
  ): Result<HookOutput | null, ParseError> {
    if (answer.status === 'expired') {
      return Result.ok(null)
    }

    // status === 'answered'
    if (!answer.answers_json) {
      return Result.err(new ParseError({ message: 'answers_json is null' }))
    }

    const jsonParsed = Result.try({
      try: () => JSON.parse(answer.answers_json!),
      catch: () => new ParseError({ message: 'Invalid answers_json' }),
    })
    if (jsonParsed.isErr()) return jsonParsed

    const validated = AnswersRecordSchema.safeParse(jsonParsed.value)
    if (!validated.success) {
      return Result.err(new ParseError({ message: 'answers_json does not match expected schema' }))
    }

    return Result.ok({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: {
          behavior: 'allow',
          updatedInput: { questions, answers: validated.data },
        },
      },
    })
  }
}
