import React from 'react';

function renderInlineFormatting(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[12px] text-teal-700 dark:text-teal-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

export function FormattedAssistantText({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={keyPrefix} className="space-y-1.5 my-2 pl-4 list-disc marker:text-teal-600">
        {listItems.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInlineFormatting(item)}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(`list-${idx}`);
      return;
    }

    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      flushList(`list-${idx}`);
      const cleanHeading = line.replace(/^#{1,3}\s+/, '');
      elements.push(
        <p
          key={`h-${idx}`}
          className="font-display font-semibold text-slate-900 dark:text-white mt-3 first:mt-0 mb-1"
        >
          {renderInlineFormatting(cleanHeading)}
        </p>
      );
      return;
    }

    if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      listItems.push(line.replace(/^([-*•]|\d+\.)\s+/, ''));
      return;
    }

    flushList(`list-${idx}`);
    elements.push(
      <p key={`p-${idx}`} className="leading-relaxed my-1.5 first:mt-0 last:mb-0">
        {renderInlineFormatting(line)}
      </p>
    );
  });

  flushList('list-end');
  return <div className="text-sm text-slate-700 dark:text-slate-200 tabular-nums">{elements}</div>;
}
