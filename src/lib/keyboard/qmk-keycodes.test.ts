import { describe, expect, it } from 'vitest';
import {
  extractCopyrightLines, parseKeymapC, parseKeymapJson, qmkKeycodeInfo, splitTopLevel, stripCComments
} from './qmk-keycodes';

const KEYMAP = `/* Copyright 2021 Example Maker
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
#include QMK_KEYBOARD_H
// [IGNORED] = LAYOUT(KC_Z)
const uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {
  [_BASE] = LAYOUT_alice( /* base */
    KC_ESC, KC_1, LT(_FN, KC_SPC), MT(MOD_LCTL, KC_A),
    _______, MO(1)
  ),
  [1] = LAYOUT(
    KC_TRNS, RGB_TOG, KC_MUTE, S(KC_1), LCTL_T(KC_ESC), XXXXXXX
  )
};
const uint16_t PROGMEM encoder_map[][NUM_ENCODERS][NUM_DIRECTIONS] = {
  [_BASE] = { ENCODER_CCW_CW(KC_VOLD, KC_VOLU) }
};`;

describe('QMK keycode table', () => {
  it.each([
    ['KC_A', 'KeyA', 'A'], ['KC_0', 'Digit0', '0'], ['KC_BSPC', 'Backspace', 'Bksp'],
    ['KC_BACKSPACE', 'Backspace', 'Bksp'], ['KC_LOPT', 'AltLeft', 'Alt'], ['KC_RCMD', 'MetaRight', 'Meta'],
    ['KC_NUHS', 'Backslash', '#'], ['KC_NUBS', 'IntlBackslash', '\\'], ['KC_F24', 'F24', 'F24'],
    ['KC_PGDN', 'PageDown', 'PgDn'], ['KC_APP', 'ContextMenu', 'Menu'], [' KC_SPC ', 'Space', 'Space']
  ])('maps plain keycode %s to %s', (keycode, code, legend) => {
    expect(qmkKeycodeInfo(keycode)).toEqual({ code, legend });
  });

  it.each([
    ['MO(1)', 'Fn'], ['LT(_FN, KC_SPC)', 'Space'], ['MT(MOD_LCTL, KC_A)', 'A'], ['LCTL_T(KC_ESC)', 'Esc'],
    ['KC_TILD', '~'], ['S(KC_1)', '⇧1'], ['_______', ''], ['KC_TRNS', ''], ['XXXXXXX', ''], ['KC_NO', ''],
    ['KC_MUTE', 'Mute'], ['QK_GESC', 'Esc'], ['RGB_TOG', 'TOG'], ['MACRO_ONE', 'MACRO']
  ])('leaves %s uncoded with legend %j', (keycode, legend) => {
    expect(qmkKeycodeInfo(keycode)).toEqual({ code: null, legend });
  });
});

describe('QMK keymap parsing', () => {
  it('strips comments but keeps string contents', () => {
    expect(stripCComments('a // x\nb /* y */ c "d // e"')).toBe('a \nb   c "d // e"');
    expect(() => stripCComments('/* open')).toThrow(/Unterminated/);
  });

  it('splits only top-level arguments', () => {
    expect(splitTopLevel(' KC_A, LT(1, KC_SPC),  MT(MOD_LCTL | MOD_LSFT,  KC_B) , ')).toEqual([
      'KC_A', 'LT(1, KC_SPC)', 'MT(MOD_LCTL | MOD_LSFT, KC_B)'
    ]);
    expect(() => splitTopLevel('LT(1, KC_A')).toThrow(/Unbalanced/);
  });

  it('parses designated LAYOUT layers from keymap.c in order', () => {
    expect(parseKeymapC(KEYMAP)).toEqual([
      { name: '_BASE', macro: 'LAYOUT_alice', keycodes: ['KC_ESC', 'KC_1', 'LT(_FN, KC_SPC)', 'MT(MOD_LCTL, KC_A)', '_______', 'MO(1)'] },
      { name: '1', macro: 'LAYOUT', keycodes: ['KC_TRNS', 'RGB_TOG', 'KC_MUTE', 'S(KC_1)', 'LCTL_T(KC_ESC)', 'XXXXXXX'] }
    ]);
  });

  it('parses keymap.json layers', () => {
    expect(parseKeymapJson({ layout: 'LAYOUT_all', layers: [['KC_A', ' KC_B '], ['KC_TRNS', 'MO(1)']] })).toEqual([
      { name: '0', macro: 'LAYOUT_all', keycodes: ['KC_A', 'KC_B'] },
      { name: '1', macro: 'LAYOUT_all', keycodes: ['KC_TRNS', 'MO(1)'] }
    ]);
    expect(() => parseKeymapJson({ layers: [] })).toThrow(/layout and layers/);
    expect(() => parseKeymapJson({ layout: 'LAYOUT', layers: [[1]] })).toThrow(/string array/);
  });

  it('extracts unique copyright lines for attribution', () => {
    expect(extractCopyrightLines(KEYMAP)).toEqual(['Copyright 2021 Example Maker']);
    expect(extractCopyrightLines('/* Copyright 2012,2013 Jun Wako <x@example.com> */\n// Copyright 2012,2013 Jun Wako <x@example.com>'))
      .toEqual(['Copyright 2012,2013 Jun Wako <x@example.com>']);
  });
});
