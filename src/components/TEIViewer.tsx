import React, { useState, useRef, useEffect } from "react";

export default function TEIViewer({ teiXml }: { teiXml: string }) {
  const [markedUp, setMarkedUp] = useState(true);
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
          popoverRef.current &&
          !popoverRef.current.contains(event.target as Node) &&
          buttonRef.current &&
          !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false);
      }
    }
    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPopover]);

  const html = React.useMemo(() => {
    const parser = new DOMParser();
    const xml = parser.parseFromString(teiXml, "application/xml");
    const bodyNode = xml.querySelector("text > body");
    if (!bodyNode) return "<p>No transcription available.</p>";

    const copy = bodyNode.cloneNode(true) as HTMLElement;

    // <lb/> → <br>
    copy.querySelectorAll("lb").forEach((lb) => lb.replaceWith(document.createElement("br")));

    // <pb/> → divider with page number
    copy.querySelectorAll("pb").forEach((pb, i) => {
      const pageNum = pb.getAttribute("n") || `${i + 1}`;
      const container = document.createElement("div");
      container.className = "relative flex flex-col items-center my-6";
      container.setAttribute("role", "separator");
      container.id = `page-${pageNum}`;

      const hrLine = document.createElement("hr");
      hrLine.className = "w-full border-t border-gray-300 dark:border-gray-600 mb-2";

      const label = document.createElement("span");
      label.className =
          "mx-3 px-2 py-0.5 text-xs font-medium uppercase tracking-wide bg-white dark:bg-gray-900 text-gray-600 dark:text-accent-100 rounded";
      label.textContent = `Page ${pageNum}`;
      label.setAttribute("aria-label", `Page break: Page ${pageNum}`);

      container.appendChild(hrLine);
      container.appendChild(label);
      pb.replaceWith(container);
    });

    if (markedUp) {
      // <persName>
      copy.querySelectorAll("persName").forEach((el) => {
        const span = document.createElement("span");
        span.className =
            "text-violet-700 dark:text-violet-300 underline decoration-dotted decoration-violet-400 dark:decoration-violet-500";
        span.innerHTML = el.innerHTML;
        el.replaceWith(span);
      });

      // <placeName>
      copy.querySelectorAll("placeName").forEach((el) => {
        const span = document.createElement("span");
        span.className =
            "text-emerald-700 dark:text-emerald-300 underline decoration-dashed decoration-emerald-400 dark:decoration-emerald-500";
        span.innerHTML = el.innerHTML;
        el.replaceWith(span);
      });
    }

    return copy.innerHTML;
  }, [teiXml, markedUp]);

  return (
      <div>
        {/* Heading row */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-serif text-ink dark:text-accent-50">Transcription</h2>

          {/* Toggle + info button */}
          <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => setMarkedUp(!markedUp)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-1  ${
                    markedUp
                        ? "bg-[#37474F] border   " // ON
                        : "bg-gray-300 border border-gray-400 " // OFF
                }`}
                aria-pressed={markedUp}
            >
<span
    className={`inline-block h-3.5 w-3.5 transform rounded-full shadow transition-transform duration-300 ${
        markedUp
            ? "translate-x-4 bg-gray-50 dark:bg-gray-200" // ON
            : "translate-x-1 bg-gray-200 dark:bg-accent-50"   // OFF: force white in dark mode
    }`}
/>
            </button>
            <div className="flex items-center text-xs text-gray-600 dark:text-accent-50 relative">
              TEI Markup
              <button
                  ref={buttonRef}
                  onClick={() => setShowPopover(!showPopover)}
                  className="ml-1 text-ink-muted hover:text-ink dark:text-accent-200 hover:dark:text-accent-50"
                  aria-label="Show transcription key"
              >
                <svg
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                >
                  <path
                      fillRule="evenodd"
                      d="M18 10A8 8 0 112 10a8 8 0 0116 0zm-7-3a1 1 0 11-2 0 1 1 0 012 0zm-1 2a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z"
                      clipRule="evenodd"
                  />
                </svg>
              </button>

              {showPopover && (
                  <div
                      ref={popoverRef}
                      className="absolute top-full right-0 mt-2 w-64 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-3 text-sm text-gray-700 dark:text-gray-300 z-50"
                      role="tooltip"
                  >
                    {/* Header with X button */}
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold font-serif text-ink dark:text-gray-100">
                        TEI Formatting Key
                      </h3>
                      <button
                          onClick={() => setShowPopover(false)}
                          className="text-gray-400 hover:text-ink dark:hover:text-gray-200"
                          aria-label="Close"
                      >
                        <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                          <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414
            1.414L11.414 10l4.293 4.293a1 1 0 01-1.414
            1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586
            10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Content */}
                    <ul className="space-y-1 pl-2 list-disc">
                      <li>
        <span className="text-violet-700 dark:text-violet-300 underline decoration-dotted decoration-violet-400 dark:decoration-violet-500">
          Person Name
        </span>
                      </li>
                      <li>
        <span className="text-emerald-700 dark:text-emerald-300 underline decoration-dashed decoration-emerald-400 dark:decoration-emerald-500">
          Place Name
        </span>
                      </li>
                    </ul>
                  </div>
              )}
            </div>
          </div>
        </div>

        {/* Viewer */}
        <div
            className="prose max-w-none dark:text-accent-50 font-sans leading-relaxed text-sm sm:text-base dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
  );
}