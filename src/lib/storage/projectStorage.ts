import { parseMediaProject } from '../../schemas/project'
import type { MediaProject } from '../../types/project'
import { ensureAppLocalDirectory, readAppLocalTextFile, writeAppLocalTextFile } from '../tauri/filesystem'

function projectPath(projectId: string) {
  return `projects/${projectId}/project.json`
}

export async function saveProject(project: MediaProject) {
  const directory = `projects/${project.id}`
  await ensureAppLocalDirectory(directory)
  await writeAppLocalTextFile(projectPath(project.id), `${JSON.stringify(project, null, 2)}\n`)
}

export async function loadProject(projectId: string) {
  const contents = await readAppLocalTextFile(projectPath(projectId))
  return parseMediaProject(JSON.parse(contents))
}
