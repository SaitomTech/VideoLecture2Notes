import { z } from 'zod'
import { parseMediaProject } from '../../schemas/project'
import { syncActiveArticle, toPersistedProject } from '../project/project'
import { buildProjectSummary } from '../project/projectProgress'
import {
  PROJECT_VERSION,
  type MediaProject,
  type ProjectListEntry,
  type ProjectSummary,
} from '../../types/project'
import {
  appLocalFileExists,
  appLocalPathExists,
  ensureAppLocalDirectory,
  fileExists,
  readAppLocalDirectory,
  readAppLocalTextFile,
  removeAppLocalPath,
  renameAppLocalPath,
  writeAppLocalTextFile,
} from '../tauri/filesystem'

// Project JSON version and directory layout version are independent markers.
const STORAGE_LAYOUT_VERSION = 1
const STORAGE_VERSION = `${PROJECT_VERSION}:${STORAGE_LAYOUT_VERSION}`
const PROJECT_TRASH_DIRECTORY = 'project-trash'
type AssetCollection = 'articles' | 'videos'
type AssetTrashTransaction = {
  operationRoot: string
  sourcePath: string
  trashPath: string
  moved: boolean
}
type AssetTrashJournal = {
  operationId: string
  collection: AssetCollection
  assetId: string
  state: 'pending' | 'moved'
}

const ProjectSummarySchema = z.strictObject({
  projectVersion: z.literal(PROJECT_VERSION),
  id: z.string().min(1),
  title: z.string().min(1),
  sourceName: z.string(),
  sourcePath: z.string(),
  extension: z.enum(['mp4', 'webm', 'mov', 'mkv', 'm4v']),
  durationMs: z.number().nonnegative(),
  slideCount: z.number().int().nonnegative(),
  ocrCompleted: z.number().int().nonnegative(),
  articleCompleted: z.number().int().nonnegative(),
  articleTarget: z.number().int().nonnegative(),
  videoCount: z.number().int().nonnegative(),
  articleCount: z.number().int().nonnegative(),
  thumbnailPath: z.string().min(1).optional(),
  resumeStep: z.enum(['detect-slides', 'generate-notes', 'article-review', 'export']),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  lastOpenedAt: z.iso.datetime(),
  health: z.enum(['ready', 'source-missing', 'needs-repair']),
})

let storageInitialization: Promise<void> | null = null
const saveQueues = new Map<string, Promise<MediaProject>>()
const projectMutationQueues = new Map<string, Promise<unknown>>()

function enqueueProjectMutation<T>(projectId: string, operation: () => Promise<T>) {
  const previous = projectMutationQueues.get(projectId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(operation)
  projectMutationQueues.set(projectId, next)
  return next.finally(() => {
    if (projectMutationQueues.get(projectId) === next) projectMutationQueues.delete(projectId)
  })
}

function assertProjectId(projectId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('不正なプロジェクトIDです。')
}

function assertAssetId(assetId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(assetId)) throw new Error('不正なアセットIDです。')
}

function projectDirectory(projectId: string) {
  assertProjectId(projectId)
  return `projects/${projectId}`
}

function projectPath(projectId: string) {
  return `${projectDirectory(projectId)}/project.json`
}

function projectSummaryPath(projectId: string) {
  return `${projectDirectory(projectId)}/project.summary.json`
}

function assetPath(projectId: string, collection: AssetCollection, assetId: string) {
  assertAssetId(assetId)
  return `${projectDirectory(projectId)}/${collection}/${assetId}`
}

async function removeIfPresent(path: string) {
  if (!isSafeStoragePath(path)) throw new Error('不正なストレージパスです。')
  if (await appLocalPathExists(path)) await removeAppLocalPath(path)
}

function isSafeStoragePath(path: string) {
  return (
    path === 'projects' ||
    path === PROJECT_TRASH_DIRECTORY ||
    path.startsWith('projects/') ||
    path.startsWith(`${PROJECT_TRASH_DIRECTORY}/`)
  )
}

