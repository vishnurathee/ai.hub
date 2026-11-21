import { useState, useRef, useEffect } from "react";
import { MAX_PROMPT_CHARS } from "@workspace/api-zod/input-limits";

interface MessageInputProps {
  onSend: (message: string) => boolean | void | Promise<boolean | void>;
  isDisabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({ onSend, isDisabled = false, placeholder }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const tooLong = message.trim().length > MAX_PROMPT_CHARS;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const fill = (event: Event) => {
      const suggestion = (event as CustomEvent<string>).detail;
      if (suggestion) {
        setMessage(suggestion);
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("ai-hub-fill-composer", fill);
    return () => window.removeEventListener("ai-hub-fill-composer", fill);
  }, []);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`;
    }
  }, [message]);
  const handleSend = async () => {
    if (!message.trim() || isDisabled || tooLong || submitting.current) return;
    const content = message.trim();
    submitting.current = true;
    try {
      const saved = await onSend(content);
      if (saved !== false) setMessage((current) => current.trim() === content ? "" : current);
    } catch {
      // The parent displays the error. Unsaved drafts survive rejected requests.
    } finally {
      submitting.current = false;
    }
  };

  return (
    <footer className="kw-composer-wrap">
      <form className="kw-composer" onSubmit={(event) => { event.preventDefault(); handleSend(); }}>
        <label className="kw-composer-label" htmlFor="kw-message">YOUR NEXT THOUGHT</label>
        <div className="kw-input-frame">
          <textarea
            id="kw-message"
            ref={textareaRef}
            value={message}
            aria-invalid={tooLong}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={placeholder || "Write your next thought…"}
            disabled={isDisabled}
            rows={1}
            data-testid="input-message"
          />
          <div className="kw-composer-tools">
            <span role={tooLong ? "alert" : undefined}>{tooLong ? `Keep your prompt within ${MAX_PROMPT_CHARS.toLocaleString()} characters. Your draft is preserved.` : <>Enter to send <i>·</i> Shift + Enter for a line break</>}</span>
            <button type="submit" disabled={!message.trim() || isDisabled || tooLong} aria-label="Send message" data-testid="button-send"><span>Send thought</span><b aria-hidden="true">↑</b></button>
          </div>
        </div>
        <p className="kw-composer-disclaimer"><span>Messages are sent securely to the selected provider.</span><span>Take a breath. Stay curious.</span></p>
      </form>
    </footer>
  );
}