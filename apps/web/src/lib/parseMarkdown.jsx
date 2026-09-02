import React from 'react';

export function parseMarkdown(mdText) {
  if (!mdText) return null;

  const lines = mdText.split('\n');
  const elements = [];
  let listItems = [];

  const flushList = (key) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="list-disc ps-5 space-y-1.5 my-3 text-text-brand text-[14px] font-semibold">
          {listItems.map((item, i) => <li key={i}>{parseInline(item)}</li>)}
        </ul>
      );
      listItems = [];
    }
  };

  const parseInline = (text) => {
    const parts = [];
    const regex = /(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g;
    let match;
    let lastIndex = 0;
    let keyIdx = 0;

    while ((match = regex.exec(text)) !== null) {
      const matchText = match[0];
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      if (matchText.startsWith('**') && matchText.endsWith('**')) {
        parts.push(<strong key={keyIdx++} className="font-bold text-dark-brand">{matchText.slice(2, -2)}</strong>);
      } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
        parts.push(<code key={keyIdx++} className="px-1.5 py-0.5 rounded bg-secondary/50 text-xs font-mono">{matchText.slice(1, -1)}</code>);
      } else if (matchText.startsWith('[') && matchText.includes('](')) {
        const label = matchText.substring(1, matchText.indexOf(']'));
        const href = matchText.substring(matchText.indexOf('](') + 2, matchText.length - 1);
        parts.push(
          <a key={keyIdx++} href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
            {label}
          </a>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  let inCode = false;
  let codeLines = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();

    if (line.startsWith('```')) {
      if (inCode) {
        elements.push(
          <pre key={`code-${idx}`} className="p-4 rounded-lg bg-secondary/30 border border-border/40 font-mono text-xs overflow-x-auto my-4 text-foreground">
            {codeLines.join('\n')}
          </pre>
        );
        inCode = false;
        codeLines = [];
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) { codeLines.push(lines[idx]); continue; }

    if (line.startsWith('# ')) {
      flushList(idx);
      elements.push(<h1 key={`h1-${idx}`} className="text-[20px] font-bold text-primary-brand mb-3 pb-3 border-b border-border">{parseInline(line.slice(2))}</h1>);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList(idx);
      elements.push(<h2 key={`h2-${idx}`} className="text-[18px] font-bold text-primary-brand mb-3">{parseInline(line.slice(3))}</h2>);
      continue;
    }
    if (line.startsWith('### ')) {
      flushList(idx);
      elements.push(<h3 key={`h3-${idx}`} className="text-[16px] font-bold text-dark-brand mb-3">{parseInline(line.slice(4))}</h3>);
      continue;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) { listItems.push(line.slice(2)); continue; }
    if (/^\d+\.\s/.test(line)) {
      flushList(idx);
      const m = line.match(/^\d+\.\s(.*)/);
      elements.push(
        <div key={`num-${idx}`} className="flex gap-3 my-2 text-sm text-muted-foreground">
          <span className="font-bold text-primary shrink-0">{line.match(/^\d+/)[0]}.</span>
          <p className="pt-0.5">{parseInline(m[1])}</p>
        </div>
      );
      continue;
    }
    if (line === '') { flushList(idx); continue; }
    if (line === '---') {
      flushList(idx);
      elements.push(<hr key={`hr-${idx}`} className="!my-5 border-border" />);
      continue;
    }
    if (line.startsWith('> ')) {
      flushList(idx);
      elements.push(<blockquote key={`quote-${idx}`} className="pl-4 border-l-4 border-primary/50 text-muted-foreground text-sm italic my-4">{parseInline(line.slice(2))}</blockquote>);
      continue;
    }

    // Pipe-delimited table rows
    if (line.startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.every(c => /^[-:]+$/.test(c))) continue;

      // Check if the next line is also a table row
      const nextLine = lines[idx + 1]?.trim() || '';
      const isLastRow = !nextLine.startsWith('|');

      elements.push(
        <div
          key={`tr-${idx}`}
          className={`grid gap-2 text-[12px] text-text-brand pb-2 mb-2 font-semibold ${isLastRow ? '' : 'border-b border-border'
            }`}
          style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
        >
          {cells.map((cell, ci) => <span key={ci}>{parseInline(cell)}</span>)}
        </div>
      );
      continue;
    }

    flushList(idx);
    elements.push(<p key={`p-${idx}`} className="text-[14px] font-semibold text-text-brand leading-relaxed my-3">{parseInline(line)}</p>);
  }

  flushList(lines.length);
  return elements;
}