async function recoverAtomicFile(path: string) {
  const backupPath = `${path}.bak`
  const temporaryPath = `${path}.tmp`
  const [primaryExists, backupExists] = await Promise.all([
    appLocalPathExists(path),
    appLocalPathExists(backupPath),
  ])
  if (!primaryExists && backupExists) {
    await renameAppLocalPath(backupPath, path)
  }
  if (await appLocalPathExists(temporaryPath)) await removeAppLocalPath(temporaryPath)
}

async function readProjectFile(path: string, projectId: string) {
  const project = parseMediaProject(JSON.parse(await readAppLocalTextFile(path)))
  if (project.id !== projectId) throw new Error('プロジェクトIDが一致しません。')
  return project
}

async function readProjectWithBackup(projectId: string) {
  const primaryPath = projectPath(projectId)
  try {
    return await readProjectFile(primaryPath, projectId)
  } catch (primaryError) {
    try {
      const recovered = await readProjectFile(`${primaryPath}.bak`, projectId)
      try {
        if (await appLocalPathExists(primaryPath)) await removeAppLocalPath(primaryPath)
        await renameAppLocalPath(`${primaryPath}.bak`, primaryPath)
      } catch (recoveryError) {
        console.warn('プロジェクトのバックアップを本体へ復旧できませんでした。', recoveryError)
      }
      return recovered
    } catch {
      throw primaryError
    }
  }
}

async function recoverAssetTrash(projectId: string) {
  const trashRoot = `${projectDirectory(projectId)}/.trash`
  if (!(await appLocalPathExists(trashRoot))) return
  const operations = await readAppLocalDirectory(trashRoot)
  for (const operation of operations.filter((entry) => entry.isDirectory)) {
    try {
      assertAssetId(operation.name)
    } catch (error) {
      console.warn('不正な削除トランザクションを復旧できません。', error)
      continue
    }
    const operationRoot = `${trashRoot}/${operation.name}`
    const journalPath = `${operationRoot}/operation.json`
    let journal: AssetTrashJournal
    try {
      const parsed: unknown = JSON.parse(await readAppLocalTextFile(journalPath))
      if (!parsed || typeof parsed !== 'object') throw new Error('journal is not an object')
      const candidate = parsed as Partial<AssetTrashJournal>
      if (
        typeof candidate.operationId !== 'string' ||
        (candidate.collection !== 'articles' && candidate.collection !== 'videos') ||
        typeof candidate.assetId !== 'string' ||
        (candidate.state !== 'pending' && candidate.state !== 'moved')
      ) {
        throw new Error('journal fields are invalid')
      }
      assertAssetId(candidate.assetId)
      if (candidate.operationId !== operation.name) throw new Error('journal operation id mismatch')
      journal = candidate as AssetTrashJournal
    } catch (error) {
      console.warn('不正な削除トランザクションを削除できませんでした。', error)
      continue
    }

    const sourcePath = assetPath(projectId, journal.collection, journal.assetId)
    const trashPath = `${operationRoot}/${journal.collection}/${journal.assetId}`
    let project: MediaProject
    try {
      project = await readProjectWithBackup(projectId)
    } catch (error) {
      console.warn('削除トランザクションの復旧を保留しました。', error)
      continue
    }
    const stillReferenced =
      journal.collection === 'articles'
        ? project.articles.some((article) => article.id === journal.assetId)
        : project.videos.some((video) => video.id === journal.assetId)

    if (
      stillReferenced &&
      (await appLocalPathExists(trashPath)) &&
      !(await appLocalPathExists(sourcePath))
    ) {
      await ensureAppLocalDirectory(`${projectDirectory(projectId)}/${journal.collection}`)
      await renameAppLocalPath(trashPath, sourcePath)
    }
    await removeIfPresent(operationRoot)
  }
}

