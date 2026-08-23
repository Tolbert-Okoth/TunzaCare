import test from 'node:test';
import assert from 'node:assert/strict';

import en from '../src/i18n/en.json' with { type: 'json' };
import sw from '../src/i18n/sw.json' with { type: 'json' };
import { t, setLanguage } from '../src/i18n/i18n.js';
import { clearAll } from '../src/storage/store.js';

function getLeafKeys(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(getLeafKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getAllStringValues(obj) {
  let strings = [];
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      strings = strings.concat(getAllStringValues(v));
    } else if (typeof v === 'string') {
      strings.push(v);
    }
  }
  return strings;
}

test('i18n (Rule 6): Bidirectional 1:1 key parity between English and Swahili', () => {
  const enKeys = getLeafKeys(en).sort();
  const swKeys = getLeafKeys(sw).sort();

  // Check EN keys in SW
  const missingInSw = enKeys.filter(k => !swKeys.includes(k));
  assert.deepEqual(missingInSw, [], `Keys in EN but missing in SW: ${missingInSw.join(', ')}`);

  // Check SW keys in EN
  const missingInEn = swKeys.filter(k => !enKeys.includes(k));
  assert.deepEqual(missingInEn, [], `Keys in SW but missing in EN: ${missingInEn.join(', ')}`);

  // Assert counts match exactly
  assert.equal(enKeys.length, swKeys.length);
  assert.ok(enKeys.length > 25, 'Should have comprehensive dictionary coverage');
});

test('i18n: Lookup and interpolation work accurately', () => {
  clearAll();
  setLanguage('en');
  assert.equal(t('home.refill_left', { days: 6 }), '6 days of medication left');

  setLanguage('sw');
  assert.equal(t('home.refill_left', { days: 6 }), 'Siku 6 za dawa zimebaki');
});

test('i18n (USER ITEM 4 / Rule 7): Non-shaming copy audit across all strings', () => {
  const allEnStrings = getAllStringValues(en);
  const allSwStrings = getAllStringValues(sw);

  const shamingEnglishKeywords = [
    /\bfailed to\b/i,
    /\byou failed\b/i,
    /\byou didn't\b/i,
    /\bshould have\b/i,
    /\byou broke\b/i,
    /\bguilty\b/i,
    /\bbad patient\b/i,
    /\bdisobedient\b/i
  ];

  for (const str of allEnStrings) {
    for (const pattern of shamingEnglishKeywords) {
      assert.equal(pattern.test(str), false, `Shaming keyword detected in EN copy: "${str}" matching ${pattern}`);
    }
  }

  const shamingSwahiliKeywords = [
    /\bulishindwa\b/i,
    /\bumeharibu\b/i,
    /\bmakosa yako\b/i,
    /\bunazembea\b/i
  ];

  for (const str of allSwStrings) {
    for (const pattern of shamingSwahiliKeywords) {
      assert.equal(pattern.test(str), false, `Shaming keyword detected in SW copy: "${str}" matching ${pattern}`);
    }
  }
});
