import { useState, useEffect, useMemo, useCallback } from 'react'
import clsx from 'clsx'
import { formatTime } from '../../lib/dates'

type ParsedOption = {
  label: string
  description?: string
}

type ParsedQuestion = {
  question: string
  options: ParsedOption[]
  multiSelect: boolean
}

type QuestionCardProps = {
  content: string
  timestamp?: string
  onSend: (answer: string) => void
  answeredWith?: string
  questionReviewId?: string
  questionReviewStatus?: 'pending' | 'answered' | 'expired'
  questionReviewAnswers?: Record<string, string>
  onQuestionAnswer?: (reviewId: string, answers: Record<string, string>) => void
}

// Answers stored as arrays to support multiSelect
type Answers = Record<number, string[]>

function parseQuestions(content: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = []
  let current: ParsedQuestion | null = null

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Question heading: **Question text**
    const questionMatch = trimmed.match(/^\*\*(.+?)\*\*$/)
    if (questionMatch) {
      if (current && current.options.length > 0) {
        questions.push(current)
      }
      current = { question: questionMatch[1], options: [], multiSelect: false }
      continue
    }

    if (!current) continue

    // Option line: 1. **Label** — Description
    const optionMatch = trimmed.match(/^\d+\.\s+\*\*(.+?)\*\*(?:\s+—\s+(.+))?$/)
    if (optionMatch) {
      current.options.push({
        label: optionMatch[1],
        description: optionMatch[2],
      })
      continue
    }

    if (trimmed.includes('Multiple choices allowed')) {
      current.multiSelect = true
    }
  }

  if (current && current.options.length > 0) {
    questions.push(current)
  }

  return questions
}

function deriveAnswers(answeredWith: string | undefined, questions: ParsedQuestion[]): Answers {
  if (!answeredWith) return {}
  const result: Answers = {}

  if (questions.length === 1) {
    const q = questions[0]
    if (q.multiSelect) {
      // Multi-select single question — answer may be comma-separated labels
      const labels = answeredWith.split(', ').map(s => s.trim())
      const matched = labels.filter(l => q.options.some(o => o.label === l))
      if (matched.length > 0) result[0] = matched
    } else {
      const option = q.options.find(o => o.label === answeredWith)
      if (option) result[0] = [option.label]
    }
    return result
  }

  // Multi-question — format: "Question text: Answer\nQuestion text: Answer"
  const lines = answeredWith.split('\n')
  for (const line of lines) {
    const colonIdx = line.lastIndexOf(': ')
    if (colonIdx === -1) continue
    const answer = line.slice(colonIdx + 2)
    for (let qi = 0; qi < questions.length; qi++) {
      if (result[qi]) continue
      const q = questions[qi]
      if (q.multiSelect) {
        const labels = answer.split(', ').map(s => s.trim())
        const matched = labels.filter(l => q.options.some(o => o.label === l))
        if (matched.length > 0) {
          result[qi] = matched
          break
        }
      } else {
        const option = q.options.find(o => o.label === answer)
        if (option) {
          result[qi] = [option.label]
          break
        }
      }
    }
  }

  return result
}

function isSelected(answers: Answers, qi: number, label: string): boolean {
  return answers[qi]?.includes(label) ?? false
}

function deriveFromReviewAnswers(reviewAnswers: Record<string, string> | undefined, questions: ParsedQuestion[]): Answers {
  if (!reviewAnswers || questions.length === 0) return {}
  const result: Answers = {}
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi]
    const answer = reviewAnswers[q.question]
    if (answer) {
      result[qi] = q.multiSelect ? answer.split(', ').map(s => s.trim()) : [answer]
    }
  }
  return result
}