async function recoverStorageArtifacts() {
  const projectEntries = await readAppLocalDirectory('projects')
  const projectDirectories = projectEntries.filter((entry) => {
    if (!entry.isDirectory || entry.name === '.trash') return false
    try {
      assertProjectId(entry.name)
      return true
    } catch (error) {
      console.warn('不正なプロジェクトディレクトリを復旧対象から除外しました。', error)
      return false
    }
  })
  await Promise.all(
    projectDirectories.map(async (entry) => {
      await Promise.all([
        recoverAtomicFile(projectPath(entry.name)),
        recoverAtomicFile(projectSummaryPath(entry.name)),
      ])
      await recoverAssetTrash(entry.name)
    }),
  )
  await removeIfPresent(PROJECT_TRASH_DIRECTORY)
}

async function initializeProjectStorage() {
  if (storageInitialization) return storageInitialization
  const initialization = (async () => {
    await ensureAppLocalDirectory('projects')
    const markerPath = 'projects/.storage-version'
    const marker = (await appLocalFileExists(markerPath))
      ? (await readAppLocalTextFile(markerPath)).trim()
      : ''
    const hasProjectData = (await readAppLocalDirectory('projects')).some(
      (entry) => entry.name !== '.storage-version',
    )
    if (marker !== STORAGE_VERSION) {
      if (marker || hasProjectData) await removeAppLocalPath('projects')
      await ensureAppLocalDirectory('projects')
      await writeAppLocalTextFile(markerPath, `${STORAGE_VERSION}\n`)
    }
    await recoverStorageArtifacts()
  })()
  storageInitialization = initialization.catch((error) => {
    storageInitialization = null
    throw error
  })
  return storageInitialization
}

async function atomicWrite(path: string, contents: string) {
  const temporaryPath = `${path}.tmp`
  const backupPath = `${path}.bak`
  const hadOriginal = await appLocalPathExists(path)
  await writeAppLocalTextFile(temporaryPath, contents)
  try {
    if (hadOriginal) {
      if (await appLocalPathExists(backupPath)) await removeAppLocalPath(backupPath)
      await renameAppLocalPath(path, backupPath)
    }
    await renameAppLocalPath(temporaryPath, path)
  } catch (error) {
    await removeIfPresent(temporaryPath).catch(() => undefined)
    if (
      hadOriginal &&
      !(await appLocalPathExists(path)) &&
      (await appLocalPathExists(backupPath))
    ) {
      await renameAppLocalPath(backupPath, path).catch(() => undefined)
    }
    throw error
  }
  await removeIfPresent(backupPath).catch((error) => {
    console.warn('古いプロジェクトバックアップを削除できませんでした。', error)
  })
}

async function writeProjectSummary(project: MediaProject) {
  await atomicWrite(
    projectSummaryPath(project.id),
    `${JSON.stringify(buildProjectSummary(project), null, 2)}\n`,
  )
}

async function saveProjectNow(project: MediaProject): Promise<MediaProject> {
  await initializeProjectStorage()
  const synced = syncActiveArticle(project)
  await ensureAppLocalDirectory(projectDirectory(project.id))
  await atomicWrite(
    projectPath(project.id),
    `${JSON.stringify(toPersistedProject(synced), null, 2)}\n`,
  )
  await writeProjectSummary(synced).catch((error) =>
    console.warn('プロジェクト一覧情報を更新できませんでした。', error),
  )
  return synced
}

export async function saveProject(project: MediaProject): Promise<MediaProject> {
  const previous = saveQueues.get(project.id) ?? Promise.resolve(project)
  const next = previous.catch(() => project).then(() => saveProjectNow(project))
  saveQueues.set(project.id, next)
  try {
    return await next
  } finally {
    if (saveQueues.get(project.id) === next) saveQueues.delete(project.id)
  }
}

