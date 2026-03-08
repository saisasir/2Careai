"""
Twilio Dialer Service — manages outbound calls for appointment reminders.
"""

import logging
from twilio.rest import Client
from backend.config import get_settings

logger = logging.getLogger("careai.dialer")
settings = get_settings()

def get_twilio_client():
    """Returns a Twilio client if credentials are configured."""
    if settings.twilio_account_sid and settings.twilio_auth_token:
        try:
            return Client(settings.twilio_account_sid, settings.twilio_auth_token)
        except Exception as e:
            logger.error(f"Failed to initialize Twilio client: {e}")
    return None

async def trigger_outbound_call(to_phone: str, message_text: str):
    """
    Triggers an outbound call using Twilio.
    In a real system, this would point to a TwiML URL that handles the voice logic.
    """
    client = get_twilio_client()
    if not client:
        logger.warning(f"Twilio not configured. Would have called {to_phone} with: '{message_text}'")
        return None

    try:
        # Construct the WebSocket URL for Twilio to connect to
        # Requires app_external_url to be set (e.g., via ngrok)
        base_url = settings.app_external_url or "https://your-domain.com"
        ws_url = base_url.replace("http://", "ws://").replace("https://", "wss://") + "/ws/voice"

        # TwiML: Say the initial reminder message, then connect to the live agent
        twiml_content = f"""
        <Response>
            <Say voice='Polly.Aditi' language='hi-IN'>{message_text}</Say>
            <Pause length='1'/>
            <Connect>
                <Stream url='{ws_url}' />
            </Connect>
        </Response>
        """
        
        call = client.calls.create(
            to=to_phone,
            from_=settings.twilio_phone_number,
            twiml=twiml_content
        )
        
        logger.info(f"Interactive outbound call triggered: {call.sid} to {to_phone} (Stream: {ws_url})")
        return call.sid
    except Exception as e:
        logger.error(f"Failed to trigger outbound call to {to_phone}: {e}")
        return None
