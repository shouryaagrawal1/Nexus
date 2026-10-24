import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Code2, AlertTriangle, Copy, Check, CornerDownLeft, Loader2 } from 'lucide-react';
import FilePill from './FilePill';
import { executeChatQuery } from '../services/api';

export default function ChatPane({
  onSelectEntity,
  onGraphUpdate,
  activeRepo,
  onOpenCodeDrawer,
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome-msg',
      sender: 'ai',
      text: `Hello! I am **Nexus**, your Senior Software Architect and Codebase Intelligence Agent.\n\nI combine **Neo4j Structural Graph Maps** and **ChromaDB Semantic Vectors** to analyze your code without hallucinations.\n\nTry clicking any suggested question below or ask anything about your codebase:`,
      file_pills: ['auth.py', 'AuthManager', 'BaseDBWorker', 'worker.cpp'],
      snippets: [],
      graph_data: null,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedSnippetId, setCopiedSnippetId] = useState(null);
  const scrollRef = useRef(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (queryText = null) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!queryText) setInput('');
    setLoading(true);

    try {
      // Build lightweight chat history
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome-msg')
        .slice(-6)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [m.text],
        }));

      const response = await executeChatQuery(textToSend.trim(), historyPayload);

      const aiMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.response_text,
        file_pills: response.file_pills || [],
        snippets: response.snippets || [],
        graph_data: response.graph_data || null,
      };

      setMessages((prev) => [...prev, aiMessage]);

      // If response has graph data, auto-sync canvas!
      if (response.graph_data && onGraphUpdate) {
        onGraphUpdate(response.graph_data);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: `⚠️ Error executing query: ${err.message}`,
          snippets: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopySnippet = (snippetId, code) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippetId(snippetId);
    setTimeout(() => setCopiedSnippetId(null), 2000);
  };

  // Helper to parse [[Pill]] in text and turn into <FilePill>
  const renderFormattedText = (rawText) => {
    if (!rawText) return null;

    // Split on [[Entity]] pattern
    const parts = rawText.split(/(\[\[.*?\]\])/g);

    return parts.map((part, index) => {
      const match = part.match(/^\[\[(.*?)\]\]$/);
      if (match) {
        const entityName = match[1];
        return (
          <FilePill
            key={index}
            name={entityName}
            onSelect={onSelectEntity}
          />
        );
      }

      // Format bold markdown **text**
      const boldParts = part.split(/(\*\*.*?\*\*)/g);
      return (
        <span key={index}>
          {boldParts.map((subPart, subIndex) => {
            const boldMatch = subPart.match(/^\*\*(.*?)\*\*$/);
            if (boldMatch) {
              return <strong key={subIndex} style={{ color: '#fff' }}>{boldMatch[1]}</strong>;
            }
            return subPart;
          })}
        </span>
      );
    });
  };

  const suggestedPrompts = [
    'Where is the user authentication logic located?',
    'What other classes inherit from BaseDBWorker?',
    'If I modify retryConnection, what will break?',
  ];

  return (
    <section
      style={{
        flex: 1,
        height: '100%',
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {/* Center Pane Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(15, 20, 34, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--cyan-glow)" />
          <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-primary)' }}>
            Intelligence Chat
          </span>
          {activeRepo && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '2px 8px',
                borderRadius: '10px',
              }}
            >
              Target: {activeRepo.name}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMessages(messages.slice(0, 1))}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Clear History
        </button>
      </div>

      {/* Scrolling Conversation History */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: '12px',
              maxWidth: msg.sender === 'user' ? '85%' : '95%',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {/* Avatar */}
            {msg.sender === 'ai' && (
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 0 10px rgba(0, 242, 254, 0.3)',
                }}
              >
                <Bot size={15} color="#050814" strokeWidth={2.5} />
              </div>
            )}

            {/* Bubble Container */}
            <div
              style={{
                borderRadius: 'var(--radius-md)',
                padding: msg.sender === 'user' ? '12px 16px' : '16px 20px',
                backgroundColor: msg.sender === 'user' ? '#1e293b' : 'var(--bg-card)',
                border: `1px solid ${msg.sender === 'user' ? 'rgba(56, 189, 248, 0.25)' : 'var(--border-subtle)'}`,
                boxShadow: '0 4px 18px rgba(0, 0, 0, 0.2)',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                lineHeight: 1.6,
              }}
            >
              {/* Main text formatted */}
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {renderFormattedText(msg.text)}
              </div>

              {/* Code Snippets Attached */}
              {msg.snippets && msg.snippets.length > 0 && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {msg.snippets.map((snippet, sIdx) => {
                    const snippetKey = `${msg.id}-s-${sIdx}`;
                    return (
                      <div key={snippetKey} className="code-block-container">
                        <div className="code-block-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Code2 size={13} color="var(--cyan-glow)" />
                            <span>
                              {snippet.file_path} (Lines {snippet.start_line}-{snippet.end_line})
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '11px' }}
                              onClick={() =>
                                onOpenCodeDrawer &&
                                onOpenCodeDrawer({
                                  label: snippet.file_path,
                                  file_path: snippet.file_path,
                                  start_line: snippet.start_line,
                                  code: snippet.code,
                                  type: 'Snippet',
                                })
                              }
                            >
                              Expand
                            </button>
                            <button
                              type="button"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                              }}
                              onClick={() => handleCopySnippet(snippetKey, snippet.code)}
                            >
                              {copiedSnippetId === snippetKey ? (
                                <Check size={12} color="#10b981" />
                              ) : (
                                <Copy size={12} />
                              )}
                              <span>{copiedSnippetId === snippetKey ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>
                        <pre className="code-content">{snippet.code}</pre>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* User Avatar */}
            {msg.sender === 'user' && (
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <User size={15} color="#94a3b8" />
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Bot size={15} color="#050814" />
            </div>
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: 'var(--text-secondary)',
                fontSize: '12.5px',
              }}
            >
              <Loader2 size={16} className="animate-spin" color="var(--cyan-glow)" />
              <span>Querying ChromaDB Vector + Neo4j Graph + Gemini Orchestrator...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompts (when conversation is short) */}
      {messages.length <= 2 && !loading && (
        <div style={{ padding: '0 20px 10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {suggestedPrompts.map((promptText, pIdx) => (
            <button
              key={pIdx}
              type="button"
              className="btn-secondary"
              style={{ fontSize: '11.5px', borderRadius: '14px', padding: '5px 12px' }}
              onClick={() => handleSend(promptText)}
            >
              <Sparkles size={11} color="var(--cyan-glow)" />
              <span>{promptText}</span>
            </button>
          ))}
        </div>
      )}

      {/* Sticky Bottom Input Bar */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'rgba(15, 20, 34, 0.85)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '10px',
            background: '#090d18',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 12px',
            transition: 'border-color 0.2s',
          }}
          onFocus={() => {}}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about architecture, functions, inheritance, or blast radius..."
            rows={2}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              lineHeight: 1.4,
            }}
          />

          <button
            type="button"
            className="btn-primary"
            style={{
              padding: '8px 12px',
              height: '34px',
              opacity: !input.trim() || loading ? 0.5 : 1,
            }}
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
          >
            <Send size={14} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '6px',
            fontSize: '10.5px',
            color: 'var(--text-muted)',
          }}
        >
          <span>Press <strong>Enter</strong> to send, <strong>Shift+Enter</strong> for newline</span>
          <span>Zero-hallucination dual retrieval</span>
        </div>
      </div>
    </section>
  );
}
