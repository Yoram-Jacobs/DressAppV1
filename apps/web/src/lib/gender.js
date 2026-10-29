/**
 * Centralized gender resolution utilities for DressApp.
 * Normalizes varied database, profile, and UI representations of gender/sex
 * ('male', 'men', 'man', 'm', 'boy', 'masculine', 'זכר', 'גבר', 'רגל', 'ذكر', 'رجل')
 * into canonical binary / neutral states for avatar rendering and styling logic.
 */

export function isMaleGender(val) {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s === 'male' ||
    s === 'men' ||
    s === 'man' ||
    s === 'm' ||
    s === 'boy' ||
    s === 'masculine' ||
    s === 'גבר' ||
    s === 'זכר' ||
    s === 'זכרי' ||
    s === 'رجل' ||
    s === 'ذكر'
  );
}

export function isFemaleGender(val) {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s === 'female' ||
    s === 'women' ||
    s === 'woman' ||
    s === 'w' ||
    s === 'girl' ||
    s === 'feminine' ||
    s === 'אישה' ||
    s === 'נקבה' ||
    s === 'נקבי' ||
    s === 'נשים' ||
    s === 'امرأة' ||
    s === 'أنثى'
  );
}

export function normalizeGender(val, fallback = 'female') {
  if (!val) return fallback;
  if (isMaleGender(val)) return 'male';
  if (isFemaleGender(val)) return 'female';
  return fallback;
}
