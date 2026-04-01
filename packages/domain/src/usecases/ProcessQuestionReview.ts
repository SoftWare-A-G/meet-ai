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
    return Result.gen(async function* (this: ProcessQuestionReview) {
      const input = yield* this.parseQuestionInput(rawInput)
      const roomId = yield* Result.await(
        this.roomResolver.findRoomForSession(input.session_id, input.transcript_path)
      )
      const formattedContent = this.formatQuestionContent(input.tool_input.questions)
      const review = yield* Result.await(
        this.questionReviewRepository.createQuestionReview(
          roomId,
          input.tool_input.questions,
          formattedContent
        )
      )

      const answer = yield* Result.await(
        (async () => {
          const result = await this.questionReviewRepository.getQuestionReviewStatus(
            roomId,
            review.id
          )
          if (result.isErr() && result.error._tag === 'TimeoutError') {
            await this.questionReviewRepository.expireQuestionReview(roomId, review.id)
            await this.hookTransport.sendTimeoutMessage(
              roomId,
              '_Question timed out — answer in terminal instead._',
              '#f59e0b'
            )
          }
          return result
        })()
      )

      return this.resolveAnswerOutput(answer, input.tool_input.questions)
    }, this)
  }

  private parseQuestionInput(
    raw: string
  ): Result<QuestionRequestInput, ParseError | ValidationError> {
    return Result.gen(function* () {
      const parsed = yield* Result.try({
        try: () => JSON.parse(raw),
        catch: () => new ParseError({ message: 'Invalid JSON' }),
      })

      const result = QuestionRequestInputSchema.safeParse(parsed)
      if (!result.success) {
        const issue = result.error.issues[0]
        const field = String(issue.path[0] ?? 'input')
        const message = issue.code === 'too_small' ? `${field} is required` : issue.message
        return yield* Result.err(new ValidationError({ field, message }))
      }

      return Result.ok(result.data)
    })
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