export async function saveProjectWithCreatedAssets(
  project: MediaProject,
  assets: Array<{ collection: AssetCollection; assetId: string }>,
) {
  try {
    return await saveProject(project)
  } catch (error) {
    const cleanupErrors: unknown[] = []
    await Promise.all(
      assets.map(async ({ collection, assetId }) => {
        try {
          await removeIfPresent(assetPath(project.id, collection, assetId))
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError)
        }
      }),
    )
    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        '保存に失敗したアセットの回収にも失敗しました。',
      )
    }
    throw error
  }
}

export async function loadProject(projectId: string) {
  await initializeProjectStorage()
  return readProjectWithBackup(projectId)
}

function parseSummary(value: unknown, projectId: string): ProjectSummary {
  const summary = ProjectSummarySchema.parse(value)
  if (summary.id !== projectId) throw new Error('プロジェクトIDが一致しません。')
  return summary
}

async function projectEntries() {
  await initializeProjectStorage()
  await ensureAppLocalDirectory('projects')
  return (await readAppLocalDirectory('projects')).filter(
    (entry) =>
      entry.isDirectory && entry.name !== PROJECT_TRASH_DIRECTORY && entry.name !== '.trash',
  )
}

async function readProjectEntry(projectId: string): Promise<ProjectListEntry> {
  try {
    const summaryFile = projectSummaryPath(projectId)
    let summary: ProjectSummary
    if (await appLocalFileExists(summaryFile)) {
      try {
        summary = parseSummary(JSON.parse(await readAppLocalTextFile(summaryFile)), projectId)
      } catch {
        summary = buildProjectSummary(await loadProject(projectId))
      }
    } else {
      summary = buildProjectSummary(await loadProject(projectId))
    }
    const sourceExists = summary.sourcePath ? await fileExists(summary.sourcePath) : true
    return {
      kind: 'project',
      summary: { ...summary, health: sourceExists ? summary.health : 'needs-repair' },
    }
  } catch (error) {
    return {
      kind: 'invalid',
      id: projectId,
      error: error instanceof Error ? error.message : 'プロジェクトを読み込めませんでした。',
    }
  }
}

export async function listProjects() {
  const entries = await projectEntries()
  const projects = await Promise.all(entries.map((entry) => readProjectEntry(entry.name)))
  return projects.sort((first, second) => {
    const a = first.kind === 'project' ? first.summary.lastOpenedAt : ''
    const b = second.kind === 'project' ? second.summary.lastOpenedAt : ''
    return b.localeCompare(a)
  })
}

async function beginAssetTrashTransaction(
  projectId: string,
  collection: AssetCollection,
  assetId: string,
): Promise<AssetTrashTransaction> {
  await initializeProjectStorage()
  assertAssetId(assetId)
  const operationId = crypto.randomUUID()
  const operationRoot = `${projectDirectory(projectId)}/.trash/${operationId}`
  const sourcePath = assetPath(projectId, collection, assetId)
  const trashPath = `${operationRoot}/${collection}/${assetId}`
  const transaction = { operationRoot, sourcePath, trashPath, moved: false }
  try {
    await ensureAppLocalDirectory(operationRoot)
    await writeAppLocalTextFile(
      `${operationRoot}/operation.json`,
      `${JSON.stringify({ operationId, collection, assetId, state: 'pending' } satisfies AssetTrashJournal)}\n`,
    )
    transaction.moved = await appLocalPathExists(sourcePath)
    if (transaction.moved) {
      await ensureAppLocalDirectory(`${operationRoot}/${collection}`)
      await renameAppLocalPath(sourcePath, trashPath)
      await writeAppLocalTextFile(
        `${operationRoot}/operation.json`,
        `${JSON.stringify({ operationId, collection, assetId, state: 'moved' } satisfies AssetTrashJournal)}\n`,
      )
    }
    return transaction
  } catch (error) {
    try {
      await restoreAssetTrashTransaction(transaction)
    } catch (restoreError) {
      throw new AggregateError([error, restoreError], 'アセット退避の復旧に失敗しました。')
    } finally {
      await finishAssetTrashTransaction(transaction)
    }
    throw error
  }
}

