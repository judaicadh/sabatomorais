import React, { useEffect, useState } from "react";
import TEIViewer from "./TEIViewer";

export default function TEILoader({ url }: { url: string }) {
  const [teiXml, setTeiXml] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    fetch(url)
      .then((res) => res.text())
      .then((xml) => setTeiXml(xml));
  }, [url]);

  if (!teiXml) return <p className="text-gray-500 dark:text-accent-50">Loading transcription…</p>;

  return <TEIViewer teiXml={teiXml} />;
}
