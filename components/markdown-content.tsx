"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const markdownComponents: Components = {
  a: ({ node: _node, ...props }) => (
    <a
      {...props}
      className={cn(
        "underline decoration-sea/40 underline-offset-4 transition hover:text-sea",
        props.className,
      )}
    />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote
      {...props}
      className={cn("border-l-4 border-sea/25 pl-4 italic text-ink/70", props.className)}
    />
  ),
  h1: ({ node: _node, ...props }) => <h1 {...props} className={cn("text-2xl font-semibold text-ink", props.className)} />,
  h2: ({ node: _node, ...props }) => <h2 {...props} className={cn("text-xl font-semibold text-ink", props.className)} />,
  h3: ({ node: _node, ...props }) => <h3 {...props} className={cn("text-lg font-semibold text-ink", props.className)} />,
  hr: ({ node: _node, ...props }) => <hr {...props} className={cn("border-0 border-t border-ink/10", props.className)} />,
  img: ({ alt }) => (
    <span className="inline-flex rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-ink/55">
      {alt ? `Inline image omitted: ${alt}` : "Inline images are not shown here."}
    </span>
  ),
  li: ({ node: _node, ...props }) => <li {...props} className={cn("pl-1", props.className)} />,
  ol: ({ node: _node, ...props }) => <ol {...props} className={cn("list-decimal space-y-2 pl-5", props.className)} />,
  p: ({ node: _node, ...props }) => <p {...props} className={cn("text-inherit", props.className)} />,
  pre: ({ node: _node, ...props }) => (
    <pre
      {...props}
      className={cn("overflow-x-auto rounded-2xl bg-ink px-4 py-3 text-sm text-white", props.className)}
    />
  ),
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} className={cn("min-w-full border-collapse text-left", props.className)} />
    </div>
  ),
  td: ({ node: _node, ...props }) => <td {...props} className={cn("border border-ink/10 px-3 py-2 align-top", props.className)} />,
  th: ({ node: _node, ...props }) => (
    <th
      {...props}
      className={cn("border border-ink/10 bg-ink/5 px-3 py-2 text-left font-semibold", props.className)}
    />
  ),
  ul: ({ node: _node, ...props }) => <ul {...props} className={cn("list-disc space-y-2 pl-5", props.className)} />,
};

export function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-4 break-words text-sm leading-6 text-inherit [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:rounded-lg [&_code]:bg-ink/8 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.95em] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
        className,
      )}
    >
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm, remarkBreaks]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
