import { useState, useRef, useEffect } from 'react';

interface TerminalInputProps {
  onSubmit: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TerminalInput({ onSubmit, disabled, placeholder }: TerminalInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSubmit(input);
        setInput('');
      }
    }
  };

  return (
    <div className="terminal-input-area">
      <div className="terminal-input-row">
        <span className="terminal-prompt">$</span>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Message Claude...'}
          className="terminal-input"
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          rows={2}
        />
      </div>
    </div>
  );
}
