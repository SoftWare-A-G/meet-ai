export default interface IFileSystem {
  readFileSync(path: string, encoding: BufferEncoding): string
  writeFileSync(path: string, data: string, encoding?: BufferEncoding): void
  mkdirSync(path: string, opts?: { recursive?: boolean }): void
  existsSync(path: string): boolean
  statSync(path: string): { mtimeMs: number; size: number }
}