async function restoreAssetTrashTransaction(transaction: AssetTrashTransaction) {
  if (!transaction.moved || !(await appLocalPathExists(transaction.trashPath))) return
  if (await appLocalPathExists(transaction.sourcePath)) {
    await removeAppLocalPath(transaction.trashPath)
    return
  }
  const parent = transaction.sourcePath.slice(0, transaction.sourcePath.lastIndexOf('/'))
  await ensureAppLocalDirectory(parent)
  await renameAppLocalPath(transaction.trashPath, transaction.sourcePath)
}

async function finishAssetTrashTransaction(transaction: AssetTrashTransaction) {
  await removeIfPresent(transaction.operationRoot).catch((error) => {
    console.warn('削除済みアセットの一時退避領域を削除できませんでした。', error)
  })
}

async function deleteProjectAssetNow(
  project: MediaProject,
  collection: AssetCollection,
  assetId: string,
  update: (current: MediaProject) => MediaProject,
) {
  assertAssetId(assetId)
  const current = await loadProject(project.id)
  const exists =
    collection === 'articles'
      ? current.articles.some((article) => article.id === assetId)
      : current.videos.some((video) => video.id === assetId)
  if (!exists) return current
  const transaction = await beginAssetTrashTransaction(current.id, collection, assetId)
  try {
    const next = await saveProject(update(current))
    await finishAssetTrashTransaction(transaction)
    return next
  } catch (error) {
    try {
      await restoreAssetTrashTransaction(transaction)
      await finishAssetTrashTransaction(transaction)
    } catch (restoreError) {
      throw new AggregateError([error, restoreError], 'アセット削除のロールバックに失敗しました。')
    }
    throw error
  }
}

export function deleteProjectArticle(project: MediaProject, articleId: string) {
  return enqueueProjectMutation(project.id, () =>
    deleteProjectAssetNow(project, 'articles', articleId, (current) => {
      const articles = current.articles.filter((article) => article.id !== articleId)
      const activeArticleId =
        current.activeArticleId === articleId ? articles[0]?.id : current.activeArticleId
      const next = { ...current, articles, activeArticleId, updatedAt: new Date().toISOString() }
      if (activeArticleId && activeArticleId !== current.activeArticleId) {
        const activeArticle = articles.find((article) => article.id === activeArticleId)
        if (activeArticle) {
          return {
            ...next,
            activeArticleId,
            source: activeArticle.inputMedia,
            settings: activeArticle.settings,
            slides: activeArticle.slides,
            slideDetection: activeArticle.slideDetection,
            transcription: activeArticle.transcription,
            article: activeArticle.article,
            workflow: activeArticle.workflow,
          }
        }
      }
      return next
    }),
  )
}

export function deleteProjectVideo(project: MediaProject, videoId: string) {
  return enqueueProjectMutation(project.id, () =>
    deleteProjectAssetNow(project, 'videos', videoId, (current) => ({
      ...current,
      videos: current.videos.filter((video) => video.id !== videoId),
      articles: current.articles.map((article) =>
        article.sourceVideoId === videoId ? { ...article, sourceVideoId: undefined } : article,
      ),
      updatedAt: new Date().toISOString(),
    })),
  )
}

export async function deleteProject(projectId: string) {
  await enqueueProjectMutation(projectId, async () => {
    await initializeProjectStorage()
    const sourcePath = projectDirectory(projectId)
    if (!(await appLocalPathExists(sourcePath))) return
    const trashPath = `${PROJECT_TRASH_DIRECTORY}/${projectId}-${crypto.randomUUID()}`
    await ensureAppLocalDirectory(PROJECT_TRASH_DIRECTORY)
    await renameAppLocalPath(sourcePath, trashPath)
    await removeIfPresent(trashPath).catch((error) => {
      console.warn('削除済みプロジェクトの一時退避領域を削除できませんでした。', error)
    })
  })
}
