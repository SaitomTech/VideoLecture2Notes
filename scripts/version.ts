import { join } from 'node:path'

const projectRoot = join(import.meta.dir, '..')

const manifestPaths = {
  packageJson: join(projectRoot, 'package.json'),
  tauriConfig: join(projectRoot, 'src-tauri', 'tauri.conf.json'),
  cargoToml: join(projectRoot, 'src-tauri', 'Cargo.toml'),
  cargoLock: join(projectRoot, 'src-tauri', 'Cargo.lock'),
} as const

type AppVersions = Record<keyof typeof manifestPaths, string>

function assertVersion(version: string) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`バージョンはSemVer形式で指定してください: ${version}`)
  }
}

function normalizeVersion(version: string) {
  const normalized = version.trim().replace(/^v/i, '')
  assertVersion(normalized)
  return normalized
}

function replaceVersion(text: string, pattern: RegExp, version: string, label: string) {
  const matches = text.match(new RegExp(pattern.source, `${pattern.flags}g`))
  if (!matches || matches.length !== 1) {
    throw new Error(`${label}のバージョンフィールドを一意に見つけられません。`)
  }

  return text.replace(pattern, `$1"${version}$2`)
}

async function readVersions(): Promise<AppVersions> {
  const packageText = await Bun.file(manifestPaths.packageJson).text()
  const packageJson = JSON.parse(packageText) as { version?: unknown }
  const packageVersion = packageJson.version
  if (typeof packageVersion !== 'string') {
    throw new Error('package.jsonのトップレベルversionが見つかりません。')
  }

  const tauriText = await Bun.file(manifestPaths.tauriConfig).text()
  const tauriConfig = JSON.parse(tauriText) as { version?: unknown }
  const tauriVersion = tauriConfig.version
  if (typeof tauriVersion !== 'string') {
    throw new Error('src-tauri/tauri.conf.jsonのトップレベルversionが見つかりません。')
  }

  const cargoText = await Bun.file(manifestPaths.cargoToml).text()
  const cargoMatch = cargoText.match(/^version\s*=\s*"([^"]+)"/m)
  if (!cargoMatch) {
    throw new Error('src-tauri/Cargo.tomlのpackage versionが見つかりません。')
  }

  const cargoLockText = await Bun.file(manifestPaths.cargoLock).text()
  const cargoLockMatch = cargoLockText.match(
    /\[\[package\]\]\nname = "videolecture2notes"\nversion = "([^"]+)"/,
  )
  if (!cargoLockMatch) {
    throw new Error('src-tauri/Cargo.lockのアプリ自身のversionが見つかりません。')
  }

  return {
    packageJson: packageVersion,
    tauriConfig: tauriVersion,
    cargoToml: cargoMatch[1],
    cargoLock: cargoLockMatch[1],
  }
}

function assertVersionsMatch(versions: AppVersions) {
  const uniqueVersions = new Set(Object.values(versions))
  if (uniqueVersions.size !== 1) {
    const details = Object.entries(versions)
      .map(([file, version]) => `${file}=${version}`)
      .join(', ')
    throw new Error(`アプリバージョンが一致していません: ${details}`)
  }

  const [version] = uniqueVersions
  assertVersion(version)
  return version
}

async function checkVersion(expectedVersion?: string) {
  const versions = await readVersions()
  const version = assertVersionsMatch(versions)

  if (expectedVersion) {
    const normalizedExpectedVersion = normalizeVersion(expectedVersion)
    if (version !== normalizedExpectedVersion) {
      throw new Error(`期待するバージョン(${normalizedExpectedVersion})と一致しません: ${version}`)
    }
  }

  console.log(`アプリバージョンは${version}で一致しています。`)
}

async function setVersion(nextVersion: string) {
  const normalizedNextVersion = normalizeVersion(nextVersion)
  const currentVersions = await readVersions()
  assertVersionsMatch(currentVersions)

  const packageText = await Bun.file(manifestPaths.packageJson).text()
  const tauriText = await Bun.file(manifestPaths.tauriConfig).text()
  const cargoText = await Bun.file(manifestPaths.cargoToml).text()
  const cargoLockText = await Bun.file(manifestPaths.cargoLock).text()

  await Bun.write(
    manifestPaths.packageJson,
    replaceVersion(
      packageText,
      /^( {2}"version"\s*:\s*)"[^"]+("\s*,?)/m,
      normalizedNextVersion,
      'package.json',
    ),
  )
  await Bun.write(
    manifestPaths.tauriConfig,
    replaceVersion(
      tauriText,
      /^( {2}"version"\s*:\s*)"[^"]+("\s*,?)/m,
      normalizedNextVersion,
      'src-tauri/tauri.conf.json',
    ),
  )
  await Bun.write(
    manifestPaths.cargoToml,
    replaceVersion(
      cargoText,
      /^(version\s*=\s*)"[^"]+("\s*)/m,
      normalizedNextVersion,
      'src-tauri/Cargo.toml',
    ),
  )
  await Bun.write(
    manifestPaths.cargoLock,
    replaceVersion(
      cargoLockText,
      /(\[\[package\]\]\nname = "videolecture2notes"\nversion = )"[^"]+("\n)/,
      normalizedNextVersion,
      'src-tauri/Cargo.lock',
    ),
  )

  console.log(`アプリバージョンを${normalizedNextVersion}に更新しました。`)
}

const [command = 'check', version] = process.argv.slice(2)

if (command === 'check') {
  await checkVersion(version)
} else if (command === 'set' && version) {
  await setVersion(version)
} else {
  throw new Error(
    '使い方: bun scripts/version.ts check [version] または bun scripts/version.ts set <version>',
  )
}
