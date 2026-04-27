/**
 * Post-translation quality validation.
 *
 * Runs a set of heuristic checks against the source text and translated
 * output.  Warnings are stored in the `quality_warnings` JSONB column
 * so they can be surfaced in the reader UI or admin views without
 * blocking delivery of the translation.
 */

export interface QualityWarning {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface ValidationInput {
  sourceText: string;
  translatedText: string;
  chunkCount: number | null;
  confirmedTerms?: Array<{ termJa: string; termKo: string }>;
}

/**
 * Run all quality checks and return an array of warnings (empty = clean).
 */
export function validateTranslation(input: ValidationInput): QualityWarning[] {
  const warnings: QualityWarning[] = [];

  // 1. Empty output
  if (!input.translatedText.trim()) {
    warnings.push({
      code: "EMPTY_OUTPUT",
      message: "Translation output is empty",
      severity: "error",
    });
    return warnings; // No point running further checks
  }

  // 2. Length ratio check — Korean output is typically 0.6–1.8x the Japanese source length
  const ratio = input.translatedText.length / input.sourceText.length;
  if (ratio < 0.5) {
    warnings.push({
      code: "SUSPICIOUSLY_SHORT",
      message: `Translation is ${Math.round(ratio * 100)}% of source length (expected ≥50%)`,
      severity: "warning",
    });
  } else if (ratio > 2.0) {
    warnings.push({
      code: "SUSPICIOUSLY_LONG",
      message: `Translation is ${Math.round(ratio * 100)}% of source length (expected ≤200%)`,
      severity: "warning",
    });
  }

  // 3. Untranslated Japanese segments — detect large runs of hiragana/katakana/kanji
  const japaneseRuns = input.translatedText.match(
    /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]{10,}/g,
  );
  if (japaneseRuns && japaneseRuns.length > 0) {
    warnings.push({
      code: "UNTRANSLATED_SEGMENTS",
      message: `Found ${japaneseRuns.length} untranslated Japanese segment(s) (≥10 chars each)`,
      severity: "warning",
    });
  }

  // 4. Paragraph count mismatch — translated text should roughly match source paragraph count
  const sourceParagraphs = input.sourceText.split(/\n\n+/).filter(Boolean).length;
  const translatedParagraphs = input.translatedText.split(/\n\n+/).filter(Boolean).length;
  if (sourceParagraphs > 0 && translatedParagraphs > 0) {
    const paragraphRatio = translatedParagraphs / sourceParagraphs;
    if (paragraphRatio < 0.7 || paragraphRatio > 1.5) {
      warnings.push({
        code: "PARAGRAPH_COUNT_MISMATCH",
        message: `Source has ${sourceParagraphs} paragraphs, translation has ${translatedParagraphs}`,
        severity: "warning",
      });
    }
  }

  // 5. Truncation detection — output ends mid-sentence.
  // Strip trailing whitespace + closing quotes/brackets/parens before
  // looking at the final character. Web-novel tails like
  //   「……쿠우」
  //   (계속)
  // legitimately end on a syllable that the earlier strict last-50-chars
  // regex treated as truncation.
  const trimmedTail = input.translatedText
    .replace(/[\s」』）\)\]】〕〉》​]+$/u, "");
  // Match a deliberate ending in the LAST few characters of the cleaned
  // tail, not anywhere in the last 50. Korean verbs end in 다/요/지/까/네/군
  // (occasionally 자/임/음/됨/함), plus standard punctuation, ellipsis,
  // dashes, or the conventional closing markers.
  const lastFew = trimmedTail.slice(-3);
  const hasSentenceEnding =
    /[다요죠지까네군자임음됨함\.\!\?。…—–]/.test(lastFew) ||
    /계속$/.test(trimmedTail) || // "(계속)" = "(continued)"
    /끝$/.test(trimmedTail);
  if (!hasSentenceEnding && input.translatedText.length > 100) {
    warnings.push({
      code: "POSSIBLE_TRUNCATION",
      message: "Translation may be truncated (no sentence-ending punctuation found near end)",
      severity: "warning",
    });
  }

  // 6. Glossary compliance — check confirmed terms appear in translation
  if (input.confirmedTerms) {
    const missed: string[] = [];
    for (const term of input.confirmedTerms) {
      if (input.sourceText.includes(term.termJa) && !input.translatedText.includes(term.termKo)) {
        missed.push(term.termJa);
      }
    }
    if (missed.length > 0) {
      warnings.push({
        code: "GLOSSARY_MISMATCH",
        message: `${missed.length} glossary term(s) not found in translation: ${missed.slice(0, 5).join(", ")}`,
        severity: "info",
      });
    }
  }

  // 7. Chunk boundary artifacts — look for repeated sentences at chunk boundaries
  if (input.chunkCount && input.chunkCount > 1) {
    const lines = input.translatedText.split("\n").filter(Boolean);
    let duplicateCount = 0;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].length > 20 && lines[i] === lines[i - 1]) {
        duplicateCount++;
      }
    }
    if (duplicateCount > 0) {
      warnings.push({
        code: "CHUNK_DUPLICATE_LINES",
        message: `Found ${duplicateCount} consecutive duplicate line(s), possibly from chunk boundary overlap`,
        severity: "warning",
      });
    }
  }

  return warnings;
}
