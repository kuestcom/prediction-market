import { searchPath } from 'fumadocs-core/breadcrumb'
import { source } from '@/lib/source'

type DocsTree = typeof source.pageTree
type DocsTreeNode = DocsTree['children'][number]

function resolveRequestedUrl(slug?: string[]): string {
  if (!slug || slug.length === 0) {
    return '/docs/users'
  }
  return `/docs/${slug.join('/')}`
}

function getRootFolderForUrl(tree: DocsTree, url: string, slug?: string[]) {
  const path = searchPath(tree.children, url)
    ?? (tree.fallback ? searchPath(tree.fallback.children, url) : null)

  const fromPath = path?.findLast(
    (node): node is Extract<DocsTreeNode, { type: 'folder' }> => (
      node.type === 'folder' && node.root === true
    ),
  )

  if (fromPath) {
    return fromPath
  }

  const topLevelSlug = slug?.[0]
  if (!topLevelSlug) {
    return null
  }

  return tree.children.find(
    (node): node is Extract<DocsTreeNode, { type: 'folder' }> => (
      node.type === 'folder'
      && node.root === true
      && node.index?.url === `/docs/${topLevelSlug}`
    ),
  ) ?? null
}

export function getDocsSidebarTree(slug?: string[]): DocsTree {
  const tree = source.pageTree
  const requestedUrl = resolveRequestedUrl(slug)
  const rootFolder = getRootFolderForUrl(tree, requestedUrl, slug)

  if (!rootFolder) {
    return tree
  }

  const children = rootFolder.index ? [rootFolder.index, ...rootFolder.children] : rootFolder.children

  return {
    ...tree,
    children,
    fallback: undefined,
  }
}
