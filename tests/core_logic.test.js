import test from 'node:test';
import assert from 'node:assert/strict';

import { logReading, getAlertLevel, mmolToMgdl, mgdlToMmol, getReadings } from '../src/logic/readings.js';
import { logAdherence, calculateAdherenceRate, getRefillStatus, checkEscalationTrigger } from '../src/logic/adherence.js';
import { clearAll, saveProfile, savePrescriptionState, getProfile } from '../src/storage/store.js';

test('Core Logic: Reading log is immutable and appends records', () => {
  clearAll();
  const r1 = logReading('BP', { systolic: 120, diastolic: 80 }, '2026-08-22T08:00:00Z', 'Morning');
  const r2 = logReading('BP', { systolic: 125, diastolic: 82 }, '2026-08-22T12:00:00Z', 'Correction note', r1.entry.id);

  const all = getReadings();
  assert.equal(all.length, 2);
  assert.equal(all[0].id, r1.entry.id);
  assert.equal(all[1].isCorrection, true);
  assert.equal(all[1].originalReadingId, r1.entry.id);
});

test('Core Logic: getAlertLevel returns dual outputs (displayBand AND isEmergency)', () => {
  // Routine reading
  const res1 = getAlertLevel('BP', { systolic: 128, diastolic: 82 });
  assert.equal(res1.isEmergency, false);
  assert.equal(res1.emergencyDetails, null);
  assert.equal(res1.displayBand.id, 'normal');

  // Emergency High BP (>= 200/100)
  const res2 = getAlertLevel('BP', { systolic: 204, diastolic: 108 });
  assert.equal(res2.isEmergency, true);
  assert.equal(res2.emergencyDetails.type, 'EMERGENCY_HIGH_BP');
  assert.equal(res2.emergencyDetails.requiresAcknowledgment, true);
  assert.equal(res2.displayBand.id, 'grade_2');

  // Emergency Low BP (< 80)
  const res3 = getAlertLevel('BP', { systolic: 76, diastolic: 50 });
  assert.equal(res3.isEmergency, true);
  assert.equal(res3.emergencyDetails.type, 'EMERGENCY_LOW_BP');
});

test('Core Logic: calculateAdherenceRate evaluates check-in proxy vs 80% cutoff', () => {
  const dummyLogs = [
    { date: '2026-08-01', status: 'took' },
    { date: '2026-08-02', status: 'took' },
    { date: '2026-08-03', status: 'took' },
    { date: '2026-08-04', status: 'took' },
    { date: '2026-08-05', status: 'missed' }
  ]; // 4 out of 5 = 80%

  const res = calculateAdherenceRate(null, 5, dummyLogs, '2026-08-05');
  assert.equal(res.rate, 80);
  assert.equal(res.isAdherent, true);

  const dummyLogsLow = [
    { date: '2026-08-01', status: 'took' },
    { date: '2026-08-02', status: 'missed' },
    { date: '2026-08-03', status: 'took' },
    { date: '2026-08-04', status: 'missed' }
  ]; // 2 out of 4 = 50%

  const resLow = calculateAdherenceRate(null, 4, dummyLogsLow, '2026-08-04');
  assert.equal(resLow.rate, 50);
  assert.equal(resLow.isAdherent, false);
});

test('Core Logic: getRefillStatus evaluates max(7 days, 20% of supply)', () => {
  // Case A: 30 day supply. 20% is 6 days. Max(7, 6) = 7 days.
  const ps30 = { totalDays: 30, lastRefillDate: '2026-08-01' };
  // On Day 22 (Aug 23), elapsed is 22 days, remaining is 8 days -> Not due yet
  const s1 = getRefillStatus(ps30, '2026-08-23');
  assert.equal(s1.daysRemaining, 8);
  assert.equal(s1.reminderThreshold, 7);
  assert.equal(s1.isReminderDue, false);

  // On Day 23 (Aug 24), remaining is 7 days -> Reminder Due!
  const s2 = getRefillStatus(ps30, '2026-08-24');
  assert.equal(s2.daysRemaining, 7);
  assert.equal(s2.isReminderDue, true);

  // Case B: 90 day supply. 20% is 18 days. Max(7, 18) = 18 days.
  const ps90 = { totalDays: 90, lastRefillDate: '2026-06-01' };
  // On Day 72 (Aug 12), remaining is 18 days -> Reminder Due!
  const s3 = getRefillStatus(ps90, '2026-08-12');
  assert.equal(s3.reminderThreshold, 18);
  assert.equal(s3.daysRemaining, 18);
  assert.equal(s3.isReminderDue, true);
});

test('Core Logic: checkEscalationTrigger 5-day self-prompt and 7-day contact notify', () => {
  const profileWithEscalation = { optInEscalation: true, createdAt: '2026-08-01T00:00:00Z' };

  // 4 days missed -> none
  const log4d = [{ date: '2026-08-10', status: 'took' }];
  assert.equal(checkEscalationTrigger(log4d, profileWithEscalation, '2026-08-14'), 'none');

  // 5 days missed -> self_prompt_due
  assert.equal(checkEscalationTrigger(log4d, profileWithEscalation, '2026-08-15'), 'self_prompt_due');

  // 7 days missed with escalation enabled -> contact_notify_due
  assert.equal(checkEscalationTrigger(log4d, profileWithEscalation, '2026-08-17'), 'contact_notify_due');

  // 7 days missed with escalation disabled -> stays self_prompt_due
  const profileDisabled = { optInEscalation: false, createdAt: '2026-08-01T00:00:00Z' };
  assert.equal(checkEscalationTrigger(log4d, profileDisabled, '2026-08-17'), 'self_prompt_due');

  // Late check-in arrives -> resets to none
  const logLate = [
    { date: '2026-08-17', status: 'took' },
    { date: '2026-08-10', status: 'took' }
  ];
  assert.equal(checkEscalationTrigger(logLate, profileWithEscalation, '2026-08-17'), 'none');
});
