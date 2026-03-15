import { useMutation, useQueryClient } from '@tanstack/react-query'
import { claimToken, shareAuth, generateKey } from '../lib/fetchers'
import { setApiKey } from '../lib/api'
import { resetApiClient } from '../lib/api-client'

export function useClaimToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => claimToken(token),
    onSuccess: (data) => {
      setApiKey(data.api_key)
      resetApiClient()
      queryClient.clear()
    },
  })
}

export function useShareAuth() {
  return useMutation({
    mutationFn: () => shareAuth(),
  })
}

export function useGenerateKey() {
  return useMutation({
    mutationFn: () => generateKey(),
    onSuccess: (data) => {
      setApiKey(data.key)
      resetApiClient()
    },
  })
}
