import { createNoise2D } from 'simplex-noise'
import alea from 'alea'

export function create_fractionnal_brownian(biome) {
  const {
    seed,
    scale,
    height,
    octaves,
    persistence,
    lacunarity,
    exponentiation,
  } = biome

  const memoized = new Map()
  const noise_pass_1 = createNoise2D(alea(`${seed}_1`))
  const noise_pass_2 = createNoise2D(alea(`${seed}_2`))
  const noise_pass_3 = createNoise2D(alea(`${seed}_3`))

  return (x, y) => {
    const key = `${x}:${y}`

    if (memoized.has(key)) return memoized.get(key)

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
    total = Math.round(total)

    memoized.set(key, total)

    return total
  }
}
