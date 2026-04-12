export interface TranslationRequest {
  sourceText: string;
  sourceLanguage: "ja";
  targetLanguage: "ko";
}

export interface TranslationResult {
  translatedText: string;
  provider: string;
  modelName: string;
}

export interface TranslationProvider {
  readonly provider: string;
  readonly modelName: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}
