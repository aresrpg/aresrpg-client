export default class ChunkMap extends Map {
  constructor({ capacity, on_eviction = (key, data) => {} }) {
    super()
    this.capacity = capacity
    this.on_eviction = on_eviction
    this.usage_queue = new Set()
  }

  #mark_as_recently_used(key) {
    if (this.usage_queue.has(key)) this.usage_queue.delete(key)
    this.usage_queue.add(key)
  }

  #evict_if_needed() {
    if (this.size > this.capacity) {
      const key_to_evict = this.usage_queue.values().next().value
      this.on_eviction(key_to_evict, super.get(key_to_evict))
      this.delete(key_to_evict)
    }
  }

  set(key, value) {
    super.set(key, value)
    this.#mark_as_recently_used(key)
    this.#evict_if_needed()
    return this
  }

  get(key) {
    if (super.has(key)) {
      this.#mark_as_recently_used(key)
      return super.get(key)
    }
    return undefined
  }

  has(key) {
    const result = super.has(key)
    if (result) {
      this.#mark_as_recently_used(key)
    }
    return result
  }

  delete(key) {
    if (super.delete(key)) {
      this.usage_queue.delete(key)
      return true
    }
    return false
  }

  clear() {
    super.clear()
    this.usage_queue.clear()
  }
}
