import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useBot } from "@/contexts/BotContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/contexts/PremiumContext";
import { X, Send, Sparkles, ChevronRight, RotateCcw } from "lucide-react";

/* ──────────────────────────────────────────────────────────
   TYPES
────────────────────────────────────────────────────────── */
interface BotMessage {
  id: string;
  from: "bot" | "user";
  text: string;
  actions?: BotAction[];
  typing?: boolean;
}

interface BotAction {
  label: string;
  icon?: string;
  href?: string;
  query?: string;
}

interface SiteIndex {
  subjects: Array<{ id: string; name: string; slug: string }>;
  folders: Array<{ id: string; name: string; subject: string }>;
  announcements: Array<{ id: string; title: string }>;
  loaded: boolean;
}

/* ──────────────────────────────────────────────────────────
   ROMAN HINDI → SEMANTIC ENGLISH MAPPING
────────────────────────────────────────────────────────── */
const RH_PHRASES: [RegExp, string][] = [
  [/nhi\s+mil\s+raha|nahi\s+mil\s+raha|nhi\s+mila|nahi\s+mila/gi, "cannot find help"],
  [/samaj\s+nahi|samajh\s+nahi|pata\s+nahi|kuch\s+nahi\s+mila|kuch\s+samajh\s+nahi/gi, "help confused"],
  [/admin\s+se\s+baat|baat\s+karna\s+hai|admin\s+ko\s+msg|sir\s+se\s+baat|teacher\s+se\s+baat/gi, "contact admin"],
  [/group\s+chat\s+kholo|community\s+chat\s+kholo|sabse\s+baat|sab\s+log\s+chat/gi, "community chat open"],
  [/private\s+msg\s+open|private\s+chat\s+open|dm\s+open|private\s+msg|kisi\s+ko\s+msg/gi, "private chat open"],
  [/kya\s+chal\s+raha|kya\s+hua|latest\s+update|koi\s+update|koi\s+khabar|naya\s+kya/gi, "announcements latest"],
  [/youtube\s+wala\s+video|yt\s+pe\s+dekh|video\s+dekh|lecture\s+video|video\s+lectures/gi, "youtube video"],
  [/real\s+numb[ae]r/gi, "maths realnumber chapter"],
  [/\bch\s*(\d+)\b|\bchap\s*(\d+)\b|\bchapter\s*(\d+)\b/gi, "chapter$1$2$3"],
  [/kaise\s+use\s+kare|kaise\s+chalaye|help\s+chahiye|kaise\s+kaam\s+karta/gi, "help guide"],
  [/sign\s+in\s+kaise|login\s+kaise|account\s+banana|register\s+kaise/gi, "login help"],
  [/mujhe\s+samajh\s+nahi|kuch\s+nahi\s+samjha|confused\s+hoon/gi, "help confused"],
];

const RH_WORDS: Record<string, string> = {
  kaha:"find where", kahan:"find where", kahi:"find where",
  chahiye:"need want", chaiye:"need want", chahie:"need want", chaeiye:"need want",
  kholo:"open", kholdo:"open", khol:"open",
  dikhao:"show", dikha:"show", bata:"tell show", batao:"tell show",
  dhoondh:"find search", dhundh:"find search", dhundho:"find search", dhoondo:"find search",
  milao:"find get", milega:"find", mile:"found",
  dekho:"view see", dekhna:"view see", dekh:"view",
  padhna:"lecture study", padh:"study read", padhai:"study lecture",
  lao:"get bring", laao:"get bring",
  de:"give get", dedo:"give get",
  nhi:"not", nahi:"not", nahin:"not", nhii:"not",
  ganit:"maths", gaanit:"maths",
  vigyan:"science",
  itihas:"history sst", bhugol:"geography sst",
  angrezi:"english", angrejhi:"english",
  vyakaran:"hindi grammar",
  rasayan:"chemistry science", bhautiki:"physics science",
  jeev:"biology science",
  samajik:"sst social", nagarik:"civics sst",
  nauts:"notes", nots:"notes", notts:"notes",
  modul:"module", moduel:"module",
  lec:"lecture", lectur:"lecture",
  assignmnt:"assignment", assinment:"assignment",
  testt:"test", tset:"test",
  annoucement:"announcements", anouncement:"announcements", anncouncement:"announcements",
  suchna:"announcements notice",
  madat:"help support",
  mujhe:"i need", mujhko:"i need", hume:"we need",
  wala:"type related", wali:"type related", vale:"type related",
  bhai:"hey", bro:"hey", yaar:"hey", dost:"hey",
  namaste:"hello", namaskar:"hello",
  kya:"what", kaise:"how", konsa:"which", konse:"which",
  sab:"all", sabhi:"all",
  aur:"and", ya:"or",
  ke:"", ka:"", ki:"", ko:"", se:"", mein:"in", pe:"on",
  yeh:"this", ye:"this", woh:"that",
  hi:"hey hello",
  sir:"admin teacher", madam:"admin teacher",
  kal:"yesterday tomorrow", aaj:"today",
  abhi:"now", jaldi:"fast quick",
  thoda:"little", bahut:"very much",
  accha:"good ok", theek:"ok fine",
  samjhao:"explain",
  upload:"upload file",
  naya:"new latest", purana:"old previous",
};

