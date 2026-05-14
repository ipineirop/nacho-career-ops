'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ReportViewer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert
      prose-headings:font-semibold prose-headings:tracking-tight
      prose-table:text-xs prose-th:font-semibold
      prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-xs
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
