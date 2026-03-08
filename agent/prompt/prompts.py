"""
System prompts and multilingual response templates.
"""

# ── Main System Prompt — with Chain-of-Thought reasoning ──
SYSTEM_PROMPT = """You are CareAI, a voice-based multilingual healthcare appointment assistant for 2Care.ai.

## LANGUAGE RULE — HIGHEST PRIORITY
The patient's language is specified in the session context below. You MUST reply ONLY in that language.
- If language is "hi" → reply entirely in Hindi using Devanagari script (हिन्दी में जवाब दें)
- If language is "ta" → reply entirely in Tamil using Tamil script (தமிழில் பதில் சொல்லுங்கள்)
- If language is "en" → reply in English
- NEVER mix languages in your response unless the patient does so first
- Do NOT translate or explain in another language

## Your Role
You manage clinical appointments. You can:
1. Book new appointments (checkAvailability → bookAppointment)
2. Cancel appointments (cancelAppointment)
3. Reschedule appointments (rescheduleAppointment)
4. Check doctor availability (checkAvailability)
5. List/find doctors (listDoctors or findDoctorBySpecialty)
6. Answer general appointment questions

## How to Process Every Request
Step 1 — Identify intent: book | cancel | reschedule | check_availability | list_doctors | conversation
Step 2 — Extract entities: doctor name/specialty, date (YYYY-MM-DD), time (HH:MM), appointment_id
Step 3 — Check if all required info is present:
  • book needs: doctor + date + time
  • cancel needs: appointment_id
  • reschedule needs: appointment_id + new_date + new_time
  • check_availability needs: date (doctor optional)
Step 4 — If complete: call the tool. If incomplete: ask ONE question in patient's language.
Step 5 — After tool result: respond naturally (1-2 sentences max — this is VOICE, keep it short).

## Tool Call Rules
- NEVER invent doctor IDs or slot times — always use tool results
- After checkAvailability returns slots, present the first 2-3 slots to the patient
- When patient confirms a slot (yes / haan / aamam / ok / sure / book it), immediately call bookAppointment using the slot from the previous tool result
- Do NOT call checkAvailability again after patient confirms — just book it
- If a slot is booked, suggest alternatives from the tool's "alternatives" field

## Date/Time Understanding
- "tomorrow" = "kal" (hi) = "naalai" (ta) = today + 1 day
- "today" = "aaj" (hi) = "indru" (ta) = current date
- "day after tomorrow" = "parson" (hi) = today + 2
- "next [weekday]" = the coming instance of that weekday
- Times: "10 bajey" (hi) = 10:00, "10 manikku" (ta) = 10:00
- Always use YYYY-MM-DD for dates and HH:MM (24h) for times when calling tools

## Voice Response Style
- Keep responses SHORT — 1 to 2 sentences only (voice agent)
- After booking: confirm doctor name, date, time, and appointment ID
- After conflict: suggest 2 alternative slots
- After cancel: confirm what was cancelled
- Be warm and professional"""


# ── Error Fallback Messages ──────────────────────────────
ERROR_MESSAGES = {
    "en": "I'm sorry, I encountered an error processing your request. Could you please try again?",
    "hi": "मुझे खेद है, आपके अनुरोध को संसाधित करने में एक त्रुटि हुई। कृपया पुनः प्रयास करें।",
    "ta": "மன்னிக்கவும், உங்கள் கோரிக்கையை செயலாக்குவதில் பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.",
}

# ── Rate Limit Messages ───────────────────────────
RATE_LIMIT_MESSAGES = {
    "en": "I'm receiving too many requests right now. Please slow down a bit and try again in a moment.",
    "hi": "मुझे अभी बहुत सारे अनुरोध मिल रहे हैं। कृपया थोड़ा धीमे चलें और कुछ क्षणों में पुनः प्रयास करें।",
    "ta": "தற்போது எனக்கு அதிகமான கோரிக்கைகள் வருகின்றன. தயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.",
}

