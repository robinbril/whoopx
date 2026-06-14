"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendCoachMessage } from "../actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = "user" | "coach" | "error";

interface Message {
  id: string;
  role: Role;
  text: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WELCOME: Message = {
  id: "welcome",
  role: "coach",
  text: "Hey there, ask me anything about your recovery, sleep or strain.",
};

const SUGGESTED_PROMPTS = [
  "How's my recovery today?",
  "Should I train hard today?",
  "Why is my HRV up?",
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CoachAvatar() {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
      style={{ background: "rgba(61,127,255,0.18)" }}
    >
      <Sparkles size={14} style={{ color: "var(--color-strain)" }} />
    </div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      key="typing"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className="flex items-end gap-2"
    >
      <CoachAvatar />
      <div className="rounded-[14px] rounded-bl-[4px] border border-line-soft bg-surface px-3 py-2.5">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--color-dim)" }}
              animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.18,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

interface BubbleProps {
  message: Message;
}

function Bubble({ message }: BubbleProps) {
  const isUser = message.role === "user";
  const isError = message.role === "error";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn("flex items-end gap-2", isUser && "flex-row-reverse")}
    >
      {!isUser && <CoachAvatar />}

      <div
        className={cn(
          "max-w-[78%] rounded-[14px] px-3.5 py-2.5 text-[14px] leading-relaxed",
          isUser &&
            "rounded-br-[4px] border border-line-soft bg-surface-2 text-fg",
          !isUser &&
            !isError &&
            "rounded-bl-[4px] border border-line-soft bg-surface text-fg",
          isError &&
            "rounded-bl-[4px] border border-line-soft bg-surface text-dim",
        )}
      >
        {message.text}
      </div>
    </motion.div>
  );
}

interface SuggestedChipsProps {
  onSelect: (prompt: string) => void;
}

function SuggestedChips({ onSelect }: SuggestedChipsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className="flex flex-wrap gap-2 pt-2"
    >
      {SUGGESTED_PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-line-soft bg-surface px-3.5 py-1.5 text-[13px] text-muted transition-colors active:bg-surface-2"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {prompt}
        </button>
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CoachChat({ initialQuery }: { initialQuery?: string }) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const idCounter = useRef(0);

  const nextId = () => {
    idCounter.current += 1;
    return String(idCounter.current);
  };

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping) return;

      const userMsg: Message = { id: nextId(), role: "user", text: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      try {
        const reply = await sendCoachMessage(trimmed);
        const coachMsg: Message = { id: nextId(), role: "coach", text: reply };
        setMessages((prev) => [...prev, coachMsg]);
      } catch {
        const errMsg: Message = {
          id: nextId(),
          role: "error",
          text: "Something went wrong. Try again.",
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [isTyping],
  );

  const initialSent = useRef(false);
  useEffect(() => {
    if (initialQuery && !initialSent.current) {
      initialSent.current = true;
      void submit(initialQuery);
    }
  }, [initialQuery, submit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit(input);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const showChips = messages.length === 1 && !isTyping;

  return (
    <div className="flex min-h-full flex-col">
      {/* Message list */}
      <div className="flex-1 px-4 py-4">
        <div className="mx-auto flex max-w-[480px] flex-col gap-3">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <Bubble key={msg.id} message={msg} />
            ))}

            {showChips && (
              <SuggestedChips key="chips" onSelect={(p) => void submit(p)} />
            )}

            {isTyping && <TypingIndicator key="typing" />}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input row */}
      <div className="sticky bottom-0 shrink-0 border-t border-line-soft bg-ink/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[480px] items-end gap-2">
          <div className="flex min-h-[44px] flex-1 items-end rounded-[18px] border border-line-soft bg-surface-2 px-4 py-2.5">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your data…"
              disabled={isTyping}
              className="w-full resize-none bg-transparent text-[14px] text-fg placeholder:text-dim focus:outline-none disabled:opacity-50"
              style={{ lineHeight: "1.5", maxHeight: "120px" }}
            />
          </div>

          <button
            type="button"
            onClick={() => void submit(input)}
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-opacity",
              input.trim() && !isTyping ? "opacity-100" : "opacity-30",
            )}
            style={{ background: "var(--color-strain)" }}
          >
            <ArrowUp size={18} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
