export const RUST_SNIPPETS = [
  ['rs-closure-pipes', 'let doubled: Vec<i32> = values.iter().map(|v| v * 2).collect();'],
  ['rs-match-arms', 'match hand { Hand::Left => left += 1, Hand::Right => right += 1, _ => {} }'],
  ['rs-array-literal', 'let row: [u8; 6] = [0x14, 0x1a, 0x08, 0x15, 0x17, 0x1c];'],
  ['rs-struct-def', 'struct Key { row: u8, col: u8, code: &\'static str }'],
  ['rs-if-let', 'if let Some(count) = misses.get_mut(&code) { *count += 1; }'],
  ['rs-filter-map', 'let ids: Vec<_> = keys.iter().filter_map(|k| k.code.as_ref()).collect();'],
  ['rs-format-macro', 'println!("{} typed {:.1} wpm in {}s", name, wpm, elapsed / 1000);'],
  ['rs-backtick-doc', '/// Returns `None` when the `layers[0]` slot holds `KC_NO`.'],
  ['rs-result-question', 'let layout: Layout = serde_json::from_str(&raw)?; Ok(layout.layers.len())'],
  ['rs-or-pattern', 'let thumb = matches!(code, "Space" | "AltLeft" | "AltRight");'],
  ['rs-slice-pattern', 'if let [first, .., last] = &row[..] { println!("{first} {last}"); }'],
  ['rs-impl-block', 'impl Default for Stats { fn default() -> Self { Self { wpm: 0, acc: 100 } } }'],
  ['rs-hashmap-entry', '*counts.entry(code.to_string()).or_insert(0) += 1;'],
  ['rs-raw-string', 'let note = r#"Wrap code in `ticks`; 2 halves | 1 board"#;'],
  ['rs-enumerate-zip', 'for (i, (a, b)) in left.iter().zip(right.iter()).enumerate() { total[i] = a + b; }'],
  ['rs-vec-macro', 'let mut grid = vec![vec![0u16; 15]; 5]; grid[2][7] = 0x2c;'],
  ['rs-trait-bound', 'fn average<T: Into<f64> + Copy>(items: &[T]) -> f64 { items.len() as f64 }']
] as const;
