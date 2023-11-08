import { DirectionalLight, AmbientLight } from 'three'

import { Packets, pop_actions } from '../actions.js'

/** @type {import("../game.js").Module} */
export default function () {
  function create_light(type, settings) {
    switch (type) {
      case 'directional': {
        const light = new DirectionalLight(settings.color, settings.intensity)
        light.position.set(
          settings.position.x,
          settings.position.y,
          settings.position.z,
        )
        light.castShadow = settings.shadow
        light.shadow.camera.top = settings.shadow_camera.top
        light.shadow.camera.bottom = settings.shadow_camera.bottom
        light.shadow.camera.left = settings.shadow_camera.left
        light.shadow.camera.right = settings.shadow_camera.right
        light.shadow.camera.near = settings.shadow_camera.near
        light.shadow.camera.far = settings.shadow_camera.far
        light.shadow.mapSize.width = settings.shadow_camera.map_size.width
        light.shadow.mapSize.height = settings.shadow_camera.map_size.height
        return light
      }
      case 'ambient':
        return new AmbientLight(settings.color, settings.intensity)
    }
  }

  return state => {
    const { pending_server_actions, lights, scene } = state

    const [add_light_actions, remaining_actions] = pop_actions(
      [Packets.ADD_LIGHT],
      pending_server_actions,
    )

    add_light_actions.forEach(({ type, ...payload }) => {
      const light = create_light(type, payload)
      lights.add(light)
      scene.add(light)
    })

    return {
      ...state,
      lights,
      pending_server_actions: remaining_actions,
    }
  }
}
