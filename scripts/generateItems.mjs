// Generates src/data/items.json from the TEI files in public/tei/.
// Run with:  node scripts/generateItems.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TEI_DIR = join(ROOT, "public", "tei");
const OUT = join(ROOT, "src", "data", "items.json");

const COLLECTION =
  "Dropsie Collection, Center for Advanced Judaic Studies, University of Pennsylvania Libraries";

// Curated overrides keyed by id (filename without extension).
const OVERRIDES = {
  SMBx12FF5_20: {
    title: "Lecture on Isaac Abarbanel",
    title2: "Lecture on Don Isaac Abarbanel and the Expulsion from Spain",
    description:
      "A lecture by Sabato Morais on the Sephardic statesman and biblical commentator Don Isaac Abarbanel — his efforts to avert the 1492 expulsion of the Jews from Spain, his years of exile in Italy, and the fates of his three sons. Part of Morais's 'Post-Biblical History' lectures.",
    type: "Lecture",
    subject: [
      "Abarbanel, Isaac, 1437-1508",
      "Jews — Expulsion from Spain, 1492",
      "Sephardim — History",
      "Post-biblical history",
    ],
  },
};

const slugify = (t) =>
  String(t || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+|-+$/g, "");

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const firstMatch = (xml, re) => {
  const m = xml.match(re);
  return m ? decodeEntities(m[1]).trim() : "";
};

// A paragraph is letterhead/boilerplate we should skip when picking a title.
function isBoilerplate(text) {
  const t = text.trim();
  if (t.length < 15) return true;
  if (/fifth street|n\.? fifth|s\.?\s*morais,/i.test(t)) return true;
  if (/^\W*\d+\W*$/.test(t)) return true; // just a page number
  return false;
}

function paragraphText(pInner, joiner = " ") {
  return decodeEntities(
    pInner
      .replace(/<lb\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(joiner)
    .replace(/\s+/g, " ")
    .trim();
}

function buildTitle(paras) {
  for (const p of paras) {
    const firstLine = paragraphText(p, "\n").split("\n")[0].trim();
    if (!firstLine || isBoilerplate(firstLine)) continue;
    let title = firstLine.replace(/[.,;:\s]+$/, "");
    if (title.length > 80) title = title.slice(0, 77).replace(/\s+\S*$/, "") + "…";
    return title;
  }
  return "";
}

function normalizeAuthor(raw) {
  const a = decodeEntities(raw).trim();
  if (!a) return "";
  if (a.includes(",")) {
    const [last, ...rest] = a.split(",");
    return `${rest.join(",").trim()} ${last.trim()}`.trim();
  }
  return a;
}

const files = readdirSync(TEI_DIR).filter((f) => f.toLowerCase().endsWith(".xml"));
files.sort();

const items = [];
let withText = 0;

for (const file of files) {
  const id = file.replace(/\.xml$/i, "");
  const xml = readFileSync(join(TEI_DIR, file), "utf8");

  const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : "";
  const paras = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1]);

  const fullText = paras
    .map((p) => paragraphText(p))
    .filter((t) => !isBoilerplate(t))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (fullText) withText++;

  const authorRaw =
    firstMatch(xml, /<letHeading>[\s\S]*?<author[^>]*>([^<]+)<\/author>/i) ||
    firstMatch(xml, /<author[^>]*>([^<]+)<\/author>/i);
  const creator = normalizeAuthor(authorRaw) || "Sabato Morais";

  const addressee = firstMatch(xml, /<addressee[^>]*>([^<]+)<\/addressee>/i);
  const placeLet = firstMatch(xml, /<placeLet>([^<]+)<\/placeLet>/i).replace(/,\s*PA$/i, "");
  const placeRec = firstMatch(xml, /<placeRec>([^<]+)<\/placeRec>/i).replace(/,\s*PA$/i, "");
  const dateWhen = firstMatch(xml, /<dateLet[^>]*\bwhen="([^"]*)"/i);
  const dateText = firstMatch(xml, /<dateLet[^>]*>([^<]+)<\/dateLet>/i);
  const date = (dateWhen || dateText || "").trim();

  const languages = [...xml.matchAll(/<language[^>]*>([^<]+)<\/language>/gi)]
    .map((m) => decodeEntities(m[1]).trim())
    .filter(Boolean);
  const langs = [...new Set(languages)];

  const extent = firstMatch(xml, /<extent>\s*(\d+\s+pages[^<]*)<\/extent>/i);

  const override = OVERRIDES[id] || {};
  const title = override.title || buildTitle(paras) || id;
  const title2 = override.title2 || title;
  const description =
    override.description ||
    (fullText ? fullText.slice(0, 280).replace(/\s+\S*$/, "") + (fullText.length > 280 ? "…" : "") : "");

  const type = override.type || (addressee ? "Letter" : "Manuscript");

  items.push({
    id,
    slug: slugify(id),
    title,
    title2,
    description,
    creators: [creator],
    contributors: addressee ? [decodeEntities(addressee).trim()] : [],
    thumbnail: "",
    manifestUrl: [""],
    xml: `/tei/${file}`,
    type,
    collection: COLLECTION,
    fromLocation: placeLet || "Philadelphia",
    toLocation: placeRec || "",
    subject: override.subject || [],
    language: langs.length ? langs : ["English"],
    date: date ? [date] : [],
    hebrewdate: "",
    extent,
  });
}

writeFileSync(OUT, JSON.stringify(items, null, 2) + "\n");
console.log(`Wrote ${items.length} items to src/data/items.json (${withText} with transcription text).`);
