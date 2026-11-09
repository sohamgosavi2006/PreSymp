// HI/BN need native-speaker review
// Fixed phrase bank for reminders and the follow-up card. Nothing here is translated by a machine
// at run time: every string is written out. The Hindi and Bengali strings are drafts and need a
// native-speaker review before anyone outside the team sees them.
import { parts } from './dates'

export type Lang = 'en' | 'hi' | 'bn'
export const LANGS: Lang[] = ['en', 'hi', 'bn']
export const LANG_NAME: Record<Lang, string> = { en: 'English', hi: 'Hindi', bn: 'Bengali' }
export const LANG_TAB: Record<Lang, string> = { en: 'EN', hi: 'हिं', bn: 'বাং' }

export const CLINIC = 'Demo Diabetes Clinic'
export const CLINIC_PHONE = '033 0000 0000 (fictional)'

type Tri = Record<Lang, string>

// check names, as used in the reminder messages
export const CHECK: Record<string, Tri> = {
  repeat_uacr: { en: 'follow-up urine test', hi: 'दोबारा यूरिन टेस्ट', bn: 'ফলো-আপ প্রস্রাব পরীক্ষা' },
  panel: {
    en: 'yearly kidney check (blood and urine tests)',
    hi: 'किडनी की वार्षिक जाँच (खून और यूरिन टेस्ट)',
    bn: 'কিডনির বার্ষিক পরীক্ষা (রক্ত ও প্রস্রাব)',
  },
  egfr2: { en: 'second kidney blood test', hi: 'किडनी का दूसरा ब्लड टेस्ट', bn: 'কিডনির দ্বিতীয় রক্ত পরীক্ষা' },
  fundus: { en: 'eye check', hi: 'आँखों की जाँच (फंडस)', bn: 'চোখের পরীক্ষা (ফান্ডাস)' },
  foot: { en: 'foot check', hi: 'पैरों की जाँच', bn: 'পায়ের পরীক্ষা' },
}

export const REMINDER: Tri = {
  en: 'Namaste {name}. This is a reminder from {clinic} that your {item} is due. Please call the clinic to book a time.',
  hi: 'नमस्ते {name}। {clinic} की ओर से याद दिलाया जा रहा है कि आपकी {item} का समय हो गया है। कृपया समय तय करने के लिए क्लिनिक को फोन करें।',
  bn: 'নমস্কার {name}। {clinic} থেকে মনে করিয়ে দেওয়া হচ্ছে যে আপনার {item}-এর সময় হয়েছে। অনুগ্রহ করে সময় ঠিক করতে ক্লিনিকে ফোন করুন।',
}

export const reminder = (lang: Lang, name: string, key: string) =>
  REMINDER[lang].replace('{name}', name).replace('{clinic}', CLINIC).replace('{item}', CHECK[key][lang])

export const MONTHS: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
  bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
}

export function dateIn(lang: Lang, d: string) {
  const p = parts(d)
  return `${p.d} ${MONTHS[lang][p.m - 1]} ${p.y}`
}

export const CARD = {
  title: { en: 'Follow-up card', hi: 'फॉलो-अप कार्ड', bn: 'ফলো-আপ কার্ড' },
  patient: { en: 'Patient', hi: 'मरीज़', bn: 'রোগী' },
  id: { en: 'ID', hi: 'आईडी', bn: 'আইডি' },
  phone: { en: 'Clinic phone', hi: 'क्लिनिक का फ़ोन', bn: 'ক্লিনিকের ফোন' },
  done: { en: 'Done', hi: 'हो चुका', bn: 'করা হয়েছে' },
  next: { en: 'Next', hi: 'अगला', bn: 'পরবর্তী' },
  appt: { en: 'Next appointment', hi: 'अगली अपॉइंटमेंट', bn: 'পরবর্তী অ্যাপয়েন্টমেন্ট' },
  last: { en: 'Last results', hi: 'पिछले परिणाम', bn: 'সর্বশেষ ফলাফল' },
  date: { en: 'Date', hi: 'तारीख', bn: 'তারিখ' },
  none: { en: 'Nothing on file yet', hi: 'अभी कुछ दर्ज नहीं है', bn: 'এখনও কিছু নথিভুক্ত নেই' },
  call: {
    en: 'Please call the clinic to book a time.',
    hi: 'कृपया समय तय करने के लिए क्लिनिक को फोन करें।',
    bn: 'অনুগ্রহ করে সময় ঠিক করতে ক্লিনিকে ফোন করুন।',
  },
  by: { en: 'Approved by', hi: 'स्वीकृत', bn: 'অনুমোদন' },
  note: { en: "Doctor's note", hi: 'डॉक्टर का नोट', bn: 'ডাক্তারের নোট' },
} satisfies Record<string, Tri>
