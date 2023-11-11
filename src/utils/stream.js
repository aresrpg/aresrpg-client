// @ts-ignore
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

// @ts-ignore
export class ObjectArrayStream extends ReadableStream {
  constructor(dataArray) {
    super({
      start(controller) {
        setTimeout(() => {
          for (const item of dataArray) controller.enqueue(item)
          controller.close() // Close the stream after enqueuing all objects
        }, 1000)
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
        return reader.read().then(result => {
          if (result.done) {
            // If the stream is done, return an object with done: true
            return { value: undefined, done: true }
          } else {
            // Otherwise, return the value and done: false
            return { value: result.value, done: false }
          }
        })
      },
      return() {
        reader.releaseLock()
        return Promise.resolve({ done: true })
      },
      throw(error) {
        reader.releaseLock()
        throw error
      },
      [Symbol.asyncIterator]() {
        return this
      },
    }
  }
}
