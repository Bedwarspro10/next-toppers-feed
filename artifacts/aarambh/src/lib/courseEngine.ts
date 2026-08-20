import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface CourseContentDoc {
  courseId: string;
  entityId: string;
  parentId: string;
  title: string;
  type: string;
  isFolder: boolean;
  fileType: string;
  resolvedUrl: string;
  status: "resolved" | "pending" | "failed" | string;
  updatedAt: number;
}

export interface CourseNode extends CourseContentDoc {
  children: CourseNode[];
}

const cache = new Map<string, CourseNode[]>();

const normalizeTitle = (value: string) =>
  value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function rank(doc: CourseContentDoc): number {
  if (doc.status === "resolved" && isValidUrl(doc.resolvedUrl)) return 4;
  if (isValidUrl(doc.resolvedUrl)) return 3;
  if (doc.status === "resolved") return 2;
  if (doc.status === "failed") return 1;
  return 0;
}

function dedupe(docs: CourseContentDoc[]): CourseContentDoc[] {
  // entityId is the scanner's stable content identity. Prefer the best copy
  // when the same file appears more than once (for example unresolved + resolved).
  const byEntity = new Map<string, CourseContentDoc>();
  for (const doc of docs) {
    const existing = byEntity.get(doc.entityId);
    if (!existing || rank(doc) > rank(existing) || (rank(doc) === rank(existing) && doc.updatedAt > existing.updatedAt)) {
      byEntity.set(doc.entityId, doc);
    }
  }

  // Same-title files with DIFFERENT entity IDs are legitimate and remain.
  return [...byEntity.values()];
}
function buildTree(docs: CourseContentDoc[]): CourseNode[] {
  const nodes = new Map<string, CourseNode>();
  for (const doc of docs) {
    nodes.set(doc.entityId, { ...doc, children: [] });
  }

  const roots: CourseNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId && node.parentId !== "0" ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortNodes = (items: CourseNode[]) => {
    items.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return normalizeTitle(a.title).localeCompare(normalizeTitle(b.title));
    });
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);
  return roots;
}

export async function loadCourseTree(courseId: string, force = false): Promise<CourseNode[]> {
  if (!force && cache.has(courseId)) return cache.get(courseId)!;
  const snapshot = await getDocs(collection(db, "courses", courseId, "content"));
  const docs = snapshot.docs.map((doc) => ({
    courseId,
    entityId: String(doc.data().entityId ?? doc.id),
    parentId: String(doc.data().parentId ?? "0"),
    title: String(doc.data().title ?? "Untitled"),
    type: String(doc.data().type ?? ""),
    isFolder: Boolean(doc.data().isFolder),
    fileType: String(doc.data().fileType ?? ""),
    resolvedUrl: String(doc.data().resolvedUrl ?? ""),
    status: String(doc.data().status ?? "pending"),
    updatedAt: Number(doc.data().updatedAt ?? 0),
  })) as CourseContentDoc[];

  const tree = buildTree(dedupe(docs));
  cache.set(courseId, tree);
  return tree;
}

export async function listAvailableCourses(): Promise<string[]> {
  const snapshot = await getDocs(collection(db, "courses"));
  return snapshot.docs.map((doc) => doc.id);
}

export async function resolveDefaultCourseId(preferred = "176"): Promise<string | null> {
  const courses = await listAvailableCourses();
  if (!courses.length) return null;
  if (courses.includes(preferred)) return preferred;
  return [...courses].sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
    return b.localeCompare(a);
  })[0];
}

export function flattenCourseTree(nodes: CourseNode[]): CourseNode[] {
  const result: CourseNode[] = [];
  const walk = (items: CourseNode[]) => {
    for (const item of items) {
      result.push(item);
      walk(item.children);
    }
  };
  walk(nodes);
  return result;
}

export function ancestorChain(nodes: CourseNode[], targetId: string): CourseNode[] {
  const parentMap = new Map<string, CourseNode>();
  const byId = new Map<string, CourseNode>();
  const walk = (items: CourseNode[]) => {
    for (const item of items) {
      byId.set(item.entityId, item);
      item.children.forEach((child) => parentMap.set(child.entityId, item));
      walk(item.children);
    }
  };
  walk(nodes);
  const target = byId.get(targetId);
  if (!target) return [];

  const chain: CourseNode[] = [];
  let current: CourseNode | undefined = target;
  while (current) {
    chain.unshift(current);
    current = parentMap.get(current.entityId);
  }
  return chain;
}

export function clearCourseCache(courseId?: string) {
  if (courseId) cache.delete(courseId);
  else cache.clear();
}