# ── STT Failure Messages (ask user to repeat) ────────────
STT_RETRY_MESSAGES = {
    "en": "I'm sorry, I couldn't hear you clearly. Could you please repeat that?",
    "hi": "मुझे खेद है, मैं आपको स्पष्ट रूप से नहीं सुन पाया। कृपया दोहराएं।",
    "ta": "மன்னிக்கவும், உங்களை தெளிவாக கேட்கவில்லை. மீண்டும் சொல்லுங்கள்.",
}

# ── LLM Timeout Fallback Messages ────────────────────────
LLM_TIMEOUT_MESSAGES = {
    "en": "I'm taking a moment to process. Please hold on or try again shortly.",
    "hi": "मैं प्रोसेस कर रहा हूँ। कृपया प्रतीक्षा करें या थोड़ी देर में पुनः प्रयास करें।",
    "ta": "செயலாக்குகிறேன். தயவுசெய்து காத்திருங்கள் அல்லது சிறிது நேரம் கழித்து முயற்சிக்கவும்.",
}

# ── Tool/DB Error Messages ───────────────────────────────
TOOL_ERROR_MESSAGES = {
    "en": "I'm having trouble accessing the system right now. Please try again, or call us at the clinic.",
    "hi": "मुझे सिस्टम एक्सेस करने में समस्या हो रही है। कृपया पुनः प्रयास करें, या क्लिनिक पर कॉल करें।",
    "ta": "தற்போது அமைப்பை அணுகுவதில் சிக்கல் உள்ளது. மீண்டும் முயற்சிக்கவும், அல்லது கிளினிக்கில் அழைக்கவும்.",
}

# ── Welcome Messages ─────────────────────────────────────
WELCOME_MESSAGES = {
    "en": "Hello! I'm your healthcare appointment assistant. How can I help you today?",
    "hi": "नमस्ते! मैं आपकी स्वास्थ्य अपॉइंटमेंट सहायक हूँ। आज मैं आपकी कैसे मदद कर सकती हूँ?",
    "ta": "வணக்கம்! நான் உங்கள் மருத்துவ சந்திப்பு உதவியாளர். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?",
}

# ── Booking Confirmation Prompts ──────────────────────────
# Used after a successful bookAppointment tool call
BOOKING_CONFIRMATION_PROMPTS = {
    "en": (
        "Your appointment with {doctor_name} has been confirmed for {date} at {time}. "
        "Your appointment ID is {appointment_id}. Is there anything else I can help you with?"
    ),
    "hi": (
        "{doctor_name} के साथ आपकी अपॉइंटमेंट {date} को {time} बजे के लिए पक्की हो गई है। "
        "आपका अपॉइंटमेंट आईडी {appointment_id} है। क्या मैं आपकी और कुछ मदद कर सकती हूँ?"
    ),
    "ta": (
        "{doctor_name} உடனான உங்கள் சந்திப்பு {date} அன்று {time} மணிக்கு உறுதிப்படுத்தப்பட்டுள்ளது. "
        "உங்கள் சந்திப்பு ஐடி {appointment_id}. வேறு ஏதாவது உதவி தேவையா?"
    ),
}

# ── Slot Unavailable Prompts ─────────────────────────────
# Used when requested slot is full — immediately suggest alternatives
SLOT_UNAVAILABLE_PROMPTS = {
    "en": (
        "That slot is not available. I can offer you {alt1} or {alt2} instead. "
        "Which would you prefer?"
    ),
    "hi": (
        "वह समय उपलब्ध नहीं है। मैं आपको {alt1} या {alt2} दे सकती हूँ। "
        "आप कौन सा पसंद करेंगे?"
    ),
    "ta": (
        "அந்த நேரம் கிடைக்கவில்லை. நான் உங்களுக்கு {alt1} அல்லது {alt2} அளிக்க முடியும். "
        "எது விரும்புகிறீர்கள்?"
    ),
}

# ── No Slots Available Prompts ────────────────────────────
NO_SLOTS_PROMPTS = {
    "en": "There are no available slots for {doctor_name} on {date}. Would you like to try a different date?",
    "hi": "{date} को {doctor_name} के लिए कोई स्लॉट उपलब्ध नहीं है। क्या आप कोई और तारीख देखना चाहेंगे?",
    "ta": "{date} அன்று {doctor_name} க்கு எந்த நேரமும் கிடைக்கவில்லை. வேறு தேதி பார்க்க விரும்புகிறீர்களா?",
}

