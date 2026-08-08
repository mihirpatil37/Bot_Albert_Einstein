# Albert Einstein Chatbot

A modern, local AI chatbot built with **Python**, **FastAPI**, **Ollama**, **PostgreSQL**, and a Claude-inspired UI. It provides a calm, Einstein-inspired conversational experience featuring real-time streaming, Markdown formatting, KaTeX mathematical equations, persistent chat history, quick prompts, and random quotes.

## Features

- **Einstein-inspired Persona:** Structured responses with summaries, key ideas, simple examples, and closing lines.
- **Real-Time Streaming:** Streams responses chunk-by-chunk via Server-Sent Events (SSE).
- **Markdown & Math Support:** Renders rich text and mathematical equations (e.g., $E=mc^2$) using Marked.js and KaTeX.
- **Persistent Chat History:** Automatically logs conversations and messages to a PostgreSQL database.
- **Claude-inspired UI:** Clean, warm typography and responsive layout using Tailwind CSS.
- **Local AI Integration:** Runs completely offline using Ollama.
- **Docker-Ready:** Fully containerized stack (Web, Ollama, and PostgreSQL) via Docker Compose.

## Screenshots

### Home / Initial View
![Screenshot 1](static/images/SS1.jpg)

The first screen shows the full layout with the Einstein portrait, quote card, quick prompts, and the empty conversation panel.

### Conversation in Progress
![Screenshot 2](static/images/SS2.jpg)

The second screen shows an active chat where the assistant responds in an Einstein-like style.

### Long Response View
![Screenshot 3](static/images/SS3.jpg)

The third screen shows a longer answer inside the chat area, demonstrating scrolling and message flow.

## Project Structure

```text
.
├── app.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── templates
│   └── index.html
└── static
    ├── app.js
    ├── styles.css
    └── images
        ├── Albert_Einstein_Head_cleaned.jpg.webp
        ├── SS1.jpg
        ├── SS2.jpg
        └── SS3.jpg
```
## Quick Start (Docker Compose)
The easiest way to run the entire stack (App, AI Model, and Database) is using Docker Compose.

1. Clone the repository and navigate into the folder.
2. Build and start the containers in the background:

```text
docker compose up -d --build
```

1. Download the LLM model into the isolated Ollama container (only required on the first run):

```text
docker compose exec ollama ollama pull llama3.2
```

1. Open your browser and visit: http://localhost:8000

## Environment Variables
You can configure the application via environment variables (automatically handled in docker-compose.yml):

- **OLLAMA_HOST:** URL of the Ollama instance (default: http://localhost:11434)

- **OLLAMA_MODEL:** The model name to use (default: llama3.2)

- **DATABASE_URL:** PostgreSQL connection string

## Making it Public (Cloudflare Tunnel)
To expose your local Docker setup securely to the internet with HTTPS for free:

1. Create a persistent tunnel in the Cloudflare Zero Trust dashboard.
2. Add the cloudflared service to your docker-compose.yml using your tunnel token.
3. Route your public domain/subdomain to web:8000.

## License
For learning and personal use.
