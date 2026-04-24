export interface CandidateTerm {
  termJa: string;
  termKo: string;
}

export interface TermValidationResult<T extends CandidateTerm> {
  accepted: T[];
  rejected: Array<{ term: T; reason: "missing-source" | "missing-translation" }>;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/**
 * Drop candidate terms whose term_ja is absent from the JP source text,
 * or whose term_ko is absent from the KR translation. Catches LLM
 * hallucinations and invented renderings.
 */
export function validateTermsAgainstCorpus<T extends CandidateTerm>(
  candidates: T[],
  corpus: { sourceTexts: string[]; translatedTexts: string[] },
): TermValidationResult<T> {
  const sourceBlob = corpus.sourceTexts.join("\n");
  const translatedBlob = normalize(corpus.translatedTexts.join("\n"));

  const accepted: T[] = [];
  const rejected: TermValidationResult<T>["rejected"] = [];

  for (const term of candidates) {
    const ja = term.termJa.trim();
    const ko = normalize(term.termKo);
    if (!ja || !ko) {
      rejected.push({ term, reason: "missing-source" });
      continue;
    }
    if (!sourceBlob.includes(ja)) {
      rejected.push({ term, reason: "missing-source" });
      continue;
    }
    if (!translatedBlob.includes(ko)) {
      rejected.push({ term, reason: "missing-translation" });
      continue;
    }
    accepted.push(term);
  }

  return { accepted, rejected };
}
