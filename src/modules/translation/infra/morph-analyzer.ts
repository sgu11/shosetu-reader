import path from "node:path";
import kuromoji, { type IpadicFeatures, type Tokenizer } from "kuromoji";

export interface MorphCandidate {
  term: string;
  frequency: number;
  category: "character" | "place" | "term" | "skill" | "honorific" | "unknown";
  reading: string | null;
}

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null;

function resolveDictPath(): string {
  return path.join(process.cwd(), "node_modules", "kuromoji", "dict");
}

function buildTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  return new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: resolveDictPath() })
      .build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
  });
}

async function getTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  if (!tokenizerPromise) tokenizerPromise = buildTokenizer();
  return tokenizerPromise;
}

const STOPWORD_CATEGORIES = new Set([
  "代名詞",
  "非自立",
  "接尾",
  "数",
]);

function classifyToken(t: IpadicFeatures): MorphCandidate["category"] | null {
  if (t.pos !== "名詞") return null;
  if (t.pos_detail_1 && STOPWORD_CATEGORIES.has(t.pos_detail_1)) return null;

  if (t.pos_detail_1 === "固有名詞") {
    switch (t.pos_detail_2) {
      case "人名":
        return "character";
      case "地域":
        return "place";
      default:
        return "term";
    }
  }

  // Katakana-only noun → likely skill/magic/loanword name in web novels
  if (/^[゠-ヿー]{2,}$/.test(t.surface_form)) return "skill";

  // Kanji-only compound noun (2-4 chars) → likely glossary-worthy term
  if (/^[一-鿿]{2,4}$/.test(t.surface_form)) return "term";

  return null;
}

/**
 * Tokenize multiple JP texts and return frequency-ranked glossary candidates.
 * Uses kuromoji IPADIC POS tags to identify proper nouns, skills, terms.
 */
export async function mineCandidates(
  texts: string[],
  opts: { topN?: number; minFrequency?: number } = {},
): Promise<MorphCandidate[]> {
  const topN = opts.topN ?? 80;
  const minFrequency = opts.minFrequency ?? 2;
  if (texts.length === 0) return [];

  const tokenizer = await getTokenizer();
  const counts = new Map<
    string,
    { freq: number; category: MorphCandidate["category"]; reading: string | null }
  >();

  for (const text of texts) {
    if (!text) continue;
    const tokens = tokenizer.tokenize(text);
    for (const token of tokens) {
      const category = classifyToken(token);
      if (!category) continue;
      const surface = token.surface_form;
      if (surface.length < 2) continue;
      const existing = counts.get(surface);
      if (existing) {
        existing.freq += 1;
      } else {
        counts.set(surface, {
          freq: 1,
          category,
          reading: token.reading ?? null,
        });
      }
    }
  }

  const ranked: MorphCandidate[] = [];
  for (const [term, info] of counts) {
    if (info.freq < minFrequency) continue;
    ranked.push({
      term,
      frequency: info.freq,
      category: info.category,
      reading: info.reading,
    });
  }

  ranked.sort((a, b) => b.frequency - a.frequency || a.term.localeCompare(b.term));
  return ranked.slice(0, topN);
}

/**
 * Preload tokenizer to warm the IPADIC dictionary cache.
 * Safe to call at worker boot. Returns silently on failure.
 */
export async function warmMorphAnalyzer(): Promise<void> {
  try {
    await getTokenizer();
  } catch {
    // dict unavailable; mineCandidates() will retry lazily
  }
}
