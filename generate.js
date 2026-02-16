import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// main libraries
import puppeteer from 'puppeteer';
import MarkdownIt from 'markdown-it'; // Importiere markdown-it
import Mustache from 'mustache'; // Mustache importieren

import { Monitor } from 'node-screenshots';

// markdown-it plugins
// https://mdit-plugins.github.io/
import { attrs } from '@mdit/plugin-attrs';
import { legacyImgSize, imgSize, obsidianImgSize } from '@mdit/plugin-img-size'; // legacyImgSize is not used
import { embed } from '@mdit/plugin-embed';
import { mark } from '@mdit/plugin-mark';

// other plugins
//
import mdAnchor from 'markdown-it-anchor';
import mdTOC from 'markdown-it-table-of-contents';
import mdInclude from 'markdown-it-include';

//
import plantuml from 'markdown-it-plantuml';

// file related
import { fileURLToPath } from 'url';

// pdf related
import muhammara from 'muhammara';

// New syntax
const md = new MarkdownIt({ html: true }); // for comments
md.use(imgSize);
md.use(obsidianImgSize);
// md.use(legacyImgSize); // disabled for no particular reason - just because legacy does not sound fresh :)

md.use(attrs);
md.use(mdAnchor);
md.use(mdTOC);
md.use(mdInclude);

// plantUml support
md.use(plantuml);

md.use(embed, {
  config: [
    // mandatory
    {
      name: 'youtube',
      setup: (id) =>
        `<iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe>`,
    },
    {
      name: 'icon',
      allowInline: true,
      setup: (name) => `<i class="icon icon-${name}"></i>`,
    },
  ],
});
// usage: {% youtube dQw4w9WgXcQ %}
// usage: Click the {% icon home %} button to go home.

md.use(mark); // "VuePress Theme Hope is ==powerful==."

// Global Variables
let restart = true;
// --- filename from  ---
const argv = process.argv;

const dataFile = argv[2]; // new paradigm // GLOBAL VARIABLE!!!

let data = {};
if (!fs.existsSync(dataFile)) {
  console.error('You need to specify an existing data file with full path.');
  console.error(`call ${argv[1]} [data-file]`);
  process.exit(-1);
}

const fulldataFilePath = fs.realpathSync(dataFile);

const impFileName = 'file://' + fulldataFilePath;
const dataFilePath = path.parse(fulldataFilePath).dir; // dir part of the data file // GLOBAL VARIABLE !!!

console.log(`Importing metadata from ${fulldataFilePath}`);
data = await import(impFileName);
// console.log(data.default);
data = data.default; // extract "default" data structure. This allows for javascript to be performed in the data.mjs file

