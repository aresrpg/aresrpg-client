export default function merge_plane_columns(chunk_data_array) {
  // Calculate total size for each buffer type
  const totalVerticesSize = chunk_data_array.reduce(
    (sum, chunk) => sum + chunk.vertices.byteLength,
    0,
  )
  const totalColorsSize = chunk_data_array.reduce(
    (sum, chunk) => sum + chunk.colors.byteLength,
    0,
  )
  const totalIndicesSize = chunk_data_array.reduce(
    (sum, chunk) => sum + chunk.indices.byteLength,
    0,
  )

  // Allocate the merged buffers
  const mergedVertices = new SharedArrayBuffer(totalVerticesSize)
  const mergedColors = new SharedArrayBuffer(totalColorsSize)
  const mergedIndices = new SharedArrayBuffer(totalIndicesSize)

  // Create views for the merged buffers
  const mergedVerticesView = new Float32Array(mergedVertices)
  const mergedColorsView = new Float32Array(mergedColors)
  const mergedIndicesView = new Uint32Array(mergedIndices)

  let vertexOffset = 0
  let colorOffset = 0
  let indexOffset = 0
  let vertexCount = 0

  chunk_data_array.forEach(chunk => {
    // Copy vertices and colors
    mergedVerticesView.set(
      new Float32Array(chunk.vertices),
      vertexOffset / Float32Array.BYTES_PER_ELEMENT,
    )
    mergedColorsView.set(
      new Float32Array(chunk.colors),
      colorOffset / Float32Array.BYTES_PER_ELEMENT,
    )

    // Adjust and copy indices
    const chunkIndices = new Uint32Array(chunk.indices)
    for (let i = 0; i < chunkIndices.length; i++) {
      mergedIndicesView[indexOffset / Uint32Array.BYTES_PER_ELEMENT + i] =
        chunkIndices[i] + vertexCount
    }

    // Update offsets and vertex count
    vertexOffset += chunk.vertices.byteLength
    colorOffset += chunk.colors.byteLength
    indexOffset += chunk.indices.byteLength
    vertexCount +=
      chunk.vertices.byteLength / (3 * Float32Array.BYTES_PER_ELEMENT)
  })

  return {
    vertices: mergedVertices,
    colors: mergedColors,
    indices: mergedIndices,
  }
}
