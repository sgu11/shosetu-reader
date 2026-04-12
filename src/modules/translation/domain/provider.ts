export interface TranslationRequest {
  sourceText: string;
  sourceLanguage: "ja";
  targetLanguage: "ko";
  /** For chunked translations: tail of the previous chunk's translated output */
  previousChunkTranslation?: string;
  /** Chunk label, e.g. "2/5" — indicates this is part of a larger text */
  chunkLabel?: string;
}

export interface TranslationResult {
  translatedText: string;
  provider: string;
  modelName: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface TranslationProvider {
  readonly provider: string;
  readonly modelName: string;
  translate(request: TranslationRequest, contextSummary?: string): Promise<TranslationResult>;
}
