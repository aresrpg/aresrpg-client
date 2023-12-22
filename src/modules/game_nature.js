import { setInterval } from 'timers/promises'

import {
  AmbientLight,
  CameraHelper,
  Color,
  DirectionalLight,
  DirectionalLightHelper,
  MathUtils,
  PMREMGenerator,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  TextureLoader,
  Vector3,
} from 'three'
import { Water } from 'three/examples/jsm/objects/Water.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { aiter } from 'iterator-helper'
import { CHUNK_SIZE, to_chunk_position } from '@aresrpg/aresrpg-protocol'

import water_normal from '../assets/waternormals.jpg'
import { abortable } from '../utils/iterator'

const Colors = {
  sunrise: new Color(0xffa500),
  noon: new Color(0xffffff),
  sunset: new Color(0xff4500),
  night: new Color(0x0000ff),
}

export const DAY_DURATION = 600000 // 10 minutes in milliseconds
const CAMERA_SHADOW_FAR = 500
const CAMERA_SHADOW_NEAR = 0.1
const CAMERA_SHADOW_SIZE = 100

/** @type {Type.Module} */
export default function () {
  const water_geometry = new PlaneGeometry(10000, 10000)
  const water = new Water(water_geometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new TextureLoader().load(water_normal, function (texture) {
      texture.wrapS = texture.wrapT = RepeatWrapping
    }),
    sunDirection: new Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x001e0f,
    distortionScale: 3.7,
    fog: true,
  })

  return {
    name: 'game_nature',
    tick() {
      if (water) water.material.uniforms.time.value += 1.0 / 60.0
    },
    observe({ scene, renderer, signal, camera, get_state, events }) {
      // lights
      const ambiant_light = new AmbientLight(0xffffff, 1)

      const sunlight = new DirectionalLight(0xffffff, 1)
      const moonlight = new DirectionalLight(0x6666ff, 0) // Initially off
      const sunlight_helper = new DirectionalLightHelper(sunlight, 10)
      const suncamera_helper = new CameraHelper(sunlight.shadow.camera)

      const moonlight_helper = new DirectionalLightHelper(moonlight, 10)
      const mooncamera_helper = new CameraHelper(moonlight.shadow.camera)

      sunlight.castShadow = true
      sunlight.shadow.mapSize.width = 4096 // Adjust as needed for performance/quality
      sunlight.shadow.mapSize.height = 4096

      sunlight.shadow.camera.near = CAMERA_SHADOW_NEAR
      sunlight.shadow.camera.far = CAMERA_SHADOW_FAR
      sunlight.shadow.camera.left = -CAMERA_SHADOW_SIZE
      sunlight.shadow.camera.right = CAMERA_SHADOW_SIZE
      sunlight.shadow.camera.top = CAMERA_SHADOW_SIZE
      sunlight.shadow.camera.bottom = -CAMERA_SHADOW_SIZE
      sunlight.shadow.bias = -0.001 // This value may need tweaking

      sunlight.shadow.camera.updateProjectionMatrix()
      suncamera_helper.update()

      moonlight.castShadow = true
      moonlight.shadow.mapSize.width = 2048 // Adjust as needed for performance/quality
      moonlight.shadow.mapSize.height = 2048

      moonlight.shadow.camera.near = CAMERA_SHADOW_NEAR
      moonlight.shadow.camera.far = CAMERA_SHADOW_FAR
      moonlight.shadow.camera.left = -CAMERA_SHADOW_SIZE
      moonlight.shadow.camera.right = CAMERA_SHADOW_SIZE
      moonlight.shadow.camera.top = CAMERA_SHADOW_SIZE
      moonlight.shadow.camera.bottom = -CAMERA_SHADOW_SIZE
      moonlight.shadow.bias = -0.001 // This value may need tweaking

      moonlight.shadow.camera.updateProjectionMatrix()
      mooncamera_helper.update()

      scene.add(ambiant_light)
      scene.add(sunlight)
      scene.add(sunlight.target)
      scene.add(sunlight_helper)
      scene.add(suncamera_helper)

      scene.add(moonlight)
      scene.add(moonlight.target)
      scene.add(moonlight_helper)
      scene.add(mooncamera_helper)

      // water
      water.position.y = 15.5
      water.rotation.x = -Math.PI / 2

      scene.add(water)

      // sky
      const sky = new Sky()

      sky.scale.setScalar(10000)

      const { uniforms } = sky.material

      uniforms.turbidity.value = 10
      uniforms.rayleigh.value = 2
      uniforms.mieCoefficient.value = 0.005
      uniforms.mieDirectionalG.value = 0.8

      scene.add(sky)

      // sun
      const sun = new Vector3()
      const pmrem_generator = new PMREMGenerator(renderer)

      let render_target = null
      let sky_elevation = 0
      let sky_azimuth = 0
      let day_time = DAY_DURATION * 0.7 // Track the time of day as a value between 0 and DAY_DURATION
      const day_time_step = 100 // How much to increment day_time each frame

      events.on('SET_TIME', time => {
        day_time = time
      })

      function get_player_chunk_position() {
        try {
          const player = get_state()?.player
          if (!player) return new Vector3()
          return to_chunk_position(player.position)
        } catch (error) {
          console.error(error)
          return new Vector3()
        }
      }

      aiter(abortable(setInterval(day_time_step, null, { signal }))).forEach(
        () => {
          // Update day_time and calculate day_ratio
          day_time = (day_time + day_time_step) % DAY_DURATION
          const day_ratio = day_time / DAY_DURATION

          const chunk_position = get_player_chunk_position()

          const light_base_position = new Vector3(
            chunk_position.x * CHUNK_SIZE,
            300,
            chunk_position.z * CHUNK_SIZE,
          )
          const light_target_position = light_base_position.clone().setY(0)

          // Calculate sun's position
          const angle = day_ratio * Math.PI * 2
          sky_elevation = 90 - (Math.sin(angle) * 0.5 + 0.5) * 180
          sky_azimuth = ((day_ratio * 360) % 360) - 180

          const is_night = sky_elevation <= 0

          const phi = MathUtils.degToRad(90 - sky_elevation)
          const theta = MathUtils.degToRad(sky_azimuth)
          sun.setFromSphericalCoords(1, phi, theta)

          // Update sky and water materials
          sky.material.uniforms.sunPosition.value.copy(sun)
          water.material.uniforms.sunDirection.value.copy(sun).normalize()

          // Calculate the sun and moon position relative to the base position
          const sun_position_offset = sun.clone().multiplyScalar(200)
          const moon_position_offset = sun.clone().negate().multiplyScalar(200)

          sunlight.position.copy(light_base_position).add(sun_position_offset)
          sunlight.target.position.copy(light_target_position)

          moonlight.position.copy(light_base_position).add(moon_position_offset)
          moonlight.target.position.copy(light_target_position)

          const normalized_phi = phi / Math.PI
          const intensity =
            Math.min(0.2, Math.cos(normalized_phi * Math.PI) * 0.4) + 0.5

          sunlight.intensity = Math.max(0, intensity)
          ambiant_light.intensity = Math.max(0.5, intensity)
          moonlight.intensity = is_night ? 0.5 : 0 // Adjust intensity based on night/day

          if (!is_night) {
            const color = Colors.sunrise.lerp(Colors.noon, sky_elevation / 90)
            sunlight.color = color
            scene.fog.color = color
          } else {
            const color = Colors.sunset.lerp(Colors.night, -sky_elevation / 90)
            sunlight.color = color
            scene.fog.color = color
          }

          // Update environment map
          if (render_target) render_target.dispose()

          const scene_env = new Scene()
          scene_env.add(sky)
          render_target = pmrem_generator.fromScene(scene_env)
          scene.environment = render_target.texture

          events.emit('TIME_CHANGE', day_time)
        },
      )
    },
  }
}
