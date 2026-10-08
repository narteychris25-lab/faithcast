/**
 * Convert free user input into a safe FTS5 MATCH expression: every word
 * becomes a quoted prefix term, so punctuation or FTS operators typed by
 * the user can never cause a syntax error.
 */
export function ftsQuery(input: string): string {
  const words = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^\p{L}\p{N}']+/u)
    .map((w) => w.replace(/'/g, ''))
    .filter(Boolean)
    .slice(0, 12)
  return words.map((w) => `"${w}"*`).join(' ')
}

/** Escape LIKE wildcards for use with ESCAPE '\'. */
export function likePattern(input: string): string {
  return `%${input.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}
