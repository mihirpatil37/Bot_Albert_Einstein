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

// --- NEW RENDERING ENGINE ---
function renderMarkdownAndMath(element, text) {
  // 1. Parse Markdown and sanitize HTML
  const rawHtml = marked.parse(text);
  const cleanHtml = DOMPurify.sanitize(rawHtml);
  element.innerHTML = cleanHtml;

  // 2. Render Math using KaTeX Auto-Render
  renderMathInElement(element, {
    delimiters: [
      {left: '$$', right: '$$', display: true},
      {left: '\\[', right: '\\]', display: true},
      {left: '$', right: '$', display: false},
      {left: '\\(', right: '\\)', display: false}
    ],
    throwOnError: false, // Prevents errors from halting rendering
    ignoredClasses: ["message__meta"] // Don't try to parse math in our metadata tags
  });
}

function addMessage(text, role){
  const wrap = document.createElement('div');
  wrap.className = `message ${role === 'assistant' ? 'bot' : 'user'}`;
  
  // Create the skeleton
  wrap.innerHTML = role === 'assistant'
    ? `<div class="message__avatar">AE</div><div class="message__body"><div class="message__bubble"></div><div class="message__meta">Albert Einstein · now</div></div>`
    : `<div class="message__avatar">You</div><div class="message__body"><div class="message__bubble"></div><div class="message__meta">You · now</div></div>`;
  
  messages.appendChild(wrap);
  
  // Render the actual content safely
  const bubble = wrap.querySelector('.message__bubble');
  renderMarkdownAndMath(bubble, text);
  
  messages.scrollTop = messages.scrollHeight;
  return bubble;
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

  const bubble = addMessage('Thinking carefully...', 'assistant');

  try {
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Request failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let assistantReply = '';
    let isFirstToken = true;
    let buffer = '';

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') {
              done = true;
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.token) {
                if (isFirstToken) {
                  bubble.textContent = ''; // Clear 'Thinking...'
                  isFirstToken = false;
                }
                
                assistantReply += parsed.token;
                
                // Use the new render function for real-time streaming updates
                renderMarkdownAndMath(bubble, assistantReply);
                
                messages.scrollTop = messages.scrollHeight;
              }
            } catch (err) {
              console.error('Error parsing stream chunk:', err, dataStr);
            }
          }
        }
      }
    }
    
    history.push({ role: 'assistant', content: assistantReply });

  } catch (err) {
    bubble.textContent = `Error: ${err.message}`;
  }
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

clearBtn.addEventListener('click', () => {
  // Replaced hardcoded HTML with standard setup to ensure styles match
  messages.innerHTML = '';
  addMessage('Good day. Let us begin with a clear question.', 'assistant');
  history.length = 0;
  setRandomQuote();
});