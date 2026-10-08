/** Images imported from src/assets resolve to a URL (Vite). */
declare module '*.png' {
  const src: string
  export default src
}
