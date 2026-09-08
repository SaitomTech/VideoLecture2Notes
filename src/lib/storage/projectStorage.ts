import { parseMediaProject } from '../../schemas/project'
import type {
  MediaProject,
  ProjectListEntry,
  ProjectOpenResult,
  ProjectSummary,
} from '../../types/project'
import { buildProjectSummary, getProjectResumeStep } from '../project/projectProgress'
import {
  appLocalFileExists,
  ensureAppLocalDirectory,
  fileExists,
  readAppLocalDirectory,
  readAppLocalTextFile,
  removeAppLocalPath,
  renameAppLocalPath,
  writeAppLocalTextFile,
} from '../tauri/filesystem'

function assertProjectId(projectId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error('不正なプロジェクトIDです。')
  }
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

function projectBackupPath(projectId: string) {
  return `${projectPath(projectId)}.bak`
}

async function atomicWriteAppLocalTextFile(path: string, contents: string) {
  const temporaryPath = `${path}.tmp`
  const backupPath = `${path}.bak`
  const hadOriginal = await appLocalFileExists(path)

  await writeAppLocalTextFile(temporaryPath, contents)

  try {
    if (hadOriginal) await renameAppLocalPath(path, backupPath)
    await renameAppLocalPath(temporaryPath, path)
  } catch (error) {
    if (await appLocalFileExists(temporaryPath)) {
      await removeAppLocalPath(temporaryPath).catch(() => undefined)
    }
    if (hadOriginal && !(await appLocalFileExists(path)) && (await appLocalFileExists(backupPath))) {
      await renameAppLocalPath(backupPath, path).catch(() => undefined)
    }
    throw error
  }
}

function parseSummary(value: unknown, projectId: string) {
  if (!value || typeof value !== 'object') throw new Error('プロジェクトの一覧情報が不正です。')
  const summary = value as Partial<ProjectSummary>
  if (
    summary.id !== projectId ||
    typeof summary.title !== 'string' ||
    typeof summary.sourceName !== 'string' ||
    typeof summary.sourcePath !== 'string' ||
    typeof summary.durationMs !== 'number' ||
    typeof summary.slideCount !== 'number' ||
    typeof summary.ocrCompleted !== 'number' ||
    typeof summary.articleCompleted !== 'number' ||
    typeof summary.articleTarget !== 'number' ||
    typeof summary.resumeStep !== 'string' ||
    typeof summary.createdAt !== 'string' ||
    typeof summary.updatedAt !== 'string' ||
    typeof summary.lastOpenedAt !== 'string'
  ) {
    throw new Error('プロジェクトの一覧情報が不完全です。')
  }
  return summary as ProjectSummary
}

async function writeProjectSummary(project: MediaProject) {
  const summary = buildProjectSummary(project)
  await atomicWriteAppLocalTextFile(
    projectSummaryPath(project.id),
    `${JSON.stringify(summary, null, 2)}\n`,
  )
}

async function readProjectFile(path: string) {
  const contents = await readAppLocalTextFile(path)
  return parseMediaProject(JSON.parse(contents))
}

export async function saveProject(project: MediaProject) {
  const directory = projectDirectory(project.id)
  await ensureAppLocalDirectory(directory)
  await atomicWriteAppLocalTextFile(
    projectPath(project.id),
    `${JSON.stringify(project, null, 2)}\n`,
  )

  // The summary is a rebuildable index. A project save should still succeed if only this cache fails.
  await writeProjectSummary(project).catch((error) => {
    console.warn('プロジェクト一覧情報を更新できませんでした。', error)
  })
}

export async function loadProject(projectId: string) {
  const primaryPath = projectPath(projectId)

  try {
    const project = await readProjectFile(primaryPath)
    if (project.id !== projectId) throw new Error('プロジェクトIDが一致しません。')
    return project
  } catch (primaryError) {
    if (!(await appLocalFileExists(projectBackupPath(projectId)))) throw primaryError

    const recovered = await readProjectFile(projectBackupPath(projectId))
    if (recovered.id !== projectId) throw primaryError
    return recovered
  }
}

