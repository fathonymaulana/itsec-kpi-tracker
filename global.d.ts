// Tell TypeScript that CSS files are valid side-effect imports (Next.js handles them)
declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}
