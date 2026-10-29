export const PYTHON_SNIPPETS = [
  ['py-dict-comprehension', 'squares = {n: n * n for n in range(10) if n % 2 == 0}'],
  ['py-list-slice', 'tail = values[-3:] if len(values) > 3 else values[:]'],
  ['py-f-string', 'print(f"{name!r} typed {wpm:.1f} wpm at {accuracy:.0%}")'],
  ['py-bitwise-or', 'flags = READ | WRITE | (EXECUTE if allow_exec else 0)'],
  ['py-dict-merge', 'settings = defaults | {"theme": "charcoal", "accent": "#FF5D00"}'],
  ['py-sorted-key', 'ranked = sorted(scores.items(), key=lambda pair: pair[1], reverse=True)[:5]'],
  ['py-zip-dict', 'lookup = dict(zip(["left", "right"], [0.48, 0.52]))'],
  ['py-with-open', 'with open("layout.json", encoding="utf-8") as handle: data = json.load(handle)'],
  ['py-type-union', 'def parse(raw: str | bytes, limit: int = 256) -> list[dict[str, int]]:'],
  ['py-set-ops', 'shared = set(left_keys) & set(right_keys) | {"KeyB", "Space"}'],
  ['py-enumerate', 'for index, key in enumerate(row[1:], start=2): print(index, key)'],
  ['py-backtick-doc', 'help_text = "Wrap inline code in `backticks`, e.g. `layers[0][7]`."'],
  ['py-walrus', 'if (count := len(missed)) > 20: print(f"{count} misses logged")'],
  ['py-nested-list', 'matrix = [[0 for _ in range(15)] for _ in range(5)]'],
  ['py-dataclass', '@dataclass(frozen=True) class Key: row: int; col: int; code: str = "KC_NO"'],
  ['py-try-except', 'try: value = int(token) except ValueError as error: raise KeyError(token) from error'],
  ['py-any-all', 'ready = all(k in pressed for k in ["KeyT", "KeyY"]) and not any(stuck)']
] as const;
