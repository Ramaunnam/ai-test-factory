/**
 * Turns docs/PLAYBOOK.md into a printed playbook.
 *
 *   node scripts/make-playbook-pdf.mjs
 *
 * Nothing is added to this project. The three tools it needs (marked to read
 * the markdown, puppeteer-core to drive the browser, pdf-lib to stamp the
 * running header and footer) are installed once into a folder in the system
 * temp directory, and the browser is the Chrome or Edge already on the machine.
 *
 * It renders twice: the first pass finds out which page each section landed on,
 * the second pass puts those page numbers into the table of contents.
 */
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'docs', 'PLAYBOOK.md')
const OUT = join(ROOT, 'docs', 'J2W-AI-Test-Factory-Playbook.pdf')

const STEEL = '#14395C'
const MARGIN_MM = 18
const TOOLS = join(tmpdir(), 'j2w-pdf-tools')
const PACKAGES = ['marked', 'puppeteer-core', 'pdf-lib', 'pdfjs-dist']

/* -------------------------------------------------------------------------- */
/* The tools, kept outside the project                                        */
/* -------------------------------------------------------------------------- */

function ensureTools() {
  mkdirSync(TOOLS, { recursive: true })
  const missing = PACKAGES.filter((p) => !existsSync(join(TOOLS, 'node_modules', p)))
  if (!missing.length) return
  console.log(`  installing ${missing.join(', ')} into ${TOOLS} (not into this project)…`)
  // all four together: npm prunes whatever is not named in the command
  execSync(`npm install --no-save --no-audit --no-fund --silent ${PACKAGES.join(' ')}`, {
    cwd: TOOLS,
    stdio: 'inherit',
  })
}

/** The Chrome or Edge already installed, so no browser is downloaded. */
function findBrowser() {
  const candidates =
    process.platform === 'win32'
      ? [
          'C:/Program Files/Google/Chrome/Application/chrome.exe',
          'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
          'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
          'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          ]
        : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge']
  const found = [process.env.CHROME_PATH, ...candidates].find((p) => p && existsSync(p))
  if (!found) throw new Error('No Chrome or Edge found. Set CHROME_PATH to the browser executable.')
  return found
}

/* -------------------------------------------------------------------------- */
/* The page                                                                   */
/* -------------------------------------------------------------------------- */

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** "## 4. The business flows" -> { n: '4', title: '4. The business flows', id } */
function readSections(markdown) {
  const out = []
  let inFence = false
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence
    if (inFence) continue
    const m = /^## (.+)$/.exec(line)
    if (!m) continue
    const title = m[1].trim()
    if (title.toLowerCase() === 'table of contents') continue
    out.push({ title, id: 'sec-' + out.length })
  }
  return out
}

