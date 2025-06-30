Answer from Gemini - German Jun. 2025 { .title }

Sehr gute Idee! Die Integration einer Templating-Engine wie Mustache (oder Handlebars, das sehr ähnlich ist und auf Mustache aufbaut) gibt dir enorme Flexibilität, um dynamische Daten in dein HTML-Template einzufügen, bevor Puppeteer es rendert.

Hier zeige ich dir, wie du Mustache.js mit Puppeteer in deinem Node.js-Skript verwenden kannst.

### Schritte zur Integration von Mustache.js:

1.  **Mustache.js installieren:**
    Zuerst musst du das `mustache` (oder `mustache.js`) Paket in deinem Projekt installieren:
    ```bash
    npm install mustache
    ```
    (Oder `npm install handlebars` wenn du die erweiterten Funktionen von Handlebars bevorzugst.)

2.  **HTML-Template mit Mustache-Syntax erstellen:**
    Erstelle eine separate HTML-Template-Datei (z.B. `document-template.html`), die deine Platzhalter im Mustache-Format enthält.

3.  **Datenobjekt vorbereiten:**
    Erstelle ein JavaScript-Objekt, das die Daten enthält, die du in dein Template einfügen möchtest.

4.  **Template rendern:**
    Verwende `Mustache.render()` (oder `Handlebars.compile()` und dann `template(data)`), um dein Template mit den Daten zu füllen und den resultierenden HTML-String zu erhalten.

5.  **Gerenderten HTML an Puppeteer übergeben:**
    Der resultierende HTML-String wird dann an `page.setContent()` von Puppeteer übergeben.

### Angepasstes Beispiel mit Mustache.js:

**1. `package.json` anpassen (falls nicht schon geschehen):**
Stelle sicher, dass du `puppeteer` und `marked` und `mustache` in deinen `dependencies` hast:
```json
{
  "name": "pdf-generator",
  "version": "1.0.0",
  "description": "Generate PDFs from Markdown with Node.js and Puppeteer using Mustache templates",
  "main": "generate-pdf.js",
  "scripts": {
    "start": "node generate-pdf.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "marked": "^13.0.0",
    "mustache": "^4.2.0",
    "puppeteer": "^22.0.0"
  }
}
```

