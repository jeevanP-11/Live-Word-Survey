export function isValidPhone(phone: unknown): phone is string {
  if (typeof phone !== 'string') return false;
  // Accepts optional leading + then 7-15 digits (E.164-ish, permissive for a test-bed)
  return /^\+?[0-9]{7,15}$/.test(phone.trim());
}

export function isValidOtp(otp: unknown): otp is string {
  return typeof otp === 'string' && /^[0-9]{6}$/.test(otp.trim());
}

export function isValidWord(word: unknown): word is string {
  if (typeof word !== 'string') return false;
  const trimmed = word.trim();
  return trimmed.length > 0 && trimmed.length <= 60;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
