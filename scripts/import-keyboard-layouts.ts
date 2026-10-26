// Maintainer-only importer for AliceType keyboard layout profiles.
// Run with `npm run import:layouts` (Node 22.18+ native TypeScript type stripping).
// Flags: --latest (re-pin upstream commits to the current default branches),
//        --skip-failed (write successful entries and report failed ones instead of aborting).
// Never run at build time or in the browser; the generated snapshot is committed.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { parseViaKeymap, type KleKey } from '../src/lib/keyboard/kle-layout.ts';
import {
  extractCopyrightLines,
  parseKeymapC,
  parseKeymapJson,
  qmkKeycodeInfo,
  type KeymapLayer
} from '../src/lib/keyboard/qmk-keycodes.ts';

interface SourceEntry {
  id: string;
  via: string;
  qmk: string;
  layer?: string;
  displayName?: string;
  note: string;
}

interface SourceFile {
  $comment: string;
  pins: { via: string; qmk: string };
  entries: SourceEntry[];
}

interface QmkLayoutKey {
  matrix: [number, number];
}

interface QmkInfo {
  manufacturer?: string;
  keyboard_name?: string;
  last_updated?: string;
  usb?: { vid?: string; pid?: string };
  layouts?: Record<string, { layout: QmkLayoutKey[] }>;
  layout_aliases?: Record<string, string>;
}

const SOURCES_PATH = 'scripts/keyboard-layout-sources.json';
const OUTPUT_DIR = 'src/lib/keyboard/layout-data';
const VIA_REPO = 'the-via/keyboards';
const QMK_REPO = 'qmk/qmk_firmware';
const QMK_API = 'https://keyboards.qmk.fm/v1';
const args = new Set(process.argv.slice(2));
const REQUIRED_CODES = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `Key${letter}`),
  ...'0123456789'.split('').map((digit) => `Digit${digit}`),
  'Space'
];

async function fetchText(url: string): Promise<string | null> {
  const response = await fetch(url, { headers: { 'User-Agent': 'AliceType layout importer' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${url} failed with ${response.status}.`);
  return response.text();
}

async function fetchRequired(url: string): Promise<string> {
  const text = await fetchText(url);
  if (text === null) throw new Error(`GET ${url} returned 404.`);
  return text;
}

async function latestCommit(repo: string): Promise<string> {
  const body = JSON.parse(await fetchRequired(`https://api.github.com/repos/${repo}/commits/HEAD`)) as { sha?: unknown };
  if (typeof body.sha !== 'string' || !/^[0-9a-f]{40}$/.test(body.sha)) throw new Error(`No commit SHA for ${repo}.`);
  return body.sha;
}

const raw = (repo: string, commit: string, path: string) => `https://raw.githubusercontent.com/${repo}/${commit}/${path}`;
const blob = (repo: string, commit: string, path: string) => `https://github.com/${repo}/blob/${commit}/${path}`;

function parseUsbId(value: unknown, label: string): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 16) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xffff) throw new Error(`Invalid ${label} "${String(value)}".`);
  return parsed;
}

const round = (value: number) => Math.round(value * 10000) / 10000;

async function findKeymap(keyboard: string, commit: string) {
  const parts = keyboard.split('/');
  for (let depth = parts.length; depth > 0; depth -= 1) {
    const base = `keyboards/${parts.slice(0, depth).join('/')}/keymaps/default`;
    for (const file of ['keymap.c', 'keymap.json']) {
      const path = `${base}/${file}`;
      const text = await fetchText(raw(QMK_REPO, commit, path));
      if (text !== null) {
        const layers: KeymapLayer[] = file === 'keymap.c' ? parseKeymapC(text) : parseKeymapJson(JSON.parse(text));
        return { path, text, layers, copyright: file === 'keymap.c' ? extractCopyrightLines(text) : [] };
      }
    }
  }
  throw new Error(`No default keymap found for ${keyboard}.`);
}

