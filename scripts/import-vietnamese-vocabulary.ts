import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const revision = '525f9b560de45753a5ea01069454e72e9aa541c6';
const url = `https://raw.githubusercontent.com/hermitdave/FrequencyWords/${revision}/content/2018/vi/vi_50k.txt`;
const response = await fetch(url);
if (!response.ok) throw new Error(`Vietnamese vocabulary fetch failed: HTTP ${response.status}.`);
const source = await response.text();
const supported = /^[a-zàáâãèéêìíòóôõùúýăđĩũơư\u1ea0-\u1ef9]+$/u;
const syllable = /^(?:ngh|ng|gh|gi|kh|nh|ph|th|tr|ch|qu|[bcdđghklmnpqrstvx])?[aeiouyăâêôơư]+(?:ch|ng|nh|[cmnptk])?$/u;
const excluded = new Set(['đụ', 'địt', 'cặc', 'lồn', 'đéo', 'đĩ', 'buồi', 'đếch']);
const words: string[] = [];
const seen = new Set<string>();
for (const line of source.split(/\r?\n/)) {
  const token = line.split(/\s+/)[0].normalize('NFC');
  if (!supported.test(token) || seen.has(token) || excluded.has(token)) continue;
  const base = token.normalize('NFD').replace(/[\u0300\u0301\u0303\u0309\u0323]/g, '').normalize('NFC');
  const toneMarks = token.normalize('NFD').match(/[\u0300\u0301\u0303\u0309\u0323]/g) ?? [];
  if (!syllable.test(base) || toneMarks.length > 1) continue;
  seen.add(token);
  words.push(token);
  if (words.length === 5000) break;
}
if (words.length !== 5000) throw new Error(`Only ${words.length} eligible tokens; 5000 are required.`);
const destination = fileURLToPath(new URL('../src/lib/typing/word-banks/vietnamese.json', import.meta.url));
await writeFile(destination, `${JSON.stringify(words, null, 2)}\n`, 'utf8');
console.log(`Imported ${words.length} Vietnamese subtitle-derived tokens from ${revision}. Fluent editorial review remains required.`);
