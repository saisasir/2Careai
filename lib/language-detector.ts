// Language Detection Module
// Supports: English, Hindi, Tamil

export type SupportedLanguage = 'en' | 'hi' | 'ta'

export interface LanguageDetectionResult {
  language: SupportedLanguage
  confidence: number
  detectedScript?: string
}

// Unicode ranges for different scripts
const DEVANAGARI_RANGE = /[\u0900-\u097F]/  // Hindi
const TAMIL_RANGE = /[\u0B80-\u0BFF]/        // Tamil

// Common words/patterns for each language
const HINDI_PATTERNS = [
  /मुझे/, /है/, /हूँ/, /कृपया/, /धन्यवाद/, /नमस्ते/,
  /डॉक्टर/, /अपॉइंटमेंट/, /बुक/, /रद्द/, /समय/
]

const TAMIL_PATTERNS = [
  /நான்/, /வேண்டும்/, /தயவுசெய்து/, /நன்றி/, /வணக்கம்/,
  /மருத்துவர்/, /நேரம்/, /முன்பதிவு/
]

export function detectLanguage(text: string): LanguageDetectionResult {
  if (!text || text.trim().length === 0) {
    return { language: 'en', confidence: 0.5 }
  }
  
  const trimmedText = text.trim()
  
  // Count script characters
  const devanagariCount = (trimmedText.match(new RegExp(DEVANAGARI_RANGE, 'g')) || []).length
  const tamilCount = (trimmedText.match(new RegExp(TAMIL_RANGE, 'g')) || []).length
  const totalChars = trimmedText.replace(/\s/g, '').length
  
  // Check for Hindi script
  if (devanagariCount > 0) {
    const ratio = devanagariCount / totalChars
    if (ratio > 0.3) {
      return {
        language: 'hi',
        confidence: Math.min(0.95, 0.7 + ratio * 0.25),
        detectedScript: 'Devanagari'
      }
    }
  }
  
  // Check for Tamil script
  if (tamilCount > 0) {
    const ratio = tamilCount / totalChars
    if (ratio > 0.3) {
      return {
        language: 'ta',
        confidence: Math.min(0.95, 0.7 + ratio * 0.25),
        detectedScript: 'Tamil'
      }
    }
  }
  
  // Check for Hindi patterns (romanized)
  for (const pattern of HINDI_PATTERNS) {
    if (pattern.test(trimmedText)) {
      return { language: 'hi', confidence: 0.85 }
    }
  }
  
  // Check for Tamil patterns (romanized)
  for (const pattern of TAMIL_PATTERNS) {
    if (pattern.test(trimmedText)) {
      return { language: 'ta', confidence: 0.85 }
    }
  }
  
  // Default to English
  return { language: 'en', confidence: 0.9, detectedScript: 'Latin' }
}

// Get language display name
export function getLanguageDisplayName(lang: SupportedLanguage): string {
  const names: Record<SupportedLanguage, string> = {
    en: 'English',
    hi: 'Hindi',
    ta: 'Tamil'
  }
  return names[lang]
}

// Get language greeting
export function getLanguageGreeting(lang: SupportedLanguage): string {
  const greetings: Record<SupportedLanguage, string> = {
    en: 'Hello! How can I help you today?',
    hi: 'नमस्ते! आज मैं आपकी कैसे मदद कर सकता हूँ?',
    ta: 'வணக்கம்! இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?'
  }
  return greetings[lang]
}

// Get common phrases in each language
export function getCommonPhrases(lang: SupportedLanguage) {
  const phrases: Record<SupportedLanguage, Record<string, string>> = {
    en: {
      booking_confirmed: 'Your appointment has been booked successfully.',
      booking_cancelled: 'Your appointment has been cancelled.',
      slot_unavailable: 'Sorry, that slot is not available. Would you like to try another time?',
      doctor_not_found: 'I could not find a doctor matching your request.',
      please_wait: 'Please wait while I check the availability.',
      anything_else: 'Is there anything else I can help you with?'
    },
    hi: {
      booking_confirmed: 'आपकी अपॉइंटमेंट सफलतापूर्वक बुक हो गई है।',
      booking_cancelled: 'आपकी अपॉइंटमेंट रद्द कर दी गई है।',
      slot_unavailable: 'क्षमा करें, वह समय उपलब्ध नहीं है। क्या आप कोई अन्य समय चुनना चाहेंगे?',
      doctor_not_found: 'मुझे आपके अनुरोध से मेल खाने वाला डॉक्टर नहीं मिला।',
      please_wait: 'कृपया प्रतीक्षा करें जब तक मैं उपलब्धता जाँचता हूँ।',
      anything_else: 'क्या मैं आपकी और कोई मदद कर सकता हूँ?'
    },
    ta: {
      booking_confirmed: 'உங்கள் சந்திப்பு வெற்றிகரமாக பதிவு செய்யப்பட்டது.',
      booking_cancelled: 'உங்கள் சந்திப்பு ரத்து செய்யப்பட்டது.',
      slot_unavailable: 'மன்னிக்கவும், அந்த நேரம் கிடைக்கவில்லை. வேறு நேரத்தை முயற்சிக்க விரும்புகிறீர்களா?',
      doctor_not_found: 'உங்கள் கோரிக்கைக்கு பொருந்தும் மருத்துவரை என்னால் கண்டுபிடிக்க முடியவில்லை.',
      please_wait: 'கிடைக்கும் தன்மையை சரிபார்க்கும் வரை தயவுசெய்து காத்திருக்கவும்.',
      anything_else: 'வேறு ஏதாவது உதவ முடியுமா?'
    }
  }
  return phrases[lang]
}
