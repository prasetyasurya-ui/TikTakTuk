const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const usernameRegex = /^[a-zA-Z0-9_]{4,100}$/;

export const SQL_MAX_LENGTH = {
  USERNAME: 100,
  PASSWORD: 255,
  FULL_NAME: 100,
  PHONE_NUMBER: 20,
  ORGANIZER_NAME: 100,
  CONTACT_EMAIL: 100,
  VENUE_NAME: 100,
  CITY: 100,
  EVENT_TITLE: 200,
  CATEGORY_NAME: 50,
  ARTIST_NAME: 100,
  GENRE: 100,
};

export function normalizeText(value) {
  return (value || '').trim();
}

export function normalizePhone(value) {
  return (value || '').replace(/[\s-]/g, '').trim();
}

export function isValidEmail(value) {
  return emailRegex.test(normalizeText(value));
}

export function isValidUsername(value) {
  return usernameRegex.test(normalizeText(value));
}

export function isValidPhone(value) {
  const normalized = normalizePhone(value);
  return /^\+?[0-9]{10,15}$/.test(normalized);
}

export function isValidPassword(value) {
  return (value || '').length >= 6 && (value || '').length <= 255;
}

export function hasMaxLength(value, maxLength) {
  return normalizeText(value).length <= maxLength;
}

export function isRequired(value) {
  return normalizeText(value).length > 0;
}

export function isPositiveInteger(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
}

export function isPositiveNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0;
}

export function isNonNegativeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0;
}