const CSS = `
  @page { size: A4; margin: ${MARGIN_MM}mm; }

  :root { --steel: ${STEEL}; --line: #c9d2dc; --grey: #f1f4f7; --muted: #4a5765; }

  * { box-sizing: border-box; }

  html, body {
    margin: 0; padding: 0;
    font-family: Inter, 'Segoe UI', Arial, Helvetica, sans-serif;
    font-size: 10.5pt; line-height: 1.5; color: #1c2530;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }

  code, pre, .mono { font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace; }

  /* ---------------------------------------------------------------- cover -- */
  .cover {
    page-break-after: always;
    height: 247mm;                 /* A4 height less the two margins */
    display: flex; flex-direction: column; justify-content: center;
  }
  .cover .rule { width: 54mm; height: 3.2mm; background: var(--steel); margin-bottom: 11mm; }
  .cover h1 {
    font-size: 33pt; line-height: 1.16; color: var(--steel);
    margin: 0 0 7mm 0; font-weight: 700; letter-spacing: -0.4pt;
  }
  .cover .subtitle { font-size: 14pt; color: var(--muted); margin: 0 0 22mm 0; }
  .cover .meta { font-size: 11pt; color: var(--muted); }
  .cover .meta .tag { color: var(--steel); font-weight: 600; letter-spacing: 0.4pt; }
  .cover .foot { margin-top: auto; font-size: 9pt; color: #7a8694; }

  /* ------------------------------------------------------------------ toc -- */
  .toc { page-break-after: always; }
  .toc h2 { font-size: 17pt; color: var(--steel); margin: 0 0 6mm 0; }
  .toc ol { list-style: none; margin: 0; padding: 0; }
  .toc li { margin: 0 0 2.6mm 0; break-inside: avoid; }
  .toc a {
    display: flex; align-items: baseline; gap: 2mm;
    color: #1c2530; text-decoration: none; font-size: 11pt;
  }
  .toc .dots { flex: 1; border-bottom: 1px dotted #b9c3cf; transform: translateY(-1.2mm); }
  .toc .pg { font-variant-numeric: tabular-nums; color: var(--muted); min-width: 7mm; text-align: right; }

  /* -------------------------------------------------------------- headings -- */
  h2 {
    page-break-before: always; break-before: page;
    font-size: 17pt; color: var(--steel); margin: 0 0 4mm 0; padding-bottom: 2mm;
    border-bottom: 1.6pt solid var(--steel);
  }
  h3 { font-size: 12.5pt; color: var(--steel); margin: 7mm 0 2.5mm 0; break-after: avoid; }
  h4 { font-size: 11pt; color: var(--steel); margin: 5mm 0 2mm 0; break-after: avoid; }
  h2 + h3, h2 + p { margin-top: 3mm; }

  p { margin: 0 0 3mm 0; orphans: 2; widows: 2; }
  ul, ol { margin: 0 0 3mm 0; padding-left: 6mm; }
  li { margin-bottom: 1.2mm; }
  strong { color: #10202f; }
  hr { display: none; }

  a { color: var(--steel); }

  /* ---------------------------------------------------------------- tables -- */
  table {
    width: 100%; border-collapse: collapse; margin: 0 0 4mm 0;
    font-size: 9.5pt; line-height: 1.38; table-layout: auto;
  }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th {
    background: var(--grey); color: #10202f; font-weight: 600; text-align: left;
    border: 0.6pt solid var(--line); padding: 1.6mm 2mm;
    /* a header on one line gives its column a sensible minimum width */
    white-space: nowrap;
  }
  /* break-word, never anywhere: "Sanctions" must not come out as "Sanction s" */
  td { border: 0.6pt solid var(--line); padding: 1.5mm 2mm; vertical-align: top; overflow-wrap: break-word; }
  td code, th code { font-size: 8.8pt; }

  /* ------------------------------------------------------- code and ascii -- */
  pre {
    background: var(--grey); border: 0.6pt solid var(--line); border-radius: 1.2mm;
    padding: 2.6mm 3mm; margin: 0 0 4mm 0; font-size: 8.6pt; line-height: 1.34;
    white-space: pre; overflow: hidden; break-inside: avoid; page-break-inside: avoid;
  }
  pre.wrap { white-space: pre-wrap; overflow-wrap: anywhere; }
  code { background: #eef2f6; border-radius: 0.8mm; padding: 0.2mm 1mm; font-size: 9pt; }
  pre code { background: none; padding: 0; font-size: inherit; }

  blockquote {
    margin: 0 0 4mm 0; padding: 2mm 3mm; border-left: 2.4pt solid var(--steel);
    background: #f6f9fc; color: var(--muted);
  }
  blockquote p:last-child { margin-bottom: 0; }
`

