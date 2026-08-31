import { createHash } from 'node:crypto'
import { access, chmod, mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'

const TARGET_TRIPLE = process.env.TAURI_ENV_TARGET_TRIPLE ?? (process.platform === 'darwin' && process.arch === 'arm64' ? 'aarch64-apple-darwin' : '')
const SIDECAR_DIRECTORY = join(import.meta.dir, '..', 'src-tauri', 'binaries')
const RELEASE = '9.0.1'
const RELEASE_DIRECTORY = '1787073674_9.0.1'

const SIDECARS = [
  {
    name: 'ffmpeg',
    url: `https://ffmpeg.martin-riedl.de/download/macos/arm64/${RELEASE_DIRECTORY}/ffmpeg.zip`,
    sha256: '8287a1b2229e05eb41859f073e18e6c52c60a778f2f5e6881070fe51b79407fe',
  },
  {
    name: 'ffprobe',
    url: `https://ffmpeg.martin-riedl.de/download/macos/arm64/${RELEASE_DIRECTORY}/ffprobe.zip`,
    sha256: '102a26b8940a053298d9929bfaae71e4b6ef65ba5f19a99a88c433108560741a',
  },
] as const

function sidecarPath(name: string) {
  return join(SIDECAR_DIRECTORY, `${name}-${TARGET_TRIPLE}`)
}

async function pathExists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function run(command: string, args: string[]) {
  const child = Bun.spawn([command, ...args], {
    stderr: 'pipe',
    stdout: 'pipe',
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])

  if (code !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${code}): ${stderr.trim()}`)
  }

  return stdout
}

async function sha256(path: string) {
  const hash = createHash('sha256')
  const contents = await readFile(path)
  hash.update(contents)
  return hash.digest('hex')
}

async function downloadAndExtract(
  sidecar: (typeof SIDECARS)[number],
  temporaryDirectory: string,
) {
  const archivePath = join(temporaryDirectory, `${sidecar.name}.zip`)
  const response = await fetch(sidecar.url)
  if (!response.ok) {
    throw new Error(`${sidecar.name}のダウンロードに失敗しました: HTTP ${response.status}`)
  }

  await Bun.write(archivePath, response)
  const actualHash = await sha256(archivePath)
  if (actualHash !== sidecar.sha256) {
    throw new Error(`${sidecar.name}のSHA-256が一致しません (expected ${sidecar.sha256}, got ${actualHash})`)
  }

  const entries = (await run('unzip', ['-Z1', archivePath]))
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
  const entry = entries.find((candidate) => basename(candidate) === sidecar.name)
  if (!entry) {
    throw new Error(`${sidecar.name}をzip内から見つけられませんでした`)
  }

  const child = Bun.spawn(['unzip', '-p', archivePath, entry], {
    stderr: 'pipe',
    stdout: 'pipe',
  })
  const [binary, stderr, code] = await Promise.all([
    new Response(child.stdout).arrayBuffer(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (code !== 0) {
    throw new Error(`${sidecar.name}の展開に失敗しました (${code}): ${stderr.trim()}`)
  }

  const destination = sidecarPath(sidecar.name)
  const temporaryDestination = `${destination}.tmp`
  await Bun.write(temporaryDestination, new Uint8Array(binary))
  await chmod(temporaryDestination, 0o755)
  await rename(temporaryDestination, destination)
  console.log(`✓ ${sidecar.name}-${TARGET_TRIPLE}`)
}

async function main() {
  if (TARGET_TRIPLE !== 'aarch64-apple-darwin') {
    throw new Error(`現在はmacOS Apple Siliconのみ対応しています。検出されたtarget triple: ${TARGET_TRIPLE || 'unknown'}`)
  }

  await mkdir(SIDECAR_DIRECTORY, { recursive: true })
  const destinations = SIDECARS.map((sidecar) => sidecarPath(sidecar.name))
  const force = process.argv.includes('--force')
  if (!force && (await Promise.all(destinations.map(pathExists))).every(Boolean)) {
    console.log(`✓ ffmpeg sidecarは準備済みです (${TARGET_TRIPLE})`)
    return
  }

  const cleanTemporaryDirectory = await mkdtemp(join(tmpdir(), 'video-notes-sidecars-'))
  try {
    for (const sidecar of SIDECARS) {
      await downloadAndExtract(sidecar, cleanTemporaryDirectory)
    }
  } finally {
    await rm(cleanTemporaryDirectory, { force: true, recursive: true })
  }

  console.log(`ffmpeg ${RELEASE} sidecarの準備が完了しました。`)
}

await main()