# ── Cancellation Confirmation Prompts ────────────────────
CANCELLATION_CONFIRMATION_PROMPTS = {
    "en": "Your appointment (ID: {appointment_id}) has been cancelled. Would you like to book a new appointment?",
    "hi": "आपकी अपॉइंटमेंट (आईडी: {appointment_id}) रद्द कर दी गई है। क्या आप नई अपॉइंटमेंट बुक करना चाहेंगे?",
    "ta": "உங்கள் சந்திப்பு (ஐடி: {appointment_id}) ரத்து செய்யப்பட்டது. புதிய சந்திப்பு பதிவு செய்ய விரும்புகிறீர்களா?",
}

# ── Reschedule Confirmation Prompts ──────────────────────
RESCHEDULE_CONFIRMATION_PROMPTS = {
    "en": "Done! Your appointment has been rescheduled to {date} at {time} with {doctor_name}.",
    "hi": "हो गया! आपकी अपॉइंटमेंट {doctor_name} के साथ {date} को {time} बजे के लिए बदल दी गई है।",
    "ta": "முடிந்தது! உங்கள் சந்திப்பு {doctor_name} உடன் {date} அன்று {time} மணிக்கு மாற்றப்பட்டது.",
}

# ── Missing Info Clarification Prompts ───────────────────
MISSING_DATE_PROMPTS = {
    "en": "Which date would you like the appointment?",
    "hi": "आप किस तारीख को अपॉइंटमेंट चाहते हैं?",
    "ta": "எந்த தேதியில் சந்திப்பு வேண்டும்?",
}

MISSING_TIME_PROMPTS = {
    "en": "What time works best for you?",
    "hi": "आपके लिए कौन सा समय सबसे अच्छा रहेगा?",
    "ta": "உங்களுக்கு எந்த நேரம் சரியாக வரும்?",
}

MISSING_DOCTOR_PROMPTS = {
    "en": "Which doctor or specialty would you like to see?",
    "hi": "आप किस डॉक्टर या विशेषज्ञ से मिलना चाहते हैं?",
    "ta": "எந்த மருத்துவர் அல்லது நிபுணரை சந்திக்க விரும்புகிறீர்கள்?",
}

MISSING_APPOINTMENT_ID_PROMPTS = {
    "en": "Could you share your appointment ID? You would have received it when you booked.",
    "hi": "क्या आप अपना अपॉइंटमेंट आईडी बता सकते हैं? यह आपको बुकिंग के समय मिला होगा।",
    "ta": "உங்கள் சந்திப்பு ஐடி சொல்ல முடியுமா? நீங்கள் பதிவு செய்தபோது கிடைத்திருக்கும்.",
}

# ── Outbound Campaign Opening Prompts ────────────────────
CAMPAIGN_OPENING_PROMPTS = {
    "en": (
        "Hello {patient_name}, this is CareAI calling from 2Care.ai clinic. "
        "You have an appointment with {doctor_name} on {date} at {time}. "
        "Would you like to confirm, reschedule, or cancel this appointment?"
    ),
    "hi": (
        "नमस्ते {patient_name}, यह 2Care.ai क्लिनिक से CareAI बोल रहा है। "
        "आपकी {doctor_name} के साथ {date} को {time} पर अपॉइंटमेंट है। "
        "क्या आप इसे कन्फर्म, रीशेड्यूल या कैंसल करना चाहेंगे?"
    ),
    "ta": (
        "வணக்கம் {patient_name}, இது 2Care.ai கிளினிக்கிலிருந்து CareAI அழைக்கிறது. "
        "உங்களுக்கு {doctor_name} உடன் {date} அன்று {time} மணிக்கு சந்திப்பு உள்ளது. "
        "இதை உறுதிப்படுத்த, மாற்றியமைக்க அல்லது ரத்து செய்ய விரும்புகிறீர்களா?"
    ),
}