export default function QuestionCard({ content, timestamp, onSend, answeredWith, questionReviewId, questionReviewStatus, questionReviewAnswers, onQuestionAnswer }: QuestionCardProps) {
  const questions = useMemo(() => parseQuestions(content), [content])
  const reviewDerived = useMemo(() => deriveFromReviewAnswers(questionReviewAnswers, questions), [questionReviewAnswers, questions])
  const textDerived = useMemo(() => deriveAnswers(answeredWith, questions), [answeredWith, questions])
  const derived = Object.keys(reviewDerived).length > 0 ? reviewDerived : textDerived
  const [answers, setAnswers] = useState<Answers>(derived)
  const isExpired = questionReviewStatus === 'expired'
  const isAnsweredViaReview = questionReviewStatus === 'answered'
  const [submitted, setSubmitted] = useState(Object.keys(derived).length > 0 || isExpired || isAnsweredViaReview)

  // Sync state when answeredWith arrives late (e.g. async message load)
  useEffect(() => {
    const keys = Object.keys(derived)
    if (keys.length > 0) {
      setAnswers(derived)
      setSubmitted(true)
    }
  }, [derived])

  const allAnswered = questions.length > 0 && Object.keys(answers).length === questions.length

  const handleSelect = useCallback((questionIndex: number, label: string, multiSelect: boolean) => {
    if (submitted) return
    setAnswers(prev => {
      const current = prev[questionIndex] ?? []
      if (multiSelect) {
        // Toggle: add if missing, remove if present
        const next = current.includes(label)
          ? current.filter(l => l !== label)
          : [...current, label]
        if (next.length === 0) {
          const copy = { ...prev }
          delete copy[questionIndex]
          return copy
        }
        return { ...prev, [questionIndex]: next }
      }
      // Single select: toggle off or replace
      if (current.length === 1 && current[0] === label) {
        const copy = { ...prev }
        delete copy[questionIndex]
        return copy
      }
      return { ...prev, [questionIndex]: [label] }
    })
  }, [submitted])

  const handleSubmit = useCallback(() => {
    if (!allAnswered || submitted) return
    setSubmitted(true)

    // If we have a question review, submit via the review API
    if (questionReviewId && onQuestionAnswer) {
      const answersMap: Record<string, string> = {}
      for (let i = 0; i < questions.length; i++) {
        answersMap[questions[i].question] = answers[i].join(', ')
      }
      onQuestionAnswer(questionReviewId, answersMap)
      return
    }

    // Fallback: send as plain text message
    const formatAnswer = (qi: number) => answers[qi].join(', ')
    const response = questions.length === 1
      ? formatAnswer(0)
      : questions.map((q, i) => `${q.question}: ${formatAnswer(i)}`).join('\n')
    onSend(response)
  }, [allAnswered, submitted, questions, answers, onSend, questionReviewId, onQuestionAnswer])

  if (questions.length === 0) return null

  return (
    <div className={clsx('rounded-md border-l-2 px-3 py-2.5 text-sm', isExpired ? 'border-[#6b7280] bg-[#6b7280]/[0.06]' : 'border-[#f59e0b] bg-[#f59e0b]/[0.06]')}>
      <div className="flex items-center gap-2 mb-2">
        <span className={clsx('font-bold text-sm', isExpired ? 'text-[#6b7280]' : 'text-[#f59e0b]')}>
          {isExpired ? 'Question expired' : 'Agent question'}
        </span>
        {timestamp && (
          <span className="text-xs text-[#8b8fa3]">{formatTime(timestamp)}</span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((q, qi) => (
          <div key={qi}>
            <p className="text-msg-text mb-2">{q.question}</p>

            <div className="flex flex-col gap-2">
              {q.options.map((opt) => {
                const selected = isSelected(answers, qi, opt.label)
                return (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={submitted}
                    onClick={() => handleSelect(qi, opt.label, q.multiSelect)}
                    className={clsx(
                      'rounded-lg border px-3 py-2.5 text-left transition-all',
                      submitted
                        ? selected
                          ? 'border-[#f59e0b] bg-[#f59e0b]/20 text-[#f59e0b] cursor-default'
                          : 'border-border text-[#8b8fa3] opacity-40 cursor-default'
                        : selected
                          ? 'border-[#f59e0b] bg-[#f59e0b]/20 text-[#f59e0b] cursor-pointer'
                          : 'border-border text-msg-text hover:border-[#f59e0b]/60 hover:bg-[#f59e0b]/[0.08] cursor-pointer',
                    )}
                  >
                    <span className="text-sm font-bold">{opt.label}</span>
                    {opt.description && (
                      <span className={clsx('block text-xs mt-0.5', selected ? 'opacity-80' : 'opacity-60')}>{opt.description}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {q.multiSelect && !answers[qi] && !submitted && (
              <p className="text-xs text-[#8b8fa3] mt-1.5">Multiple choices allowed</p>
            )}
          </div>
        ))}
      </div>

      {!submitted && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={!allAnswered}
            onClick={handleSubmit}
            className={clsx(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
              allAnswered
                ? 'bg-[#f59e0b] text-black cursor-pointer hover:brightness-110'
                : 'bg-[#f59e0b]/20 text-[#f59e0b]/40 cursor-not-allowed',
            )}
          >
            Submit
          </button>
        </div>
      )}
    </div>
  )
}
