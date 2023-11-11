import { on } from 'events'

import { Box3, Vector3 } from 'three'
import { aiter } from 'iterator-helper'

import { create_capsule } from '../utils/entities.js'

/** @type {Type.Module} */
export default function () {
  return {
    reduce(state, { type, payload }) {
      if (type === 'SHOW_BOUNDING_BOXES')
        return {
          ...state,
          show_bounding_boxes: payload,
        }
      return state
    },
    observe({ events, get_state, world, dispatch }) {
      aiter(on(events, 'STATE_UPDATED')).reduce(
        (
          last_show_bounding_boxes,
          { show_bounding_boxes, entities, player },
        ) => {
          if (last_show_bounding_boxes !== show_bounding_boxes) {
            // for all entities
            for (const entity of entities.values())
              entity.show_bounding_box(show_bounding_boxes)

            // and also for the player
            if (player.model) player.show_bounding_box(show_bounding_boxes)
          }

          return show_bounding_boxes
        },
      )
    },
  }
}
