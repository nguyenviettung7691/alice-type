export const JAVASCRIPT_SNIPPETS = [
  ['js-template-literal', 'const label = `${key.code} (${hand}) - ${misses}/${attempts}`;'],
  ['js-arrow-map', 'const doubled = [1, 2, 3, 4].map((value) => value * 2);'],
  ['js-destructure', 'const { left = 0, right = 0, ...rest } = summary.handAttempts ?? {};'],
  ['js-array-destructure', 'const [first, second, ...others] = layers[0].slice(0, 16);'],
  ['js-optional-chain', 'const legend = layout?.keys?.[index]?.legend ?? "?";'],
  ['js-logical-or', 'const accent = theme.accent || "#FF5D00"; const ok = a || b && !c;'],
  ['js-reduce', 'const total = Object.values(counts).reduce((sum, n) => sum + n, 0);'],
  ['js-filter-sort', 'const worst = rows.filter((r) => r.attempts >= 20).sort((a, b) => a.rate - b.rate);'],
  ['js-async-fetch', 'const data = await file.text().then((raw) => JSON.parse(raw));'],
  ['js-class-field', 'class Counter { #count = 0; increment() { return ++this.#count; } }'],
  ['js-set-spread', 'const unique = [...new Set(["KeyB", "KeyB", "Space", "KeyN"])];'],
  ['js-regex-test', 'if (/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(code)) misses[code] += 1;'],
  ['js-object-entries', 'for (const [code, count] of Object.entries(missed)) console.log(code, count);'],
  ['js-pipe-bitmask', 'const mods = (shift ? 1 : 0) | (ctrl ? 2 : 0) | (alt ? 4 : 0) | (meta ? 8 : 0);'],
  ['js-promise-all', 'const [quotes, words] = await Promise.all([loadQuotes(), loadWords(5000)]);'],
  ['js-switch-case', 'switch (mode) { case "drills": return 25; case "code": return 1; default: return 0; }'],
  ['js-tagged-template', 'const sql = String.raw`SELECT * FROM keys WHERE code = ${code}`;']
] as const;