function buildHtml(bodyHtml, sections, pages, today) {
  const toc = sections
    .map(
      (s, i) =>
        `<li><a href="#${s.id}"><span>${escape(s.title)}</span><span class="dots"></span>` +
        `<span class="pg">${pages ? pages[i] : '&nbsp;'}</span></a></li>`,
    )
    .join('\n')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>J2W AI Test Factory — Playbook</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style></head>
<body>

<section class="cover">
  <div class="rule"></div>
  <h1>J2W AI Test Factory<br>— Playbook</h1>
  <p class="subtitle">AI-driven end-to-end test automation</p>
  <div class="meta">
    <div>${today}</div>
    <div class="tag">J2W · Internal</div>
  </div>
  <div class="foot">Simulated demonstration environment. All data is mock data; no real company, person,
  location or in-house system name appears in this document.</div>
</section>

<section class="toc">
  <h2>Contents</h2>
  <ol>${toc}</ol>
</section>

${bodyHtml}
</body></html>`
}

/* -------------------------------------------------------------------------- */
/* Render                                                                     */
/* -------------------------------------------------------------------------- */

/** A4 less the two margins, in CSS pixels, so the DOM lays out as it will print. */
const PRINT_WIDTH_PX = Math.round(((210 - 2 * MARGIN_MM) / 25.4) * 96)

async function render(browser, html) {
  const page = await browser.newPage()
  // measuring in the viewport is only meaningful if the viewport is the paper
  await page.setViewport({ width: PRINT_WIDTH_PX, height: 1123 })
  await page.setContent(html, { waitUntil: 'networkidle0' })
  await page.emulateMediaType('print')
  await page.evaluateHandle('document.fonts.ready')

  /* Shrink any block that would run off the right edge, so an ASCII diagram is
     never clipped. Only wrap as a last resort, because wrapping breaks art. */
  /* Measure every code block and shrink the ones that would run off the right
     edge, so an ASCII diagram is never clipped. Wrapping is a last resort,
     because it destroys the shape of a diagram.

     The width has to be measured with a Range over the text, and with the
     clipping switched off while measuring: scrollWidth on a `pre` includes the
     right-hand padding when the text fits and leaves it out when it does not,
     and a Range inside an `overflow: hidden` box reports the clipped width. */
  const { fitted, overflow } = await page.evaluate(() => {
    const widest = (el) => {
      const kept = el.style.overflow
      el.style.overflow = 'visible'
      const range = document.createRange()
      range.selectNodeContents(el)
      const w = range.getBoundingClientRect().width
      el.style.overflow = kept
      return w
    }
    const room = (el) => {
      const cs = getComputedStyle(el)
      return el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
    }

    const fitted = []
    document.querySelectorAll('pre').forEach((el, i) => {
      let size = 8.6
      el.style.fontSize = size + 'pt'
      while (widest(el) > room(el) + 0.5 && size > 5.4) {
        size = Math.round((size - 0.1) * 10) / 10
        el.style.fontSize = size + 'pt'
      }
      if (widest(el) > room(el) + 0.5) {
        el.classList.add('wrap')
        fitted.push({ i, size, wrapped: true })
      } else if (size < 8.6) {
        fitted.push({ i, size, wrapped: false })
      }
    })

    /* A short code-like cell such as IF-02, F10 or C6b must not be split at its
       hyphen. Anything longer is left to wrap normally. */
    document.querySelectorAll('td, th').forEach((cell) => {
      const t = (cell.textContent || '').trim()
      if (t.length <= 10 && !t.includes(' ')) cell.style.whiteSpace = 'nowrap'
    })

    const overflow = [...document.querySelectorAll('pre, table, td, th')]
      .filter((el) => (el.tagName === 'PRE' ? widest(el) > room(el) + 0.5 : el.scrollWidth > el.clientWidth + 1))
      .map((el) => el.tagName + ': ' + (el.textContent || '').replace(/\s+/g, ' ').slice(0, 60))

    return { fitted, overflow }
  })

  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: `${MARGIN_MM}mm`, right: `${MARGIN_MM}mm`, bottom: `${MARGIN_MM}mm`, left: `${MARGIN_MM}mm` },
  })
  await page.close()
  return { pdf, fitted, overflow }
}

/** Which page does each section heading start on? Read it back out of the PDF. */
async function sectionPages(pdfBytes, sections, require) {
  const pdfjs = await import(
    pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href
  )
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true }).promise
  const text = []
  for (let i = 1; i <= doc.numPages; i += 1) {
    const content = await (await doc.getPage(i)).getTextContent()
    text.push(content.items.map((t) => t.str).join('').replace(/\s+/g, ' ').trim())
  }
  const flat = (s) => s.replace(/\s+/g, ' ').trim()
  // The cover is page 1 and the contents is page 2. The contents repeats every
  // section title, so the search has to begin after it.
  const BODY_STARTS_AT = 2
  const pages = sections.map((s) => {
    const needle = flat(s.title)
    const hit = text.findIndex((t, i) => i >= BODY_STARTS_AT && t.includes(needle))
    return hit < 0 ? 1 : hit + 1
  })
  return { pages, text, numPages: doc.numPages }
}

/** The running header and footer, drawn straight onto every page but the cover. */
async function stamp(pdfBytes, require) {
  const { PDFDocument, StandardFonts, rgb } = await import(
    pathToFileURL(require.resolve('pdf-lib')).href
  )
  const doc = await PDFDocument.load(pdfBytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const steel = rgb(0x14 / 255, 0x39 / 255, 0x5c / 255)
  const gray = rgb(0.42, 0.47, 0.53)
  const pages = doc.getPages()
  const total = pages.length
  const mm = (n) => (n * 72) / 25.4

  pages.forEach((page, i) => {
    if (i === 0) return // the cover carries nothing
    const { width, height } = page.getSize()
    const title = 'J2W AI Test Factory — Playbook'
    page.drawText(title, { x: mm(MARGIN_MM), y: height - mm(11.5), size: 8, font, color: steel })
    page.drawLine({
      start: { x: mm(MARGIN_MM), y: height - mm(13.4) },
      end: { x: width - mm(MARGIN_MM), y: height - mm(13.4) },
      thickness: 0.5,
      color: rgb(0.79, 0.82, 0.86),
    })
    const foot = `Page ${i + 1} of ${total}`
    const w = font.widthOfTextAtSize(foot, 8)
    page.drawText(foot, { x: (width - w) / 2, y: mm(10.5), size: 8, font, color: gray })
    page.drawText('J2W · Internal', { x: mm(MARGIN_MM), y: mm(10.5), size: 8, font, color: gray })
  })
  return Buffer.from(await doc.save())
}

/* -------------------------------------------------------------------------- */

async function main() {
  if (!existsSync(SOURCE)) throw new Error(`${SOURCE} not found`)
  ensureTools()
  const require = createRequire(pathToFileURL(join(TOOLS, 'noop.js')))

  const { marked } = await import(pathToFileURL(require.resolve('marked')).href)
  const puppeteer = (await import(pathToFileURL(require.resolve('puppeteer-core')).href)).default

  // the file is checked out with Windows line endings; normalise before parsing
  const markdown = readFileSync(SOURCE, 'utf8').split(/\r\n|\r|\n/).join('\n')
  const sections = readSections(markdown)

  /* The contents page is built from the headings, so the list the markdown
     carries at the top would be a second, stale copy of it. Drop it. */
  const withoutToc = markdown.replace(/^## Table of contents[\s\S]*?(?=^## )/m, '')

  marked.setOptions({ gfm: true, breaks: false })
  let n = 0
  const renderer = new marked.Renderer()
  const heading = renderer.heading.bind(renderer)
  renderer.heading = (token) => {
    const html = heading(token)
    if (token.depth !== 2) return html
    const id = 'sec-' + n
    n += 1
    return html.replace('<h2', `<h2 id="${id}"`)
  }
  const bodyHtml = marked.parse(withoutToc, { renderer })

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: true,
    args: ['--no-sandbox', '--font-render-hinting=none'],
  })

  try {
    // pass 1 — no page numbers yet, just to see where the sections land
    const first = await render(browser, buildHtml(bodyHtml, sections, null, today))
    const found = await sectionPages(first.pdf, sections, require)

    // pass 2 — the same document, with the real page numbers in the contents
    const second = await render(browser, buildHtml(bodyHtml, sections, found.pages, today))
    const check = await sectionPages(second.pdf, sections, require)
    const moved = sections.filter((_, i) => check.pages[i] !== found.pages[i])

    const final = await stamp(second.pdf, require)
    writeFileSync(OUT, final)

    const size = statSync(OUT).size
    console.log('')
    console.log(`  written   ${OUT}`)
    console.log(`  pages     ${check.numPages}`)
    console.log(`  size      ${(size / 1024 / 1024).toFixed(2)} MB (${size.toLocaleString('en-GB')} bytes)`)
    console.log(`  sections  ${sections.length}, contents page numbers ${moved.length ? 'SHIFTED' : 'correct'}`)
    if (second.fitted.length) {
      console.log(`  shrunk    ${second.fitted.length} code block(s) so nothing is cut off at the right edge`)
    }
    if (second.overflow.length) {
      console.log(`  WARNING   ${second.overflow.length} block(s) still overflow:`)
      second.overflow.forEach((o) => console.log(`              ${o}`))
    }
    if (moved.length) {
      console.log('  WARNING   these sections moved between the two passes:')
      moved.forEach((s) => console.log(`              ${s.title}`))
    }
    console.log('')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('\n  failed:', err.message, '\n')
  process.exit(1)
})