function buildGroups(labels: unknown, keys: readonly KleKey[]) {
  const counts = new Map<number, number>();
  for (const key of keys) {
    if (key.group >= 0) counts.set(key.group, Math.max(counts.get(key.group) ?? 0, key.option + 1));
  }
  const groupCount = counts.size === 0 ? 0 : Math.max(...counts.keys()) + 1;
  const labelList = Array.isArray(labels) ? labels : [];
  return Array.from({ length: groupCount }, (_, index) => {
    const label = labelList[index];
    const optionCount = counts.get(index) ?? 0;
    if (optionCount === 0) throw new Error(`Layout option group ${index} has no keys.`);
    // An option may legitimately have no keys (for example "no knob"), so label lists may be longer than the key options.
    if (typeof label === 'string') {
      if (optionCount > 2) throw new Error(`Toggle group "${label}" has ${optionCount} options.`);
      return { label, options: ['Off', 'On'] };
    }
    if (Array.isArray(label) && typeof label[0] === 'string' && label.slice(1).every((value) => typeof value === 'string')) {
      const options = label.slice(1) as string[];
      if (options.length < optionCount) throw new Error(`Group "${label[0]}" lists ${options.length} options for ${optionCount}.`);
      return { label: label[0], options };
    }
    return { label: `Layout option ${index + 1}`, options: Array.from({ length: optionCount }, (_, option) => `Option ${option + 1}`) };
  });
}

async function importEntry(entry: SourceEntry, pins: SourceFile['pins'], usbIndex: Map<string, Set<string>>) {
  const viaUrl = raw(VIA_REPO, pins.via, entry.via);
  const via = JSON.parse(await fetchRequired(viaUrl)) as {
    name?: unknown; vendorId?: unknown; productId?: unknown; layouts?: { keymap?: unknown; labels?: unknown };
  };
  if (typeof via.name !== 'string' || !via.name.trim()) throw new Error('VIA definition has no name.');
  const vendorId = parseUsbId(via.vendorId, 'VIA vendorId');
  const productId = parseUsbId(via.productId, 'VIA productId');
  const layout = parseViaKeymap(via.layouts?.keymap);
  const groups = buildGroups(via.layouts?.labels, layout.keys);

  const infoUrl = `${QMK_API}/keyboards/${entry.qmk}/info.json`;
  const infoBody = JSON.parse(await fetchRequired(infoUrl)) as { keyboards?: Record<string, QmkInfo> };
  const info = infoBody.keyboards?.[entry.qmk];
  if (!info) throw new Error(`QMK API has no info for ${entry.qmk}.`);
  if (parseUsbId(info.usb?.vid, 'QMK vid') !== vendorId || parseUsbId(info.usb?.pid, 'QMK pid') !== productId) {
    throw new Error(`VIA and QMK USB IDs differ for ${entry.id}.`);
  }
  if (typeof info.manufacturer !== 'string' || !info.manufacturer.trim()) throw new Error('QMK info has no manufacturer.');

  const keymap = await findKeymap(entry.qmk, pins.qmk);
  const layer = entry.layer ? keymap.layers.find((candidate) => candidate.name === entry.layer) : keymap.layers[0];
  if (!layer) throw new Error(`Keymap layer ${entry.layer ?? '(first)'} not found in ${keymap.path}.`);
  const macro = info.layouts?.[layer.macro] ? layer.macro : info.layout_aliases?.[layer.macro];
  const qmkLayout = macro ? info.layouts?.[macro]?.layout : undefined;
  if (!qmkLayout) throw new Error(`QMK layout ${layer.macro} not found for ${entry.qmk}.`);
  if (qmkLayout.length !== layer.keycodes.length) {
    throw new Error(`${layer.macro} has ${qmkLayout.length} positions but layer ${layer.name} has ${layer.keycodes.length} keycodes.`);
  }
  const matrix = new Map<string, string>();
  qmkLayout.forEach((position, index) => {
    const key = `${position.matrix[0]},${position.matrix[1]}`;
    if (!matrix.has(key)) matrix.set(key, layer.keycodes[index]);
  });

  let unmatched = 0;
  const keys = layout.keys.map((key) => {
    const keycode = matrix.get(`${key.row},${key.col}`) ?? null;
    if (keycode === null) unmatched += 1;
    const mapped = keycode === null ? { code: null, legend: '' } : qmkKeycodeInfo(keycode);
    return {
      row: key.row,
      col: key.col,
      x: round(key.x),
      y: round(key.y),
      w: round(key.w),
      h: round(key.h),
      r: round(key.r),
      rx: round(key.rx),
      ry: round(key.ry),
      s: key.secondary ? [key.secondary.x2, key.secondary.y2, key.secondary.w2, key.secondary.h2].map(round) : null,
      g: key.group,
      o: key.option,
      kc: keycode,
      code: mapped.code,
      legend: mapped.legend
    };
  });

  const defaultCodes = new Set(keys.filter((key) => key.o === 0).map((key) => key.code));
  const missing = REQUIRED_CODES.filter((code) => !defaultCodes.has(code));
  if (missing.length > 0) throw new Error(`Default variant lacks physical codes ${missing.join(', ')}.`);
  // Alice-family boards have an angled split: both halves must be rotated in opposite directions.
  if (!keys.some((key) => key.r > 0) || !keys.some((key) => key.r < 0)) {
    throw new Error('Layout has no angled split (needs both positive and negative key rotation); not an Alice-family board.');
  }

  const usbKey = `${vendorId}:${productId}`;
  const sharedIdCount = Math.max(1, usbIndex.get(usbKey)?.size ?? 0);
  const name = via.name.trim();
  return {
    profile: { id: entry.id, name, width: round(layout.width), height: round(layout.height), keys },
    index: {
      id: entry.id,
      displayName: entry.displayName ?? name,
      name,
      brand: info.manufacturer.trim(),
      vendorId,
      productId,
      sharedIdCount,
      groups,
      sources: {
        via: { repository: VIA_REPO, path: entry.via, commit: pins.via, url: blob(VIA_REPO, pins.via, entry.via), license: 'GPL-3.0' },
        qmkInfo: { keyboard: entry.qmk, url: infoUrl, lastUpdated: info.last_updated ?? null, license: 'GPL-2.0-or-later' },
        keymap: {
          repository: QMK_REPO, path: keymap.path, commit: pins.qmk, url: blob(QMK_REPO, pins.qmk, keymap.path),
          layer: layer.name, layoutMacro: layer.macro, license: 'GPL-2.0-or-later'
        }
      }
    },
    copyright: keymap.copyright,
    unmatched,
    note: entry.note
  };
}

