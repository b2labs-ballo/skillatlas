// Renders the creator's README safely: markdown + the HTML that READMEs often
// contain, with anything dangerous (scripts, styles, event handlers) removed.

import Markdown, { defaultUrlTransform } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const schema = {
  ...defaultSchema,
  // Do not let README HTML submit forms or embed inputs.
  tagNames: (defaultSchema.tagNames ?? []).filter((t) => t !== "input"),
};

/** READMEs use addresses relative to the repository; point them back at GitHub. */
function resolver(githubUrl: string | null, branch: string | null, sourceUrl?: string | null) {
  const repo = githubUrl?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)/)?.[1];
  const ref = branch || "HEAD";
  const hf = !repo && sourceUrl?.startsWith("https://huggingface.co/") ? sourceUrl : null;
  const files = repo ? `https://raw.githubusercontent.com/${repo}/${ref}/` : hf ? `${hf}/resolve/main/` : null;
  const pages = repo ? `https://github.com/${repo}/blob/${ref}/` : hf ? `${hf}/blob/main/` : null;
  return (url: string, key: string) => {
    let out = url.trim();
    if (files && pages && out && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(out)) {
      const path = out.replace(/^\.?\//, "");
      out = (key === "src" ? files : pages) + path;
    }
    // Images linked through the GitHub file viewer need the raw file address.
    if (key === "src") out = out.replace(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\//, "https://raw.githubusercontent.com/$1/");
    return defaultUrlTransform(out); // blocks javascript: and similar
  };
}

export function Readme({ markdown, githubUrl, branch, sourceUrl }: { markdown: string; githubUrl: string | null; branch: string | null; sourceUrl?: string | null }) {
  return (
    <div
      className="prose max-w-none break-words text-ink dark:prose-invert prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-ink prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-a:font-semibold prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-code:rounded-md prose-code:bg-accent-soft prose-code:px-1.5 prose-code:py-0.5 prose-code:font-medium prose-code:text-ink prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-2xl prose-pre:bg-[#231a3a] prose-pre:text-[#f1ecff] prose-img:my-1 prose-img:inline-block prose-img:max-w-full prose-img:rounded-lg prose-table:block prose-table:overflow-x-auto prose-hr:border-line [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit"
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
        urlTransform={resolver(githubUrl, branch, sourceUrl)}
        components={{
          a: ({ node: _node, ...props }) => {
            const external = /^https?:/i.test(props.href ?? "");
            return <a {...props} {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : {})} />;
          },
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ node: _node, ...props }) => <img {...props} alt={props.alt ?? ""} loading="lazy" />,
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
