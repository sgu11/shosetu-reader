/**
 * Episode chunking for long source texts.
 *
 * When an episode exceeds CHUNK_THRESHOLD characters, it is split at
 * paragraph boundaries into TARGET_CHUNK_SIZE pieces.  Each chunk
 * after the first carries a trailing excerpt from the previous chunk
 * so the translator can maintain continuity.
 */

const CHUNK_THRESHOLD = 12_000; // chars — below this, no split needed
const TARGET_CHUNK_SIZE = 8_000; // chars — soft target per chunk

export interface EpisodeChunk {
  /** 0-based chunk index */
  index: number;
  /** Source text for this chunk */
  text: string;
  /** Total number of chunks */
  total: number;
  /** Trailing ~500 chars of the previous chunk's source for overlap context */
  overlapSourceTail?: string;
}

export function shouldChunk(text: string): boolean {
  return text.length > CHUNK_THRESHOLD;
}

/**
 * Break text into segments no larger than TARGET_CHUNK_SIZE using
 * progressively finer-grained splitting:
 *   1. Double newlines (\n\n)
 *   2. Single newlines (\n)
 *   3. Japanese sentence-ending punctuation (。！？)
 *   4. Hard character-boundary cut (last resort)
 */
function splitIntoParagraphs(text: string): string[] {
  // Try double-newline split first
  let parts = text.split(/\n\n+/).filter(Boolean);

  // If we got a single element that's still over threshold, try single newline
  if (parts.length === 1 && parts[0].length > CHUNK_THRESHOLD) {
    parts = parts[0].split(/\n/).filter(Boolean);
  }

  // If still a single element over threshold, try sentence boundaries
  if (parts.length === 1 && parts[0].length > CHUNK_THRESHOLD) {
    parts = parts[0].split(/(?<=[。！？])/).filter(Boolean);
  }

  // Last resort: if still a single oversized block, hard-split at TARGET_CHUNK_SIZE
  if (parts.length === 1 && parts[0].length > CHUNK_THRESHOLD) {
    const block = parts[0];
    parts = [];
    for (let i = 0; i < block.length; i += TARGET_CHUNK_SIZE) {
      parts.push(block.slice(i, i + TARGET_CHUNK_SIZE));
    }
  }

  return parts;
}

/**
 * Split source text into chunks at paragraph boundaries.
 * Returns a single-element array when no chunking is needed.
 */
export function splitIntoChunks(text: string): EpisodeChunk[] {
  if (!shouldChunk(text)) {
    return [{ index: 0, text, total: 1 }];
  }

  const paragraphs = splitIntoParagraphs(text);
  const chunks: { text: string }[] = [];
  let currentParagraphs: string[] = [];
  let currentLength = 0;

  for (const para of paragraphs) {
    // If adding this paragraph exceeds target and we already have content, flush
    if (
      currentLength + para.length > TARGET_CHUNK_SIZE &&
      currentParagraphs.length > 0
    ) {
      chunks.push({ text: currentParagraphs.join("\n\n") });
      currentParagraphs = [];
      currentLength = 0;
    }
    currentParagraphs.push(para);
    currentLength += para.length + 2; // +2 for the \n\n separator
  }

  // Flush remaining paragraphs
  if (currentParagraphs.length > 0) {
    chunks.push({ text: currentParagraphs.join("\n\n") });
  }

  const total = chunks.length;

  return chunks.map((c, i) => ({
    index: i,
    text: c.text,
    total,
    overlapSourceTail:
      i > 0 ? chunks[i - 1].text.slice(-500) : undefined,
  }));
}

/**
 * Reassemble translated chunks into a single string.
 * Joins with double newline to restore paragraph boundaries.
 */
export function reassembleChunks(translatedChunks: string[]): string {
  return translatedChunks.join("\n\n");
}
