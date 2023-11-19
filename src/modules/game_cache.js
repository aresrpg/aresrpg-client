import { Cache } from 'three'

export default function () {
  // Enable THREE Cache
  Cache.enabled = true

  // Override THREE Cache methods to use localForage
  // Cache.useCache({
  //   add: (key, value, callback) => {
  //     localforage.setItem(key, value).then(callback)
  //   },
  //   get: (key, callback) => {
  //     localforage.getItem(key).then(value => {
  //       callback(value == null ? undefined : value)
  //     })
  //   },
  //   remove: (key, callback) => {
  //     localforage.removeItem(key).then(callback)
  //   },
  //   clear: () => {
  //     localforage.clear()
  //   },
  // })

  return {
    name: 'game_cache',
  }
}
