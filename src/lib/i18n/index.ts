import { cookies } from "next/headers";
import { dictionaries, type Locale, type TranslationKey } from "./dictionaries";

export type { Locale, TranslationKey };
export { dictionaries };

const COOKIE_NAME = "locale";
const DEFAULT_LOCALE: Locale = "en";

/** Read locale from cookies (server-side). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (value === "en" || value === "ko") return value;
  return DEFAULT_LOCALE;
}

/** Translate a key for a given locale. Supports {placeholder} interpolation. */
export function t(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  let text: string = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
