/**
 * TunzaCare i18n Lookup Engine (/src/i18n/i18n.js)
 */

import en from './en.json' with { type: 'json' };
import sw from './sw.json' with { type: 'json' };
import { getProfile, saveProfile } from '../storage/store.js';

const dictionaries = { en, sw };

export function getCurrentLanguage() {
  const profile = getProfile();
  return (profile && profile.language === 'en') ? 'en' : 'sw';
}

export function setLanguage(lang) {
  const target = lang === 'en' ? 'en' : 'sw';
  saveProfile({ language: target });
  return target;
}

export function toggleLanguage() {
  const current = getCurrentLanguage();
  const next = current === 'en' ? 'sw' : 'en';
  return setLanguage(next);
}

/**
 * Translates a dot-notated key with optional interpolation tokens.
 * @param {string} keyPath e.g. "home.refill_left"
 * @param {object} params e.g. { days: 6 }
 * @param {string} langOverride Optional
 * @returns {string}
 */
export function t(keyPath, params = {}, langOverride = null) {
  const lang = langOverride || getCurrentLanguage();
  const dict = dictionaries[lang] || dictionaries.sw;

  const parts = keyPath.split('.');
  let current = dict;

  for (const p of parts) {
    if (current && typeof current === 'object' && p in current) {
      current = current[p];
    } else {
      // Fallback to English, then Swahili, then keyPath
      const fallback = dictionaries.en;
      let fbVal = fallback;
      for (const fp of parts) {
        if (fbVal && typeof fbVal === 'object' && fp in fbVal) {
          fbVal = fbVal[fp];
        } else {
          fbVal = null;
          break;
        }
      }
      current = fbVal || keyPath;
      break;
    }
  }

  if (typeof current !== 'string') {
    return keyPath;
  }

  // Interpolation
  let result = current;
  for (const [k, v] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }

  return result;
}
