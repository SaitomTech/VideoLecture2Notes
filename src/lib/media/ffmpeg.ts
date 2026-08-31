import { executeSidecar } from '../tauri/sidecar'

/** Runs the bundled ffmpeg with an argument array; callers never build a shell command string. */
export function runFfmpeg(args: string[]) {
  return executeSidecar('binaries/ffmpeg', args)
}