while (restart) {
  // TODO Reloader
  // console.log(`Importing metadata from ${fulldataFilePath}`);
  // data = await import(fulldataFilePath);
  // console.log(data.default);
  // data = data.default; // extract "default" data structure. This allows for javascript to be performed in the data.mjs file

  /// collect SVG content
  const svgContent = {};
  const svgContentList = data.SVGContents;

  if (!!svgContentList && typeof svgContentList === 'object') {
    const svgLoader = [];
    for (const svg of Object.keys(svgContentList)) {
      svgLoader.push({ name: svg, file: svgContentList[svg] });
    }

    // read SVG content
    console.log(`Reading ${svgLoader.length} SVG Content`);
    for (const s of svgLoader) {
      let svgPath = s.file; // absolute path
      if (!path.isAbsolute(svgPath)) {
        svgPath = path.join(dataFilePath, s.file); // try relative path
      }
      if (!fs.existsSync(svgPath)) {
        console.log(
          `Warning: Could not read svg file [${svgPath}] specified in [${fulldataFilePath}].`,
        );
      }
      svgContent[s.name] = fs.readFileSync(svgPath).toString('utf-8');
    }
  }

  // default data for Mustache-Template
  const docData = {
    docTitle: 'tempTitle', // should be replaced by data.mjs
    filesPrefix: 'temp',
    paperFormat: 'A4',
    topMargin: '20mm', // default
    bottomMargin: '25mm', // default
    leftMargin: '20mm', // default
    rightMargin: '20mm', // default
    ...data,
    // read logo svg to embed in header
    ...svgContent,
    currentDate: `${new Date().toLocaleDateString('de-DE')}`,
  };

  const docParts = data.docParts;
  if (
    !docParts ||
    docParts.length < 1 ||
    typeof docParts[0].markdownFile != 'string' ||
    typeof docParts[0].content != 'string'
  ) {
    console.error(
      `You need to specify atlease one docPart in the data [${impFileName}] with markdownFile and content.`,
    );
    console.error(
      `   export default { ..., docParts:[ {markdownFile: "testBody.md", content: "./document-template-body.html"}] `,
    );
    process.exit(-2);
  }

  // loop through templates and create temporary pdfs
  console.log(`Number of document parts: ${docParts.length}`);

  if (data.restartCB) {
    console.log(`Execute CB function.`);
    data.restartCB();
  }

  if (data.screenshots) {
    console.log(`Found screenshots ${data.screenshots.list.length}.`);
    await genScreenshotList(data.screenshots);
  }

  for (const docP of docParts) {
    checkMarkdown(docP); // make sure that the markdown file exists
    checkTemplates(docP); // make sure that the template files exists

    await generatePdfFromDocPart(docP, docData);
  }
  console.log('Merging document parts ...');

  // done generating all parts -> join them
  const docPartsProcessed = [...docParts]; // create copy
  const finalPDFPath = path.join(dataFilePath, docData.docTitle + '.pdf');
  const first = docPartsProcessed.shift(); // get first and remove

  if (docPartsProcessed.length === 0) {
    // only 1 pdf -> just move temp to final
    fs.renameSync(first.partPDFPath, finalPDFPath);
  } else {
    let start = first.partPDFPath;
    for (const docP of docPartsProcessed) {
      await mergePdfs(start, docP.partPDFPath, finalPDFPath);
      // cleanup temp files
      start = finalPDFPath;
    }
  }
  console.log(`Processing file ${finalPDFPath} finished.`);

  // this is really annoing -> joining holds a lock on the files after returning to javascript
  // have to manually loop and wait for the task to release the temp files so they can be deleted.

  if (!data.debug) {
    let waitForJoin = 5; // max 5*2 seconds
    while (waitForJoin > 0) {
      try {
        let trys = 0;
        if (fs.existsSync(first.partPDFPath)) {
          trys++;
          fs.unlinkSync(first.partPDFPath); // remove file
        }
        for (const docP of docParts) {
          // loop through other files
          if (fs.existsSync(docP.partPDFPath)) {
            trys++;
            fs.unlinkSync(docP.partPDFPath); // remove file
          }
        }
        if (trys === 0) {
          break; // all have been deleted
        }
      } catch (e) {
        waitForJoin--;
        // wait 1 sec
        console.log('Waiting for 2 seconds for join to finish...');
        await new Promise((r) => setTimeout(r, 2000));
        // try again ...
      }
    }
    if (waitForJoin <= 0) {
      console.log('WARNING: Temporary files could not be removed.');
    }
  }

  if (data.openFinishedAndRestart) {
    console.log('Open final PDF trough OS...');
    execSync(`"${finalPDFPath}"`, (error) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
    });
  } else {
    restart = false;
  }
}

console.log(`Done.`);
process.exit(0);

/**
 * check if markdown file exists (absolute path or relative to the data file)
 * @param {*} docPart defintion of this part of the document
 * @returns
 */
function checkMarkdown(docPart) {
  let markdownFile = docPart.markdownFile;

  if (!markdownFile) {
    console.error(
      `You need to specify a markdownFile in the data file [${dataFile}].`,
    );
    console.error(`   export default {markdownFile: "./test.md", ...} `);

    process.exit(-2);
  }

  if (!path.isAbsolute(markdownFile)) {
    markdownFile = path.join(dataFilePath, markdownFile);
  }

  if (!fs.existsSync(markdownFile)) {
    console.error(
      `You need to specify an existing markdownFile in the data file [${dataFile}].`,
    );
    console.error(`Could not find [${markdownFile}].`);
    console.error(`   export default {markdownFile: "./test.md", ...} `);

    process.exit(-2);
  }

  console.log(`Markdown used: ${markdownFile}`);
  docPart.markdownFile = markdownFile; // set file
  return markdownFile;
}

/**
 *
 * @param {*} docPart
 */
function checkTemplates(docPart) {
  checkTemplateByName(docPart, 'content', true); // mandatory
  checkTemplateByName(docPart, 'header', false); // optional
  checkTemplateByName(docPart, 'footer', false); // optional
}
/**
 *
 * @param {*} docPart
 * @param {*} part
 * @param {*} mandatoryFlag
 * @returns
 */
