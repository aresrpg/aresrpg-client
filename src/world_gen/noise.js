import { createNoise2D } from 'simplex-noise'
import alea from 'alea'
import ndarray from 'ndarray'
import { MAP_BOUNDS } from '@aresrpg/aresrpg-protocol'

const OFFSET = MAP_BOUNDS / 2 // Adjust based on your expected coordinate range
const NOISE_CACHE_SIZE = MAP_BOUNDS // Assuming this covers the range of expected values

export const HEIGHTS = new SharedArrayBuffer(
  NOISE_CACHE_SIZE * NOISE_CACHE_SIZE * Int16Array.BYTES_PER_ELEMENT,
)

export function create_shared_fractionnal_brownian(buffer) {
  const cache = ndarray(new Int16Array(buffer), [
    NOISE_CACHE_SIZE,
    NOISE_CACHE_SIZE,
  ])

  return (x, y) => {
    x = Math.floor(x) + OFFSET
    y = Math.floor(y) + OFFSET

    if (x < 0 || x >= NOISE_CACHE_SIZE || y < 0 || y >= NOISE_CACHE_SIZE)
      return 0

    return cache.get(x, y) ?? 0
  }
}

function create_fractionnal_brownian(seed, biome) {
  const { scale, height, octaves, persistence, lacunarity, exponentiation } =
    biome

  const noise_cache = ndarray(new Int16Array(HEIGHTS), [
    NOISE_CACHE_SIZE,
    NOISE_CACHE_SIZE,
  ])

  const noise_pass_1 = createNoise2D(alea(`${seed}_1`))
  const noise_pass_2 = createNoise2D(alea(`${seed}_2`))
  const noise_pass_3 = createNoise2D(alea(`${seed}_3`))

  return (x, y) => {
    x = Math.floor(x) + OFFSET
    y = Math.floor(y) + OFFSET

    if (x < 0 || x >= NOISE_CACHE_SIZE || y < 0 || y >= NOISE_CACHE_SIZE)
      return 0

    const existing = noise_cache.get(x, y)
    if (existing) return existing

    const xs = x / scale
    const ys = y / scale
    let total = 0
    let amplitude = 1.0
    let frequency = 1.0
    let max_amplitude = 0

    for (let o = 0; o < octaves; o++) {
      const noise_value =
        noise_pass_1(xs * frequency, ys * frequency) * 0.5 +
        0.5 +
        (noise_pass_2(xs * frequency, ys * frequency) * 0.5 + 0.5) *
          (noise_pass_3(xs * frequency, ys * frequency) * 0.5 + 0.5)
      total += noise_value * amplitude

      max_amplitude += amplitude
      amplitude *= persistence
      frequency *= lacunarity
    }

    total /= max_amplitude
    total = Math.pow(total, exponentiation)
    total *= height
    total = Math.floor(total)

    noise_cache.set(x, y, total)
    // console.log('cache miss', x, y, total)

    return total
  }
}

// only used locally @see utils/export_heights
export async function fill_heights(seed, biome) {
  console.log('loading heights')

  const brownian = create_fractionnal_brownian(seed, biome)

  const time = Date.now()

  for (let x = -OFFSET; x < OFFSET; x++) {
    console.log('loading heights', x, Date.now() - time)
    for (let y = -OFFSET; y < OFFSET; y++) {
      brownian(x, y)
    }
  }

  console.log('done loading heights', Date.now() - time)
}
