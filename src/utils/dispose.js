export default function dispose(object) {
  // Use the .traverse method to go through all descendants of the object
  object?.traverse(child => {
    // Dispose of geometry if the child is a mesh
    if (child.isMesh && child.geometry) child.geometry.dispose()

    // Dispose of material(s)
    if (child.material) {
      if (Array.isArray(child.material)) {
        // Handle multiple materials
        child.material.forEach(material => dispose_material(material))
      } else if (child.material.isMaterial) {
        // Handle single material
        dispose_material(child.material)
      }
    }
  })
}

function dispose_material(material) {
  // Dispose the material
  material.dispose()

  // Dispose textures and other resources
  Object.entries(material).forEach(([key, value]) => {
    if (value && typeof value === 'object' && 'minFilter' in value)
      value.dispose()
  })
}