function checkTemplateByName(docPart, part, mandatoryFlag) {
  let file = docPart[part];
  if (mandatoryFlag) {
    if (!file || typeof file != 'string') {
      console.error(
        `You must specify a ${part} in the data file [${dataFile}].`,
      );
      console.error(`Could not read property ${part} in:`);
      console.error(JSON.stringify(docPart));
      process.exit(-5);
    }
  } else {
    if (!file) {
      // no need to check
      return;
    }
  }

  if (!path.isAbsolute(file)) {
    file = path.join(dataFilePath, file);
  }

  if (!fs.existsSync(file)) {
    console.error(
      `You need to specify an existing template file in the data file [${dataFile}].`,
    );
    console.error(`Could not find [${file}].`);

    process.exit(-2);
  }

  console.log(`Templated used: ${file}`);

  docPart[part] = file; // write back
}

/**
 * generatePdfFromDocPart performs the generation of the temporary pdf file for the part of the document
 *
 * @param {*} docP document part with markdown and html templates
 * @param {*} docData data for mustache and global settings
 */
async function generatePdfFromDocPart(docP, docData) {
  const markdownPathParts = path.parse(docP.markdownFile);
  const markdownPath = markdownPathParts.dir;

  // create 2 temporary file names -> html and pdf
  const tempFileName = docData.filesPrefix + markdownPathParts.name;
  const partHTMLPath = path.join(markdownPath, tempFileName + '.html');
  const partPDFPath = path.join(markdownPath, tempFileName + '.pdf');

  console.log(`Generating ${partPDFPath} ..`);

  // Pfad zur HTML-Datei
  const markdownFilePath = docP.markdownFile;
  const markdownContent = fs.readFileSync(markdownFilePath, 'utf8');

  const markdownHtml = md.render(markdownContent); // convert Markdown to HTML
  // console.log(markdownHtml);

  const templateFilePath = docP.content;
  const htmlTemplate = fs.readFileSync(templateFilePath, 'utf8'); // HTML-Template laden

  // Datenobjekt für Mustache um den Markdown-HTML-Inhalt erweitern
  const templateData = {
    markdownHtml, // Der konvertierte Markdown-HTML-Inhalt
    ...docData, // Zusätzliche dynamische Daten aus dem Aufruf
  };

  // Mustache-Template mit den Daten rendern
  const fullHtml = Mustache.render(htmlTemplate, templateData);

  const htmlTemplatePath = path.parse(templateFilePath).dir;
  const replacePath = htmlTemplatePath.replace(/\\/g, '/');
  // console.log(replacePath);

  // replace placeholder for full path
  const htmlContentFull = fullHtml.replaceAll(
    'file://[template-path]', // Ersetze den relativen Pfad
    `file://${replacePath}`, // Durch den absoluten file:// Pfad (Windows-Pfade umwandeln)
  );

  // console.log(htmlContentFull);

  // Eine temporäre HTML-Datei erstellen, um den aktualisierten Inhalt zu laden
  fs.writeFileSync(partHTMLPath, htmlContentFull);

  // generate header with Mustache if present
  let headerTemplate = undefined;
  if (docP.header) {
    const headerTemplateHtml = fs.readFileSync(docP.header, 'utf8'); // HTML-Template laden
    headerTemplate = Mustache.render(headerTemplateHtml, templateData);
    console.log(`Rendered header template for ${partPDFPath}.`);
  }

  // generate footer with Mustache if present
  let footerTemplate = undefined;
  if (docP.footer) {
    const footerTemplateHtml = fs.readFileSync(docP.footer, 'utf8'); // HTML-Template laden
    footerTemplate = Mustache.render(footerTemplateHtml, templateData);
    console.log(`Rendered footer template for ${partPDFPath}.`);
  }

  const browser = await puppeteer.launch({
    args: ['--allow-file-access-from-files'], // important to access local files (images/css)
    // headless: false,
  });
  const page = await browser.newPage();

  // Navigiere zur temporären lokalen HTML-Datei
  await page.goto(`file://${partHTMLPath}`, { waitUntil: 'networkidle0' });

  // call "pdf" to generate a pdf with puppeteer
  await page.pdf({
    path: partPDFPath,
    format: docData.paperFormat, // should be provided in HTML template
    landscape: docData.paperLandscape,
    printBackground: true,
    displayHeaderFooter:
      headerTemplate != undefined || footerTemplate != undefined,
    headerTemplate, // could be empty
    footerTemplate, // could be empty
    margin: {
      top: docData.topMargin,
      bottom: docData.bottomMargin,
      left: docData.leftMargin,
      right: docData.rightMargin,
    },
  });
  // close headless browser
  await browser.close();

  if (!docData.debug) {
    fs.unlinkSync(partHTMLPath); // remove temporary html
  }
  docP.partPDFPath = partPDFPath; // store in docPart
  console.log(`PDF ${partPDFPath} saved.`);
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
  return new Promise((resolve, reject) => {
    try {
      const pdfPart = pdfDoc.appendPage(second);
      pdfPart.endPDF(resolve);
      console.log(`Merging to ${output}.`);
      // console.log(`Merging\n\t${first}\n\t${second}\n to\n${output} - DONE.`);
      resolve();
    } catch (ex) {
      console.error('Error while merging');
      console.error(ex);

      reject(ex);
    }
  });
}

