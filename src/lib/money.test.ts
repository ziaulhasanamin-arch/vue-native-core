import { describe, expect, it } from 'vitest';
import { convertMoney, decimalMoney, parseMoney, parseRate, percent } from './money';

describe('integer minor-unit money', () => {
  it('parses decimal strings without binary floating point', () => {
    expect(parseMoney('0.10')).toBe(10);
    expect(parseMoney('1,234.56')).toBe(123456);
    expect(parseMoney('-42.05')).toBe(-4205);
    expect(parseMoney('12', 'JPY')).toBe(12);
    expect(parseMoney('0.001', 'KWD')).toBe(1);
  });
  it('rejects invalid precision and unsafe amounts', () => {
    expect(() => parseMoney('1.234')).toThrow();
    expect(() => parseMoney('1.5', 'JPY')).toThrow();
    expect(() => parseMoney('abc')).toThrow();
    expect(() => parseMoney('999999999999999.99')).toThrow();
  });
  it('round-trips minor units', () => {
    expect(decimalMoney(123456)).toBe('1234.56');
    expect(decimalMoney(-5)).toBe('-0.05');
    expect(decimalMoney(7, 'JPY')).toBe('7');
  });
  it('converts with exact half-up rounding', () => {
    expect(convertMoney(100, 1_500_000)).toBe(150);
    expect(convertMoney(1, 500_000)).toBe(1);
    expect(convertMoney(1, 499_999)).toBe(0);
    expect(() => convertMoney(10, 0)).toThrow();
  });
  it('parses rates as integer ppm', () => {
    expect(parseRate('110.25')).toBe(110_250_000);
    expect(() => parseRate('0')).toThrow();
  });
  it('calculates display percentages safely', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
    expect(percent(200, 100)).toBe(100);
  });
});
