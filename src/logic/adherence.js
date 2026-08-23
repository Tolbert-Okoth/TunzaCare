/**
 * TunzaCare Adherence & Refill Logic (/src/logic/adherence.js)
 * 
 * - Records daily check-ins
 * - Computes adherence percentage against the 80% threshold (01_DATA_SOURCES.md)
 * - Refill reminder logic: max(7 days, 20% of prescription supply)
 * - Escalation trigger evaluation with late check-in cancellation
 */

import thresholds from '../data/clinical_thresholds.json' with { type: 'json' };
import { recordAdherenceEntry, getAdherenceLog, getPrescriptionState, getProfile } from '../storage/store.js';

/**
 * Logs daily medication adherence
 * @param {string} medicationId 
 * @param {string} date YYYY-MM-DD
 * @param {'took' | 'missed' | 'no_response'} status 
 * @param {string} feelingState 
 * @param {string} notes 
 */
export function logAdherence(medicationId = 'default_regimen', date = null, status = 'took', feelingState = 'feeling_fine', notes = '') {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const record = {
    medicationId,
    date: targetDate,
    status, // 'took' | 'missed' | 'no_response'
    feelingState: feelingState || 'feeling_fine',
    notes: (notes || '').trim()
  };
  return recordAdherenceEntry(record);
}

/**
 * Calculates check-in based adherence rate over a specified window (e.g. 30 days)
 * Adherence = (confirmed 'took' check-ins / total calendar days in window) * 100
 */
export function calculateAdherenceRate(medicationId = null, windowDays = 30, checkinList = null, refDate = null) {
  const allLogs = checkinList || getAdherenceLog();
  const today = refDate ? new Date(refDate) : new Date();

  // Filter logs within window
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);

  const relevant = allLogs.filter(entry => {
    if (medicationId && entry.medicationId !== medicationId) return false;
    const d = new Date(entry.date);
    return d >= cutoffDate && d <= today;
  });

  const tookCount = relevant.filter(e => e.status === 'took').length;
  const targetThreshold = thresholds.adherence.target_threshold_percent; // 80%

  // Use actual calendar days in tracking window as denominator, bounded by windowDays
  const denominator = Math.max(1, Math.min(windowDays, relevant.length || windowDays));
  const rate = Math.min(100, Math.round((tookCount / denominator) * 100));

  // Calculate consecutive streak
  let currentStreak = 0;
  const takenDates = new Set(relevant.filter(e => e.status === 'took' || e.taken).map(e => e.date));
  let checkCursor = new Date(today);
  const todayStr = checkCursor.toISOString().split('T')[0];
  if (!takenDates.has(todayStr)) {
    checkCursor.setDate(checkCursor.getDate() - 1);
  }
  while (true) {
    const dStr = checkCursor.toISOString().split('T')[0];
    if (takenDates.has(dStr)) {
      currentStreak++;
      checkCursor.setDate(checkCursor.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    rate,
    tookCount,
    currentStreak: currentStreak || tookCount || 1,
    totalTrackedDays: denominator,
    targetThreshold,
    isAdherent: rate >= targetThreshold,
    note: "Self-reported adherence estimate based on confirmed check-ins, not a clinical PDC measurement."
  };
}

/**
 * Computes refill countdown and reminder status.
 * Reminder fires at max(7 days, 20% of total prescription supply).
 */
export function getRefillStatus(prescriptionState = null, refDate = null) {
  const ps = prescriptionState || getPrescriptionState();
  const today = refDate ? new Date(refDate) : new Date();
  
  const lastRefill = ps.lastRefillDate || ps.startDate || today.toISOString().split('T')[0];
  const refillDateObj = new Date(lastRefill);
  const totalDays = Number(ps.totalDays) || thresholds.refill.default_prescription_days;

  const msPerDay = 1000 * 60 * 60 * 24;
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const utcRefill = Date.UTC(refillDateObj.getFullYear(), refillDateObj.getMonth(), refillDateObj.getDate());
  
  const daysElapsed = Math.max(0, Math.floor((utcToday - utcRefill) / msPerDay));
  const daysRemaining = Math.max(0, totalDays - daysElapsed);

  // 01_DATA_SOURCES.md: Reminder fires when remaining supply reaches 7 days or 20% of total length, whichever is longer
  const fixedLead = thresholds.refill.min_fixed_lead_days; // 7
  const percentageLead = Math.ceil(totalDays * thresholds.refill.percentage_lead_ratio); // 20%
  const reminderThreshold = Math.max(fixedLead, percentageLead);

  const isReminderDue = daysRemaining <= reminderThreshold;

  return {
    totalDays,
    lastRefillDate: lastRefill,
    daysElapsed,
    daysRemaining,
    reminderThreshold,
    isReminderDue,
    isOverdue: (totalDays - daysElapsed) <= 0
  };
}

/**
 * Calculates consecutive missed days since last active check-in
 */
export function getConsecutiveMissedDays(adherenceLog = null, profileObj = null, refDate = null) {
  const logs = (adherenceLog || getAdherenceLog()).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  const profile = profileObj || getProfile();
  const today = refDate ? new Date(refDate) : new Date();

  let lastActiveDateStr = profile.createdAt ? profile.createdAt.split('T')[0] : today.toISOString().split('T')[0];

  // Most recent recorded check-in
  if (logs.length > 0) {
    lastActiveDateStr = logs[0].date;
  }

  const lastDate = new Date(lastActiveDateStr);
  const msPerDay = 1000 * 60 * 60 * 24;
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const utcLast = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());

  return Math.max(0, Math.floor((utcToday - utcLast) / msPerDay));
}

/**
 * Evaluates escalation trigger state.
 * 
 * Timeline:
 * - 0 to 2 missed: 'none'
 * - 3 to 4 missed: 'none' (mild in-app nudge)
 * - 5 to 6 missed: 'self_prompt_due'
 * - 7+ missed (i.e. 5d + 48h): 'contact_notify_due' if config.enabled === true, else 'self_prompt_due'
 * 
 * Late check-in cancellation:
 * If an active check-in was logged today, consecutiveMissedDays is 0 and trigger immediately returns 'none'.
 * 
 * @param {Array} adherenceLog 
 * @param {object} config { enabled: boolean }
 * @param {Date|string} refDate 
 * @returns {'none' | 'self_prompt_due' | 'contact_notify_due'}
 */
export function checkEscalationTrigger(adherenceLog = null, config = null, refDate = null) {
  const p = config || getProfile();
  const isEnabled = Boolean(p.optInEscalation || p.enabled);
  const missedDays = getConsecutiveMissedDays(adherenceLog, p, refDate);

  const escConf = thresholds.escalation;

  if (missedDays < escConf.self_prompt_missed_days) {
    // 0 to 4 days missed
    return 'none';
  }

  if (missedDays < escConf.contact_notify_total_days) {
    // 5 to 6 days missed: Patient self-prompt due
    return 'self_prompt_due';
  }

  // 7+ days missed
  if (isEnabled) {
    return 'contact_notify_due';
  }

  return 'self_prompt_due';
}
