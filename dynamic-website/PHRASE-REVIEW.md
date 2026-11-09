# Hindi and Bengali phrases: native-speaker review

Every Hindi and Bengali phrase the app prints comes from the fixed phrase bank in `src/logic/phrases.ts`.
The "Back to English" column is a machine translation by Sarvam (mayura:v1), made once on a developer computer.
It only helps the reviewer spot a wrong meaning; it is not a check. Mark each row OK or write the correction.

| Where | Key | Lang | Phrase in the app | Back to English (machine) | English the app uses | Reviewer: OK / fix |
|---|---|---|---|---|---|---|
| Check name | repeat_uacr | HI | दोबारा यूरिन टेस्ट | Urine test again | follow-up urine test | |
| Check name | repeat_uacr | BN | ফলো-আপ প্রস্রাব পরীক্ষা | Follow-up urine test | follow-up urine test | |
| Check name | panel | HI | किडनी की वार्षिक जाँच (खून और यूरिन टेस्ट) | Annual Kidney Checks (blood and urine tests) | yearly kidney check (blood and urine tests) | |
| Check name | panel | BN | কিডনির বার্ষিক পরীক্ষা (রক্ত ও প্রস্রাব) | Annual Kidney Test (Blood & Urine) | yearly kidney check (blood and urine tests) | |
| Check name | egfr2 | HI | किडनी का दूसरा ब्लड टेस्ट | Kidney's second blood test | second kidney blood test | |
| Check name | egfr2 | BN | কিডনির দ্বিতীয় রক্ত পরীক্ষা | Second blood test for the kidney | second kidney blood test | |
| Check name | fundus | HI | आँखों की जाँच (फंडस) | Examination of the fundus | eye check | |
| Check name | fundus | BN | চোখের পরীক্ষা (ফান্ডাস) | Eye Examination (Fundus) | eye check | |
| Check name | foot | HI | पैरों की जाँच | Feet check | foot check | |
| Check name | foot | BN | পায়ের পরীক্ষা | Foot examination | foot check | |
| Reminder | template | HI | नमस्ते {name}। {clinic} की ओर से याद दिलाया जा रहा है कि आपकी {item} का समय हो गया है। कृपया समय तय करने के लिए क्लिनिक को फोन करें। | Namaste {name}. The {item} has been recalled and is on its way, {clinic} staff reminds. Please call the clinic to set up a time. | Namaste {name}. This is a reminder from {clinic} that your {item} is due. Please call the clinic to book a time. | |
| Reminder | template | BN | নমস্কার {name}। {clinic} থেকে মনে করিয়ে দেওয়া হচ্ছে যে আপনার {item}-এর সময় হয়েছে। অনুগ্রহ করে সময় ঠিক করতে ক্লিনিকে ফোন করুন। | Namaste {name}. The {clinic} reminds you when it's time for your {item}. Please call the clinic to fix the time. | Namaste {name}. This is a reminder from {clinic} that your {item} is due. Please call the clinic to book a time. | |
| Card label | title | HI | फॉलो-अप कार्ड | Follow-up card | Follow-up card | |
| Card label | title | BN | ফলো-আপ কার্ড | Follow-up card | Follow-up card | |
| Card label | patient | HI | मरीज़ | Patient | Patient | |
| Card label | patient | BN | রোগী | Patient | Patient | |
| Card label | id | HI | आईडी | Id | ID | |
| Card label | id | BN | আইডি | Id | ID | |
| Card label | phone | HI | क्लिनिक का फ़ोन | Clinic phone | Clinic phone | |
| Card label | phone | BN | ক্লিনিকের ফোন | Clinic phone | Clinic phone | |
| Card label | done | HI | हो चुका | It is done | Done | |
| Card label | done | BN | করা হয়েছে | It has been done | Done | |
| Card label | next | HI | अगला | Next | Next | |
| Card label | next | BN | পরবর্তী | Next | Next | |
| Card label | appt | HI | अगली अपॉइंटमेंट | Next appointment | Next appointment | |
| Card label | appt | BN | পরবর্তী অ্যাপয়েন্টমেন্ট | Next appointment | Next appointment | |
| Card label | last | HI | पिछले परिणाम | Previous results | Last results | |
| Card label | last | BN | সর্বশেষ ফলাফল | Final results | Last results | |
| Card label | date | HI | तारीख | Date | Date | |
| Card label | date | BN | তারিখ | Date | Date | |
| Card label | none | HI | अभी कुछ दर्ज नहीं है | Nothing is registered yet | Nothing on file yet | |
| Card label | none | BN | এখনও কিছু নথিভুক্ত নেই | Nothing is documented yet | Nothing on file yet | |
| Card label | call | HI | कृपया समय तय करने के लिए क्लिनिक को फोन करें। | Please call the clinic to set up a time. | Please call the clinic to book a time. | |
| Card label | call | BN | অনুগ্রহ করে সময় ঠিক করতে ক্লিনিকে ফোন করুন। | Please call the clinic to fix the time. | Please call the clinic to book a time. | |
| Card label | by | HI | स्वीकृत | Approved | Approved by | |
| Card label | by | BN | অনুমোদন | Approval | Approved by | |
| Card label | note | HI | डॉक्टर का नोट | Doctor's note | Doctor's note | |
| Card label | note | BN | ডাক্তারের নোট | Doctor's note | Doctor's note | |
| Months | all 12 | HI | जनवरी, फ़रवरी, मार्च, अप्रैल, मई, जून, जुलाई, अगस्त, सितंबर, अक्टूबर, नवंबर, दिसंबर | January, February, March, April, May, June, July, August, September, October, November, December | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec | |
| Months | all 12 | BN | জানুয়ারি, ফেব্রুয়ারি, মার্চ, এপ্রিল, মে, জুন, জুলাই, আগস্ট, সেপ্টেম্বর, অক্টোবর, নভেম্বর, ডিসেম্বর | January, February, March, April, May, June, July, August, September, October, November, December | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec | |

Reviewer name: ____________   Date: ____________
