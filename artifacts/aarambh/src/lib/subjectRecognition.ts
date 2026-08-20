export type SubjectId = "maths" | "science" | "sst" | "english" | "hindi" | "other";

export const SUBJECT_META: Record<SubjectId, { label: string; free: boolean }> = {
  maths: { label: "Mathematics", free: false },
  science: { label: "Science", free: false },
  sst: { label: "Social Science", free: false },
  english: { label: "English", free: true },
  hindi: { label: "Hindi", free: true },
  other: { label: "Other", free: false },
};

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

export const ENGLISH = {
  reading: [
    "Types of Passages & Steps to Attempt Reading Comprehension", "Solved Examples", "Exam Practice", "Self Assessment",
  ],
  writing: ["Formal Letters", "Analytical Paragraph"],
  grammar: ["Tenses", "Modals", "Subject-Verb Concord", "Reported Speech", "Determiners", "Integrated Grammar Exercises"],
  prose: [
    "A Letter to God", "Nelson Mandela: Long Walk to Freedom", "Two Stories About Flying",
    "From the Diary of Anne Frank", "Glimpses of India", "Mijbil the Otter", "Madam Rides the Bus",
    "The Sermon at Benares", "The Proposal",
  ],
  poetry: [
    "Dust of Snow", "Fire and Ice", "A Tiger in the Zoo", "How to Tell Wild Animals", "The Ball Poem",
    "Amanda", "The Trees", "Fog", "The Tale of Custard the Dragon", "For Anne Gregory",
  ],
  supplementary: [
    "A Triumph of Surgery", "The Thief's Story", "The Midnight Visitor", "A Question of Trust",
    "Footprints Without Feet", "The Making of a Scientist", "The Necklace", "Bholi", "The Book That Saved The Earth",
  ],
};

export const SST = {
  History: ["The Rise of Nationalism in Europe", "Nationalism in India", "The Making of a Global World", "The Age of Industrialisation", "Print Culture and the Modern World"],
  Geography: ["Resources and Development", "Forest and Wildlife Resources", "Water Resources", "Agriculture", "Minerals and Energy Resources", "Manufacturing Industries", "Lifelines of National Economy"],
  "Political Science": ["Power Sharing", "Federalism", "Gender, Religion and Caste", "Political Parties", "Outcomes of Democracy"],
  Economics: ["Development", "Sectors of the Indian Economy", "Money and Credit", "Globalisation and the Indian Economy", "Consumer Rights"],
  "Disaster Management": ["Introduction", "Tsunami: The Killer Sea Wave", "Survival Skills", "Alternative Communication Systems During Disasters", "Safe Construction Practices", "Sharing Responsibility", "Planning Ahead"],
};

const SUBJECT_KEYWORDS: Record<Exclude<SubjectId, "other">, string[]> = {
  maths: ["math", "maths", "mathematics"],
  science: ["science", "chemistry", "physics", "biology"],
  sst: ["social science", "social studies", "sst", "history", "geography", "economics", "political science", "civics", "disaster management"],
  english: ["english", "grammar", "prose", "poetry", "literature"],
  hindi: ["hindi", "vyakaran", "sahitya", "हिंदी"],
};

const filler = new Set(["pdf", "notes", "note", "chapter", "chapters", "ch", "class", "class10", "cbse", "ncert", "revision", "questions", "question", "worksheet", "study", "material", "materials", "the", "and", "of", "a", "an", "in", "for", "to", "part", "lesson", "l1", "l2", "l3", "lecture", "lectures"]);

export function normalize(text: string): string {
  return text.toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[-–—_,.:;!?()[\]{}"'’/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text).split(" ").filter((t) => t && !filler.has(t) && t.length > 2);
}

export function classifySubject(text: string): SubjectId {
  const t = normalize(text);
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS) as [Exclude<SubjectId, "other">, string[]][]) {
    if (keywords.some((keyword) => t.includes(normalize(keyword)))) return subject;
  }
  return "other";
}

function scoreTitle(title: string, chapter: string, context: string[] = []): number {
  const titleWords = new Set(tokens(title));
  const chapterWords = tokens(chapter);
  if (!chapterWords.length) return 0;

  let score = 0;
  for (const word of chapterWords) {
    if (titleWords.has(word)) score += 1;
    else if (word.length >= 5 && [...titleWords].some((tw) => tw.startsWith(word) || word.startsWith(tw))) score += 0.65;
  }

  const normalizedTitle = normalize(title);
  const number = normalizedTitle.match(/\b(?:chapter|ch|chap)\s*[-:.]?\s*(\d{1,2})\b/);
  if (number) {
    const chapterNumber = Number(number[1]);
    const indexGuess = chapter.match(/^\s*(\d{1,2})\./);
    if (indexGuess && Number(indexGuess[1]) === chapterNumber) score += 2.5;
  }

  const contextText = context.join(" ");
  if (contextText && normalize(contextText).includes(normalize(chapter))) score += 3;
  const contextWords = new Set(tokens(contextText));
  for (const word of chapterWords) if (contextWords.has(word)) score += 0.25;

  return score / (chapterWords.length + 1);
}

export interface ChapterMatch {
  chapter: string;
  section?: string;
  score: number;
}

export function classifyChapter(subject: SubjectId, title: string, context: string[] = []): ChapterMatch {
  const candidates: Array<{ chapter: string; section?: string }> = [];
  if (subject === "science") SCIENCE_CHAPTERS.forEach((chapter) => candidates.push({ chapter }));
  if (subject === "maths") MATHS_CHAPTERS.forEach((chapter) => candidates.push({ chapter }));
  if (subject === "english") {
    Object.entries(ENGLISH).forEach(([section, list]) => list.forEach((chapter) => candidates.push({ chapter, section })));
  }
  if (subject === "sst") Object.entries(SST).forEach(([section, list]) => list.forEach((chapter) => candidates.push({ chapter, section })));

  if (!candidates.length) return { chapter: "Other / Unclassified", score: 0 };

  let best = { chapter: "Other / Unclassified", score: 0 } as ChapterMatch;
  for (const candidate of candidates) {
    const score = scoreTitle(title, candidate.chapter, context);
    if (score > best.score) best = { ...candidate, score };
  }
  return best.score >= 0.34 ? best : { chapter: "Other / Unclassified", score: best.score };
}

export function isFreeSubject(subject: SubjectId): boolean {
  return subject === "english" || subject === "hindi";
}
