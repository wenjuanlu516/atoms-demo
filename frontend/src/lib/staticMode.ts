export function isStaticDemo(): boolean {
  return import.meta.env.VITE_STATIC_DEMO === 'true'
}
