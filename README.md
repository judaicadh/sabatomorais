# Sabato Morais Digital Repository

A digital archive of the correspondence, sermons, and manuscripts of Rev. Sabato
Morais (1823–1897). Each item pairs a **TEI transcription** with a **IIIF image
viewer** side by side, with descriptive metadata below.

Built with [Astro](https://astro.build/) + React, styled with Tailwind CSS v4,
image viewing via [Clover IIIF](https://github.com/samvera-labs/clover-iiif),
and deployed on Netlify. It is a companion to the Gershwind-Bennett Isaac Leeser
Digital Repository and a project of
[Judaica Digital Humanities at Penn](https://judaicadhpenn.org/).

## Getting started

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static build into dist/
npm run preview
```

## Project structure

```
src/
  data/items.json          # the collection — one object per item
  pages/
    index.astro            # home / browsable grid
    about.astro            # about Morais + the repository
    item/[slug].astro      # the reading view (transcription | image + metadata)
  components/
    TEIViewer.tsx          # renders TEI XML with person/place markup toggle
    TEILoader.tsx          # fetches a TEI XML URL and hands it to TEIViewer
    Clover.tsx             # IIIF image viewer
    NavBar.astro / Footer.astro
  layouts/BaseLayout.astro # shell, SEO/OG tags, JSON-LD
  styles/global.css        # theme tokens (paper/ink palette) + fonts
  scripts/slugify.js
```

## Adding your data

The whole collection lives in [`src/data/items.json`](src/data/items.json) — an
array of item objects. It is **generated from the TEI files** in `public/tei/`:

```bash
node scripts/generateItems.mjs     # rebuilds src/data/items.json from public/tei/*.xml
```

The generator ([`scripts/generateItems.mjs`](scripts/generateItems.mjs)) reads each
TEI header and body and derives a base record (id, title from the first meaningful
body line, description excerpt, place, extent), then **enriches it from two CSVs in
`data/`**:

- **`data/apotheca.csv`** — the Apotheca/Colenda export, matched on
  `metadata.identifier`. Supplies date, geographic subjects, languages, authority
  names, rights, box/folder, call number, catalog link, and the **ARK**. From the
  ARK the generator builds the IIIF manifest URL
  `https://colenda.library.upenn.edu/items/<ark>/manifest`, which fills the Facsimile
  panel with real page images.
- **`data/descriptive.csv`** — the curated descriptive sheet, matched on `work_id`.
  Where present it wins for title, description, date/display date, people, and
  geography.

Items in the Apotheca export get a live IIIF viewer; items only in the descriptive
sheet **are not on Colenda yet**, so they show "No image available" until they are —
at which point their ARK lands in the Apotheca export and the manifest appears
automatically. Curated titles/descriptions can also be pinned per id in the
`OVERRIDES` map at the top of the script. Re-run the generator whenever you add or
change TEI files or update the CSVs.

Per item, the reading view uses:

| Field                       | Purpose                                                        |
| --------------------------- | ------------------------------------------------------------- |
| `id`, `slug`                | Identifier and URL slug (`/item/<slug>`)                      |
| `title`, `title2`           | Short title and a fuller display title                        |
| `description`               | Abstract shown in the metadata block                          |
| `creators`, `contributors`  | People (sender / recipient for letters)                       |
| `type`                      | `Letter`, `Sermon`, `Manuscript`, `Book`, …                   |
| `date`, `hebrewdate`        | Gregorian and (optional) Hebrew dates                         |
| `subject`, `language`       | Arrays of subject terms / languages                           |
| `fromLocation`, `toLocation`| Places (shown for letters)                                    |
| `collection`                | Holding collection, used in the citation                      |
| **`xml`**                   | URL to a raw **TEI XML** file → fills the transcription panel |
| **`manifestUrl`**           | URL to a **IIIF manifest** → fills the image panel            |
| `thumbnail`                 | Image URL for the home-page card                              |

If `xml` or `manifestUrl` is empty, that panel shows a graceful
"No transcription / image available" placeholder, so records render before their
media is ready.

### TEI

`TEIViewer` reads `text > body` and understands `<lb/>` (line breaks), `<pb n=""/>`
(page breaks, rendered as labeled dividers), and toggleable `<persName>` /
`<placeName>` markup. Point `xml` at a raw file URL (e.g. a GitHub `raw.githubusercontent.com`
link to your TEI repo).

## Deploying

`netlify.toml` builds with `npm run build` and publishes `dist/`. Set the
production URL in `astro.config.mjs` (`site:`), currently
`https://morais.judaicadhpenn.org`.
