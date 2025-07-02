export default {
  debug: false, // keep temporary files for development, checks and styling with css

  docParts: [
    { markdownFile: './testTitle.md', 
      content: '../html/document-template-title.html' }, // relative to data file
    {
      markdownFile: './testBody.md',
      header: '../html/document-template-body.html.header.html',
      content: '../html/document-template-body.html',
      footer: '../html/document-template-body.html.footer.html',
    },
    // just trying for more that 2 parts - please note that puppeteer will start with page 1 again
    {
      markdownFile: './testBody.md',
      header: '../html/document-template-body.html.header.html',
      content: '../html/document-template-body.html',
      footer: '../html/document-template-body.html.footer.html',
    },
  ],
  docTitle: 'test-md2pdf', // name of the final pdf
  titleHeader: 'Test Document for md2pdf',
  authorHeader: 'Thomas Psik',
  // svg logos for header and footer - svg was the first thing that worked
  SVGContents: {
    md2pdfLogoSVGContent: '../html/imgs/md2pdflogo.svg', // relative to data file
  },
  // change margin to make room for the company logo
  topMargin: '20mm',
  // add here addition data for the mustache templates
  testData: 'Hello test data ;-)',
};
