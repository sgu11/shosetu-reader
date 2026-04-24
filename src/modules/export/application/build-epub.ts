import JSZip from "jszip";
import { and, asc, desc, eq, gte, lte, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { episodes } from "@/lib/db/schema/episodes";
import { novels } from "@/lib/db/schema/novels";
import { novelGlossaryEntries } from "@/lib/db/schema/translations";
import { translations } from "@/lib/db/schema/translations";

export type ExportLang = "ko" | "ja" | "both";

export interface BuildEpubOptions {
  novelId: string;
  lang: ExportLang;
  modelName?: string;
  from?: number;
  to?: number;
}

interface Chapter {
  id: string;
  episodeNumber: number;
  titleJa: string;
  titleKo: string | null;
  jaBody: string[];
  jaPreface: string[];
  jaAfterword: string[];
  koBody: string[];
  koPreface: string[];
  koAfterword: string[];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderParagraphs(lines: string[]): string {
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "<p>&#160;</p>";
      return `<p>${escapeXml(line)}</p>`;
    })
    .join("\n");
}

function chapterXhtml(lang: ExportLang, c: Chapter): string {
  const xmlLang = lang === "ja" ? "ja" : "ko";
  const title =
    lang === "ja" || !c.titleKo
      ? c.titleJa
      : c.titleKo;
  const parts: string[] = [];

  if (lang === "both") {
    if (c.jaPreface.length || c.koPreface.length) {
      parts.push(`<section class="preface"><h2>Preface</h2>`);
      if (c.koPreface.length) parts.push(`<div class="ko">${renderParagraphs(c.koPreface)}</div>`);
      if (c.jaPreface.length) parts.push(`<div class="ja">${renderParagraphs(c.jaPreface)}</div>`);
      parts.push(`</section>`);
    }
    parts.push(`<section class="body">`);
    if (c.koBody.length) parts.push(`<div class="ko">${renderParagraphs(c.koBody)}</div>`);
    if (c.jaBody.length) parts.push(`<div class="ja">${renderParagraphs(c.jaBody)}</div>`);
    parts.push(`</section>`);
    if (c.jaAfterword.length || c.koAfterword.length) {
      parts.push(`<section class="afterword"><h2>Afterword</h2>`);
      if (c.koAfterword.length) parts.push(`<div class="ko">${renderParagraphs(c.koAfterword)}</div>`);
      if (c.jaAfterword.length) parts.push(`<div class="ja">${renderParagraphs(c.jaAfterword)}</div>`);
      parts.push(`</section>`);
    }
  } else {
    const preface = lang === "ja" ? c.jaPreface : c.koPreface;
    const body = lang === "ja" ? c.jaBody : c.koBody;
    const afterword = lang === "ja" ? c.jaAfterword : c.koAfterword;
    if (preface.length) parts.push(`<section class="preface">${renderParagraphs(preface)}</section>`);
    parts.push(`<section class="body">${renderParagraphs(body)}</section>`);
    if (afterword.length) parts.push(`<section class="afterword">${renderParagraphs(afterword)}</section>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${xmlLang}" xml:lang="${xmlLang}">
<head>
<meta charset="utf-8"/>
<title>${escapeXml(title ?? `Chapter ${c.episodeNumber}`)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
<h1>${escapeXml(title ?? `Chapter ${c.episodeNumber}`)}</h1>
${parts.join("\n")}
</body>
</html>`;
}

function styleCss(): string {
  return `body { font-family: serif; line-height: 1.7; margin: 1em; }
h1 { font-size: 1.4em; margin: 1em 0; }
h2 { font-size: 1.1em; color: #555; margin: 1em 0 0.5em; }
p { margin: 0.5em 0; text-indent: 1em; }
section.preface, section.afterword { color: #666; font-size: 0.95em; }
section.preface::before { content: ""; display: block; border-top: 1px solid #ccc; margin: 1em 0; }
section.afterword::before { content: ""; display: block; border-top: 1px solid #ccc; margin: 1em 0; }
div.ja { border-top: 1px dashed #ccc; padding-top: 0.5em; margin-top: 1em; color: #777; }
`;
}

function containerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
</rootfiles>
</container>`;
}

function contentOpf(
  novel: { title: string; author: string | null },
  chapters: Chapter[],
  includeGlossary: boolean,
  lang: ExportLang,
  uid: string,
): string {
  const xmlLang = lang === "ja" ? "ja" : "ko";
  const manifestItems = chapters
    .map(
      (c) =>
        `<item id="chap${c.episodeNumber}" href="chapter-${c.episodeNumber}.xhtml" media-type="application/xhtml+xml"/>`,
    )
    .join("\n");
  const spineItems = chapters
    .map((c) => `<itemref idref="chap${c.episodeNumber}"/>`)
    .join("\n");
  const glossaryManifest = includeGlossary
    ? `<item id="glossary" href="glossary.xhtml" media-type="application/xhtml+xml"/>`
    : "";
  const glossarySpine = includeGlossary
    ? `<itemref idref="glossary"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="${xmlLang}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">${escapeXml(uid)}</dc:identifier>
<dc:title>${escapeXml(novel.title)}</dc:title>
<dc:language>${xmlLang}</dc:language>
${novel.author ? `<dc:creator>${escapeXml(novel.author)}</dc:creator>` : ""}
<meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="style" href="style.css" media-type="text/css"/>
${manifestItems}
${glossaryManifest}
</manifest>
<spine>
${spineItems}
${glossarySpine}
</spine>
</package>`;
}

function navXhtml(chapters: Chapter[], includeGlossary: boolean): string {
  const entries = chapters
    .map(
      (c) =>
        `<li><a href="chapter-${c.episodeNumber}.xhtml">${escapeXml(
          (c.titleKo || c.titleJa) ?? `Chapter ${c.episodeNumber}`,
        )}</a></li>`,
    )
    .join("\n");
  const glossary = includeGlossary
    ? `<li><a href="glossary.xhtml">Glossary</a></li>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><meta charset="utf-8"/><title>Contents</title></head>
<body>
<nav epub:type="toc"><h1>Contents</h1><ol>
${entries}
${glossary}
</ol></nav>
</body>
</html>`;
}

function glossaryXhtml(
  entries: Array<{ termJa: string; termKo: string; category: string; notes: string | null }>,
): string {
  const rows = entries
    .map(
      (e) => `<tr>
<td>${escapeXml(e.termJa)}</td>
<td>${escapeXml(e.termKo)}</td>
<td>${escapeXml(e.category)}</td>
<td>${escapeXml(e.notes ?? "")}</td>
</tr>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><title>Glossary</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>Glossary</h1>
<table>
<thead><tr><th>JA</th><th>KO</th><th>Category</th><th>Notes</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

export async function buildEpub(opts: BuildEpubOptions): Promise<{
  buffer: Buffer;
  filename: string;
  novelTitle: string;
  chapterCount: number;
}> {
  const db = getDb();

  const [novel] = await db
    .select()
    .from(novels)
    .where(eq(novels.id, opts.novelId))
    .limit(1);
  if (!novel) throw new Error("Novel not found");

  const epFilters = [eq(episodes.novelId, opts.novelId)];
  if (opts.from !== undefined)
    epFilters.push(gte(episodes.episodeNumber, opts.from));
  if (opts.to !== undefined)
    epFilters.push(lte(episodes.episodeNumber, opts.to));

  const epRows = await db
    .select()
    .from(episodes)
    .where(and(...epFilters))
    .orderBy(asc(episodes.episodeNumber));

  const episodeIds = epRows.map((e) => e.id);
  const trRows = episodeIds.length
    ? await db
        .select()
        .from(translations)
        .where(
          and(
            inArray(translations.episodeId, episodeIds),
            eq(translations.status, "available"),
            eq(translations.targetLanguage, "ko"),
          ),
        )
        .orderBy(desc(translations.completedAt))
    : [];

  const trByEpisode = new Map<string, typeof trRows[number]>();
  for (const tr of trRows) {
    if (opts.modelName && tr.modelName !== opts.modelName) continue;
    if (!trByEpisode.has(tr.episodeId)) trByEpisode.set(tr.episodeId, tr);
  }
  if (opts.modelName && trByEpisode.size === 0) {
    throw new Error(`No translations found for model ${opts.modelName}`);
  }

  const chapters: Chapter[] = epRows.map((ep) => {
    const tr = trByEpisode.get(ep.id);
    return {
      id: ep.id,
      episodeNumber: ep.episodeNumber,
      titleJa: ep.titleJa ?? `Chapter ${ep.episodeNumber}`,
      titleKo: null,
      jaBody: (ep.normalizedTextJa ?? "").split("\n"),
      jaPreface: (ep.prefaceJa ?? "").split("\n").filter((l) => l.length > 0 || l === ""),
      jaAfterword: (ep.afterwordJa ?? "").split("\n").filter((l) => l.length > 0 || l === ""),
      koBody: (tr?.translatedText ?? "").split("\n"),
      koPreface: (tr?.translatedPreface ?? "").split("\n").filter((l) => l.length > 0 || l === ""),
      koAfterword: (tr?.translatedAfterword ?? "").split("\n").filter((l) => l.length > 0 || l === ""),
    };
  });

  const glossaryRows = await db
    .select({
      termJa: novelGlossaryEntries.termJa,
      termKo: novelGlossaryEntries.termKo,
      category: novelGlossaryEntries.category,
      notes: novelGlossaryEntries.notes,
    })
    .from(novelGlossaryEntries)
    .where(
      and(
        eq(novelGlossaryEntries.novelId, opts.novelId),
        eq(novelGlossaryEntries.status, "confirmed"),
      ),
    )
    .orderBy(asc(novelGlossaryEntries.termJa));
  const includeGlossary = glossaryRows.length > 0 && opts.lang !== "ja";

  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.folder("META-INF")!.file("container.xml", containerXml());
  const oebps = zip.folder("OEBPS")!;
  oebps.file("style.css", styleCss());
  oebps.file("nav.xhtml", navXhtml(chapters, includeGlossary));
  oebps.file(
    "content.opf",
    contentOpf(
      { title: novel.titleKo ?? novel.titleJa, author: novel.authorName ?? null },
      chapters,
      includeGlossary,
      opts.lang,
      `urn:shosetu:${novel.sourceNcode}:${Date.now()}`,
    ),
  );
  for (const c of chapters) {
    oebps.file(`chapter-${c.episodeNumber}.xhtml`, chapterXhtml(opts.lang, c));
  }
  if (includeGlossary) {
    oebps.file("glossary.xhtml", glossaryXhtml(glossaryRows));
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const safeTitle = (novel.titleKo ?? novel.titleJa).replace(/[^\w가-힣ぁ-ゖァ-ヶ一-龯-]+/g, "_").slice(0, 80);
  const filename = `${safeTitle || novel.sourceNcode}.epub`;
  return {
    buffer,
    filename,
    novelTitle: novel.titleKo ?? novel.titleJa,
    chapterCount: chapters.length,
  };
}