async function genScreenshotList(screenshots) {
  // open browser
  const browser = await puppeteer.launch({
    args: ['--allow-file-access-from-files'], // important to access local files (images/css)
    headless: screenshots.headless,
  });
  const page = await browser.newPage({ type: 'window' });

  let monitor = null;
  if (screenshots.mode == 'window') {
    monitor = Monitor.fromPoint(10, 10);
  }
  // do list of screenshots
  for (const s of screenshots.list) {
    const imgPath = path.join(dataFilePath, s.file); // try relative path
    if (!fs.existsSync(imgPath)) {
      console.log(`Performing screenshot for [${s.file}].`);

      // generate screenshot
      if (s.mode == 'window') {
        //  screenshot window
        await genScreenshotWindow(monitor, browser, page, s, imgPath);
      } else {
        // screenshot page
        await genScreenshot(page, s, imgPath);
      }
    } else {
      console.log(`Skip [${s.file}] file exists.`);
    }
  }

  // close browser
  await browser.close();
}

// function to perfrom screenshot and store image
async function genScreenshot(page, s, imgPath) {
  // change viewport if defined (first)
  if (s.vp) {
    await page.setViewport({
      width: s.vp.width,
      height: s.vp.height,
    });
  }

  // go to page and do stuff on page
  await doPage(page, s)

  // do screenshot
  await page.screenshot({
    path: imgPath,
  });
}

// function to perfrom screenshot and store image
async function genScreenshotWindow(monitor, browser, page, s, imgPath) {
  const windowId = await page.windowId();

  if (!s.window) {
    console.error("You need to specify window - if mode 'window' is selected for screenshot.")
  }
  await browser.setWindowBounds(windowId, s.window);

  // change viewport if defined
  if (s.vp) {
    await page.setViewport({
      width: s.vp.width,
      height: s.vp.height,
    });
  } else {
    await page.setViewport(null);
  }

  // go to page and do stuff on page
  await doPage(page, s);

  // do screenshot
  let image = monitor.captureImageSync();
  if (s.crop) {
    image = image.cropSync(
      s.crop.left,
      s.crop.top,
      s.crop.width,
      s.crop.height,
    );
  }
  // fs.writeFileSync(path.join(dataFilePath, 'uncrop'+s.file), image.toPngSync());

  fs.writeFileSync(imgPath, image.toPngSync());
}

async function doPage(page, s) {
   // go to url
  await page.goto(s.url, { waitUntil: 'networkidle0' });

  // scroll if specified
  await doScroll(page, s);

  // perform inputs if specified
  await doInput(page, s);
  
  // wait for async images to load if specified
  await doDelay(s.delay);
}


async function doInput(page, s) {
  if (!s.input) {
    return;
  }
  for (const inp of s.input) {
    if (inp.target) {
      await page.type(inp.target, inp.value, { delay: inp.delay });
    } else if (inp.keypress) {
      await page.keyboard.press(inp.keypress);
      await doDelay(inp.delay);
    } else if (inp.click) {
      await page.click(inp.click);
      await doDelay(inp.delay);
    }
  }
}

async function doDelay(delay) {
  if (delay) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function doScroll(page, s) {
  // to scrolling
  if (s.scroll) {
    // Locating the target element using a selector
    const targetElement = await page.$(s.scroll.target);

    // Scrolling the target element into view
    await targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
