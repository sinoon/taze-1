import path from 'path'
import { promises as fs } from 'fs'
import fg from 'fast-glob'
import { PackageMeta, CommonOptions, RawDependency } from '../types'
import { createDependenciesFilter } from '../utils/dependenciesFilter'
import { parseDependencies, dumpDependencies } from './dependencies'

export async function readJSON(filepath: string) {
  return JSON.parse(await fs.readFile(filepath, 'utf-8'))
}

export async function writeJSON(filepath: string, data: any) {
  return await fs.writeFile(filepath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
}

export async function writePackage(pkg: PackageMeta, options: CommonOptions) {
  const { raw, filepath, resolved } = pkg
  if (raw.dependencies && !options.dev)
    raw.dependencies = dumpDependencies(resolved, 'dependencies')
  if (raw.devDependencies && !options.prod)
    raw.devDependencies = dumpDependencies(resolved, 'devDependencies')
  if (raw.optionalDependencies && !options.prod && !options.dev)
    raw.optionalDependencies = dumpDependencies(resolved, 'optionalDependencies')
  await writeJSON(filepath, raw)
}

export async function loadPackage(relative: string, options: CommonOptions, shouldUpdate: (name: string) => boolean): Promise<PackageMeta> {
  const filepath = path.resolve(options.cwd, relative)
  const raw = await readJSON(filepath)
  let deps: RawDependency[] = []

  if (options.prod) {
    deps = parseDependencies(raw, 'dependencies', shouldUpdate)
  }
  else if (options.dev) {
    deps = parseDependencies(raw, 'devDependencies', shouldUpdate)
  }
  else {
    deps = [
      ...parseDependencies(raw, 'dependencies', shouldUpdate),
      ...parseDependencies(raw, 'devDependencies', shouldUpdate),
      ...parseDependencies(raw, 'optionalDependencies', shouldUpdate),
    ]
  }

  return {
    name: raw.name,
    version: raw.version,
    relative,
    filepath,
    raw,
    deps,
    resolved: [],
  }
}

export async function loadPackages(options: CommonOptions) {
  let packagesNames: string[] = []

  const filter = createDependenciesFilter(options.include, options.exclude)

  if (options.recursive) {
    packagesNames = await fg('**/package.json', {
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/public/**',
      ],
      cwd: options.cwd,
      onlyFiles: true,
    })
  }
  else {
    packagesNames = ['package.json']
  }

  const packages = await Promise.all(
    packagesNames.map(
      relative => loadPackage(relative, options, filter),
    ),
  )

  return packages
}
