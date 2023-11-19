import { on } from 'events'

import merge from 'fast-merge-async-iterators'

export function combine(...iterables) {
  // @ts-ignore weird
  return merge('iters-close-wait', ...iterables)
}

export async function* named_on(events, event, options) {
  for await (const payload of on(events, event, options))
    yield { event, payload }
}

/**
 * @template T
 * @param {AsyncIterableIterator<T> | AsyncIterable<T>} iterator
 * @returns {AsyncIterator<T>}
 */
export async function* abortable(iterator) {
  try {
    yield* iterator
  } catch (error) {
    if (!(error instanceof Error && error.name === 'AbortError')) throw error
  }
}
