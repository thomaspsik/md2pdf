// speichern als generate-pdf.js
const puppeteer = require('puppeteer');
const marked = require('marked');
const fs = require('fs');
const path = require('path');

async function generatePdfFromMarkdown(markdownFilePath, outputPath) {
  try {
    const markdownContent = fs.readFileSync(markdownFilePath, 'utf8');
    const htmlContent = marked.parse(markdownContent);

    // HTML-Template für das PDF mit Headern und Footern
    const fullHtml = fs.readFileSync('./template-01.html').toString();

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Setze den HTML-Inhalt
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

    // Generiere das PDF mit Kopf- und Fußzeile
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
                <div style="font-size: 10px; margin-left: 20mm; width: 100%; text-align: right;">
                    <span class="title" style="font-weight: bold;">Mein Dokument</span>
                </div>
            `,
      footerTemplate: `
                <div style="font-size: 10px; margin-right: 20mm; width: 100%; text-align: right;">
                    Seite <span class="pageNumber"></span> von <span class="totalPages"></span>
                </div>
            `,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '20mm',
        right: '20mm',
      },
    });

    await browser.close();
    console.log(`PDF erfolgreich generiert: ${outputPath}`);
  } catch (error) {
    console.error('Fehler beim Generieren des PDFs:', error);
  }
}

// Beispielnutzung:
const markdownFile = path.join(__dirname, 'dokument.md'); // Erstelle eine dokument.md Datei in diesem Verzeichnis
const outputPdf = path.join(__dirname, 'dokument.pdf');
generatePdfFromMarkdown(markdownFile, outputPdf);

