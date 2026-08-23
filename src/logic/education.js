/**
 * TunzaCare Contextual Education Module (/src/logic/education.js)
 * 
 * - Supportive, non-shaming micro-education (AGENTS.md Rule 7 & 12)
 * - Topic-level state tracking (prevents mechanical repetition)
 * - Triggered at moments that matter
 */

import { getEducationState, markTopicShown } from '../storage/store.js';
import { getRefillStatus } from './adherence.js';

export const EDUCATION_TOPICS = [
  {
    id: 'asymptomatic_paradox',
    title_en: 'Why keep tracking, even on good days?',
    body_en: 'Blood pressure and blood sugar can rise quietly without any symptoms. Regular readings catch changes early — not how you feel day to day.',
    title_sw: 'Kwa nini uendelee kupima hata siku nzuri?',
    body_sw: 'Shinikizo la damu na sukari vinaweza kupanda kimya kimya bila dalili zozote. Vipimo vya mara kwa mara ndivyo vinavyotambua mabadiliko mapema — si jinsi unavyohisi kila siku.'
  },
  {
    id: 'feeling_healthy_evidence',
    title_en: 'Feeling healthy means treatment is working',
    body_en: 'When you feel energetic and strong, that is evidence your medication is doing its protective job. Keep the momentum going!',
    title_sw: 'Kuhisi vizuri ni ushahidi kwamba matibabu yanafanya kazi',
    body_sw: 'Unapohisi nguvu na afya njema, huo ni ushahidi kwamba dawa yako inafanya kazi yake ya kukulinda. Endelea na safari hii nzuri!'
  },
  {
    id: 'refill_early',
    title_en: 'Plan your refill early',
    body_en: 'Refilling a few days before your last tablet ensures you never have a gap day. Your local dispensary or chemist can assist you.',
    title_sw: 'Panga kupata dawa mapema',
    body_sw: 'Kuchukua dawa siku chache kabla kidonge chako cha mwisho hakijaisha kunakuhakikishia hukosi dozi. Zahanati au duka la dawa lililo karibu linaweza kukusaidia.'
  },
  {
    id: 'organ_protection',
    title_en: 'One day at a time',
    body_en: 'Managing chronic health is a long journey. Every single day of taking care of yourself protects your heart, brain, kidneys, and eyes.',
    title_sw: 'Siku moja baada ya nyingine',
    body_sw: 'Kusimamia afya ya muda mrefu ni safari endelevu. Kila siku unayojali afya yako unalinda moyo, ubongo, figo na macho yako.'
  }
];

/**
 * Returns the most relevant contextual card based on current patient state
 * @param {object} context { feelingFineStreak, adherenceStreak, daysRemaining }
 */
export function getContextualEducationCard(context = {}) {
  const refill = getRefillStatus();
  const daysLeft = context.daysRemaining !== undefined ? context.daysRemaining : refill.daysRemaining;
  const feelingStreak = context.feelingFineStreak || 0;
  const streak = context.adherenceStreak || 0;

  let chosenTopicId = 'organ_protection';

  if (daysLeft <= 7) {
    chosenTopicId = 'refill_early';
  } else if (feelingStreak >= 3) {
    chosenTopicId = 'feeling_healthy_evidence';
  } else if (streak >= 5) {
    chosenTopicId = 'asymptomatic_paradox';
  } else {
    chosenTopicId = 'organ_protection';
  }

  const topic = EDUCATION_TOPICS.find(t => t.id === chosenTopicId) || EDUCATION_TOPICS[0];
  markTopicShown(topic.id);
  return topic;
}
