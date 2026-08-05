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
    ? `<div class="message__avatar">Albert</div><div class="message__body"><div class="message__bubble">${text}</div><div class="message__meta">Albert Einstein · now</div></div>`
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
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    loading.textContent = data.reply;
    history.push({ role: 'assistant', content: data.reply });
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