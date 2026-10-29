import type { MessageKey } from './message-contract';
import type { DrillType } from '../typing/exercise-generator';
import type { Finger, Hand } from '../keyboard/finger-map';

export const DRILL_TYPE_LABEL_KEYS = {
  'split-boundary': 'alice-practice.drill-split-boundary',
  'hand-alternation': 'alice-practice.drill-hand-alternation',
  'cross-boundary': 'alice-practice.drill-cross-boundary'
} as const satisfies Record<DrillType, MessageKey>;

export const DRILL_TYPE_HELP_KEYS = {
  'split-boundary': 'alice-practice.drill-split-boundary-help',
  'hand-alternation': 'alice-practice.drill-hand-alternation-help',
  'cross-boundary': 'alice-practice.drill-cross-boundary-help'
} as const satisfies Record<DrillType, MessageKey>;

export const HAND_LABEL_KEYS = {
  left: 'alice-practice.hand-left', right: 'alice-practice.hand-right'
} as const satisfies Record<Hand, MessageKey>;

export const FINGER_LABEL_KEYS = {
  pinky: 'alice-practice.finger-pinky', ring: 'alice-practice.finger-ring', middle: 'alice-practice.finger-middle',
  index: 'alice-practice.finger-index', thumb: 'alice-practice.finger-thumb'
} as const satisfies Record<Finger, MessageKey>;
