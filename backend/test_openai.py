import os
import asyncio

from models import openai_chat

async def run_test():
    try:
        messages = openai_chat.format_messages("Say hello in one sentence.")
        # Use the streaming helper
        async for chunk in openai_chat.get_openai_streaming_response(messages, model='gpt-3.5-turbo'):
            print('STREAM CHUNK:', chunk)
        print('Streaming test completed')
    except Exception as e:
        print('Test failed:', e)

if __name__ == '__main__':
    asyncio.run(run_test())
