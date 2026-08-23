import test from 'node:test';
import assert from 'node:assert/strict';

import {
  composeEscalationMessage,
  validateZeroHealthData,
  sendEscalationTrigger,
  setNetworkStatusMock,
  processOfflineQueue
} from '../src/escalation/escalation.js';
import { clearAll, getProfile, createDefaultProfile, getEscalationQueue } from '../src/storage/store.js';
import { checkEscalationTrigger, logAdherence } from '../src/logic/adherence.js';

test('Escalation Invariant (USER ITEM 2): Fresh profile defaults strictly to disabled', () => {
  clearAll();
  const fresh = getProfile();
  assert.equal(fresh.optInEscalation, false, 'Rule 4 violation: optInEscalation must be false by default');
  
  const def = createDefaultProfile();
  assert.equal(def.optInEscalation, false, 'Default profile template must have optInEscalation: false');
});

test('Escalation Privacy (Rule 4): Composed message contains ONLY display name and zero health data', () => {
  const msgEn = composeEscalationMessage('Asha', 'en');
  const msgSw = composeEscalationMessage('Asha', 'sw');

  // Verify display name is included
  assert.ok(msgEn.includes('Asha'));
  assert.ok(msgSw.includes('Asha'));

  // Verify validation passes for clean messages
  assert.doesNotThrow(() => validateZeroHealthData(msgEn));
  assert.doesNotThrow(() => validateZeroHealthData(msgSw));

  // Assert sensitive strings are NOT present
  const sensitiveTokens = [
    'BP', 'blood pressure', 'shinikizo', '140/90', '120/80',
    'glucose', 'sugar', 'sukari', 'kisukari', 'mg/dL', 'mmol/L',
    'hypertension', 'diabetes', 'medication', 'amlodipine', 'metformin', 'insulin',
    '80%', '86%', 'PDC', 'adherence'
  ];

  for (const token of sensitiveTokens) {
    assert.equal(msgEn.toLowerCase().includes(token.toLowerCase()), false, `Health token "${token}" found in English escalation message!`);
    assert.equal(msgSw.toLowerCase().includes(token.toLowerCase()), false, `Health token "${token}" found in Swahili escalation message!`);
  }

  // Verify validator throws if sensitive health data is injected
  assert.throws(() => validateZeroHealthData('Check in on Asha, BP was 150/95'));
  assert.throws(() => validateZeroHealthData('Check in on Asha, glucose is 180 mg/dL'));
  assert.throws(() => validateZeroHealthData('Check in on Asha, adherence dropped to 60%'));
  assert.throws(() => validateZeroHealthData('Check in on Asha, forgot Metformin'));
});

test('Escalation Invariant: Disabled escalation returns ESCALATION_DISABLED and sends nothing', async () => {
  const disabledConfig = { enabled: false, contactPhone: '+254712345678', contactName: 'Mary' };
  const msg = composeEscalationMessage('Asha', 'en');

  const res = await sendEscalationTrigger(disabledConfig, msg);
  assert.equal(res.success, false);
  assert.equal(res.reason, 'ESCALATION_DISABLED');
});

test('Escalation Invariant (USER ITEM 3): Offline queue-and-retry handles dropped connection', async () => {
  clearAll();
  const enabledConfig = { enabled: true, contactPhone: '+254712345678', contactName: 'Mary' };
  const msg = composeEscalationMessage('Asha', 'en');

  // 1. Simulate network failure (offline)
  setNetworkStatusMock(false);

  const offlineRes = await sendEscalationTrigger(enabledConfig, msg);
  assert.equal(offlineRes.success, false);
  assert.equal(offlineRes.queued, true);
  assert.equal(offlineRes.reason, 'OFFLINE_QUEUED');

  // Verify signal is in the offline queue
  const queue = getEscalationQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].signal.message, msg);

  // 2. Simulate network restored (online)
  setNetworkStatusMock(true);

  const retryRes = await processOfflineQueue(enabledConfig);
  assert.equal(retryRes.processed, 1);
  assert.equal(retryRes.results[0].success, true);
  assert.equal(retryRes.results[0].transport, 'STUBBED_GATEWAY_V1');

  // Verify queue is cleared after successful dispatch
  const queueAfter = getEscalationQueue();
  assert.equal(queueAfter.length, 0);
});

test('Escalation Adversarial: Late check-in cancels pending escalation trigger', () => {
  const config = { optInEscalation: true, createdAt: '2026-08-01T00:00:00Z' };

  // 7 days missed -> contact_notify_due
  const missedLogs = [{ date: '2026-08-01', status: 'took' }];
  assert.equal(checkEscalationTrigger(missedLogs, config, '2026-08-08'), 'contact_notify_due');

  // Late check-in arrives on Day 8
  const resolvedLogs = [
    { date: '2026-08-08', status: 'took' },
    { date: '2026-08-01', status: 'took' }
  ];

  // Immediately resets to 'none'
  assert.equal(checkEscalationTrigger(resolvedLogs, config, '2026-08-08'), 'none');
});

test('Escalation Adversarial: Mid-cycle disable stops pending contact notification', () => {
  const missedLogs = [{ date: '2026-08-01', status: 'took' }];

  // Enabled -> contact_notify_due
  const enabledConfig = { optInEscalation: true, createdAt: '2026-08-01T00:00:00Z' };
  assert.equal(checkEscalationTrigger(missedLogs, enabledConfig, '2026-08-08'), 'contact_notify_due');

  // Patient disables escalation in settings mid-cycle
  const disabledConfig = { optInEscalation: false, createdAt: '2026-08-01T00:00:00Z' };
  // Does NOT notify contact -> returns self_prompt_due only
  assert.equal(checkEscalationTrigger(missedLogs, disabledConfig, '2026-08-08'), 'self_prompt_due');
});