function applyRomanHindi(raw: string): string {
  let s = raw.toLowerCase().replace(/[^\w\s]/g, " ");
  for (const [re, rep] of RH_PHRASES) s = s.replace(re, rep);
  const tokens = s.split(/\s+/);
  const mapped = tokens.map((t) => RH_WORDS[t] ?? t);
  return mapped.join(" ").replace(/\s+/g, " ").trim();
}

function normalize(text: string): string {
  return applyRomanHindi(text)
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ──────────────────────────────────────────────────────────
   FUZZY MATCHING
────────────────────────────────────────────────────────── */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatch(word: string, target: string): boolean {
  if (target.includes(word) || word.includes(target)) return true;
  if (word.length < 3) return word === target;
  const maxDist = word.length <= 4 ? 1 : word.length <= 7 ? 2 : 3;
  return levenshtein(word, target) <= maxDist;
}

function containsFuzzy(norm: string, keywords: string[]): boolean {
  const words = norm.split(" ");
  return keywords.some((kw) =>
    norm.includes(kw) || words.some((w) => fuzzyMatch(w, kw)),
  );
}

/* ──────────────────────────────────────────────────────────
   INTENT + SUBJECT EXTRACTION
────────────────────────────────────────────────────────── */
type SubjectSlug = "maths" | "science" | "sst" | "english" | "hindi" | "it" | "ai" | null;
type ResourceType = "dpp" | "notes" | "lecture" | "pdf" | "module" | "assignment" | "test" | null;

type Intent =
  | "greeting" | "help" | "confused"
  | "subject" | "dpp" | "notes" | "lecture" | "pdf" | "module" | "assignment" | "test"
  | "youtube" | "announcements"
  | "chat_community" | "chat_private"
  | "contact" | "login" | "admin" | "subjects_list"
  | "premium_status" | "premium_upgrade"
  | "test_history" | "payment"
  | "unknown";

interface UserCtx { isGuest: boolean; isPremium: boolean; }

interface ParsedQuery {
  intent: Intent;
  subject: SubjectSlug;
  resource: ResourceType;
  chapter: string | null;
  raw: string;
  norm: string;
}

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  maths:   ["maths", "math", "mathematics", "ganit", "gaanit", "algebra", "geometry", "trigonometry", "calculus", "realnumber", "arithmetic", "number"],
  science: ["science", "vigyan", "physics", "chemistry", "biology", "rasayan", "bhautiki", "jeev", "ncert science", "lab", "experiment"],
  sst:     ["sst", "social", "history", "geography", "civics", "economics", "political", "itihas", "bhugol", "samajik", "nagarik", "geo", "hist"],
  english: ["english", "grammar", "essay", "poem", "prose", "literature", "angrezi", "angrejhi", "comprehension", "writing"],
  hindi:   ["hindi", "vyakaran", "nibandh", "kavita", "gadya", "rachna"],
  it:      ["information technology", "it", "computer", "computers", "networking", "software", "hardware", "digital", "coding", "programming", "database", "internet", "cyber", "technology"],
  ai:      ["artificial intelligence", "ai", "machine learning", "ml", "neural network", "deep learning", "bot", "chatbot", "data science", "algorithm", "automation"],
};

const RESOURCE_KEYWORDS: Record<string, string[]> = {
  dpp:        ["dpp", "daily practice", "practice problem", "worksheet", "exercise", "practice sheet", "dpi", "practice"],
  notes:      ["notes", "note", "summary", "revision", "handwritten", "brief", "nauts", "nots", "short notes", "quick notes"],
  lecture:    ["lecture", "class", "lesson", "session", "recording", "watch", "play", "lec", "padhai", "padhna", "video class", "recorded"],
  pdf:        ["pdf", "file", "document", "download", "doc"],
  module:     ["module", "booklet", "study material", "material", "modul", "book"],
  assignment: ["assignment", "homework", "hw", "task", "submission", "assignmnt", "work"],
  test:       ["test", "exam", "quiz", "mock", "paper", "question paper", "pyq", "previous year", "sample paper"],
};

