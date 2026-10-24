import React from 'react';
import { FileCode, Box, FunctionSquare } from 'lucide-react';

export default function FilePill({ name, onSelect }) {
  // Infer entity type
  let type = 'FUNC';
  let Icon = FunctionSquare;
  let color = '#f59e0b';

  if (name.includes('.') && (name.endsWith('.py') || name.endsWith('.cpp') || name.endsWith('.h') || name.endsWith('.hpp'))) {
    type = 'FILE';
    Icon = FileCode;
    color = '#00f2fe';
  } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(name)) {
    type = 'CLASS';
    Icon = Box;
    color = '#c084fc';
  }

  return (
    <button
      type="button"
      className="entity-pill"
      style={{ borderColor: `${color}66`, color }}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect(name);
      }}
      title={`Inspect ${type.toLowerCase()} [[${name}]] in Architecture Canvas`}
    >
      <Icon size={11} strokeWidth={2.2} />
      <span>{name}</span>
      <span className="pill-tag" style={{ color: `${color}cc` }}>{type}</span>
    </button>
  );
}
