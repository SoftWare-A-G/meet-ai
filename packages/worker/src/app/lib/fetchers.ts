import { getApiClient } from './api-client'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function fetchRooms() {
  const res = await getApiClient().api.rooms.$get()
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}

export async function fetchProjects() {
  const res = await getApiClient().api.projects.$get()
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return res.json()
}
