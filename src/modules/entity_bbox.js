import { on } from 'events'

import { Vector3 } from 'three'
import { aiter } from 'iterator-helper'

import { create_capsule } from '../utils/entities.js'

const BBOX_NAME = 'ares:bounding_box'

function display_bounding_box(
  show,
  { physics, model, height, radius, position },
) {
  if (show) {
    const capsule = create_capsule({
      height,
      radius,
      position,
      color: '#EF5350',
      wireframe: true,
    })

    capsule.name = BBOX_NAME

    model.add(capsule)
  } else {
    const capsule = model.getObjectByName(BBOX_NAME)

    model.remove(capsule)
    capsule.geometry.dispose()
    capsule.material.dispose()
  }
}

/** @type {Type.Module} */
export default {
  reduce(state, { type, payload }) {
    if (type === 'SHOW_BOUNDING_BOXES')
      return {
        ...state,
        show_bounding_boxes: payload,
      }
    return state
  },
  observe({ events, get_state, scene, world, dispatch }) {
    aiter(on(events, 'STATE_UPDATED'))
      .map(([state]) => state)
      .reduce(
        (
          last_show_bounding_boxes,
          { show_bounding_boxes, entities, player },
        ) => {
          if (last_show_bounding_boxes !== show_bounding_boxes) {
            // for all entities
            for (const entity of entities.values()) {
              if (entity.type === 'character')
                display_bounding_box(show_bounding_boxes, entity)
            }

            // and also for the player
            if (player.model)
              display_bounding_box(show_bounding_boxes, player.model)
          }

          return show_bounding_boxes
        },
      )
  },
}
