import { useMemo } from "react";
import { CopyButton } from "@/components/copy-button";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import bash from "shiki/langs/bash.mjs";
import json from "shiki/langs/json.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";

const highlighter = createHighlighterCoreSync({
  langs: [json, bash],
  themes: [githubLight, githubDark],
  engine: createJavaScriptRegexEngine(),
});

export function ApiCodeBlock({
  code,
  language,
}: {
  code: string;
  language: "json" | "bash";
}) {
  const html = useMemo(
    () =>
      highlighter.codeToHtml(code, {
        lang: language,
        themes: { light: "github-light", dark: "github-dark" },
      }),
    [code, language],
  );
  return (
    <div className="api-code-block cyber-card">
      <div className="api-code-header">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#ff5f56]" />
            <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="size-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="ml-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            {language === "json" ? "JSON Payload" : "Terminal cURL"}
          </span>
        </div>
        <CopyButton value={code} />
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
