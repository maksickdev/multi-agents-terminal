import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface Props {
  content: string;
  language: string; // "markdown" | "html"
}

marked.setOptions({ gfm: true, breaks: true });

function HtmlPreview({ content }: { content: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const blob = new Blob([content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [content]);

  if (!blobUrl) return null;

  return (
    <iframe
      ref={iframeRef}
      src={blobUrl}
      className="w-full h-full border-none bg-white"
      title="HTML preview"
    />
  );
}

export function RenderedPreview({ content, language }: Props) {
  const markdownHtml = useMemo(() => {
    if (language !== "markdown") return null;
    return DOMPurify.sanitize(marked.parse(content) as string);
  }, [content, language]);

  if (language === "html") {
    return <HtmlPreview content={content} />;
  }

  return (
    <div
      className="h-full overflow-auto p-6 bg-[#1a1b26] prose-preview"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: markdownHtml ?? "" }}
    />
  );
}
