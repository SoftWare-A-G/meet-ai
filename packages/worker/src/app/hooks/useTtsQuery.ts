import { useQuery, useMutation } from '@tanstack/react-query'
import { fetchTtsStatus, textToSpeech } from '../lib/fetchers'
import { queryKeys } from '../lib/query-keys'

export function useTtsStatus() {
  return useQuery({
    queryKey: queryKeys.tts.status,
    queryFn: fetchTtsStatus,
    staleTime: Infinity,
  })
}

export function useTextToSpeech() {
  return useMutation({
    mutationFn: textToSpeech,
  })
}