**2. Erstelle eine HTML-Template-Datei (`document-template.html`):**

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{{docTitle}}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
        }
        .content {
            /* Dieser Padding wird durch die Margins der PDF-Generierung überlagert */
            padding: 0;
        }
        /* Basisches Styling für Markdown-Elemente */
        h1, h2, h3, h4, h5, h6 {
            font-family: 'Georgia', serif;
            margin-top: 1em;
            margin-bottom: 0.5em;
        }
        h1 { font-size: 2em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.2em; }
        p {
            margin-bottom: 1em;
            line-height: 1.5;
        }
        ul, ol {
            margin-left: 20px;
            margin-bottom: 1em;
        }
        pre {
            background-color: #f4f4f4;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
            font-family: 'Courier New', Courier, monospace;
            font-size: 0.9em;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        code {
            font-family: 'Courier New', Courier, monospace;
            background-color: #e0e0e0;
            padding: 2px 4px;
            border-radius: 3px;
        }
        blockquote {
            border-left: 4px solid #ccc;
            padding-left: 1em;
            margin-left: 0;
            color: #666;
        }
        hr {
            border: 0;
            border-top: 1px solid #ccc;
            margin: 1em 0;
        }
        a {
            color: #007bff;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="content">
        {{{markdownHtml}}} </div>

    {{#showAdditionalInfo}}
    <div style="page-break-before: always; text-align: center; margin-top: 50px;">
        <h2>Zusätzliche Informationen</h2>
        <p>Dieses Dokument wurde am **{{generationDate}}** erstellt.</p>
        <p>Status: **{{status}}**</p>
        {{#revisionHistory}}
        <h3>Revisionsverlauf</h3>
        <ul>
            {{#.}}
            <li>**Version {{version}}**: {{description}} (Datum: {{date}})</li>
            {{/.}}
        </ul>
        {{/revisionHistory}}
    </div>
    {{/showAdditionalInfo}}

</body>
</html>
```

**Wichtige Mustache-Syntax im Template:**

* `{{docTitle}}`: Einfacher Platzhalter. Der Wert wird HTML-escaped.
* `{{{markdownHtml}}}`: **Drei geschweifte Klammern!** Dies ist entscheidend. Wenn dein `markdownHtml` bereits HTML-Code ist (was er von `marked.parse()` sein wird), musst du die dreifachen Klammern verwenden, damit Mustache das HTML **nicht escaped**. Andernfalls würdest du den HTML-Code als Klartext im PDF sehen.
* `{{#showAdditionalInfo}} ... {{/showAdditionalInfo}}`: Eine "Section". Wenn `showAdditionalInfo` `true` ist, wird der Inhalt innerhalb der Section gerendert. Wenn `false` oder nicht vorhanden, wird er ignoriert.
* `{{#revisionHistory}} ... {{/revisionHistory}}`: Wenn `revisionHistory` ein Array ist, wird der Inhalt für jedes Element im Array gerendert. `{{.}}` würde das aktuelle Element im Array referenzieren, aber hier nutze ich direkt die Felder `version`, `description`, `date` innerhalb jedes Objekts im Array.

**3. `generate-pdf.js` anpassen:**

```javascript
const puppeteer = require('puppeteer');
const marked = require('marked');
const Mustache = require('mustache'); // Mustache importieren
const fs = require('fs');
const path = require('path');

async function generatePdfFromMarkdown(markdownFilePath, templateFilePath, outputPath, data) {
    try {
        const markdownContent = fs.readFileSync(markdownFilePath, 'utf8');
        const markdownHtml = marked.parse(markdownContent); // Markdown zu HTML konvertieren

        const htmlTemplate = fs.readFileSync(templateFilePath, 'utf8'); // HTML-Template laden

        // Datenobjekt für Mustache um den Markdown-HTML-Inhalt erweitern
        const templateData = {
            markdownHtml: markdownHtml, // Der konvertierte Markdown-HTML-Inhalt
            ...data // Zusätzliche dynamische Daten aus dem Aufruf
        };

        // Mustache-Template mit den Daten rendern
        const fullHtml = Mustache.render(htmlTemplate, templateData);

        const browser = await puppeteer.launch();
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

        await browser.close();
        console.log(`PDF erfolgreich generiert: ${outputPath}`);

    } catch (error) {
        console.error('Fehler beim Generieren des PDFs:', error);
    }
}

// --- Beispielnutzung ---
const markdownFile = path.join(__dirname, 'test.md');
const templateFile = path.join(__dirname, 'document-template.html');
const outputPdf = path.join(__dirname, 'dokument.pdf');

// Beispiel Markdown-Inhalt (in dokument.md speichern)
const exampleMarkdownContent = `
# Mein Bericht

Dies ist der Hauptinhalt meines **Berichts**. Er ist sehr wichtig.

- Erste Beobachtung
- Zweite Beobachtung

## Ergebnisse

Die Ergebnisse zeigen, dass ...

\`\`\`javascript
const data = { status: 'Success' };
console.log(data.status);
\`\`\`
`;

// Schreibe die Markdown-Datei, falls sie nicht existiert
if (!fs.existsSync(markdownFile)) {
    fs.writeFileSync(markdownFile, exampleMarkdownContent, 'utf8');
    console.log(`Beispiel-Markdown-Datei '${markdownFile}' erstellt.`);
}

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

```

### Wichtige Punkte und Erläuterungen:

1.  **Trennung von Markdown und HTML-Template:**
    * Du hast jetzt eine separate `document-template.html`-Datei. Diese enthält die Grundstruktur des HTML-Dokuments und die Mustache-Platzhalter.
    * Die Markdown-Inhalte werden weiterhin in einer `.md`-Datei gepflegt.

2.  **`Mustache.render(template, data)`:**
    * `fs.readFileSync(templateFilePath, 'utf8')` liest dein `document-template.html` als String ein.
    * `Mustache.render()` nimmt diesen Template-String und das `templateData`-Objekt entgegen. Es ersetzt alle `{{platzhalter}}` durch die entsprechenden Werte aus `templateData`.

3.  **Wichtig: `{{{markdownHtml}}}` (Triple-Stache):**
    * Da `marked.parse()` bereits HTML-Code generiert, musst du `{{{markdownHtml}}}` im Template verwenden. Die dreifachen geschweiften Klammern sagen Mustache, dass es den Inhalt **un-escaped** einfügen soll. Wenn du `{{markdownHtml}}` verwenden würdest, würde der HTML-Code als reiner Text (z.B. `<p>...</p>`) im PDF erscheinen.

4.  **Datenobjekt (`documentData`):**
    * Dieses Objekt enthält alle variablen Daten, die du in deinem HTML-Template verwenden möchtest.
    * Es wird auch `markdownHtml` enthalten, da dies der generierte HTML-Inhalt aus deiner Markdown-Datei ist.
    * Du kannst hier beliebig komplexe Strukturen (Arrays, Objekte, Booleans) hinzufügen, die dann mit den Mustache-Sections (`{{#key}}...{{/key}}`) und Iterationen (`{{#array}}...{{/array}}`) verwendet werden können.

5.  **Puppeteer's `headerTemplate` und `footerTemplate`:**
    * Beachte, dass die `headerTemplate` und `footerTemplate` in `page.pdf()` von Puppeteer **separate HTML-Strings** sind. Sie haben keinen direkten Zugriff auf die Variablen, die du an dein Haupt-Mustache-Template übergeben hast.
    * Wenn du dynamische Daten aus `documentData` (wie z.B. den `docTitle`) auch im Puppeteer-Header/Footer haben möchtest, musst du diese Werte entweder direkt in den `headerTemplate`/`footerTemplate`-Strings einfügen, wenn du sie erstellst, oder du renderst auch diese Templates mit Mustache (was etwas redundante Datenhaltung bedeutet).
    * Im Beispiel habe ich `{{titleFromPuppeteer}}` in den Header des Puppeteers eingefügt, um zu zeigen, dass du dort einen Wert injizieren könntest. Aber dieser Wert muss beim Aufruf von `page.pdf()` schon im String sein, nicht als Mustache-Platzhalter, der *innerhalb* des Puppeteer-Renderings gefüllt wird.
    * Für die dynamischen Seitenzahlen (`pageNumber`, `totalPages`) bleibst du bei den speziellen Puppeteer-Klassen, die Puppeteer selbst zur Laufzeit füllt.

Mit dieser Kombination hast du eine sehr mächtige Lösung:
* **Markdown** für die einfache Erstellung des Hauptinhalts.
* **Mustache/Handlebars** für die Strukturierung des gesamten HTML-Dokuments mit Platzhaltern und bedingten Blöcken.
* **Puppeteer** für die genaue und flexible PDF-Generierung unter Nutzung der vollen Browser-Rendering-Fähigkeiten, inklusive Kopf- und Fußzeilen und dynamischen Seitenzahlen.