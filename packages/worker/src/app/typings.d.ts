declare module '*.css' {
  const url: string
  export default url
}

declare module '*.css?url' {
  const url: string
  export default url
}
