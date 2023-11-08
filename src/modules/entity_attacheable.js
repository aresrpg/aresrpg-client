function reduce_entity(entity) {
  const { parent_entity, attach_offset, position } = entity
  if (parent_entity) {
    const next_position = parent_entity.position.clone().add(attach_offset)
    if (!position.equals(next_position))
      return { ...entity, position: next_position }
  }
  return entity
}

/** @type {import("../game").Module} */
export default function () {
  return (state, delta) => ({
    ...state,
    entities: state.entities.map(reduce_entity),
  })
}
