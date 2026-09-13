@"
import os
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Literal, Optional

import httpx
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship

BASE_DIR = Path(__file__).resolve().parent
OLLAMA_URL = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "500"))

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://einstein:your_password_here@localhost:5432/chat_history"
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    messages = relationship("MessageRecord", back_populates="conversation", cascade="all, delete-orphan")


class MessageRecord(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id"), index=True)
    role = Column(String)
    content = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    conversation = relationship("Conversation", back_populates="messages")


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app = FastAPI(title="Einstein Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

SYSTEM_PROMPT = (
    "You are a respectful educational chatbot inspired by Albert Einstein. "
    "Never claim to be the real Einstein. "
    "Answer in short, polished chunks. "
    "Use this structure: summary, key idea, simple example, closing line. "
    "Keep each chunk brief and avoid huge paragraphs. "
    "When writing mathematical formulas or equations, always wrap them in "
    "double dollar signs for block equations ($$E=mc^2$$) or single dollar signs for inline math."
)


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: List[Message] = []
    conversation_id: Optional[str] = None


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"model": MODEL},
    )


@app.get("/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            r.raise_for_status()
        return JSONResponse({"ok": True, "model": MODEL})
    except Exception as e:
        return JSONResponse({"ok": False, "model": MODEL, "error": str(e)}, status_code=500)


async def _stream_ollama(payload: dict, conv_id: str, db: Session):
    assistant_reply = ""
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream("POST", f"{OLLAMA_URL}/api/chat", json=payload) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    chunk = json.loads(line)
                    token = chunk.get("message", {}).get("content", "")
                    if token:
                        assistant_reply += token
                        yield f"data: {json.dumps({'token': token, 'conversation_id': conv_id})}\n\n"
                    if chunk.get("done"):
                        yield "data: [DONE]\n\n"
                        break
    except httpx.HTTPError:
        yield f"data: {json.dumps({'error': 'Model unavailable. Please try again.'})}\n\n"
    finally:
        if assistant_reply:
            bot_msg = MessageRecord(
                conversation_id=conv_id,
                role="assistant",
                content=assistant_reply
            )
            db.add(bot_msg)
            db.commit()


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest, db: Session = Depends(get_db)):
    conv_id = req.conversation_id
    if not conv_id:
        new_conv = Conversation()
        db.add(new_conv)
        db.commit()
        db.refresh(new_conv)
        conv_id = new_conv.id

    user_msg = MessageRecord(
        conversation_id=conv_id,
        role="user",
        content=req.message.strip()
    )
    db.add(user_msg)
    db.commit()

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for item in req.history[-10:]:
        if item.role in {"user", "assistant"}:
            messages.append({"role": item.role, "content": item.content})
    messages.append({"role": "user", "content": req.message.strip()})

    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": 0.7,
            "num_predict": MAX_TOKENS,
        },
    }

    return StreamingResponse(
        _stream_ollama(payload, conv_id, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/conversations")
async def list_conversations(db: Session = Depends(get_db)):
    """Fetch the latest 20 conversations for the sidebar."""
    convs = (
        db.query(Conversation)
        .order_by(Conversation.created_at.desc())
        .limit(20)
        .all()
    )
    return [{"id": c.id, "created_at": c.created_at.isoformat()} for c in convs]


@app.get("/api/history/{conversation_id}")
async def get_history(conversation_id: str, db: Session = Depends(get_db)):
    """Load the full message history for a specific conversation."""
    messages = (
        db.query(MessageRecord)
        .filter(MessageRecord.conversation_id == conversation_id)
        .order_by(MessageRecord.created_at)
        .all()
    )
    if not messages:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        "conversation_id": conversation_id,
        "history": [{"role": m.role, "content": m.content} for m in messages],
    }
"@ | Set-Content app.py -Encoding UTF8