function extractSubject(norm: string): SubjectSlug {
  for (const [slug, kws] of Object.entries(SUBJECT_KEYWORDS)) {
    if (containsFuzzy(norm, kws)) return slug as SubjectSlug;
  }
  return null;
}

function extractResource(norm: string): ResourceType {
  for (const [type, kws] of Object.entries(RESOURCE_KEYWORDS)) {
    if (containsFuzzy(norm, kws)) return type as ResourceType;
  }
  return null;
}

function extractChapter(raw: string): string | null {
  const m = raw.match(/\b(?:ch(?:apter)?|chapter)\s*(\d+)\b/i)
    ?? raw.match(/\b(\d+)\s*(?:wala|wali|ka|ki|ke|number|num)\b/i);
  return m ? m[1] : null;
}

function parseQuery(text: string, lastParsed: ParsedQuery | null): ParsedQuery {
  const norm = normalize(text);
  const raw = text.toLowerCase().trim();

  const subject = extractSubject(norm);
  const resource = extractResource(norm);
  const chapter = extractChapter(raw);

  let intent: Intent = "unknown";

  if (containsFuzzy(norm, ["hi", "hello", "hey", "hii", "hiya", "namaste", "namaskar", "sup", "yo", "helo", "heyy"])) {
    intent = "greeting";
  } else if (containsFuzzy(norm, ["help confused", "what can you do", "features", "guide", "help guide", "kya kar sakte", "kya milega"])) {
    intent = "help";
  } else if (containsFuzzy(norm, ["cannot find help", "help confused", "kuch nahi mila", "samajh nahi"])) {
    intent = "confused";
  } else if (containsFuzzy(norm, ["youtube", "yt", "playlist", "channel", "youtube video", "video lectures", "online class", "video class"])) {
    intent = "youtube";
  } else if (containsFuzzy(norm, ["announcements", "announcement", "notice", "update", "news", "latest", "notification", "suchna", "khabar", "naya"])) {
    intent = "announcements";
  } else if (containsFuzzy(norm, ["community chat", "group chat", "group", "community", "public chat", "everyone", "sabse baat", "general chat"])) {
    intent = "chat_community";
  } else if (containsFuzzy(norm, ["private chat", "private message", "dm", "direct message", "personal", "kisi ko msg", "private msg open"])) {
    intent = "chat_private";
  } else if (containsFuzzy(norm, ["contact", "contact admin", "message admin", "admin se baat", "teacher", "support", "query", "reach", "feedback", "sir se baat", "madam se baat"])) {
    intent = "contact";
  } else if (containsFuzzy(norm, ["login", "signin", "sign in", "register", "signup", "account", "login help"])) {
    intent = "login";
  } else if (containsFuzzy(norm, ["admin panel", "admin page", "manage", "dashboard admin"])) {
    intent = "admin";
  } else if (containsFuzzy(norm, ["all subjects", "subjects", "all chapters", "sabhi", "kya kya", "subjects list", "show subjects"])) {
    intent = "subjects_list";
  } else if (containsFuzzy(norm, ["premium status", "my membership", "mera premium", "plan active", "premium active", "kab expire", "membership", "plan status", "premium kab tak"])) {
    intent = "premium_status";
  } else if (containsFuzzy(norm, ["premium lena", "upgrade", "premium chahiye", "buy premium", "premium kaise", "membership lena", "how to get premium"])) {
    intent = "premium_upgrade";
  } else if (containsFuzzy(norm, ["test history", "my tests", "past tests", "test results", "mera result", "pichle test", "result check", "test score"])) {
    intent = "test_history";
  } else if (containsFuzzy(norm, ["payment", "paid", "payment history", "pay", "transaction", "payment kiya", "receipt", "bill", "invoice", "refund"])) {
    intent = "payment";
  } else if (resource) {
    intent = resource as Intent;
  } else if (subject) {
    intent = "subject";
  }

  const isVeryShort = raw.split(/\s+/).length <= 3;
  if (intent === "unknown" && lastParsed && isVeryShort) {
    intent = lastParsed.intent !== "unknown" ? lastParsed.intent : intent;
  }
  const resolvedSubject  = subject  ?? (isVeryShort && lastParsed ? lastParsed.subject  : null);
  const resolvedResource = resource ?? (isVeryShort && lastParsed ? lastParsed.resource : null);
  const resolvedChapter  = chapter  ?? (isVeryShort && lastParsed ? lastParsed.chapter  : null);

  return { intent, subject: resolvedSubject, resource: resolvedResource, chapter: resolvedChapter, raw, norm };
}

