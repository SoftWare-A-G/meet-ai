import { useQuery, useMutation } from '@tanstack/react-query'
import { textToSpeech } from '../lib/fetchers'
import { ttsStatusQueryOptions } from '../lib/query-options'

export function useTtsStatus() {
  return useQuery(ttsStatusQueryOptions)
}

export function useTextToSpeech() {
  return useMutation({
    mutationFn: textToSpeech,
  })
}
