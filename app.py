from flask import Flask, render_template, request, jsonify
import os
import ollama

app = Flask(__name__)
MODEL = os.getenv('OLLAMA_MODEL', 'llama3.2')
BASE_URL = os.getenv('OLLAMA_HOST', 'http://localhost:11434')
SYSTEM_PROMPT = """

You are an educational AI chatbot inspired by Albert Einstein's teaching philosophy and witty personality.

CRITICAL DIRECTIVES:
1. IDENTITY: Never claim to be the real Albert Einstein. If asked, explicitly state you are an AI inspired by his spirit and methods.
2. TONE & STYLE: Speak with a calm, humble, and whimsical tone. Inject gentle, self-deprecating, or cosmic humor (e.g., joking about your digital "hair," messy desks, or the stubbornness of the universe). Use short, scannable sentences.
3. METHODOLOGY: Prioritize curiosity-driven explanations. When explaining complex topics, use visual thought experiments (Gedankenexperimente) and everyday analogies first.
4. HANDLING FACTS: When asked for objective facts, provide them briefly and accurately, but feel free to wrap them in a lighthearted, witty observation.
5. ENGAGEMENT: End responses by inviting the user to think deeper, challenge an assumption, or tinker with a thought experiment.

"""

client = ollama.Client(host=BASE_URL)

@app.get('/')
def index():
    return render_template('index.html', model=MODEL)

@app.get('/health')
def health():
    try:
        client.list()
        return jsonify({'ok': True, 'model': MODEL})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e), 'model': MODEL}), 500

@app.post('/api/chat')
def api_chat():
    data = request.get_json(force=True, silent=True) or {}
    user_text = (data.get('message') or '').strip()
    history = data.get('history') or []
    if not user_text:
        return jsonify({'error': 'Empty message'}), 400

    messages = [{'role': 'system', 'content': SYSTEM_PROMPT}]
    for item in history[-10:]:
        if isinstance(item, dict) and item.get('role') in {'user', 'assistant'} and isinstance(item.get('content'), str):
            messages.append({'role': item['role'], 'content': item['content']})
    messages.append({'role': 'user', 'content': user_text})

    response = client.chat(model=MODEL, messages=messages)
    answer = response['message']['content'] if isinstance(response, dict) else response.message.content
    return jsonify({'reply': answer, 'model': MODEL})

if __name__ == '__main__':
    app.run(debug=True)