/* ──────────────────────────────────────────────────────────
   RESPONSE GENERATOR
────────────────────────────────────────────────────────── */
const SUBJECT_META: Record<string, { label: string; emoji: string; slug: string }> = {
  maths:   { label: "Maths",   emoji: "📐", slug: "maths" },
  science: { label: "Science", emoji: "🔬", slug: "science" },
  sst:     { label: "SST",     emoji: "🗺", slug: "sst" },
  english: { label: "English", emoji: "📖", slug: "english" },
  hindi:   { label: "Hindi",   emoji: "📜", slug: "hindi" },
  it:      { label: "Info & Tech", emoji: "💻", slug: "it" },
  ai:      { label: "AI",      emoji: "🤖", slug: "ai" },
};

const ALL_SUBJECT_ACTIONS: BotAction[] = [
  { label: "Maths",      href: "/subjects/maths" },
  { label: "Science",    href: "/subjects/science" },
  { label: "SST",        href: "/subjects/sst" },
  { label: "English",    href: "/subjects/english" },
  { label: "Hindi",      href: "/subjects/hindi" },
  { label: "Info & Tech", href: "/subjects/it" },
  { label: "AI",         href: "/subjects/ai" },
];

function resourceLabel(resource: ResourceType): string {
  const labels: Record<string, string> = {
    dpp: "DPP", notes: "Notes", lecture: "Lecture",
    pdf: "PDF", module: "Module", assignment: "Assignment", test: "Test Paper",
  };
  return resource ? (labels[resource] ?? resource) : "Resources";
}