export async function loadProjectForResume(projectId: string): Promise<ProjectOpenResult> {
  try {
    const project = await loadProject(projectId)
    if (!(await fileExists(project.source.path))) {
      return { kind: 'source-missing', project }
    }

    if (project.trim && !(await fileExists(project.trim.source.path))) {
      const repairedProject: MediaProject = {
        ...project,
        trim: undefined,
        workflow: {
          ...project.workflow,
          cropConfirmedAt: undefined,
          lastVisitedStep: 'crop',
        },
        slides: [],
        slideDetection: undefined,
        transcription: undefined,
        article: project.article ? { title: project.article.title } : undefined,
      }
      return { kind: 'ready', project: repairedProject, step: 'crop' }
    }

    const hasMissingSlideAsset = (await Promise.all(
      project.slides.map(async (slide) => {
        const path = slide.image.representativeFramePath
        return !path || !(await fileExists(path))
      }),
    )).some(Boolean)
    const step = hasMissingSlideAsset ? 'detect-slides' : getProjectResumeStep(project)

    return { kind: 'ready', project, step }
  } catch (error) {
    return {
      kind: 'invalid',
      message: error instanceof Error ? error.message : 'プロジェクトを読み込めませんでした。',
    }
  }
}

async function listProjectDirectoryEntries() {
  await ensureAppLocalDirectory('projects')
  const entries = await readAppLocalDirectory('projects')
  const legacyTrash = entries.find((entry) => entry.isDirectory && entry.name === '.trash')

  if (legacyTrash) {
    try {
      await removeAppLocalPath('projects/.trash')
    } catch (error) {
      throw new Error('旧仕様の削除待ちプロジェクトを完全削除できませんでした。', {
        cause: error,
      })
    }
  }

  return entries.filter((entry) => entry.name !== '.trash')
}

async function readProjectEntry(projectId: string): Promise<ProjectListEntry> {
  try {
    let summary: ProjectSummary
    if (await appLocalFileExists(projectSummaryPath(projectId))) {
      try {
        summary = parseSummary(
          JSON.parse(await readAppLocalTextFile(projectSummaryPath(projectId))),
          projectId,
        )
      } catch {
        const project = await loadProject(projectId)
        summary = buildProjectSummary(project)
        await writeProjectSummary(project).catch(() => undefined)
      }
    } else {
      const project = await loadProject(projectId)
      summary = buildProjectSummary(project)
      await writeProjectSummary(project).catch(() => undefined)
    }
    const sourceExists = await fileExists(summary.sourcePath)
    const thumbnailExists = summary.thumbnailPath ? await fileExists(summary.thumbnailPath) : false
    const hasMissingAssets = summary.slideCount > 0 && !thumbnailExists

    return {
      kind: 'project',
      summary: {
        ...summary,
        health: sourceExists ? (hasMissingAssets ? 'needs-repair' : 'ready') : 'source-missing',
      },
    }
  } catch (error) {
    return {
      kind: 'invalid',
      id: projectId,
      error: error instanceof Error ? error.message : 'プロジェクトを読み込めませんでした。',
    }
  }
}

export async function listProjects(): Promise<ProjectListEntry[]> {
  const entries = await listProjectDirectoryEntries()
  const projectIds: string[] = []
  for (const entry of entries) {
    if (entry.isDirectory) projectIds.push(entry.name)
  }

  const projects = await Promise.all(projectIds.map(readProjectEntry))
  return projects.sort((first, second) => {
    const firstDate = first.kind === 'project' ? first.summary.lastOpenedAt : ''
    const secondDate = second.kind === 'project' ? second.summary.lastOpenedAt : ''
    return secondDate.localeCompare(firstDate)
  })
}

export async function deleteProject(projectId: string) {
  await removeAppLocalPath(projectDirectory(projectId))
}
