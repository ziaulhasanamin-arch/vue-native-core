import { describe, expect, it } from 'vitest';
import { nextOccurrence } from './recurring';

describe('recurrence scheduling', () => {
  it('clamps monthly recurrence to month end', () => {
    const jan31 = new Date(2026, 0, 31, 9, 0).getTime();
    const feb = nextOccurrence(jan31, 'monthly', 31);
    expect(new Date(feb).getMonth()).toBe(1);
    expect(new Date(feb).getDate()).toBe(28);
    const mar = nextOccurrence(feb, 'monthly', 31);
    expect(new Date(mar).getDate()).toBe(31);
  });
  it('advances daily, weekly and yearly', () => {
    const start = new Date(2026, 0, 1, 9, 0).getTime();
    expect(new Date(nextOccurrence(start, 'daily')).getDate()).toBe(2);
    expect(new Date(nextOccurrence(start, 'weekly')).getDate()).toBe(8);
    const leap = new Date(2024, 1, 29, 9, 0).getTime();
    const next = nextOccurrence(leap, 'yearly', 29);
    expect(new Date(next).getFullYear()).toBe(2025);
    expect(new Date(next).getMonth()).toBe(1);
    expect(new Date(next).getDate()).toBe(28);
  });
});