function generateResponse(
  text: string,
  index: SiteIndex,
  lastParsed: ParsedQuery | null,
  userCtx: UserCtx = { isGuest: true, isPremium: false },
): { response: Pick<BotMessage, "text" | "actions">; parsed: ParsedQuery } {
  const parsed = parseQuery(text, lastParsed);
  const { intent, subject, resource, chapter } = parsed;

  const subMeta = subject ? SUBJECT_META[subject] : null;
  const chapterStr = chapter ? ` Ch. ${chapter}` : "";

  const respond = (text: string, actions: BotAction[]) =>
    ({ response: { text, actions }, parsed });

  switch (intent) {
    case "greeting":
      return respond(
        "Hey! Main **NextCutie-Feed** hoon. Kya chahiye? Notes, DPP, lecture, announcements — bas type karo!",
        [
          { label: "Maths", href: "/subjects/maths" },
          { label: "Science", href: "/subjects/science" },
          { label: "Updates", href: "/announcements" },
          { label: "Chat", href: "/chat" },
        ],
      );

    case "help":
      return respond(
        "Main **NextCutie-Feed** hoon — tumhara smart study bot!\n\nYeh kar sakta hoon:\n• Notes, DPP, lectures dhundhna\n• Subjects browse karna\n• Announcements check karna\n• Chat open karna\n• Admin se contact karna\n• YouTube lectures dikhana\n\nHinglish, Hindi, English — sab samajhta hoon!",
        ALL_SUBJECT_ACTIONS,
      );

    case "confused":
      return respond(
        "Koi baat nahi! Yeh dhundh rahe ho kya?",
        [
          { label: "Maths DPP", href: "/subjects/maths" },
          { label: "Science Notes", href: "/subjects/science" },
          { label: "Announcements", href: "/announcements" },
          { label: "Contact Admin", href: "/contact" },
        ],
      );

    case "subject": {
      if (!subMeta) return respond("Konsa subject?", ALL_SUBJECT_ACTIONS);
      return respond(
        `${subMeta.label}${chapterStr} section open karta hoon!`,
        [{ label: `Open ${subMeta.label}`, href: `/subjects/${subMeta.slug}` }],
      );
    }

    case "dpp": {
      if (subMeta) {
        return respond(
          `**${subMeta.label}${chapterStr} DPP** yahan milegi!`,
          [{ label: `${subMeta.label} DPP`, href: `/subjects/${subMeta.slug}` }],
        );
      }
      return respond("Kis subject ki DPP chahiye?", ALL_SUBJECT_ACTIONS);
    }

    case "notes": {
      if (subMeta) {
        return respond(
          `**${subMeta.label}${chapterStr} Notes** yahan milenge!`,
          [{ label: `${subMeta.label} Notes`, href: `/subjects/${subMeta.slug}` }],
        );
      }
      return respond("Konse subject ke notes chahiye?", ALL_SUBJECT_ACTIONS);
    }

    case "lecture": {
      if (subMeta) {
        const isPremiumSubject = ["maths", "science", "sst"].includes(subject ?? "");
        if (isPremiumSubject && !userCtx.isPremium) {
          if (userCtx.isGuest) {
            return respond(
              `**${subMeta.label} Lectures** premium content hai! Pehle sign in karo, phir membership lo — sirf ₹3/day.`,
              [
                { label: "Sign In", href: "/login" },
                { label: "Know More", href: `/subjects/${subMeta.slug}` },
              ],
            );
          }
          return respond(
            `**${subMeta.label} Lectures** sirf premium members ke liye hain.\n\n₹3/day ya ₹39/month mein upgrade karo — access milega!`,
            [
              { label: "Upgrade to Premium", href: "/dashboard" },
              { label: "View Plans", href: "/dashboard" },
            ],
          );
        }
        return respond(
          `**${subMeta.label}${chapterStr} Lectures** yahan hain!`,
          [
            { label: `${subMeta.label} Lectures`, href: `/subjects/${subMeta.slug}` },
            { label: "YouTube Videos", href: "/youtube" },
          ],
        );
      }
      return respond(
        "Kaunsa subject ka lecture chahiye?",
        [...ALL_SUBJECT_ACTIONS, { label: "YouTube", href: "/youtube" }],
      );
    }

    case "pdf": {
      if (subMeta) {
        return respond(
          `**${subMeta.label}** ke PDFs yahan milenge!`,
          [{ label: `${subMeta.label} Files`, href: `/subjects/${subMeta.slug}` }],
        );
      }
      return respond("Kaunse subject ki PDF chahiye?", ALL_SUBJECT_ACTIONS);
    }

    case "module": {
      if (subMeta) {
        return respond(
          `**${subMeta.label} Module** yahan hai!`,
          [{ label: `${subMeta.label} Module`, href: `/subjects/${subMeta.slug}` }],
        );
      }
      return respond("Kaunse subject ka module chahiye?", ALL_SUBJECT_ACTIONS);
    }

    case "assignment": {
      if (subMeta) {
        return respond(
          `**${subMeta.label} Assignment** yahan milega!`,
          [{ label: `${subMeta.label} Assignment`, href: `/subjects/${subMeta.slug}` }],
        );
      }
      return respond("Kaunse subject ka assignment?", ALL_SUBJECT_ACTIONS);
    }

    case "test": {
      if (subMeta) {
        return respond(
          `**${subMeta.label}** ke practice tests yahan milenge! Chapter tests, mocks — sab available hain.`,
          [
            { label: `${subMeta.label} Tests`, href: `/subjects/${subMeta.slug}` },
            { label: "All Practice Tests", href: "/tests" },
          ],
        );
      }
      return respond(
        "Practice Tests section mein chapter tests, mock tests aur full syllabus tests hain!",
        [
          { label: "Open Practice Tests", href: "/tests" },
          { label: "Test History", href: "/test-history" },
          ...ALL_SUBJECT_ACTIONS,
        ],
      );
    }

    case "test_history":
      return respond(
        "Tumhare pichle test results aur history yahan dekh sakte ho!",
        [{ label: "View Test History", href: "/test-history" }],
      );

    case "payment":
      if (userCtx.isGuest) {
        return respond("Payment history dekhne ke liye pehle sign in karo!", [{ label: "Sign In", href: "/login" }]);
      }
      return respond(
        "Tumhari payment history yahan dekh sakte ho. Agar koi issue hai toh admin se contact karo.",
        [
          { label: "Payment History", href: "/payments" },
          { label: "Contact Admin", href: "/contact" },
        ],
      );

    case "youtube":
      return respond(
        "YouTube section mein latest videos aur playlists hain!",
        [{ label: "Open YouTube Section", href: "/youtube" }],
      );

    case "announcements": {
      const recent = index.announcements.slice(0, 2);
      const txt = recent.length > 0
        ? `Latest:\n**${recent.map((a) => a.title).join("**\n**")}**\n\nSab dekhne ke liye:`
        : "Announcements yahan check karo!";
      return respond(txt, [{ label: "Open Announcements", href: "/announcements" }]);
    }

    case "chat_community":
      return respond(
        "Community Chat khol raha hoon!",
        [{ label: "Open Community Chat", href: "/chat" }],
      );

    case "chat_private":
      return respond(
        "Private DM ke liye Chat section mein jao!",
        [{ label: "Open Chat", href: "/chat" }],
      );

    case "contact":
      return respond(
        "Admin se baat karni hai? Contact page pe message bhejo!",
        [{ label: "Contact Admin", href: "/contact" }],
      );

    case "login":
      return respond(
        "Google se login karo — 5 seconds mein!",
        [{ label: "Sign In", href: "/login" }],
      );

    case "admin":
      return respond(
        "Admin panel (sirf admins ke liye)",
        [{ label: "Admin Panel", href: "/admin" }],
      );

    case "premium_status": {
      if (userCtx.isGuest) {
        return respond(
          "Premium status dekhne ke liye pehle sign in karo!",
          [{ label: "Sign In", href: "/login" }],
        );
      }
      if (userCtx.isPremium) {
        return respond(
          "**Tumhara Premium Active hai!** 🎉\n\nMaths, Science, SST ke saare lectures access kar sakte ho. Dashboard pe expiry date dekh sakte ho.",
          [
            { label: "Maths Lectures", href: "/subjects/maths" },
            { label: "Science Lectures", href: "/subjects/science" },
            { label: "SST Lectures", href: "/subjects/sst" },
          ],
        );
      }
      return respond(
        "Abhi tumhara premium membership nahi hai.\n\nSirf **₹3/day** ya **₹39/month** mein Science, Maths, SST ke saare lectures unlock ho jaate hain!",
        [{ label: "Upgrade Now", href: "/dashboard" }],
      );
    }

    case "premium_upgrade": {
      if (userCtx.isPremium) {
        return respond(
          "Tumhara premium already active hai! Maths, Science, SST ke lectures dekh sakte ho.",
          [
            { label: "Maths Lectures", href: "/subjects/maths" },
            { label: "Science Lectures", href: "/subjects/science" },
          ],
        );
      }
      return respond(
        "**Premium Plans:**\n• ₹3/day — Daily Access\n• ₹39/month — Monthly Access\n\nDono plans mein Science, Maths, SST ke saare premium lectures milte hain!",
        [{ label: userCtx.isGuest ? "Sign In First" : "Get Premium", href: userCtx.isGuest ? "/login" : "/dashboard" }],
      );
    }

    case "subjects_list": {
      const extra = index.subjects
        .filter((s) => !Object.keys(SUBJECT_META).includes(s.slug))
        .map((s) => ({ label: s.name, href: `/subjects/${s.slug}` }));
      return respond(
        "Yahan sab subjects hain! Kaunsa open karna hai?",
        [...ALL_SUBJECT_ACTIONS, ...extra],
      );
    }

    default: {
      const folderMatch = index.folders.find((f) =>
        containsFuzzy(parsed.norm, normalize(f.name).split(" ").filter((w) => w.length > 2)),
      );
      if (folderMatch) {
        return respond(
          `Lagta hai tum **"${folderMatch.name}"** dhundh rahe ho!`,
          [{ label: folderMatch.name, href: `/subjects/${folderMatch.subject ?? ""}` }],
        );
      }

      if (lastParsed?.subject && lastParsed?.resource) {
        const lMeta = SUBJECT_META[lastParsed.subject];
        const rLabel = resourceLabel(lastParsed.resource);
        return respond(
          `**${lMeta?.label} ${rLabel}** yahan milega!`,
          [{ label: `Open ${lMeta?.label}`, href: `/subjects/${lastParsed.subject}` }],
        );
      }

      return respond(
        "Mujhe samajh nahi aaya 😅 Thoda aur clearly batao?",
        [
          { label: "Maths", href: "/subjects/maths" },
          { label: "Science", href: "/subjects/science" },
          { label: "Latest Updates", href: "/announcements" },
          { label: "Contact Admin", href: "/contact" },
        ],
      );
    }
  }
}

