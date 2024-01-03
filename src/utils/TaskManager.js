export default class TaskManager {
  #tasks

  constructor() {
    this.#tasks = []
  }

  add(task) {
    this.#tasks.push(task)
  }

  tick(time_left) {
    const start = performance.now()
    const adjusted_time_left = time_left * 0.5

    while (this.#tasks.length && performance.now() - start < adjusted_time_left)
      this.#tasks.shift()()
  }
}
