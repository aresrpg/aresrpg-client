import Biomes from './biomes'

export const BLOCKS = {
  STONE: 0x8a8a8a,
  STONE_VARIATION: 0xa3a3a3,
  GRASS: 0x41b91d,
  GRASS_VARIATION: 0x00e500,
  DRY_GRASS: 0xa3a370,
  DRY_GRASS_VARIATION: 0x66cc33,
  SAND: 0xffd699,
  SAND_VARIATION: 0xe5c266,
  SNOW: 0xffffff,
}

export const block_at_index = index => BLOCKS[Object.keys(BLOCKS)[index - 1]]
export const block_index = block => Object.values(BLOCKS).indexOf(block) + 1

export function get_voxel_data({ x, y, z, heightfield }) {
  const { painting } = Biomes.DEFAULT

  // Calculate noise values for snow, stone, sand, and grass
  const snow_noise = heightfield(
    x * painting.snow_cover_scale,
    z * painting.snow_cover_scale,
  )
  const stone_noise = heightfield(
    x * painting.stone_noise_scale,
    z * painting.stone_noise_scale,
  )
  const sand_noise = heightfield(
    x * painting.sand_noise_scale,
    z * painting.sand_noise_scale,
  )
  const grass_noise = heightfield(
    x * painting.grass_noise_scale,
    z * painting.grass_noise_scale,
  )

  // Determine the base terrain height using heightfield
  const terrain_height = heightfield(x, z)

  // Calculate moisture for grass color variation
  const moisture = heightfield(
    x * painting.moisture_scale,
    z * painting.moisture_scale,
  )

  // Determine if the voxel is stone based on noise and height
  const is_stone = terrain_height > y && stone_noise > painting.stone_threshold

  // Check for snow coverage based on altitude and noise
  const is_snow_covered =
    y >= painting.min_snow_altitude &&
    snow_noise > painting.snow_cover_threshold
  const is_fully_snow_covered = y >= painting.full_snow_altitude

  // Grass and stone color variations
  const grass_color_variation =
    grass_noise > painting.grass_noise_threshold
      ? block_index(BLOCKS.GRASS)
      : block_index(BLOCKS.GRASS_VARIATION) // Additional grass color
  const dry_grass_color_variation =
    grass_noise > painting.dry_grass_noise_threshold
      ? block_index(BLOCKS.DRY_GRASS)
      : block_index(BLOCKS.DRY_GRASS_VARIATION) // Additional dry grass color
  const stone_color_variation =
    stone_noise > painting.stone_color_noise_threshold
      ? block_index(BLOCKS.STONE)
      : block_index(BLOCKS.STONE_VARIATION) // Additional stone color
  const sand_color_variation =
    sand_noise > painting.sand_color_noise_threshold
      ? block_index(BLOCKS.SAND)
      : block_index(BLOCKS.SAND_VARIATION) // Additional sand color

  // Initialize the color variable
  let block = null

  // Set the voxel color based on the terrain type
  if (is_fully_snow_covered) {
    block = block_index(BLOCKS.SNOW)
  } else if (is_stone) {
    // Stone color with variation
    block = stone_color_variation
  } else if (is_snow_covered) {
    // Blend stone and snow based on noise, with additional stone color variation
    block =
      stone_noise > painting.snow_stone_mix_threshold
        ? stone_color_variation
        : block_index(BLOCKS.SNOW)
  } else if (y < 15) {
    // Sand color with variation
    block = sand_color_variation
  } else {
    // Grass color varies based on moisture, with additional grass color variation
    block =
      moisture > painting.moisture_threshold
        ? grass_color_variation
        : dry_grass_color_variation
  }

  return { block }
}
