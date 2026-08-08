const root = document.documentElement;
let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
root.setAttribute('data-theme', theme);

const form = document.getElementById('chat-form');
const input = document.getElementById('message');
const messages = document.getElementById('messages');
const clearBtn = document.getElementById('clear');
const status = document.getElementById('status');
const quoteText = document.getElementById('quote-text');
const history = [];

const quotes = [
  "The important thing is not to stop questioning.",
  "Imagination is more important than knowledge.",
  "Life is like riding a bicycle. To keep your balance you must keep moving.",
  "Try not to become a man of success, but rather try to become a man of value.",
  "A person who never made a mistake never tried anything new.",
  "Look deep into nature, and then you will understand everything better."
];

function setRandomQuote() {
  if (!quoteText) return;
  const randomIndex = Math.floor(Math.random() * quotes.length);
  quoteText.textContent = `“${quotes[randomIndex]}” — Albert Einstein`;
}

function addMessage(text, role){
  const wrap = document.createElement('div');
  wrap.className = `message ${role === 'assistant' ? 'bot' : 'user'}`;
  wrap.innerHTML = role === 'assistant'
    ? `<div class="message__avatar">AE</div><div class="message__body"><div class="message__bubble">${text}</div><div class="message__meta">Albert Einstein · now</div></div>`
    : `<div class="message__avatar">You</div><div class="message__body"><div class="message__bubble">${text}</div><div class="message__meta">You · now</div></div>`;
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
  return wrap.querySelector('.message__bubble');
}

async function health(){
  try{
    const res = await fetch('/health');
    const data = await res.json();
    status.textContent = res.ok && data.ok ? `Online · ${data.model}` : 'Offline';
  }catch{
    status.textContent = 'Offline';
  }
}

health();
setRandomQuote();

document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    input.value = btn.dataset.prompt || btn.textContent.trim();
    input.focus();
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  history.push({ role: 'user', content: text });
  input.value = '';

  const loading = addMessage('Thinking carefully...', 'assistant');

  try {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Request failed');
    }

    // Clear the "Thinking carefully..." placeholder
    loading.textContent = ''; 

    // Initialize stream readers
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullResponse = "";
    let buffer = "";

    // Process the stream chunk by chunk
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // SSE events are separated by a double newline
      const parts = buffer.split('\n\n');
      // Keep the last incomplete chunk in the buffer
      buffer = parts.pop();

      for (const part of parts) {
        if (part.startsWith('data: ')) {
          const dataStr = part.slice(6).trim();
          
          if (dataStr === '[DONE]') {
            continue;
          }
          
          try {
            const dataObj = JSON.parse(dataStr);
            if (dataObj.token) {
              fullResponse += dataObj.token;
              loading.textContent = fullResponse;
              // Auto-scroll as text arrives
              messages.scrollTop = messages.scrollHeight; 
            }
          } catch (err) {
            console.error("Failed to parse stream chunk:", err, dataStr);
          }
        }
      }
    }

    // Add the final complete response to history
    history.push({ role: 'assistant', content: fullResponse });

  } catch (err) {
    loading.textContent = `Error: ${err.message}`;
  }
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

clearBtn.addEventListener('click', () => {
  messages.innerHTML = '<div class="assistant-line max-w-[760px] grid gap-1"><div class="assistant-label text-[.8rem] text-muted font-[\'Sentient\'] uppercase tracking-[.12em]">Albert Einstein</div><div class="assistant-text font-[\'Sentient\'] text-[1.08rem] leading-7">Good day. Let us begin with a clear question.</div></div>';
  history.length = 0;
  setRandomQuote();
});