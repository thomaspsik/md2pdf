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

// --- filename from  ---
const argv = process.argv;
console.log(`Template used: ${argv[2]}`);
console.log(`Markdown used: ${argv[3]}`);

const templateFile = argv[2];
const markdownFile = argv[3];

if (!fs.existsSync(templateFile)) {
  console.error('You need to specify a template file with full path.');
  console.error(`call ${argv[1]} [template-file] [md-file] {|body|withTitle}`);

  process.exit(-1);
}

if (!fs.existsSync(markdownFile)) {
  console.error('You need to specify a markdown file with full path.');
  console.error(`call ${argv[1]} [template-file] [md-file] {|body|withTitle}`);

  process.exit(-1);
}

let mode = argv[4];
if (!mode) {
  mode = 'body';
}

const mdPathParts = path.parse(markdownFile);
const markdownPath = path.join(mdPathParts.dir); // GLOBAL

const templParts = path.parse(templateFile);
const toolpath = path.join(templParts.dir); // global

const dataFile = path.join(markdownPath, 'data.mjs');

let data = {};
if (fs.existsSync(dataFile)) {
  const impFileName = 'file://' + dataFile.replace(/\\/g, '/');
  console.log(`Importing metadata from ${impFileName}`);

  data = await import(impFileName);
  // console.log(data.default);
  data = data.default;
}

// collect SVG content
const svgLoader = [];
for (const d of Object.keys(data)) {
  if (d.endsWith('SVGContent')) {
    svgLoader.push({ name: d, file: data[d] });
  }
}

// read SVG content
console.log('Reading SVG Content');
console.log(svgLoader);
const svgContent = {};
for (const s of svgLoader) {
  const svgPath = path.join(toolpath, s.file);
  svgContent[s.name] = fs.readFileSync(svgPath).toString('utf-8');
}

// Beispiel Datenobjekt für das Mustache-Template
const documentData = {
  docTitle: 'tempTitle', // should be replaced by data.mjs
  tempHTMLFile: 'temp',
  topMargin: '20mm', // default
  bottomMargin: '25mm', // default
  leftMargin: '20mm', // default
  rightMargin: '20mm', // default
  ...data,
  // read logo svg to embed in header
  // logoContent: fs.readFileSync('html/imgs/Logo HTL Wien West2.svg').toString('utf-8'),
  ...svgContent,
  currentDate: `${new Date().toLocaleDateString('de-DE')}`,
};

// console.log(documentData);

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
  console.log('Generating tempTitle.pdf ...');
  await generatePdfFromFileUrl(markdownFileTitle, markdownPath, titleTemplateFile, titlePDFPath, documentData);

  // create body pdf
  const bodyPDFPath = path.join(markdownPath, 'tempBody' + '.pdf');
  documentData.tempHTMLFile = 'body';
  console.log('Generating tempBody.pdf ...');
  await generatePdfFromFileUrl(markdownFile, markdownPath, bodyTemplateFile, bodyPDFPath, documentData);

  // merge title+body pdf
  const finalPDFPath = path.join(markdownPath, documentData.docTitle + '.pdf');
  await mergePdfs(titlePDFPath, bodyPDFPath, finalPDFPath);

  // cleanup temp files
  if (!data.debug) {
    fs.unlinkSync(titlePDFPath); // Temporäre Datei aufräumen
    fs.unlinkSync(bodyPDFPath); // Temporäre Datei aufräumen
  }
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
    'file://[template-path]', // Ersetze den relativen Pfad
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
      top: data.topMargin,
      bottom: data.bottomMargin,
      left: data.leftMargin,
      right: data.rightMargin,
    },
  });
  await browser.close();

  if (!data.debug) {
    fs.unlinkSync(tempHtmlPath); // Temporäre Datei aufräumen
  }

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
