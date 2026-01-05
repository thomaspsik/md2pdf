export default {
  debug: false, // keep temporary files for development, checks and styling with css

  docParts: [
    {
      markdownFile: './testBody.md',
      header: './html/document-template-body-exam.html.header.html',
      content: './html/document-template-body-exam.html',
      footer: './html/document-template-body-exam.html.footer.html',
    },
  ],
  docTitle: 'exam-template-md2pdf', // name of the final pdf
  titleHeader: 'University of Lorem City',
  titleHeaderRight: 'IT / Web-Insider (404)',
  authorHeader: '40404 Lorem City',
  SVGContents: {
    md2pdfLogoSVGContent: './pics/logo.svg',
  },

  topMargin: '25mm',
};


