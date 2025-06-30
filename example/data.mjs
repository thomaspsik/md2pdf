export default {
  debug: true, // keep temporary files for development, checks and styling with css
  templates: 
  [{ content: "../html/document-template-title.html" }, 
   { content: "../html/document-template-body.html", 
     header: "../html/document-template-body.html.header.html", 
     footer: "../html/document-template-body.html.footer.html" }],
  docTitle: 'Test title', // name of the final pdf
  titleHeader: 'Test Document for md2pdf',
  authorHeader: 'Thomas Psik',
  // svg logos
  SVGContents: {
      htllogoSVGContent: './imgs/md2pdflogo.svg', // relative to body template
  },
  // change margin to make room for the company logo
  topMargin: '20mm',
  // add here addition data for the mustache templates
  testData: "Hello test data ;-)"

};
