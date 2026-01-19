import { useState, useRef, useEffect, useCallback } from 'react';
import { AttachIcon, CloseIcon, FileIcon, SendIcon } from '../Icons';
import type { Attachment } from '../../types';

interface TerminalInputProps {
  onSubmit: (content: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TerminalInput({ onSubmit, disabled, placeholder }: TerminalInputProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const fileToAttachment = useCallback(async (file: File): Promise<Attachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]; // Remove data:...;base64, prefix
        resolve({
          type: file.type.startsWith('image/') ? 'image' : 'file',
          name: file.name,
          data: base64,
          mimeType: file.type || 'application/octet-stream',
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const newAttachments = await Promise.all(
      Array.from(files).map(fileToAttachment)
    );
    setAttachments(prev => [...prev, ...newAttachments]);
  }, [fileToAttachment]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Handle paste (Cmd+V for images)
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      await addFiles(imageFiles);
    }
  }, [addFiles]);

  // Handle file picker
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await addFiles(files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [addFiles]);

  const handleSend = useCallback(() => {
    if (input.trim() || attachments.length > 0) {
      onSubmit(input, attachments.length > 0 ? attachments : undefined);
      setInput('');
      setAttachments([]);
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    }
  }, [input, attachments, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter sends, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="terminal-input-area">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="attachment-preview-row">
          {attachments.map((att, i) => (
            <div key={i} className="attachment-preview">
              {att.type === 'image' ? (
                <img src={`data:${att.mimeType};base64,${att.data}`} alt={att.name} />
              ) : (
                <div className="file-preview">
                  <FileIcon />
                  <span className="file-name">{att.name.slice(0, 8)}</span>
                </div>
              )}
              <button
                className="remove-btn"
                onClick={() => removeAttachment(i)}
                title="Remove"
              >
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="terminal-input-container">
        <div className="terminal-input-row">
          <span className="terminal-prompt">$</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder || 'Message Claude...'}
            className="terminal-input"
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            rows={1}
          />
          <button
            className="attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file (images, PDFs, text)"
            disabled={disabled}
          >
            <AttachIcon />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.json,.csv,.xml,.yaml,.yml"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={disabled || (!input.trim() && attachments.length === 0)}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