/* ──────────────────────────────────────────────────────────
   GENERATING ANIMATION
────────────────────────────────────────────────────────── */
const GENERATING_PHRASES = [
  "Searching resources",
  "Thinking for you",
  "Finding the match",
  "Looking it up",
  "Processing query",
];

function GeneratingIndicator() {
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const dotsTimer = setInterval(() => setDots((d) => (d + 1) % 4), 350);
    const phraseTimer = setInterval(() => setPhraseIdx((p) => (p + 1) % GENERATING_PHRASES.length), 1800);
    return () => { clearInterval(dotsTimer); clearInterval(phraseTimer); };
  }, []);

  const dotStr = ".".repeat(dots);
  const padStr = "\u00a0".repeat(3 - dots);

  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <div className="relative w-5 h-5 flex-shrink-0">
        <div className="absolute inset-0 rounded-full animate-spin"
          style={{ background: "conic-gradient(from 0deg, #8b5cf6, #ec4899, #f59e0b, #8b5cf6)", padding: "2px" }}>
          <div className="w-full h-full rounded-full" style={{ background: "rgba(15,10,30,0.95)" }} />
        </div>
        <div className="absolute inset-1 rounded-full" style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }} />
      </div>
      <span className="text-sm font-medium"
        style={{
          background: "linear-gradient(90deg, #a78bfa, #f472b6, #fb923c, #a78bfa)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          animation: "shimmerText 2s linear infinite",
        }}>
        {GENERATING_PHRASES[phraseIdx]}{dotStr}{padStr}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   RENDER RICH TEXT (bold **text**)
