'use client';

import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-4 border-b border-slate-700 pb-2 text-xl font-semibold text-slate-100 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-lg font-semibold text-slate-100 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-3 text-base font-semibold text-slate-200 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-3 text-sm font-semibold text-slate-200 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0 marker:text-slate-500">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0 marker:text-slate-500">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-4 border-purple-500/50 pl-4 italic text-slate-400 last:mb-0">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-purple-400 underline decoration-purple-500/50 underline-offset-2 hover:text-purple-300"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-slate-700" />,
  table: ({ children }) => (
    <div className="mb-3 max-w-full overflow-x-auto last:mb-0">
      <table className="w-full min-w-[16rem] border-collapse border border-slate-700 text-left text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-800/80">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-slate-700 px-3 py-2 font-semibold text-slate-200">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-slate-700 px-3 py-2 text-slate-300">{children}</td>
  ),
  tr: ({ children }) => <tr className="even:bg-slate-800/30">{children}</tr>,
  pre: ({ children }) => (
    <pre className="mb-3 max-w-full overflow-x-auto rounded-lg border border-slate-700 bg-slate-950/80 p-3 text-[13px] leading-relaxed last:mb-0">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = typeof className === 'string' && className.includes('language-');
    if (isBlock) {
      return (
        <code className={`font-mono text-slate-200 ${className ?? ''}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[0.9em] text-purple-200"
        {...props}
      >
        {children}
      </code>
    );
  },
  strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
};

interface MessageMarkdownProps {
  content: string;
  className?: string;
}

export function MessageMarkdown({ content, className }: MessageMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
