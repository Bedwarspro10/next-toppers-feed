/* ─────────────────────────────────────────────────────────────
   Safe HTML Quiz Parser
   No eval, no script execution, uses DOMParser (browser-safe).
   Supported format:
   <quiz title="..." subject="..." duration="15" marks="10">
     <question marks="1">
       <text>Question text here? <img src="..." /></text>
       <option>A. First option</option>
       <option correct>B. Correct option <img src="..." /></option>
       <option>C. Third option</option>
       <option>D. Fourth option</option>
       <explanation>Optional explanation text</explanation>
     </question>
   </quiz>
─────────────────────────────────────────────────────────────── */

export interface ParsedOption {
  text: string;
  isCorrect: boolean;
}

export interface ParsedQuestion {
  text: string;
  options: ParsedOption[];
  explanation: string;
  marks: number;
  correctIndex: number;
  hasHtml: boolean;
}

export interface ParsedQuiz {
  title: string;
  subject: string;
  duration: number;
  totalMarks: number;
  questions: ParsedQuestion[];
  parseErrors: string[];
}

const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s", "strike", "sup", "sub",
  "br", "p", "span", "div", "img",
]);

const DANGEROUS_ATTRS = new Set([
  "onclick", "onerror", "onload", "onmouseover", "onmouseout",
  "onfocus", "onblur", "onchange", "onsubmit", "onkeydown",
  "onkeyup", "onkeypress", "srcdoc", "data",
]);

function sanitizeNode(node: Node, depth = 0): string {
  if (depth > 20) return "";
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (!ALLOWED_TAGS.has(tag)) {
    let inner = "";
    el.childNodes.forEach((child) => { inner += sanitizeNode(child, depth + 1); });
    return inner;
  }

  if (tag === "img") {
    const src = el.getAttribute("src") ?? "";
    const alt = el.getAttribute("alt") ?? "";
    if (!src) return "";
    const isBase64 = src.startsWith("data:image/");
    const isHttps = src.startsWith("https://") || src.startsWith("http://");
    const isRelative = src.startsWith("/") || src.startsWith("./");
    if (!isBase64 && !isHttps && !isRelative) return "";
    const safeSrc = src.replace(/"/g, "&quot;");
    const safeAlt = alt.replace(/"/g, "&quot;").replace(/</g, "&lt;");
    return `<img src="${safeSrc}" alt="${safeAlt}" class="quiz-img" style="max-width:100%;height:auto;border-radius:8px;margin:6px 0;display:block;object-fit:contain;" loading="lazy" />`;
  }

  const attrStr: string[] = [];
  Array.from(el.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase();
    if (DANGEROUS_ATTRS.has(name)) return;
    if (name.startsWith("on")) return;
    if (name === "style") {
      const safe = attr.value
        .split(";")
        .filter((s) => !/expression|javascript|url\s*\(/i.test(s))
        .join(";");
      if (safe) attrStr.push(`style="${safe.replace(/"/g, "&quot;")}"`);
      return;
    }
    attrStr.push(`${name}="${attr.value.replace(/"/g, "&quot;")}"`);
  });

  let inner = "";
  el.childNodes.forEach((child) => { inner += sanitizeNode(child, depth + 1); });
  const attrs = attrStr.length ? " " + attrStr.join(" ") : "";
  if (tag === "br") return "<br/>";
  return `<${tag}${attrs}>${inner}</${tag}>`;
}

function sanitizeHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  let out = "";
  div.childNodes.forEach((n) => { out += sanitizeNode(n); });
  return out.trim();
}

function getInnerHtml(el: Element): string {
  let html = "";
  el.childNodes.forEach((n) => { html += sanitizeNode(n); });
  return html.trim();
}

function hasImageTag(html: string): boolean {
  return /<img\s/i.test(html);
}

function isPlainText(html: string): boolean {
  return !/<[^>]+>/i.test(html);
}

export function parseQuizHtml(html: string): ParsedQuiz {
  const errors: string[] = [];

  const wrapped = html.trim().startsWith("<quiz") ? html.trim() : `<quiz>${html.trim()}</quiz>`;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(wrapped, "text/html");
  } catch {
    return {
      title: "Untitled Quiz", subject: "", duration: 30, totalMarks: 0,
      questions: [], parseErrors: ["Could not parse HTML."],
    };
  }

  const quizEl = doc.querySelector("quiz") ?? doc.querySelector("body");
  if (!quizEl) {
    return {
      title: "Untitled Quiz", subject: "", duration: 30, totalMarks: 0,
      questions: [], parseErrors: ["No <quiz> element found."],
    };
  }

  const title = quizEl.getAttribute("title") ?? "";
  const subject = quizEl.getAttribute("subject") ?? "";
  const durationRaw = parseInt(quizEl.getAttribute("duration") ?? "30", 10);
  const duration = isNaN(durationRaw) ? 30 : durationRaw;

  const questions: ParsedQuestion[] = [];

  quizEl.querySelectorAll("question").forEach((qEl, qi) => {
    const textEl = qEl.querySelector("text");
    let qHtml = "";
    if (textEl) {
      qHtml = getInnerHtml(textEl);
    } else {
      const attr = qEl.getAttribute("text") ?? "";
      qHtml = sanitizeHtml(attr);
    }

    if (!qHtml && !(textEl?.innerHTML?.trim())) {
      errors.push(`Question ${qi + 1}: missing <text>`);
      return;
    }

    const marksAttr = parseInt(qEl.getAttribute("marks") ?? "1", 10);
    const qMarks = isNaN(marksAttr) ? 1 : marksAttr;

    const optEls = Array.from(qEl.querySelectorAll("option"));
    if (optEls.length < 2) { errors.push(`Question ${qi + 1}: needs at least 2 options`); return; }

    const options: ParsedOption[] = optEls.map((el) => ({
      text: getInnerHtml(el),
      isCorrect: el.hasAttribute("correct"),
    }));

    const correctIndex = options.findIndex((o) => o.isCorrect);
    if (correctIndex === -1) {
      errors.push(`Question ${qi + 1}: no option has correct attribute — defaulting to first`);
      if (options.length > 0) options[0].isCorrect = true;
    }

    const explEl = qEl.querySelector("explanation");
    const explanation = explEl ? getInnerHtml(explEl) : "";

    const allHtml = qHtml + options.map((o) => o.text).join("") + explanation;
    const questionHasHtml = !isPlainText(allHtml);

    questions.push({
      text: qHtml,
      options,
      explanation,
      marks: qMarks,
      correctIndex: correctIndex === -1 ? 0 : correctIndex,
      hasHtml: questionHasHtml,
    });
  });

  const totalMarks = questions.reduce((s, q) => s + q.marks, 0)
    || parseInt(quizEl.getAttribute("marks") ?? "0", 10);

  return { title, subject, duration, totalMarks, questions, parseErrors: errors };
}
