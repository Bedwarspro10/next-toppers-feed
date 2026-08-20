/**
 * MathRenderer — renders LaTeX math expressions using KaTeX.
 * Supports:
 *   - Inline math:  \( ... \)  or  $ ... $
 *   - Display math: \[ ... \]  or  $$ ... $$
 *   - Mixed content: text + math + <img> tags
 *
 * Falls back to plain text if KaTeX fails.
 */
import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/* ─── Detect if a string contains LaTeX ─────────────────── */
export function hasLatex(text: string): boolean {
  return (
    /\\\([\s\S]*?\\\)/.test(text) ||   // \( ... \)
    /\\\[[\s\S]*?\\\]/.test(text) ||   // \[ ... \]
    /\$\$[\s\S]*?\$\$/.test(text) ||   // $$ ... $$
    /\$[^$\n]+?\$/.test(text) ||        // $ ... $
    /\\(?:frac|sqrt|int|sum|lim|begin|end|left|right|cdot|times|pm|leq|geq|neq|infty|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|sin|cos|tan|log|ln|vec|hat|bar|dot|ddot|nabla|partial|overline|underline|binom|text|mathrm|mathbf|mathit|mathbb|mathcal)\b/.test(text)
  );
}

/* ─── Detect if a string contains HTML tags ─────────────── */
export function hasHtmlTags(text: string): boolean {
  return /<[a-zA-Z][^>]*>/.test(text);
}

/* ─── Render a single LaTeX token ───────────────────────── */
function renderLatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: "html",
      trust: false,
      strict: false,
      macros: {
        "\\RR": "\\mathbb{R}",
        "\\NN": "\\mathbb{N}",
        "\\ZZ": "\\mathbb{Z}",
        "\\vec": "\\overrightarrow",
      },
    });
  } catch {
    return `<code style="color:#f87171;font-size:0.85em">${latex}</code>`;
  }
}

/* ─── Parse mixed text+math string into HTML ────────────── */
export function parseMathToHtml(input: string): string {
  if (!input) return "";

  let result = input;

  // Display math: \[ ... \]
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) =>
    renderLatex(math.trim(), true),
  );

  // Display math: $$ ... $$
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) =>
    renderLatex(math.trim(), true),
  );

  // Inline math: \( ... \)
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) =>
    renderLatex(math.trim(), false),
  );

  // Inline math: $ ... $ (not $$)
  result = result.replace(/\$([^$\n]+?)\$/g, (_, math) =>
    renderLatex(math.trim(), false),
  );

  return result;
}

/* ─── Main component ─────────────────────────────────────── */
interface MathRendererProps {
  /** Raw content: may contain LaTeX delimiters, HTML tags, plain text, or any mix */
  content: string;
  className?: string;
  /** Extra inline styles on the wrapper */
  style?: React.CSSProperties;
}

export function MathRenderer({ content, className, style }: MathRendererProps) {
  const rendered = useMemo(() => {
    if (!content) return "";
    // First parse LaTeX → KaTeX HTML, then preserve existing HTML tags
    return parseMathToHtml(content);
  }, [content]);

  return (
    <span
      className={`math-renderer quiz-safe-html${className ? ` ${className}` : ""}`}
      style={{ display: "inline-block", width: "100%", minWidth: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

export default MathRenderer;
