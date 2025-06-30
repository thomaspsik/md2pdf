const puppeteer = require('puppeteer');
const marked = require('marked');
const Mustache = require('mustache'); // Mustache importieren
const fs = require('fs');
const path = require('path');

async function generatePdfFromMarkdown(markdownFilePath, templateFilePath, outputPath, data) {
    try {
        const markdownContent = fs.readFileSync(markdownFilePath, 'utf8');
        const markdownHtml = marked.parse(markdownContent); // Markdown zu HTML konvertieren
        const cssContent = fs.readFileSync("./css/template-02.css", "utf-8"); // css lesen

        const htmlTemplate = fs.readFileSync(templateFilePath, 'utf8'); // HTML-Template laden

        // Datenobjekt für Mustache um den Markdown-HTML-Inhalt erweitern
        const templateData = {
            markdownHtml, // Der konvertierte Markdown-HTML-Inhalt
            cssContent, // css Content
            ...data // Zusätzliche dynamische Daten aus dem Aufruf
        };

        // Mustache-Template mit den Daten rendern
        const fullHtml = Mustache.render(htmlTemplate, templateData);
   const browser = await puppeteer.launch({
            // Optional: Wenn du den Browser im "sichtbaren" Modus starten möchtest (nur zu Debugging-Zwecken)
             headless: false,
            // args: ['--start-maximized'] // Startet maximized
        });

        // const browser = await puppeteer.launch();
        const page = await browser.newPage();

        await page.setContent(fullHtml, {
            waitUntil: 'networkidle0'
        });

        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="font-size: 10px; margin-left: 20mm; margin-right: 20mm; width: 100%; display: flex; justify-content: space-between; align-items: center; padding-bottom: 5px; border-bottom: 1px solid #ddd;">
                    <span class="title" style="font-weight: bold;">{{titleFromPuppeteer}}</span>
                    <span>Generiert am ${new Date().toLocaleDateString('de-DE')}</span>
                </div>
            `,
            footerTemplate: `
                <div style="font-size: 9px; margin-left: 20mm; margin-right: 20mm; width: 100%; display: flex; justify-content: space-between; align-items: center; padding-top: 5px; border-top: 1px solid #ddd;">
                    <span>Vertraulich</span>
                    <span>Seite <span class="pageNumber"></span> von <span class="totalPages"></span></span>
                </div>
            `,
            margin: {
                top: '25mm',
                bottom: '25mm',
                left: '20mm',
                right: '20mm'
            }
        });

        // await browser.close();
        // console.log(`PDF erfolgreich generiert: ${outputPath}`);

    } catch (error) {
        console.error('Fehler beim Generieren des PDFs:', error);
    }
}

// --- Beispielnutzung ---
const markdownFile = path.join(__dirname, 'test.md');
const templateFile = path.join(__dirname, 'document-template02.html');
const outputPdf = path.join(__dirname, 'test02.pdf');



// Beispiel Datenobjekt für das Mustache-Template
const documentData = {
    docTitle: "Bericht Q2 2025",
    showAdditionalInfo: true,
    generationDate: new Date().toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }),
    status: "Final",
    revisionHistory: [
        { version: "1.0", description: "Initialer Entwurf", date: "2025-01-15" },
        { version: "1.1", description: "Ergebnisse hinzugefügt", date: "2025-03-01" },
        { version: "1.2", description: "Abschließende Überarbeitung", date: "2025-06-10" }
    ],
    // Daten, die an Puppeteer's headerTemplate und footerTemplate übergeben werden können
    // Beachte: Diese sind separate Templates und können nicht direkt auf die Mustache-Daten zugreifen,
    // es sei denn, du injizierst sie als globalen JS-Variable oder renderst den Header/Footer ebenfalls mit Mustache.
    // Für das Beispiel hier, ein statischer Wert, der nur für Puppeteer's Template ist.
    titleFromPuppeteer: "Quartalsbericht"
};

generatePdfFromMarkdown(markdownFile, templateFile, outputPdf, documentData);