async function main() {
  const sources = JSON.parse(await readFile(SOURCES_PATH, 'utf8')) as SourceFile;
  if (args.has('--latest')) {
    sources.pins = { via: await latestCommit(VIA_REPO), qmk: await latestCommit(QMK_REPO) };
    await writeFile(SOURCES_PATH, `${JSON.stringify(sources, null, 2)}\n`);
    console.log(`Pinned VIA ${sources.pins.via} and QMK ${sources.pins.qmk}.`);
  }
  const ids = new Set<string>();
  for (const entry of sources.entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || ids.has(entry.id)) throw new Error(`Invalid or duplicate id ${entry.id}.`);
    ids.add(entry.id);
  }

  const usb = JSON.parse(await fetchRequired(`${QMK_API}/usb.json`)) as { usb: Record<string, Record<string, Record<string, unknown>>> };
  const usbIndex = new Map<string, Set<string>>();
  for (const [vid, products] of Object.entries(usb.usb)) {
    for (const [pid, keyboards] of Object.entries(products)) {
      const key = `${Number.parseInt(vid, 16)}:${Number.parseInt(pid, 16)}`;
      usbIndex.set(key, new Set([...(usbIndex.get(key) ?? []), ...Object.keys(keyboards)]));
    }
  }

  const results = [];
  const failures: string[] = [];
  for (const entry of sources.entries) {
    try {
      const result = await importEntry(entry, sources.pins, usbIndex);
      results.push(result);
      console.log(`ok   ${entry.id}: ${result.profile.keys.length} keys, ${result.index.groups.length} groups, ${result.unmatched} unmatched`);
    } catch (error) {
      failures.push(`${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`FAIL ${failures.at(-1)}`);
    }
  }
  if (failures.length > 0 && !args.has('--skip-failed')) {
    throw new Error(`${failures.length} entries failed; fix or remove them, or rerun with --skip-failed.`);
  }
  const names = results.map((result) => result.index.displayName.toLowerCase());
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate) throw new Error(`Duplicate display name "${duplicate}"; add a displayName override.`);

  const license = await fetchRequired(raw(VIA_REPO, sources.pins.via, 'LICENSE'));
  if (!license.includes('GNU GENERAL PUBLIC LICENSE') || !license.includes('Version 3, 29 June 2007')) {
    throw new Error('VIA LICENSE is not the GPL-3.0 text.');
  }

  const generatedAt = new Date().toISOString().slice(0, 10);
  const revision = `via-${sources.pins.via.slice(0, 7)}.qmk-${sources.pins.qmk.slice(0, 7)}`;
  await rm(`${OUTPUT_DIR}/profiles`, { recursive: true, force: true });
  await mkdir(`${OUTPUT_DIR}/profiles`, { recursive: true });
  results.sort((a, b) => a.index.id.localeCompare(b.index.id));
  for (const result of results) {
    await writeFile(`${OUTPUT_DIR}/profiles/${result.profile.id}.json`, `${JSON.stringify(result.profile)}\n`);
  }
  await writeFile(`${OUTPUT_DIR}/index.json`, `${JSON.stringify({
    revision,
    generatedAt,
    pins: sources.pins,
    profiles: results.map((result) => result.index)
  }, null, 2)}\n`);
  await writeFile(`${OUTPUT_DIR}/LICENSE-GPL-3.0.txt`, license.endsWith('\n') ? license : `${license}\n`);

  const notice = [
    'AliceType keyboard layout data',
    '==============================',
    '',
    `Catalog revision ${revision}, generated ${generatedAt} by scripts/import-keyboard-layouts.ts.`,
    '',
    'The files in this directory (index.json and profiles/*.json) are derived from third-party',
    'open-source keyboard data and are NOT covered by the AliceType MIT license:',
    '',
    `- VIA keyboard definitions, https://github.com/${VIA_REPO} at commit ${sources.pins.via},`,
    '  licensed under the GNU General Public License v3.0 (GPL-3.0).',
    `- QMK Firmware default keymaps, https://github.com/${QMK_REPO} at commit ${sources.pins.qmk},`,
    '  and QMK keyboard metadata from the QMK API (https://keyboards.qmk.fm), licensed under the',
    '  GNU General Public License v2.0 or later (GPL-2.0-or-later), used here under GPL-3.0.',
    '',
    'Modifications: AliceType converted the VIA KLE geometry to normalized key positions, mapped QMK',
    'default-layer keycodes to browser KeyboardEvent.code values and legends, and combined them with',
    'QMK USB identifiers. The data was reformatted as JSON; no other changes were made.',
    '',
    'These derived files, and any AliceType build that bundles them, are distributed under the',
    'GNU General Public License v3.0; see LICENSE-GPL-3.0.txt. The complete corresponding source,',
    'including the importer and these files, is available at',
    'https://github.com/nguyenviettung7691/alice-type. AliceType application source code remains',
    'available under the MIT license (see the repository LICENSE file).',
    '',
    'This software is provided WITHOUT ANY WARRANTY, to the extent permitted by applicable law.',
    '',
    'Per-keyboard sources and upstream copyright notices',
    '---------------------------------------------------',
    ...results.flatMap((result) => [
      '',
      `${result.index.displayName} (${result.index.id})`,
      `  VIA definition: ${result.index.sources.via.url}`,
      `  QMK keyboard metadata: ${result.index.sources.qmkInfo.url}${result.index.sources.qmkInfo.lastUpdated ? ` (last updated ${result.index.sources.qmkInfo.lastUpdated})` : ''}`,
      `  QMK default keymap (layer ${result.index.sources.keymap.layer}): ${result.index.sources.keymap.url}`,
      ...(result.copyright.length > 0
        ? result.copyright.map((line) => `  ${line}`)
        : ['  No copyright line in the keymap header; copyright remains with the QMK Firmware contributors.'])
    ]),
    ''
  ].join('\n');
  await writeFile(`${OUTPUT_DIR}/NOTICE.txt`, notice);

  console.log(`Wrote ${results.length} profiles (${revision}).`);
  if (failures.length > 0) console.log(`Skipped ${failures.length}:\n${failures.join('\n')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
