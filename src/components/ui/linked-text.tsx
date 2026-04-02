import React from 'react';

/**
 * Matches valid http/https URLs in text.
 * Handles trailing punctuation gracefully (won't include trailing . , ; : ! ? ) if not part of URL).
 */
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+[^\s<>"{}|\\^`[\].,;:!?)]/g;

interface LinkedTextProps {
  text: string;
  className?: string;
}

/**
 * Renders plain text with auto-linked URLs.
 * Safe: uses React elements, no dangerouslySetInnerHTML.
 */
export const LinkedText: React.FC<LinkedTextProps> = ({ text, className }) => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(URL_REGEX.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    const url = match[0];
    const matchIndex = match.index;

    // Validate URL strictly
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        continue;
      }
    } catch {
      continue;
    }

    // Add text before the URL
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    parts.push(
      <a
        key={matchIndex}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
      >
        {url}
      </a>
    );

    lastIndex = matchIndex + url.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className={className}>{parts}</span>;
};
