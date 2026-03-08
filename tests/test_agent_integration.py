import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from agent.reasoning.llm_agent import process_with_agent
from database.init import init_database

@pytest.mark.asyncio
async def test_agent_integration_loop():
    """
    Integration test for the agent reasoning loop.
    Ensures the agent can process a transcript and return a structured response.
    """
    # Mock settings to use in-memory SQLite before initializing DB
    mock_settings = MagicMock()
    mock_settings.database_url = "sqlite+aiosqlite:///:memory:"
    mock_settings.debug = False
    mock_settings.openai_api_key = "mock-key"
    mock_settings.llm_model = "gpt-4o"
    mock_settings.llm_temperature = 0.2
    mock_settings.llm_max_tokens = 500

    # Helper to strip pool args from create_async_engine for SQLite
    from sqlalchemy.ext.asyncio import create_async_engine as real_create_engine
    def mock_create_engine(url, **kwargs):
        if "sqlite" in str(url):
            kwargs.pop("pool_size", None)
            kwargs.pop("max_overflow", None)
        return real_create_engine(url, **kwargs)

    with patch("database.init.settings", mock_settings), \
         patch("agent.reasoning.llm_agent.settings", mock_settings), \
         patch("database.init.create_async_engine", side_effect=mock_create_engine):
        
        # Initialize DB (uses mocked settings and patched engine creation)
        await init_database()
        
        transcript = "I would like to book an appointment with doctor Priya Sharma on Wednesday at 10AM."
        
        # --- First LLM response: returns a tool call (bookAppointment) ---
        mock_tool_call = MagicMock()
        mock_tool_call.function.name = "bookAppointment"
        mock_tool_call.function.arguments = '{"doctor_name": "Priya Sharma", "date": "2026-03-11", "time": "10:00"}'
        mock_tool_call.id = "call_test_123"

        mock_choice1 = MagicMock()
        
        # Round 1: Returns a tool call
        mock_msg_1 = MagicMock()
        mock_msg_1.content = None
        mock_msg_1.tool_calls = [mock_tool_call]
        
        # Round 2: Returns final confirmation text
        mock_msg_2 = MagicMock()
        mock_msg_2.content = "OK, I've booked your appointment with Dr. Priya Sharma for Wednesday at 10:00 AM."
        mock_msg_2.tool_calls = None
        
        mock_response_1 = MagicMock()
        mock_response_1.choices = [MagicMock(message=mock_msg_1)]
        
        mock_response_2 = MagicMock()
        mock_response_2.choices = [MagicMock(message=mock_msg_2)]
        
        # Mock the client instance
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(side_effect=[mock_response_1, mock_response_2])

        tool_result = '{"success": true, "appointment_id": 42, "doctor": "Dr. Priya Sharma", "date": "2026-03-11", "time": "10:00"}'

        with patch("agent.reasoning.llm_agent._get_client", return_value=mock_client), \
             patch("agent.reasoning.llm_agent.execute_tool", new=AsyncMock(return_value=tool_result)):
            response = await process_with_agent(
                transcript=transcript,
                language="en",
                memory_context="",
                session_id="test_session_integration",
                conversation_history=[]
            )
    
    # Assertions
    assert response is not None
    assert "response_text" in response
    assert response["intent"] == "book_appointment"
    assert isinstance(response.get("tool_calls"), list)
    assert response["tool_calls"][0]["name"] == "bookAppointment"
