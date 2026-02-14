import { STORAGE_KEYS } from './constants'

const adjectives = ['curious', 'bold', 'swift', 'quiet', 'bright', 'keen', 'calm', 'wild', 'lazy', 'witty', 'brave', 'sly', 'warm', 'cool', 'zen']
const animals = ['panda', 'fox', 'otter', 'hawk', 'wolf', 'owl', 'lynx', 'bear', 'deer', 'raven', 'hare', 'seal', 'wren', 'crane', 'moth']

export function generateHandle(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const animal = animals[Math.floor(Math.random() * animals.length)]
  const num = Math.floor(Math.random() * 100)
  return `${adj}-${animal}-${num}`
}

export function getOrCreateHandle(): string {
  if (typeof localStorage === 'undefined') return generateHandle()
  let handle = localStorage.getItem(STORAGE_KEYS.handle)
  if (!handle) {
    handle = generateHandle()
    localStorage.setItem(STORAGE_KEYS.handle, handle)
  }
  return handle
}
