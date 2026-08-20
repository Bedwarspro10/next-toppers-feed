// Reads courses/{courseId}/content from Firestore (written by the external scanner APK),
// builds an in-memory folder/chapter tree, and adapts it into the exact shape
// SubjectDetail.tsx already renders (Folder / FileDoc / LectureDoc), so no new UI
// or player is needed — course content just becomes another data source.
//
// The UI must never show courseId / entityId / parentId / Firestore / raw URLs —
// this file is the only place those fields are touched; everything it returns
// is already human-friendly.

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { classifySubject, isFreeSubject, matchKnownChapter, chapterOrderIndex } from "@/lib/subjectRecognition";

interface RawContentDoc {
  courseId: string;
  entityId: string;
  parentId: string;
  title: string;
  type: "file" | "folder";
  isFolder: boolean;
  fileType: string;
  resolvedUrl: string;
  status: "resolved" | "pending" | "failed" | string;
  updatedAt: number;
}

interface TreeNode extends RawContentDoc {
  children: TreeNode[];
}

/** Shapes matching SubjectDetail.tsx's existing Folder / FileDoc / LectureDoc types. */
export interface CourseFolder {
  id: string; name: string; subject: string; order: number; parentFolderId?: string;
}
export interface CourseFileResource {
  kind: "file"; id: string; name: string; link: string; folderId?: string;
  subject: string; type?: string; category?: string; order: number; isPremium?: boolean;
}
export interface CourseLectureResource {
  kind: "lecture"; id: string; title: string; hlsUrl?: string; folderId?: string;
  subject: string; category?: string; order: number; isPremium?: boolean;
}
export type CourseResource = CourseFileResource | CourseLectureResource;

export interface SubjectCourseData {
  folders: CourseFolder[];                          // chapter-level "folders" (synthetic root = the subject itself, not included)
  resourcesByFolder: Record<string, CourseResource[]>; // keyed by folder id
  generalResources: CourseResource[];                // files/lectures with no recognized chapter
}

/* ─── low-level fetch + tree build (one read per course, then cached) ───── */

const rawCache = new Map<string, RawContentDoc[]>();
const courseListCache = { value: null as string[] | null };

function normTitle(t: string): string {
  return (t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Same-parent + same-normalized-title + same entityId collisions are deduped by resolution quality. */
function dedupe(docs: RawContentDoc[]): RawContentDoc[] {
  const rank = (d: RawContentDoc) => {
    if (d.status === "resolved" && d.resolvedUrl) return 3;
    if (d.resolvedUrl) return 2;
    if (d.status === "resolved") return 1;
    return 0;
  };
  const byEntity = new Map<string, RawContentDoc>();
  for (const d of docs) {
    const existing = byEntity.get(d.entityId);
    if (!existing) { byEntity.set(d.entityId, d); continue; }
    const keepNew = rank(d) > rank(existing) || (rank(d) === rank(existing) && d.updatedAt > existing.updatedAt);
    byEntity.set(d.entityId, keepNew ? d : existing);
  }
  return Array.from(byEntity.values());
}

async function fetchCourseRaw(courseId: string, force = false): Promise<RawContentDoc[]> {
  if (!force && rawCache.has(courseId)) return rawCache.get(courseId)!;
  const snap = await getDocs(collection(db, "courses", courseId, "content"));
  const docs = dedupe(snap.docs.map((d) => d.data() as RawContentDoc));
  rawCache.set(courseId, docs);
  return docs;
}

async function listCourseIds(force = false): Promise<string[]> {
  if (!force && courseListCache.value) return courseListCache.value;
  try {
    const snap = await getDocs(collection(db, "courses"));
    const ids = snap.docs.map((d) => d.id);
    courseListCache.value = ids;
    return ids;
  } catch {
    return [];
  }
}

function buildTree(docs: RawContentDoc[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  docs.forEach((d) => nodes.set(d.entityId, { ...d, children: [] }));
  const roots: TreeNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && node.parentId !== "0" && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function isHls(url: string, fileType: string): boolean {
  return fileType === "video" || url.toLowerCase().split("?")[0].endsWith(".m3u8");
}
function isPdf(url: string, fileType: string): boolean {
  return fileType === "pdf" || url.toLowerCase().split("?")[0].endsWith(".pdf");
}

/**
 * Walks every discovered course, finds subject-root folders (folders whose title
 * classifies to a known subject), and flattens everything beneath them into the
 * chapter/resource shape the existing SubjectDetail.tsx page already renders.
 * One Firestore read per course; results are cached until refreshRequested=true.
 */
export async function getCourseDataForSubject(subject: string, refresh = false): Promise<SubjectCourseData> {
  const folders: CourseFolder[] = [];
  const resourcesByFolder: Record<string, CourseResource[]> = {};
  const generalResources: CourseResource[] = [];
  const seenChapter = new Map<string, string>(); // canonical/derived chapter name -> synthetic folder id

  const courseIds = await listCourseIds(refresh);

  for (const courseId of courseIds) {
    const raw = await fetchCourseRaw(courseId, refresh);
    if (raw.some((d) => d.status === "failed")) {
      // non-fatal — failed docs are simply skipped below
    }
    const tree = buildTree(raw);

    // Find every folder anywhere in the tree that classifies as this subject.
    const subjectRoots: TreeNode[] = [];
    const visit = (node: TreeNode) => {
      if (node.isFolder && classifySubject(node.title) === subject) subjectRoots.push(node);
      node.children.forEach(visit);
    };
    tree.forEach(visit);

    for (const root of subjectRoots) {
      // Direct children of the subject folder are treated as chapters.
      // If a child is itself a folder, it's the chapter folder; its files/lectures
      // (and anything nested deeper) are flattened into that chapter.
      for (const child of root.children) {
        const chapterTitle = child.title;
        const canonical = matchKnownChapter(subject, chapterTitle) ?? chapterTitle;
        let folderId = seenChapter.get(canonical);
        if (!folderId) {
          folderId = `course_${subject}_${courseId}_${child.entityId}`;
          seenChapter.set(canonical, folderId);
          folders.push({
            id: folderId,
            name: canonical,
            subject,
            order: chapterOrderIndex(subject, canonical),
          });
          resourcesByFolder[folderId] = [];
        }

        const collectFiles = (node: TreeNode) => {
          if (!node.isFolder && node.status === "resolved" && node.resolvedUrl) {
            const premium = !isFreeSubject(subject);
            if (isHls(node.resolvedUrl, node.fileType)) {
              resourcesByFolder[folderId!].push({
                kind: "lecture", id: node.entityId, title: node.title, hlsUrl: node.resolvedUrl,
                folderId, subject, order: 999, isPremium: premium,
              });
            } else if (isPdf(node.resolvedUrl, node.fileType)) {
              resourcesByFolder[folderId!].push({
                kind: "file", id: node.entityId, name: node.title, link: node.resolvedUrl,
                folderId, subject, category: "pdf", order: 999, isPremium: premium,
              });
            }
            // Unresolved/pending/failed docs are intentionally skipped — no broken links shown.
          }
          node.children.forEach(collectFiles);
        };
        if (child.isFolder) child.children.forEach(collectFiles);
        else collectFiles(child); // a lone file directly under the subject with no chapter folder
      }

      // Files/lectures placed directly under the subject root with no chapter folder at all.
      // (child.isFolder === false handled above via collectFiles fallback; nothing else to do here.)
    }
  }

  folders.sort((a, b) => a.order - b.order);
  return { folders, resourcesByFolder, generalResources };
}

export function refreshCourseCache() {
  rawCache.clear();
  courseListCache.value = null;
}
