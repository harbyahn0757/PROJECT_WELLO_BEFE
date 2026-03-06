/**
 * Tilko/NHIS API에서 온 메시지의 HTML 태그, 엔티티, 깨진 문자를 정제
 */
export function sanitizeTilkoMessage(message: string): string {
  if (!message) return '';
  return message
    .replace(/<[^>]*>?/gm, '')
    .replace(/&amp;?/g, '&')
    .replace(/&nbsp;?/g, ' ')
    .replace(/&lt;?/g, '<')
    .replace(/&gt;?/g, '>')
    .replace(/&quot;?/g, '"')
    .replace(/&lsquo;|&rsquo;|'|'|&ldquo;|&rdquo;|"|"/g, "'")
    .replace(/&middot;?/g, '·')
    .replace(/&#\d+;/g, '')
    .replace(/&#x[0-9a-fA-F]+;/g, '')
    .replace(/\n\s*\n/g, '\n\n')
    .normalize('NFC')
    .trim();
}
