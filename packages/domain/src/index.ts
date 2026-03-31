// Entities — errors
export {
  ParseError,
  ValidationError,
  TimeoutError,
  NotifyError,
  ReviewCreateError,
  ReviewPollError,
  RoomResolveError,
} from './entities/errors'

// Entities — schemas + types
export {
  ReviewStatusSchema,
  PermissionReviewDecisionSchema,
  HookOutputSchema,
  CreateReviewResultSchema,
  QuestionReviewStatusSchema,
  QuestionReviewAnswerSchema,
  AnswersRecordSchema,
  AllowedPromptSchema,
  PermissionModeSchema,
  PlanReviewDecisionSchema,
} from './entities/review'
export type {
  ReviewStatus,
  PermissionReviewDecision,
  HookOutput,
  CreateReviewResult,
  QuestionReviewStatus,
  QuestionReviewAnswer,
  AnswersRecord,
  AllowedPrompt,
  PermissionMode,
  PlanReviewDecision,
} from './entities/review'

export {
  PermissionRequestInputSchema,
  QuestionOptionSchema,
  QuestionItemSchema,
  QuestionRequestInputSchema,
  PlanRequestInputSchema,
} from './entities/hooks'
export type {
  PermissionRequestInput,
  QuestionOption,
  QuestionItem,
  QuestionRequestInput,
  PlanRequestInput,
} from './entities/hooks'

// Interfaces
export type { IReviewRepository } from './repositories/IReviewRepository'
export type { IQuestionReviewRepository } from './repositories/IQuestionReviewRepository'
export type { IPlanReviewRepository } from './repositories/IPlanReviewRepository'
export type { IHookTransport } from './adapters/IHookTransport'
export type { IRoomResolver } from './services/IRoomResolver'

// Usecases
export { default as ProcessPermissionReview } from './usecases/ProcessPermissionReview'
export type { ProcessPermissionReviewError } from './usecases/ProcessPermissionReview'

export { default as ProcessQuestionReview } from './usecases/ProcessQuestionReview'
export type { ProcessQuestionReviewError } from './usecases/ProcessQuestionReview'

export { default as ProcessPlanReview } from './usecases/ProcessPlanReview'
export type { ProcessPlanReviewError } from './usecases/ProcessPlanReview'
