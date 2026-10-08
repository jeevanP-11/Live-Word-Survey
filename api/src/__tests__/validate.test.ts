import { isValidPhone, isValidOtp, isValidWord, isNonEmptyString } from '../lib/validate';

describe('isValidPhone', () => {
  it('accepts plain digit strings', () => expect(isValidPhone('9876543210')).toBe(true));
  it('accepts a leading +', () => expect(isValidPhone('+19876543210')).toBe(true));
  it('rejects letters', () => expect(isValidPhone('abcdefghij')).toBe(false));
  it('rejects too short', () => expect(isValidPhone('123')).toBe(false));
  it('rejects non-string', () => expect(isValidPhone(12345)).toBe(false));
});

describe('isValidOtp', () => {
  it('accepts a 6-digit code', () => expect(isValidOtp('123456')).toBe(true));
  it('rejects a 5-digit code', () => expect(isValidOtp('12345')).toBe(false));
  it('rejects non-numeric', () => expect(isValidOtp('12345a')).toBe(false));
});

describe('isValidWord', () => {
  it('accepts a normal word', () => expect(isValidWord('happiness')).toBe(true));
  it('rejects empty string', () => expect(isValidWord('   ')).toBe(false));
  it('rejects overly long input', () => expect(isValidWord('a'.repeat(61))).toBe(false));
});

describe('isNonEmptyString', () => {
  it('accepts non-empty', () => expect(isNonEmptyString('x')).toBe(true));
  it('rejects empty/whitespace', () => expect(isNonEmptyString('   ')).toBe(false));
  it('rejects non-string', () => expect(isNonEmptyString(5)).toBe(false));
});
