// Generates src/data/items.json from the TEI files in public/tei/, enriched with
// metadata from the CSVs in data/ (Apotheca export + curated descriptive sheet).
// Run with:  node scripts/generateItems.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TEI_DIR = join(ROOT, "public", "tei");
const DATA_DIR = join(ROOT, "data");
const OUT = join(ROOT, "src", "data", "items.json");

const DEFAULT_COLLECTION =
  "Sabato Morais Collection, University of Pennsylvania Libraries";

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

// ---------- helpers ----------
const slugify = (t) =>
  String(t || "").toLowerCase().trim()
    .replace(/\s+/g, "-").replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-").replace(/^-+|-+$/g, "");

function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

// RFC 4180 CSV parser (handles quotes, escaped quotes, commas/newlines in fields)
function parseCSV(s) {
  const rows = [];
  let field = "", row = [], q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function loadCSV(file, idColumn) {
  const path = join(DATA_DIR, file);
  if (!existsSync(path)) return { head: [], byId: new Map() };
  const rows = parseCSV(readFileSync(path, "utf8"));
  const head = rows[0] || [];
  const idx = head.indexOf(idColumn);
  const byId = new Map();
  for (const r of rows.slice(1)) {
    if (r.length <= 1) continue;
    const id = (r[idx] || "").trim().toUpperCase();
    if (id) byId.set(id, r);
  }
  const get = (row, col) => {
    const i = head.indexOf(col);
    return i >= 0 ? (row[i] || "").trim() : "";
  };
  return { head, byId, get };
}

const splitPipes = (v) =>
  String(v || "").split("|").map((s) => s.trim()).filter(Boolean);

// most specific segment of an LC-style "A -- B -- C" place string
const specificPlace = (v) => {
  const parts = String(v || "").split("--").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
};

// ---------- TEI extraction (title/description/place from the document itself) ----------
const firstMatch = (xml, re) => { const m = xml.match(re); return m ? decodeEntities(m[1]).trim() : ""; };

function isBoilerplate(text) {
  const t = text.trim();
  if (t.length < 15) return true;
  if (/fifth street|n\.? fifth|s\.?\s*morais,/i.test(t)) return true;
  if (/^\W*\d+\W*$/.test(t)) return true;
  return false;
}
function paragraphText(pInner, joiner = " ") {
  return decodeEntities(pInner.replace(/<lb\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split("\n").map((l) => l.trim()).filter(Boolean).join(joiner)
    .replace(/\s+/g, " ").trim();
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
  const a = decodeEntities(raw).replace(/,?\s*\d{4}-\d{0,4}\s*$/, "").trim();
  if (!a) return "";
  if (a.includes(",")) { const [last, ...rest] = a.split(","); return `${rest.join(",").trim()} ${last.trim()}`.trim(); }
  return a;
}

// ---------- load CSVs ----------
const ap = loadCSV("apotheca.csv", "metadata.identifier[1].value");
const de = loadCSV("descriptive.csv", "work_id");

// ---------- build items ----------
const files = readdirSync(TEI_DIR).filter((f) => f.toLowerCase().endsWith(".xml")).sort();
const items = [];
let withManifest = 0, withCurated = 0;

for (const file of files) {
  const id = file.replace(/\.xml$/i, "");
  const KEY = id.toUpperCase();
  const xml = readFileSync(join(TEI_DIR, file), "utf8");

  const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const paras = bodyMatch ? [...bodyMatch[1].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1]) : [];
  const teiText = paras.map((p) => paragraphText(p)).filter((t) => !isBoilerplate(t)).join(" ").replace(/\s+/g, " ").trim();
  const teiTitle = buildTitle(paras);
  const teiPlace = firstMatch(xml, /<placeLet>([^<]+)<\/placeLet>/i).replace(/,\s*PA$/i, "");
  const teiPlaceRec = firstMatch(xml, /<placeRec>([^<]+)<\/placeRec>/i).replace(/,\s*PA$/i, "");
  const teiExtent = firstMatch(xml, /<extent>\s*(\d+\s+pages[^<]*)<\/extent>/i);
  const teiAddressee = firstMatch(xml, /<addressee[^>]*>([^<]+)<\/addressee>/i);

  const A = ap.byId.get(KEY);
  const D = de.byId.get(KEY);
  const override = OVERRIDES[id] || {};

  // --- Apotheca fields ---
  const apDate = A ? ap.get(A, "metadata.date[1].value") : "";
  const apExtent = A ? ap.get(A, "metadata.extent[1].value") : "";
  const apItemType = A ? ap.get(A, "metadata.item_type[1].value") : "";
  const apCollection = A ? ap.get(A, "metadata.collection[1].value") : "";
  const apProvenance = A ? ap.get(A, "metadata.provenance[1].value") : "";
  const apNotes = A ? [ap.get(A, "metadata.note[1].value"), ap.get(A, "metadata.note[2].value")].filter(Boolean) : [];
  const boxFolder = apNotes.find((n) => /box\s+\w+.*folder/i.test(n)) || "";
  const apCallNo = A ? ap.get(A, "metadata.physical_location[1].value") : "";
  const apRelation = A ? ap.get(A, "metadata.relation[1].value") : "";
  const apRights = A ? ap.get(A, "metadata.rights[1].value") : "";
  const apRightsUri = A ? ap.get(A, "metadata.rights[1].uri") : "";
  const apArk = A ? ap.get(A, "unique_identifier") : "";
  const apUrl = A ? ap.get(A, "apotheca_url") : "";
  const apLangs = A ? [ap.get(A, "metadata.language[1].value"), ap.get(A, "metadata.language[2].value")].filter(Boolean) : [];
  const apNames = A ? [1, 2, 3, 4].map((n) => ap.get(A, `metadata.name[${n}].value`)).filter(Boolean).map(normalizeAuthor) : [];
  const apGeo = A ? [1, 2, 3, 4].map((n) => specificPlace(ap.get(A, `metadata.geographic_subject[${n}].value`))).filter(Boolean) : [];

  // --- descriptive (curated) fields ---
  const deTitle = D ? de.get(D, "title") : "";
  const deDesc = D ? de.get(D, "description") : "";
  const deDate = D ? de.get(D, "date") : "";
  const deDateDisplay = D ? de.get(D, "date_display") : "";
  const deLang = D ? de.get(D, "language") : "";
  const dePeople = D ? splitPipes(de.get(D, "people")) : [];
  const deGeo = D ? splitPipes(de.get(D, "geography")) : [];
  if (D) withCurated++;

  // --- merged values ---
  const title = override.title || deTitle || teiTitle || id;
  const title2 = override.title2 || deTitle || teiTitle || title;
  const description =
    override.description || deDesc ||
    (teiText ? teiText.slice(0, 280).replace(/\s+\S*$/, "") + (teiText.length > 280 ? "…" : "") : "");

  const isoDate = deDate || apDate || "";

  // People: prefer curated list, then authority names, then TEI author + addressee
  const teiPeople = ["Sabato Morais", ...(teiAddressee ? [normalizeAuthor(teiAddressee)] : [])];
  const people = [...new Set(dePeople.length ? dePeople : apNames.length ? apNames : teiPeople)];
  let creators = people.length ? people : ["Sabato Morais"];
  let contributors = [];
  const fromTo = title.match(/^letter from\s+(.+?)\s+to\s+(.+?)(?:,|$)/i);
  if (fromTo) { creators = [fromTo[1].trim()]; contributors = [fromTo[2].trim()]; }

  const languages = [...new Set([...apLangs, ...(deLang ? [deLang] : [])])];

  const geography = deGeo.length ? deGeo : apGeo;
  const fromLocation = geography[0] || teiPlace || "Philadelphia";
  const toLocation = teiPlaceRec || "";

  const collection = boxFolder
    ? `${boxFolder}, University of Pennsylvania Libraries`
    : apCollection || DEFAULT_COLLECTION;

  const type =
    override.type ||
    apItemType ||
    (/^letter from/i.test(title) || contributors.length ? "Letter" : "Manuscript");

  const manifestUrl = apArk ? [`https://colenda.library.upenn.edu/items/${apArk}/manifest`] : [""];
  if (apArk) withManifest++;

  items.push({
    id,
    slug: slugify(id),
    title,
    title2,
    description,
    creators,
    contributors,
    people,
    thumbnail: "",
    manifestUrl,
    xml: `/tei/${file}`,
    type,
    collection,
    fromLocation,
    toLocation,
    geography,
    subject: override.subject || [],
    language: languages.length ? languages : ["English"],
    date: isoDate ? [isoDate] : [],
    dateDisplay: deDateDisplay || "",
    hebrewdate: "",
    extent: apExtent || teiExtent || "",
    callNumber: apCallNo || "",
    rights: apRights || "",
    rightsUri: apRightsUri || "",
    provenance: apProvenance || "",
    catalogUrl: apRelation || "",
    apothecaUrl: apUrl || "",
    ark: apArk || "",
  });
}

writeFileSync(OUT, JSON.stringify(items, null, 2) + "\n");
console.log(
  `Wrote ${items.length} items → src/data/items.json\n` +
  `  ${withManifest} with IIIF manifest, ${withCurated} with curated descriptive metadata.`
);
