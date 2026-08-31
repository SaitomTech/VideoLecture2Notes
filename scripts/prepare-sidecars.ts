import { createHash } from 'node:crypto'
import { access, chmod, mkdir, mkdtemp, readFile, rename, rm, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'

const TARGET_TRIPLE = process.env.TAURI_ENV_TARGET_TRIPLE ?? (process.platform === 'darwin' && process.arch === 'arm64' ? 'aarch64-apple-darwin' : '')
const SIDECAR_DIRECTORY = join(import.meta.dir, '..', 'src-tauri', 'binaries')
const RELEASE_DIRECTORY = '1787073674_9.0.1'
const LLAMA_RUNTIME_FILES = {
  'libllama-server-impl.dylib': 'libllama-server-impl.dylib',
  'libllama-common.0.dylib': 'libllama-common.0.1.2.dylib',
  'libmtmd.0.dylib': 'libmtmd.0.1.2.dylib',
  'libllama.0.dylib': 'libllama.0.1.2.dylib',
  'libggml.0.dylib': 'libggml.0.20.2.dylib',
  'libggml-cpu.0.dylib': 'libggml-cpu.0.20.2.dylib',
  'libggml-blas.0.dylib': 'libggml-blas.0.20.2.dylib',
  'libggml-metal.0.dylib': 'libggml-metal.0.20.2.dylib',
  'libggml-rpc.0.dylib': 'libggml-rpc.0.20.2.dylib',
  'libggml-base.0.dylib': 'libggml-base.0.20.2.dylib',
} as const

const SIDECARS = [
  {
    name: 'ffmpeg',
    archive: 'zip',
    url: `https://ffmpeg.martin-riedl.de/download/macos/arm64/${RELEASE_DIRECTORY}/ffmpeg.zip`,
    sha256: '8287a1b2229e05eb41859f073e18e6c52c60a778f2f5e6881070fe51b79407fe',
  },
  {
    name: 'ffprobe',
    archive: 'zip',
    url: `https://ffmpeg.martin-riedl.de/download/macos/arm64/${RELEASE_DIRECTORY}/ffprobe.zip`,
    sha256: '102a26b8940a053298d9929bfaae71e4b6ef65ba5f19a99a88c433108560741a',
  },
  {
    name: 'whisper-cli',
    archive: 'zip',
    archiveEntry: 'whisper-cpp-darwin-arm64',
    url: 'https://github.com/sjoerdteunisse/whisper.cpp/releases/download/v1.0.0/whisper-cpp-darwin-arm64.zip',
    sha256: 'd033bd3f590cad50f39957bf86354f87b44394cb001e3f78a7b47264358103e3',
  },
  {
    name: 'llama-server',
    archive: 'tar.gz',
    archiveEntry: 'llama-server',
    runtimeDirectory: 'llama-runtime',
    runtimeFiles: LLAMA_RUNTIME_FILES,
    url: 'https://github.com/ggml-org/llama.cpp/releases/download/b10516/llama-b10516-bin-macos-arm64.tar.gz',
    sha256: 'ee3324327d621026ae80c24031670e65fa62a0b23a3a027dbe2f65f240affd30',
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

async function nonEmptyFileExists(path: string) {
  try {
    return (await stat(path)).size > 0
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

async function listArchiveEntries(
  sidecar: (typeof SIDECARS)[number],
  archivePath: string,
) {
  const output =
    sidecar.archive === 'zip'
      ? await run('unzip', ['-Z1', archivePath])
      : await run('tar', ['-tzf', archivePath])

  return output
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

async function extractArchiveEntry(
  sidecar: (typeof SIDECARS)[number],
  archivePath: string,
  entry: string,
) {
  const [command, args] =
    sidecar.archive === 'zip'
      ? ['unzip', ['-p', archivePath, entry]]
      : ['tar', ['-xOf', archivePath, entry]]
  const child = Bun.spawn([command, ...args], {
    stderr: 'pipe',
    stdout: 'pipe',
  })
  const [contents, stderr, code] = await Promise.all([
    new Response(child.stdout).arrayBuffer(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (code !== 0) {
    throw new Error(`${sidecar.name}の展開に失敗しました (${code}): ${stderr.trim()}`)
  }

  return new Uint8Array(contents)
}

async function prepareRuntimeFiles(
  sidecar: (typeof SIDECARS)[number],
  archivePath: string,
  destination: string,
  entries: string[],
) {
  if (!sidecar.runtimeDirectory) return

  const runtimeDirectory = join(SIDECAR_DIRECTORY, sidecar.runtimeDirectory)
  await rm(runtimeDirectory, { force: true, recursive: true })
  await mkdir(runtimeDirectory, { recursive: true })

  for (const [destinationName, sourceName] of Object.entries(sidecar.runtimeFiles)) {
    const entry = entries.find((candidate) => basename(candidate) === sourceName)
    if (!entry) {
      throw new Error(`${sidecar.name}のランタイム ${sourceName} が見つかりませんでした`)
    }

    const runtimePath = join(runtimeDirectory, destinationName)
    await Bun.write(runtimePath, await extractArchiveEntry(sidecar, archivePath, entry))
    await chmod(runtimePath, 0o755)
  }

  await run('install_name_tool', [
    '-add_rpath',
    '@loader_path/../Resources/llama-runtime',
    '-add_rpath',
    '@loader_path/../../binaries/llama-runtime',
    destination,
  ])
}

async function downloadAndExtract(
  sidecar: (typeof SIDECARS)[number],
  temporaryDirectory: string,
) {
  const extension = sidecar.archive === 'zip' ? 'zip' : 'tar.gz'
  const archivePath = join(temporaryDirectory, `${sidecar.name}.${extension}`)
  const response = await fetch(sidecar.url)
  if (!response.ok) {
    throw new Error(`${sidecar.name}のダウンロードに失敗しました: HTTP ${response.status}`)
  }

  await Bun.write(archivePath, response)
  const actualHash = await sha256(archivePath)
  if (actualHash !== sidecar.sha256) {
    throw new Error(`${sidecar.name}のSHA-256が一致しません (expected ${sidecar.sha256}, got ${actualHash})`)
  }

  const entries = await listArchiveEntries(sidecar, archivePath)
  const entry = entries.find(
    (candidate) => basename(candidate) === (sidecar.archiveEntry ?? sidecar.name),
  )
  if (!entry) {
    throw new Error(`${sidecar.name}をアーカイブ内から見つけられませんでした`)
  }

  const destination = sidecarPath(sidecar.name)
  const temporaryDestination = `${destination}.tmp`
  await Bun.write(temporaryDestination, await extractArchiveEntry(sidecar, archivePath, entry))
  await chmod(temporaryDestination, 0o755)
  await rename(temporaryDestination, destination)
  await prepareRuntimeFiles(sidecar, archivePath, destination, entries)
  console.log(`✓ ${sidecar.name}-${TARGET_TRIPLE}`)
}

async function sidecarReady(sidecar: (typeof SIDECARS)[number]) {
  if (!(await pathExists(sidecarPath(sidecar.name)))) return false
  if (!sidecar.runtimeDirectory) return true

  const runtimeDirectory = join(SIDECAR_DIRECTORY, sidecar.runtimeDirectory)
  if (!(await pathExists(runtimeDirectory))) return false
  if (!sidecar.runtimeFiles) return true

  return (
    await Promise.all(
      Object.keys(sidecar.runtimeFiles).map((filename) =>
        nonEmptyFileExists(join(runtimeDirectory, filename)),
      ),
    )
  ).every(Boolean)
}

async function main() {
  if (TARGET_TRIPLE !== 'aarch64-apple-darwin') {
    throw new Error(`現在はmacOS Apple Siliconのみ対応しています。検出されたtarget triple: ${TARGET_TRIPLE || 'unknown'}`)
  }

  await mkdir(SIDECAR_DIRECTORY, { recursive: true })
  const force = process.argv.includes('--force')
  if (!force && (await Promise.all(SIDECARS.map(sidecarReady))).every(Boolean)) {
    console.log(`✓ sidecarは準備済みです (${TARGET_TRIPLE})`)
    return
  }

  const cleanTemporaryDirectory = await mkdtemp(join(tmpdir(), 'video-notes-sidecars-'))
  try {
    for (const sidecar of SIDECARS) {
      if (!force && (await sidecarReady(sidecar))) {
        console.log(`✓ ${sidecar.name}-${TARGET_TRIPLE}`)
        continue
      }
      await downloadAndExtract(sidecar, cleanTemporaryDirectory)
    }
  } finally {
    await rm(cleanTemporaryDirectory, { force: true, recursive: true })
  }

  console.log('sidecarの準備が完了しました。')
}

await main()