────────────────────────────────────────────────────────── */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────
   MAIN BOT COMPONENT — NO FLOATING BUTTON
   Trigger is in the Layout navbar (Sparkles button)
────────────────────────────────────────────────────────── */
export default function NextCutieFeedBot() {
  const [, navigate] = useLocation();
  const { open, setOpen } = useBot();
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [siteIndex, setSiteIndex] = useState<SiteIndex>({
    subjects: [], folders: [], announcements: [], loaded: false,
  });
  const lastParsedRef = useRef<ParsedQuery | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const BOT_AVATAR = "https://res.cloudinary.com/dju83xyco/image/upload/v1779035944/file_00000000ba2c720b9800a10ba5c37845_uttc2t.png";

  useEffect(() => {
    async function loadIndex() {
      try {
        const [subSnap, folderSnap, annSnap] = await Promise.all([
          getDocs(collection(db, "subjects")).catch(() => null),
          getDocs(collection(db, "lecture_folders")).catch(() => null),
          getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(5))).catch(() => null),
        ]);
        setSiteIndex({
          subjects: subSnap?.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; name: string; slug: string })) ?? [],
          folders: folderSnap?.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; name: string; subject: string })) ?? [],
          announcements: annSnap?.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; title: string })) ?? [],
          loaded: true,
        });
      } catch {
        setSiteIndex((prev) => ({ ...prev, loaded: true }));
      }
    }
    loadIndex();
  }, []);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: "welcome",
        from: "bot",
        text: "Hey! Main **NextCutie-Feed** hoon — tumhara smart study bot.\n\nKya chahiye? Notes, DPP, lectures, updates — bas type karo! Hindi/English/Hinglish sab samajhta hoon.",
        actions: [
          { label: "Maths", href: "/subjects/maths" },
          { label: "Science", href: "/subjects/science" },
          { label: "Announcements", href: "/announcements" },
          { label: "Chat", href: "/chat" },
        ],
      }]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages, isTyping, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const uid = useCallback(() => Math.random().toString(36).slice(2), []);

  const handleAction = useCallback((action: BotAction) => {
    if (action.href) { navigate(action.href); setOpen(false); }
    else if (action.query) setInput(action.query);
  }, [navigate, setOpen]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput("");
    const userMsg: BotMessage = { id: uid(), from: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    await new Promise((r) => setTimeout(r, 700 + Math.random() * 400));

    const { response, parsed } = generateResponse(trimmed, siteIndex, lastParsedRef.current, { isGuest: !user, isPremium });
    lastParsedRef.current = parsed;
    setIsTyping(false);
    setMessages((prev) => [...prev, { id: uid(), from: "bot", text: response.text, actions: response.actions }]);
  }, [siteIndex, uid, user, isPremium]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const reset = () => {
    lastParsedRef.current = null;
    setMessages([]);
    setTimeout(() => {
      setMessages([{
        id: uid(),
        from: "bot",
        text: "Nayi baat shuru karte hain! Kya chahiye?",
        actions: [
          { label: "Maths", href: "/subjects/maths" },
          { label: "Science", href: "/subjects/science" },
          { label: "Announcements", href: "/announcements" },
          { label: "Chat", href: "/chat" },
        ],
      }]);
    }, 50);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[55]"
        style={{ background: "rgba(5, 2, 18, 0.75)", backdropFilter: "blur(6px)", animation: "botFadeIn 0.25s ease forwards" }}
        onClick={() => setOpen(false)}
      />

      <div
        className="fixed inset-0 z-[56] flex flex-col overflow-hidden md:inset-4 md:rounded-3xl"
        style={{
          background: "linear-gradient(160deg, rgba(9,6,24,0.99) 0%, rgba(18,10,40,0.99) 50%, rgba(9,6,24,0.99) 100%)",
          backdropFilter: "blur(32px) saturate(2)",
          border: "1px solid rgba(139,92,246,0.25)",
          boxShadow: "0 32px 120px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)",
          animation: "botExpandIn 0.35s cubic-bezier(0.34, 1.4, 0.64, 1) forwards",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, #8b5cf6 30%, #ec4899 70%, transparent)" }} />

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 flex-shrink-0 md:px-6"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(236,72,153,0.10) 100%)", borderBottom: "1px solid rgba(139,92,246,0.15)" }}>
          <div className="relative flex-shrink-0">
            <div className="absolute -inset-1 rounded-full" style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)", opacity: 0.5, filter: "blur(6px)" }} />
            <img src={BOT_AVATAR} alt="NextCutie-Feed" className="relative w-11 h-11 rounded-full object-cover"
              style={{ boxShadow: "0 0 16px rgba(139,92,246,0.7)" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black animate-pulse" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-base font-bold leading-tight"
              style={{ background: "linear-gradient(90deg, #e2d9f3, #f9a8d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              NextCutie-Feed
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Sparkles size={10} className="text-violet-400 flex-shrink-0" />
              <p className="text-[11px] text-violet-300/80 font-medium">
                {isTyping ? "Thinking..." : "Smart Study Assistant • Online"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={reset} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 active:scale-95"
              style={{ color: "rgba(255,255,255,0.45)" }} title="New chat">
              <RotateCcw size={14} />
            </button>
            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 active:scale-95"
              style={{ color: "rgba(255,255,255,0.45)" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 md:px-8 md:py-6"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.25) transparent" }}>
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.from === "user" ? "flex-row-reverse" : "flex-row"}`}
              style={{ animation: "msgIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
              {msg.from === "bot" && (
                <img src={BOT_AVATAR} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5"
                  style={{ boxShadow: "0 0 10px rgba(139,92,246,0.5)" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <div className={`flex flex-col gap-2 max-w-[85%] md:max-w-[72%] ${msg.from === "user" ? "items-end" : "items-start"}`}>
                <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-line"
                  style={msg.from === "user" ? {
                    background: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
                    color: "white", borderRadius: "20px 20px 5px 20px",
                    boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
                  } : {
                    background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.92)",
                    border: "1px solid rgba(139,92,246,0.18)", borderRadius: "20px 20px 20px 5px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  }}>
                  <RichText text={msg.text} />
                </div>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-0.5">
                    {msg.actions.map((action, i) => (
                      <button key={i} onClick={() => handleAction(action)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
                        style={{
                          background: "linear-gradient(135deg, rgba(139,92,246,0.22) 0%, rgba(236,72,153,0.15) 100%)",
                          border: "1px solid rgba(139,92,246,0.35)", color: "rgba(255,255,255,0.92)",
                          backdropFilter: "blur(10px)", boxShadow: "0 2px 12px rgba(139,92,246,0.2)",
                        }}>
                        {action.label}
                        <ChevronRight size={11} className="text-violet-400 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3" style={{ animation: "msgIn 0.3s ease forwards" }}>
              <img src={BOT_AVATAR} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                style={{ boxShadow: "0 0 10px rgba(139,92,246,0.5)" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(139,92,246,0.18)", borderRadius: "20px 20px 20px 5px" }}>
                <GeneratingIndicator />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick chips */}
        {messages.length <= 1 && !isTyping && (
          <div className="px-4 pb-3 flex-shrink-0 md:px-8" style={{ borderTop: "1px solid rgba(139,92,246,0.08)" }}>
            <p className="text-[10px] text-violet-400/60 font-semibold uppercase tracking-widest mb-2 pt-3">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {["maths dpp", "science notes", "bio ke notes chahiye", "koi update hai", "admin se baat karni", "youtube lectures"].map((chip) => (
                <button key={chip} onClick={() => sendMessage(chip)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105 active:scale-95"
                  style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "rgba(255,255,255,0.7)" }}>
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0 md:px-8 md:py-5"
          style={{ borderTop: "1px solid rgba(139,92,246,0.12)" }}>
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Kuch bhi pucho... notes, dpp, lectures, updates"
            className="flex-1 h-12 px-4 rounded-2xl text-sm outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.22)",
              color: "rgba(255,255,255,0.92)", caretColor: "#a78bfa",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
            }} />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping}
            className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-35 disabled:scale-100 flex-shrink-0"
            style={{
              background: input.trim() && !isTyping ? "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)" : "rgba(255,255,255,0.04)",
              border: "1px solid rgba(139,92,246,0.3)",
              boxShadow: input.trim() && !isTyping ? "0 4px 16px rgba(139,92,246,0.5)" : "none",
            }}>
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes botFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes botExpandIn { from { opacity: 0; transform: scale(0.96) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes msgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmerText { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
      `}</style>
    </>
  );
}
