import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
} from 'node:fs'
import type IFileSystem from '@meet-ai/cli/domain/interfaces/IFileSystem'

export default class FileSystemAdapter implements IFileSystem {
  readFileSync(path: string, encoding: BufferEncoding): string {
    return readFileSync(path, encoding)
  }

  writeFileSync(path: string, data: string, encoding?: BufferEncoding): void {
    writeFileSync(path, data, encoding)
  }

  mkdirSync(path: string, opts?: { recursive?: boolean }): void {
    mkdirSync(path, opts)
  }

  existsSync(path: string): boolean {
    return existsSync(path)
  }

  statSync(path: string): { mtimeMs: number; size: number } {
    const stat = statSync(path)
    return { mtimeMs: stat.mtimeMs, size: stat.size }
  }
}
