/**
 * TunzaCare Storage Engine (/src/storage/store.js)
 * 
 * Local-First, on-device data store.
 * Supports localStorage with synchronous in-memory fallback for Node.js test environments.
 * Implements immutable reading logs and topic-level education tracking.
 */

const memoryStore = new Map();

function isLocalStorageAvailable() {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function getRawItem(key) {
  try {
    if (isLocalStorageAvailable()) {
      let val = window.localStorage.getItem(key);
      if (!val && key.startsWith('tunzacare_')) {
        // Fallback to legacy endelea_ key if migrating
        const legacyKey = key.replace('tunzacare_', 'endelea_');
        val = window.localStorage.getItem(legacyKey);
      }
      return val ? JSON.parse(val) : null;
    }
    let val = memoryStore.get(key);
    if (!val && key.startsWith('tunzacare_')) {
      const legacyKey = key.replace('tunzacare_', 'endelea_');
      val = memoryStore.get(legacyKey);
    }
    return val ? JSON.parse(val) : null;
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return null;
  }
}

export function setRawItem(key, value) {
  try {
    const serialized = JSON.stringify(value);
    if (isLocalStorageAvailable()) {
      window.localStorage.setItem(key, serialized);
    } else {
      memoryStore.set(key, serialized);
    }
    notifySubscribers(key, value);
    return true;
  } catch (e) {
    console.error(`Error writing ${key} to storage:`, e);
    return false;
  }
}

export function removeRawItem(key) {
  try {
    if (isLocalStorageAvailable()) {
      window.localStorage.removeItem(key);
    } else {
      memoryStore.delete(key);
    }
    notifySubscribers(key, null);
    return true;
  } catch (e) {
    console.error(`Error removing ${key} from storage:`, e);
    return false;
  }
}

export const KEYS = {
  PROFILE: 'tunzacare_patient_profile',
  READINGS: 'tunzacare_readings',
  ADHERENCE: 'tunzacare_adherence_log',
  PRESCRIPTION: 'tunzacare_prescription_state',
  EDUCATION: 'tunzacare_education_state',
  ESCALATION_QUEUE: 'tunzacare_escalation_queue'
};

const subscribers = new Set();

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function notifySubscribers(key, value) {
  for (const sub of subscribers) {
    try {
      sub(key, value);
    } catch (e) {
      console.error('Storage subscriber error:', e);
    }
  }
}

// -------------------------------------------------------------
// PATIENT PROFILE
// Invariant: optInEscalation is strictly FALSE by default
// -------------------------------------------------------------
export function createDefaultProfile() {
  return {
    id: `pt_${Date.now()}`,
    displayName: '',
    condition: 'hypertension', // 'hypertension' | 'diabetes' | 'both'
    language: 'sw', // default Kiswahili
    optInEscalation: false, // RULE 4: Strictly OFF by default
    trustedContact: {
      name: '',
      phone: '',
      relationship: 'family'
    },
    onboardingComplete: false,
    createdAt: new Date().toISOString()
  };
}

export function getProfile() {
  const p = getRawItem(KEYS.PROFILE);
  if (!p) {
    const def = createDefaultProfile();
    setRawItem(KEYS.PROFILE, def);
    return def;
  }
  return p;
}

export function saveProfile(updates) {
  const current = getProfile();
  const updated = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  setRawItem(KEYS.PROFILE, updated);
  return updated;
}

// -------------------------------------------------------------
// PRESCRIPTION STATE
// -------------------------------------------------------------
export function createDefaultPrescription() {
  return {
    startDate: new Date().toISOString().split('T')[0],
    totalDays: 30,
    medicationName: 'Prescribed Regimen',
    lastRefillDate: new Date().toISOString().split('T')[0]
  };
}

export function getPrescriptionState() {
  const ps = getRawItem(KEYS.PRESCRIPTION);
  if (!ps) {
    const def = createDefaultPrescription();
    setRawItem(KEYS.PRESCRIPTION, def);
    return def;
  }
  return ps;
}

export function savePrescriptionState(updates) {
  const current = getPrescriptionState();
  const updated = { ...current, ...updates };
  setRawItem(KEYS.PRESCRIPTION, updated);
  return updated;
}

// -------------------------------------------------------------
// READINGS (IMMUTABLE LOG)
// -------------------------------------------------------------
export function getReadings() {
  return getRawItem(KEYS.READINGS) || [];
}

/**
 * Appends an immutable reading entry.
 * Edits create new records with a note rather than mutating historical entries.
 */
export function appendReading(reading) {
  const list = getReadings();
  const entry = {
    ...reading,
    id: reading.id || `rd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: reading.timestamp || new Date().toISOString(),
    isCorrection: Boolean(reading.isCorrection),
    originalReadingId: reading.originalReadingId || null
  };
  list.push(entry);
  setRawItem(KEYS.READINGS, list);
  return entry;
}

// -------------------------------------------------------------
// ADHERENCE LOG
// -------------------------------------------------------------
export function getAdherenceLog() {
  return getRawItem(KEYS.ADHERENCE) || [];
}

export function recordAdherenceEntry(entry) {
  const list = getAdherenceLog();
  const dateStr = entry.date || new Date().toISOString().split('T')[0];
  const medId = entry.medicationId || 'default_regimen';

  const existingIdx = list.findIndex(e => e.date === dateStr && (e.medicationId || 'default_regimen') === medId);
  const record = {
    ...entry,
    id: entry.id || `adh_${Date.now()}`,
    date: dateStr,
    medicationId: medId,
    timestamp: entry.timestamp || new Date().toISOString()
  };

  if (existingIdx >= 0) {
    list[existingIdx] = record;
  } else {
    list.push(record);
  }

  setRawItem(KEYS.ADHERENCE, list);
  return record;
}

// -------------------------------------------------------------
// EDUCATION STATE (TOPIC-LEVEL TRACKING)
// -------------------------------------------------------------
export function getEducationState() {
  return getRawItem(KEYS.EDUCATION) || { shownTopics: {} };
}

export function markTopicShown(topicId) {
  const state = getEducationState();
  state.shownTopics[topicId] = new Date().toISOString();
  setRawItem(KEYS.EDUCATION, state);
  return state;
}

// -------------------------------------------------------------
// OFFLINE ESCALATION QUEUE
// -------------------------------------------------------------
export function getEscalationQueue() {
  return getRawItem(KEYS.ESCALATION_QUEUE) || [];
}

export function enqueueEscalation(signal) {
  const queue = getEscalationQueue();
  queue.push({
    signal,
    enqueuedAt: new Date().toISOString(),
    attempts: 0
  });
  setRawItem(KEYS.ESCALATION_QUEUE, queue);
  return queue;
}

export function clearEscalationQueue() {
  setRawItem(KEYS.ESCALATION_QUEUE, []);
}

// -------------------------------------------------------------
// RESET / EXPORT & DEMO SEEDING
// -------------------------------------------------------------
export function clearAll() {
  for (const k of Object.values(KEYS)) {
    removeRawItem(k);
  }
  memoryStore.clear();
  return true;
}

export function seedDemoDataIfEmpty() {
  const profile = getRawItem(KEYS.PROFILE);
  if (!profile) {
    saveProfile({
      displayName: 'Asha',
      condition: 'both',
      language: 'sw',
      optInEscalation: false,
      escalationContact: {
        name: 'Mama Jane (CHW)',
        phone: '+254 712 345 678',
        relationship: 'chw'
      }
    });
  }

  const readings = getReadings();
  if (readings.length === 0) {
    const now = Date.now();
    const dayMs = 86400000;
    appendReading({
      type: 'BP',
      values: { systolic: 122, diastolic: 79 },
      timestamp: new Date(now - 10 * dayMs).toISOString()
    });
    appendReading({
      type: 'BP',
      values: { systolic: 134, diastolic: 86 },
      timestamp: new Date(now - 7 * dayMs).toISOString()
    });
    appendReading({
      type: 'BP',
      values: { systolic: 151, diastolic: 97 },
      timestamp: new Date(now - 4 * dayMs).toISOString()
    });
    appendReading({
      type: 'BP',
      values: { systolic: 128, diastolic: 82 },
      timestamp: new Date(now - 2 * dayMs).toISOString()
    });
    appendReading({
      type: 'BP',
      values: { systolic: 142, diastolic: 94 },
      timestamp: new Date(now - 1 * dayMs).toISOString()
    });
  }

  const adh = getAdherenceLog();
  if (adh.length === 0) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    // Seed some initial check-ins for earlier in month
    for (let d = 1; d <= Math.min(now.getDate() - 1, 10); d++) {
      if (d !== 4 && d !== 10) {
        const dStr = `${year}-${month}-${String(d).padStart(2, '0')}`;
        recordAdherenceEntry({ date: dStr, taken: true, medicationId: 'default_regimen' });
      }
    }
  }
}
