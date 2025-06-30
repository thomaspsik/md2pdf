import puppeteer from 'puppeteer';
import MarkdownIt from 'markdown-it'; // Importiere markdown-it
import Mustache from 'mustache'; // Mustache importieren
import fs from 'fs';
import path from 'path';
// markdown-it plugins
// https://mdit-plugins.github.io/
import { attrs } from '@mdit/plugin-attrs';
import { legacyImgSize, imgSize, obsidianImgSize } from '@mdit/plugin-img-size';

// other plugins
//
import mdAnchor from 'markdown-it-anchor';
import mdTOC from 'markdown-it-table-of-contents';

// md.use(require("markdown-it-anchor").default); // Optional, but makes sense as you really want to link to something, see info about recommended plugins below
// md.use(require("markdown-it-table-of-contents"));

// New syntax
const md = new MarkdownIt({ html: true }); // for comments
md.use(imgSize);
md.use(obsidianImgSize);
md.use(attrs);
md.use(mdAnchor);
md.use(mdTOC);

async function generatePdfFromFileUrl(markdownFilePath, markdownPath, toolpath, templateFilePath, outputPath, data) {
  // Pfad zur HTML-Datei
  const markdownContent = fs.readFileSync(markdownFilePath, 'utf8');
  //   console.log(markdownFilePath);
  //   console.log(markdownContent);

  const markdownHtml = md.render(markdownContent); // Markdown zu HTML konvertieren

  //   const htmlFilePath = path.join(__dirname, 'public', 'index.html'); // Annahme: public/index.html existiert
  // Pfad zum Bild (muss ABSOLUT sein in der HTML-Datei, oder du musst sehr vorsichtig sein)
  // const absoluteImagePath = path.join(__dirname, 'public', 'bilder', 'meinbild.jpg');

  // HTML-Inhalt anpassen, um absolute file:// Pfade zu verwenden
  // let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');

  const htmlTemplate = fs.readFileSync(templateFilePath, 'utf8'); // HTML-Template laden

  // Datenobjekt für Mustache um den Markdown-HTML-Inhalt erweitern
  const templateData = {
    markdownHtml, // Der konvertierte Markdown-HTML-Inhalt
    ...data, // Zusätzliche dynamische Daten aus dem Aufruf
  };

  // Mustache-Template mit den Daten rendern
  const fullHtml = Mustache.render(htmlTemplate, templateData);

  const htmlContentFull = fullHtml.replaceAll(
    'file://[tool-path]', // Ersetze den relativen Pfad
    `file://${toolpath.replace(/\\/g, '/')}`, // Durch den absoluten file:// Pfad (Windows-Pfade umwandeln)
  );

  // generate header with Mustache
  const headerTemplateHtml = fs.readFileSync(templateFilePath + '.header.html', 'utf8'); // HTML-Template laden
  const headerTemplate = Mustache.render(headerTemplateHtml, templateData);
  const footerTemplateHtml = fs.readFileSync(templateFilePath + '.footer.html', 'utf8'); // HTML-Template laden
  const footerTemplate = Mustache.render(footerTemplateHtml, templateData);

  // Eine temporäre HTML-Datei erstellen, um den aktualisierten Inhalt zu laden
  const tempHtmlPath = path.join(markdownPath, 'temp_index.html');
  fs.writeFileSync(tempHtmlPath, htmlContentFull);

  const browser = await puppeteer.launch({
    args: ['--allow-file-access-from-files'], // Wichtig für lokalen Dateizugriff
    // headless: false,
  });
  const page = await browser.newPage();

  // Navigiere zur temporären lokalen HTML-Datei
  await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
    margin: {
      top: '20mm',
      bottom: '25mm',
      left: '20mm',
      right: '20mm',
    },
  });
  await browser.close();

  //   fs.unlinkSync(tempHtmlPath); // Temporäre Datei aufräumen
  console.log(`PDF ${outputPath} erstellt!`);
}

import { fileURLToPath } from 'url';
import { error } from 'console';

// __filename Äquivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- filename from  ---
const argv = process.argv;
console.log(argv[2]);

const markdownFile = argv[2];

if (!fs.existsSync(markdownFile)) {
  console.error("You need to specify a markdown file with full path.");
  process.exit(-1);
}

const mdPathParts = path.parse(markdownFile);
const markdownPath = path.join(mdPathParts.dir);
const dataFile = path.join(markdownPath, 'data.mjs');
let data = {};
if (fs.existsSync(dataFile)) {
    const impFileName ="file://"+dataFile.replace(/\\/g, '/');
    console.log(`importing from ${impFileName}`);
     
  data = await import(impFileName);
  console.log(data.default);
  
}

// Beispiel Datenobjekt für das Mustache-Template
const documentData = {
    docTitle:"tempDocument", // should be replaced by data.mjs

    ...data.default,
//   docTitle: 'Pädagogisches Konzept Kooperation und Konkurrenz',
  showAdditionalInfo: false,
  generationDate: new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),
  status: 'Final',
  currentDate: `${new Date().toLocaleDateString('de-DE')}`,
//   titleHeader: 'Pädagogisches Konzept SEW+WEBT 5JG',
//   authorHeader: 'Thomas Psik',
  revisionHistory: [
    { version: '1.0', description: 'Initialer Entwurf', date: '2025-01-15' },
    { version: '1.1', description: 'Ergebnisse hinzugefügt', date: '2025-03-01' },
    { version: '1.2', description: 'Abschließende Überarbeitung', date: '2025-06-10' },
  ],
  // Daten, die an Puppeteer's headerTemplate und footerTemplate übergeben werden können
  // Beachte: Diese sind separate Templates und können nicht direkt auf die Mustache-Daten zugreifen,
  // es sei denn, du injizierst sie als globalen JS-Variable oder renderst den Header/Footer ebenfalls mit Mustache.
  // Für das Beispiel hier, ein statischer Wert, der nur für Puppeteer's Template ist.
  titleFromPuppeteer: 'Quartalsbericht',
  logoContent: fs.readFileSync('html/imgs/Logo HTL Wien West2.svg').toString('utf-8'),
};

const toolpath = path.join(__dirname, 'html');
const templateFile = path.join(toolpath, 'document-template03.html');
const outputPdf = path.join(markdownPath, documentData.docTitle + '.pdf');

generatePdfFromFileUrl(markdownFile, markdownPath, toolpath, templateFile, outputPdf, documentData);
