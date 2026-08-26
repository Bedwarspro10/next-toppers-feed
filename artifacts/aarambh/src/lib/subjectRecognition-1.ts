// Automatic subject + chapter recognition for the Firestore course-scanner content.
// Pure functions only — no Firestore access here (see lib/courseEngine.ts).

export type SubjectId = "maths" | "science" | "sst" | "english" | "hindi" | "other";

const SUBJECT_KEYWORDS: Record<Exclude<SubjectId, "other">, string[]> = {
  maths: ["math", "maths", "mathematics"],
  science: ["science"],
  sst: ["social science", "sst", "social studies"],
  english: ["english"],
  hindi: ["hindi"],
};

// All 5 core subjects are free to open — nothing is locked at the subject-entry level anymore.
// ("it" / "ai" aren't part of this course-content system at all, see Subjects.tsx.)
export const FREE_SUBJECTS: SubjectId[] = ["english", "hindi", "science", "maths", "sst"];

export function isFreeSubject(subject: string): boolean {
  return (FREE_SUBJECTS as string[]).includes(subject);
}

// Within science / maths / sst, PDFs & other files are free but lecture (HLS/m3u8) content
// stays behind premium. English & Hindi remain fully free, lectures included.
export const LECTURE_LOCKED_SUBJECTS: SubjectId[] = ["science", "maths", "sst"];

export function isLectureLockedSubject(subject: string): boolean {
  return (LECTURE_LOCKED_SUBJECTS as string[]).includes(subject);
}

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Classify a folder/course title into one of the known subjects. */
export function classifySubject(title: string): SubjectId {
  const t = normalize(title);
  if (!t) return "other";
  // Longer/more specific keywords first so "social science" beats a stray "science" match.
  const order: Exclude<SubjectId, "other">[] = ["sst", "science", "maths", "english", "hindi"];
  for (const subject of order) {
    if (SUBJECT_KEYWORDS[subject].some((k) => t.includes(k))) return subject;
  }
  return "other";
}

/* ─── fixed chapter orders (used for sorting only, not filtering) ───────── */

export const SCIENCE_CHAPTERS = [
  "Chemical Reactions and Equations", "Acids, Bases and Salts", "Metals and Non-metals",
  "Carbon and its Compounds", "Life Processes", "Control and Coordination",
  "How do Organisms Reproduce?", "Heredity", "Light – Reflection and Refraction",
  "The Human Eye and the Colourful World", "Electricity", "Magnetic Effects of Electric Current",
  "Our Environment",
];

export const MATHS_CHAPTERS = [
  "Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables", "Quadratic Equations",
  "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Introduction to Trigonometry",
  "Some Applications of Trigonometry", "Circles", "Areas Related to Circles", "Surface Areas and Volumes",
  "Statistics", "Probability", "Appendix A1 — Proofs in Mathematics", "Appendix A2 — Mathematical Modelling",
];

export const SST_CHAPTERS = [
  "The Rise of Nationalism in Europe", "Nationalism in India", "The Making of a Global World",
  "The Age of Industrialisation", "Print Culture and the Modern World",
  "Resources and Development", "Forest and Wildlife Resources", "Water Resources", "Agriculture",
  "Minerals and Energy Resources", "Manufacturing Industries", "Lifelines of National Economy",
  "Power Sharing", "Federalism", "Gender, Religion and Caste", "Political Parties", "Outcomes of Democracy",
  "Development", "Sectors of the Indian Economy", "Money and Credit", "Globalisation and the Indian Economy",
  "Consumer Rights",
  "Introduction", "Tsunami: The Killer Sea Wave", "Survival Skills",
  "Alternative Communication Systems During Disasters", "Safe Construction Practices",
  "Sharing Responsibility", "Planning Ahead",
];

export const ENGLISH_CHAPTERS = [
  "A Letter to God", "Nelson Mandela: Long Walk to Freedom", "Two Stories About Flying",
  "From the Diary of Anne Frank", "Glimpses of India", "Mijbil the Otter", "Madam Rides the Bus",
  "The Sermon at Benares", "The Proposal",
  "Dust of Snow", "Fire and Ice", "A Tiger in the Zoo", "How to Tell Wild Animals", "The Ball Poem",
  "Amanda", "The Trees", "Fog", "The Tale of Custard the Dragon", "For Anne Gregory",
  "A Triumph of Surgery", "The Thief's Story", "The Midnight Visitor", "A Question of Trust",
  "Footprints Without Feet", "The Making of a Scientist", "The Necklace", "Bholi",
  "The Book That Saved The Earth",
];

const CHAPTER_ORDER_BY_SUBJECT: Record<string, string[]> = {
  science: SCIENCE_CHAPTERS,
  maths: MATHS_CHAPTERS,
  sst: SST_CHAPTERS,
  english: ENGLISH_CHAPTERS,
};

/**
 * Fuzzy-match a folder/chapter title against the known chapter list for a subject.
 * Returns the canonical chapter name, or null if there's no confident match
 * (caller should fall back to "Other / Unclassified" rather than guessing).
 */
export function matchKnownChapter(subject: string, title: string): string | null {
  const list = CHAPTER_ORDER_BY_SUBJECT[subject];
  if (!list) return null;
  const t = normalize(title);
  const tTokens = new Set(t.split(" ").filter((w) => w.length > 2));
  let best: { chapter: string; score: number } | null = null;
  for (const chapter of list) {
    const cTokens = normalize(chapter).split(" ").filter((w) => w.length > 2);
    if (!cTokens.length) continue;
    const overlap = cTokens.filter((w) => tTokens.has(w)).length;
    const score = overlap / cTokens.length;
    if (!best || score > best.score) best = { chapter, score };
  }
  return best && best.score >= 0.5 ? best.chapter : null;
}

/** Sort order index for a canonical chapter name within its subject (999 = unclassified, goes last). */
export function chapterOrderIndex(subject: string, canonicalChapter: string): number {
  const list = CHAPTER_ORDER_BY_SUBJECT[subject];
  if (!list) return 999;
  const idx = list.indexOf(canonicalChapter);
  return idx === -1 ? 999 : idx;
}
