import EventEmitter from 'eventemitter3'

function create_queue() {
  const events = []
  return {
    push(event) {
      events.push(event)
    },
    shift() {
      return events.shift()
    },
    get is_empty() {
      return events.length === 0
    },
    iterate(callback) {
      while (events.length > 0) {
        const event = events.shift()
        callback(event)
      }
    },
  }
}

function isEventTarget(emitter) {
  return emitter && !!emitter.addEventListener
}

function on(emitter, event_name, options = {}) {
  const { signal } = options
  if (signal?.aborted)
    throw new DOMException('The operation was aborted.', 'AbortError')

  const unconsumed_events = create_queue()
  const unconsumed_promises = create_queue()
  let finished = false
  let error = null

  const event_handler = event => {
    if (unconsumed_promises.is_empty) {
      unconsumed_events.push(event)
    } else {
      const { resolve } = unconsumed_promises.shift()
      resolve({ value: event, done: false })
    }
  }

  if (isEventTarget(emitter))
    emitter.addEventListener(event_name, event_handler)
  else emitter.on(event_name, event_handler)

  const remove_event_listener = () => {
    if (isEventTarget(emitter))
      emitter.removeEventListener(event_name, event_handler)
    else emitter.off(event_name, event_handler)
  }

  const iterator = {
    next() {
      if (error) {
        return Promise.reject(error)
      }

      if (!unconsumed_events.is_empty) {
        const event = unconsumed_events.shift()
        return Promise.resolve({ value: event, done: false })
      }

      if (finished) {
        return Promise.resolve({ value: undefined, done: true })
      }

      return new Promise((resolve, reject) => {
        unconsumed_promises.push({ resolve, reject })
      })
    },

    return() {
      finished = true
      remove_event_listener()
      unconsumed_promises.iterate(({ resolve }) => {
        resolve({ value: undefined, done: true })
      })
      return Promise.resolve({ value: undefined, done: true })
    },

    throw(err) {
      finished = true
      remove_event_listener()
      throw err
    },

    [Symbol.asyncIterator]() {
      return this
    },
  }

  if (signal) {
    const on_abort = () => {
      error = new DOMException('The operation was aborted.', 'AbortError')
      iterator.return()
    }
    signal.addEventListener('abort', on_abort, { once: true })

    // Override the return method to ensure abort listener is removed on iterator cleanup
    const originalReturn = iterator.return
    iterator.return = () => {
      signal.removeEventListener('abort', on_abort)
      remove_event_listener()
      return originalReturn.call(iterator)
    }
  }

  // Close events
  if (options.close) {
    options.close.forEach(close_event => {
      if (isEventTarget(emitter))
        emitter.addEventListener(close_event, () => iterator.return())
      else emitter.on(close_event, () => iterator.return())
    })
  }

  return iterator
}

const once = (emitter, event_name, options = {}) =>
  new Promise((resolve, reject) => {
    const on_abort = () => {
      emitter.off(event_name, resolve)
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    }

    if (options.signal) {
      if (options.signal.aborted) {
        on_abort()
      } else {
        options.signal.addEventListener('abort', on_abort, { once: true })
      }
    }

    emitter.once(event_name, event => {
      if (options.signal) {
        options.signal.removeEventListener('abort', on_abort)
      }
      resolve(event)
    })
  })

export { EventEmitter, on, once }
