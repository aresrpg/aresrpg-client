export default function throttle(func, wait) {
  let is_throttling = false
  let last_args
  let last_context

  const invoke = () => {
    func.apply(last_context, last_args)
    is_throttling = false
  }

  return function (...args) {
    if (!is_throttling) {
      invoke()
      is_throttling = true
      setTimeout(invoke, wait)
    } else {
      last_args = args
      last_context = this
    }
  }
}
