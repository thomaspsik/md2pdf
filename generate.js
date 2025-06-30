import puppeteer from 'puppeteer';
import MarkdownIt from 'markdown-it'; // Importiere markdown-it
import Mustache from 'mustache'; // Mustache importieren
import fs from 'fs';
import path from 'path';

// markdown-it plugins
// https://mdit-plugins.github.io/
import { attrs } from '@mdit/plugin-attrs';
import { legacyImgSize, imgSize, obsidianImgSize } from '@mdit/plugin-img-size';
import { embed } from '@mdit/plugin-embed';
import { mark } from '@mdit/plugin-mark';

// other plugins
//
import mdAnchor from 'markdown-it-anchor';
import mdTOC from 'markdown-it-table-of-contents';

// file related
import { fileURLToPath } from 'url';

// pdf related
import muhammara from 'muhammara';

// New syntax
const md = new MarkdownIt({ html: true }); // for comments
md.use(imgSize);
md.use(obsidianImgSize);
md.use(attrs);
md.use(mdAnchor);
md.use(mdTOC);

md.use(embed, {
  config: [
    // mandatory
    //   {
    //     name: 'youtube',
    //     setup: (id) =>
    //       `<iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe>`,
    //   },
    //   {
    //     name: 'icon',
    //     allowInline: true,
    //     setup: (name) => `<i class="icon icon-${name}"></i>`,
    //   },
  ],
});
// usage: {% youtube dQw4w9WgXcQ %}
// usage: Click the {% icon home %} button to go home.

md.use(mark); // "VuePress Theme Hope is ==powerful==."

// Global Variables

// __filename Äquivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const toolpath = path.join(__dirname, 'html'); // global

// --- filename from  ---
const argv = process.argv;
console.log(argv[2]);

const markdownFile = argv[2];

if (!fs.existsSync(markdownFile)) {
  console.error('You need to specify a markdown file with full path.');
  console.error(`call ${argv[1]} [md-file] {|body|withTitle}`);

  process.exit(-1);
}

let mode = argv[3];
if (!mode) {
  mode = 'body';
}

const mdPathParts = path.parse(markdownFile);
const markdownPath = path.join(mdPathParts.dir); // GLOBAL

const dataFile = path.join(markdownPath, 'data.mjs');

let data = {};
if (fs.existsSync(dataFile)) {
  const impFileName = 'file://' + dataFile.replace(/\\/g, '/');
  console.log(`importing from ${impFileName}`);

  data = await import(impFileName);
  console.log(data.default);
}

// Beispiel Datenobjekt für das Mustache-Template
const documentData = {
  docTitle: 'tempTitle', // should be replaced by data.mjs
  tempHTMLFile: 'temp',
  ...data.default,
  // read logo svg to embed in header
  logoContent: fs.readFileSync('html/imgs/Logo HTL Wien West2.svg').toString('utf-8'),
  currentDate: `${new Date().toLocaleDateString('de-DE')}`,

  //   docTitle: 'Pädagogisches Konzept Kooperation und Konkurrenz',
  // NOT USED
  /*
  showAdditionalInfo: false,
  generationDate: new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }),

  status: 'Final',

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
  */
};

const titleTemplateFile = path.join(toolpath, 'document-template-title.html'); // GLOBAL
const bodyTemplateFile = path.join(toolpath, 'document-template-body.html'); // GLOBAL

if (mode === 'withTitle') {
  // try read title md file
  const markdownFileTitle = path.join(markdownPath, 'title.md');
  if (!fs.existsSync(markdownFileTitle)) {
    console.error(`Title markdown file ${markdownFileTitle} missing.`);
    process.exit(-1);
  }

  // create title pdf
  const titlePDFPath = path.join(markdownPath, 'tempTitle' + '.pdf');
  documentData.tempHTMLFile = 'title';
  await generatePdfFromFileUrl(markdownFileTitle, markdownPath, titleTemplateFile, titlePDFPath, documentData);

  // create body pdf
  const bodyPDFPath = path.join(markdownPath, 'tempBody' + '.pdf');
  documentData.tempHTMLFile = 'body';
  await generatePdfFromFileUrl(markdownFile, markdownPath, bodyTemplateFile, bodyPDFPath, documentData);

  // merge title+body pdf
  const finalPDFPath = path.join(markdownPath, documentData.docTitle + '.pdf');
  await mergePdfs(titlePDFPath, bodyPDFPath, finalPDFPath);

  // cleanup temp files
  // fs.unlinkSync(titlePDFPath); // Temporäre Datei aufräumen
  // fs.unlinkSync(bodyPDFPath); // Temporäre Datei aufräumen
} else if (mode === 'body') {
  const outputPdfPath = path.join(markdownPath, documentData.docTitle + '.pdf');
  await generatePdfFromFileUrl(markdownFile, markdownPath, bodyTemplateFile, outputPdfPath, documentData);
} else {
  console.error(`Mode ${mode} not supported.`);
  process.exit(-1);
}

async function generatePdfFromFileUrl(markdownFilePath, markdownPath, templateFilePath, outputPath, data) {
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
  const headerFile = templateFilePath + '.header.html';
  let headerTemplate = undefined;
  if (fs.existsSync(headerFile)) {
    const headerTemplateHtml = fs.readFileSync(headerFile, 'utf8'); // HTML-Template laden
    headerTemplate = Mustache.render(headerTemplateHtml, templateData);
    console.log(`Rendered header template for ${outputPath}.`);
  }

  const footerFile = templateFilePath + '.footer.html';
  let footerTemplate = undefined;
  if (fs.existsSync(footerFile)) {
    const footerTemplateHtml = fs.readFileSync(footerFile, 'utf8'); // HTML-Template laden
    footerTemplate = Mustache.render(footerTemplateHtml, templateData);
    console.log(`Rendered footer template for ${outputPath}.`);
  }
  // Eine temporäre HTML-Datei erstellen, um den aktualisierten Inhalt zu laden
  const tempHtmlPath = path.join(markdownPath, data.tempHTMLFile + '_index.html');
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
    displayHeaderFooter: headerTemplate != undefined || footerTemplate != undefined,
    headerTemplate, // could be empty
    footerTemplate, // could be empty
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

/*

const pdfDoc = new Recipe("input.pdf", "output.pdf");
const longPDF = "/longPDF.pdf";

pdfDoc
  // just page 10
  .appendPage(longPDF, 10)
  // page 4 and page 6
  .appendPage(longPDF, [4, 6])
  // page 1-3 and 6-20
  .appendPage(longPDF, [
    [1, 3],
    [6, 20],
  ])
  // all pages
  .appendPage(longPDF)
  .endPDF();
*/

async function mergePdfs(first, second, output) {
  const Recipe = muhammara.Recipe;
  const pdfDoc = new Recipe(first, output);

  await pdfDoc.appendPage(second).endPDF();
}
