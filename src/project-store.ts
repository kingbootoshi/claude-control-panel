import fs from "fs/promises";
import path from "path";
import { config } from "./config";
import type { Project } from "./types";
import { logger } from "./utils/logger";

const log = logger.daemon;

interface ProjectsFile {
  version: 1;
  projects: Project[];
}

function getProjectsPath(): string {
  return path.join(config.workspaceRoot, ".ccp-projects.json");
}

export async function loadProjects(): Promise<Project[]> {
  try {
    const data = await fs.readFile(getProjectsPath(), "utf-8");
    const file = JSON.parse(data) as ProjectsFile;
    return file.projects;
  } catch {
    // File doesn't exist or is invalid - return empty list
    return [];
  }
}

async function saveProjects(projects: Project[]): Promise<void> {
  const file: ProjectsFile = {
    version: 1,
    projects,
  };
  await fs.mkdir(config.workspaceRoot, { recursive: true });
  await fs.writeFile(getProjectsPath(), JSON.stringify(file, null, 2));
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "project";
}

export async function addProject(name: string, projectPath: string): Promise<Project> {
  const projects = await loadProjects();

  // Normalize path
  const normalizedPath = path.resolve(projectPath.replace(/^~/, process.env.HOME || ""));

  // Check if path already exists as a project
  const existing = projects.find((p) => p.path === normalizedPath);
  if (existing) {
    throw new Error(`Project already exists at this path: ${existing.name}`);
  }

  // Check if this is a workspace project (inside workspaceRoot)
  const isWorkspaceProject = normalizedPath.startsWith(config.workspaceRoot);

  // Verify path exists on filesystem, or create if workspace project
  try {
    const stat = await fs.stat(normalizedPath);
    if (!stat.isDirectory()) {
      throw new Error("Path is not a directory");
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      if (isWorkspaceProject) {
        // Create the directory for workspace projects
        await fs.mkdir(normalizedPath, { recursive: true });
        log.info({ path: normalizedPath }, "Created workspace project directory");
      } else {
        throw new Error("Directory does not exist");
      }
    } else {
      throw err;
    }
  }

  // Generate unique ID
  let id = slugify(name);
  let counter = 1;
  while (projects.some((p) => p.id === id)) {
    id = `${slugify(name)}-${counter++}`;
  }

  const project: Project = {
    id,
    name,
    path: normalizedPath,
    createdAt: new Date().toISOString(),
    lastOpenedAt: new Date().toISOString(),
  };

  projects.push(project);
  await saveProjects(projects);

  log.info({ projectId: id, name, path: normalizedPath }, "Project created");

  return project;
}

export async function removeProject(id: string): Promise<void> {
  const projects = await loadProjects();
  const index = projects.findIndex((p) => p.id === id);

  if (index === -1) {
    throw new Error(`Project not found: ${id}`);
  }

  const removed = projects.splice(index, 1)[0];
  await saveProjects(projects);

  log.info({ projectId: id, name: removed.name }, "Project removed");
}

export async function getProject(id: string): Promise<Project | null> {
  const projects = await loadProjects();
  return projects.find((p) => p.id === id) || null;
}

export async function updateLastOpened(id: string): Promise<void> {
  const projects = await loadProjects();
  const project = projects.find((p) => p.id === id);

  if (project) {
    project.lastOpenedAt = new Date().toISOString();
    await saveProjects(projects);
  }
}
