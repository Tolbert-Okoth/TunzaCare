/**
 * TunzaCare Isolated Escalation Subsystem (/src/escalation/escalation.js)
 * 
 * STRICT ARCHITECTURAL GOVERNANCE (03_ARCHITECTURE.md & AGENTS.md Rule 4 & 5):
 * 1. This file/folder is the ONLY code in the entire repository allowed to communicate off-device.
 * 2. Escalation is OFF by default.
 * 3. Composed messages are fixed templates containing ONLY the patient's chosen display name.
 *    ZERO health data (no BP, no glucose, no %, no medication names) is ever included.
 * 4. sendEscalationTrigger is the sole chokepoint for outbound transport.
 * 5. Supports offline queue-and-retry if connectivity is unavailable.
 */

import { enqueueEscalation, getEscalationQueue, clearEscalationQueue } from '../storage/store.js';

/**
 * Composes the privacy-preserving escalation message.
 * Strictly fixed template with patient display name only.
 * 
 * @param {string} patientDisplayName 
 * @param {'sw' | 'en'} contactLanguage 
 * @returns {string}
 */
export function composeEscalationMessage(patientDisplayName = 'Asha', contactLanguage = 'sw') {
  const name = (patientDisplayName || 'Mwanachama').trim();

  if (contactLanguage === 'en') {
    return `Hi, this is a check-in reminder from ${name}'s health app. They haven't logged an update in a week — it might be worth checking in with them.`;
  }

  // Default Kenyan Swahili
  return `Habari, hii ni taarifa ya kumjulia hali ${name} kutoka kwenye programu yake ya afya. Hajathibitisha rekodi yake kwa wiki moja — tafadhali wasiliana naye kumjulia hali.`;
}

/**
 * Validates that an outbound message contains zero clinical or diagnostic data.
 * Safety invariant runtime check.
 */
export function validateZeroHealthData(messageText) {
  const forbiddenPatterns = [
    /\b\d{2,3}\/\d{2,3}\b/, // BP patterns e.g. 140/90, 120/80
    /\b(bp|systolic|diastolic|mmhg|blood pressure|shinikizo)\b/i,
    /\b(glucose|sugar|mmol\/l|mg\/dl|sukari|kisukari)\b/i,
    /\b(hypertension|diabetes|dawa|medication|adherence|pdc|amlodipine|metformin|insulin|losartan)\b/i,
    /\b\d+%/ // Percentage e.g. 80%, 60%
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(messageText)) {
      throw new Error(`Safety violation: Escalation message contains sensitive health data (${pattern})`);
    }
  }
  return true;
}

/**
 * Transport Adapter Strategy.
 * In v1, outbound transport is explicitly stubbed and logged in /docs/DECISIONS.md.
 * Real SMS gateway integration (e.g. Africa's Talking / Safaricom) requires Osus's strategic input.
 */
let isOnlineMock = true; // For testing offline queue-and-retry
export function setNetworkStatusMock(isOnline) {
  isOnlineMock = Boolean(isOnline);
}

/**
 * Outbound Chokepoint: The ONLY function in the codebase allowed to send data off-device.
 * 
 * @param {object} config { enabled: boolean, contactPhone: string, contactName: string }
 * @param {string} message Composed message
 * @returns {Promise<object>} Result
 */
export async function sendEscalationTrigger(config, message) {
  if (!config || !config.enabled) {
    return {
      success: false,
      reason: 'ESCALATION_DISABLED',
      message: 'Escalation is not enabled in patient settings.'
    };
  }

  // Safety validation
  validateZeroHealthData(message);

  const payload = {
    event: 'TUNZACARE_ESCALATION_SIGNAL',
    timestamp: new Date().toISOString(),
    recipientPhone: config.contactPhone || null,
    recipientName: config.contactName || 'Trusted Contact',
    message,
    clinicalDataIncluded: false
  };

  // Offline queue-and-retry logic (03_ARCHITECTURE.md)
  const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
    ? navigator.onLine
    : isOnlineMock;

  if (!isOnline) {
    enqueueEscalation(payload);
    return {
      success: false,
      queued: true,
      reason: 'OFFLINE_QUEUED',
      message: 'No network connection. Escalation signal queued for retry.'
    };
  }

  // V1 Stubbed Transport (Simulated Dispatch)
  return {
    success: true,
    transport: 'STUBBED_GATEWAY_V1',
    dispatchedAt: new Date().toISOString(),
    payload
  };
}

/**
 * Processes queued offline escalation triggers upon connection recovery
 */
export async function processOfflineQueue(config) {
  const queue = getEscalationQueue();
  if (queue.length === 0) return { processed: 0 };

  const results = [];
  for (const item of queue) {
    const res = await sendEscalationTrigger(config, item.signal.message);
    results.push(res);
  }

  clearEscalationQueue();
  return { processed: results.length, results };
}
