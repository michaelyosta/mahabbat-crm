import { describe, expect, it } from 'vitest';

import {
  isPosOrderActive,
  isPosOrderEditable,
  nextPosOrderStatusAfterLineChange,
} from 'src/pos/pos-order-state';

describe('pos order state machine', () => {
  it('allows line edits only for OPEN and IN_PROGRESS', () => {
    expect(isPosOrderEditable('OPEN')).toBe(true);
    expect(isPosOrderEditable('IN_PROGRESS')).toBe(true);
    expect(isPosOrderEditable('PRECHECK_PRINTED')).toBe(false);
    expect(isPosOrderEditable('CLOSED')).toBe(false);
    expect(isPosOrderEditable('CANCELLED')).toBe(false);
  });

  it('treats PRECHECK_PRINTED as an active order', () => {
    expect(isPosOrderActive('OPEN')).toBe(true);
    expect(isPosOrderActive('IN_PROGRESS')).toBe(true);
    expect(isPosOrderActive('PRECHECK_PRINTED')).toBe(true);
    expect(isPosOrderActive('CLOSED')).toBe(false);
    expect(isPosOrderActive('CANCELLED')).toBe(false);
  });

  it('moves OPEN to IN_PROGRESS once the first active line exists', () => {
    expect(nextPosOrderStatusAfterLineChange('OPEN', 0)).toBe('OPEN');
    expect(nextPosOrderStatusAfterLineChange('OPEN', 1)).toBe('IN_PROGRESS');
    expect(nextPosOrderStatusAfterLineChange('IN_PROGRESS', 3)).toBe('IN_PROGRESS');
  });
});