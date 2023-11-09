export class PassThrough extends TransformStream {
  constructor(options = {}) {
    const { signal } = options

    // Pass the options including the signal to both readable and writable sides
    super(
      {
        // Pass the signal to the transform function as well
        transform(chunk, controller) {
          controller.enqueue(chunk)
        },
      },
      { signal },
      { signal },
    )

    this.signal = signal
  }

  [Symbol.asyncIterator]() {
    const reader = this.readable.getReader()

    // Return a new async iterator which respects the abort signal
    return {
      next: () => {
        if (this.signal && this.signal.aborted) {
          return Promise.reject(
            new DOMException('This stream has been aborted', 'AbortError'),
          )
        }
        return reader.read()
      },
      return: () => {
        reader.releaseLock()
        return Promise.resolve({ done: true })
      },
      [Symbol.asyncIterator]() {
        return this
      },
    }
  }
}

export class WebSocketStream extends ReadableStream {
  constructor(url) {
    let socket
    super({
      start(controller) {
        socket = new WebSocket(url)

        socket.onmessage = event => {
          try {
            const json = JSON.parse(event.data) // Parse the JSON string
            controller.enqueue(json) // Enqueue the parsed object for processing
          } catch (error) {
            console.error('Error parsing JSON:', error)
            controller.error(error) // Handle JSON parsing errors
          }
        }

        socket.onclose = () => controller.close()
        socket.onerror = error => {
          console.error('WebSocket error:', error)
          controller.error(error) // Handle WebSocket errors
        }
      },
      cancel() {
        socket.close()
      },
    })
  }

  [Symbol.asyncIterator]() {
    const reader = this.getReader()
    return {
      next() {
        return reader.read()
      },
      return() {
        reader.releaseLock()
        return Promise.resolve({ done: true })
      },
      throw(error) {
        reader.releaseLock()
        return Promise.reject(error)
      },
      [Symbol.asyncIterator]() {
        return this
      },
    }
  }
}

export class ObjectArrayStream extends ReadableStream {
  constructor(dataArray) {
    super({
      start(controller) {
        for (const item of dataArray) {
          controller.enqueue(item)
        }
        controller.close() // Close the stream after enqueuing all objects
      },
      cancel() {
        // Handle any cleanup if necessary
      },
    })
  }

  [Symbol.asyncIterator]() {
    const reader = this.getReader()
    return {
      next() {
        return reader.read()
      },
      return() {
        reader.releaseLock()
        return Promise.resolve({ done: true })
      },
      throw(error) {
        reader.releaseLock()
        return Promise.reject(error)
      },
      [Symbol.asyncIterator]() {
        return this
      },
    }
  }
}
