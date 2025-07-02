# md2pdf
Commandline application that converts markdown files and mustache to pdf through puppeteer.

The process is driven by a javascript object (loaded from a file).

You can also just use mustache templates if you like - you must provide an empty markdown file tough.

## Libraries used:  

* [puppeteer](https://www.npmjs.com/package/puppeteer) -> converts html to pdf by command (puppeteer uses headless chromium in the background)

* [MuhammaraJS](https://www.npmjs.com/package/muhammara) (follow up to hummus) -> a pdf library that allows to combine several pdfs into one pdf

* [markdown-it](https://www.npmjs.com/package/markdown-it) -> converts markdown to html
  * bunch of [markdown-it plugins](https://mdit-plugins.github.io/)

* [mustache.js](https://www.npmjs.com/package/mustache) -> provide data insertion into html templates (like data of generation)


## The dataflow works like this:

* read data.mjs file (specified as CLI parameter)

* check structure of the data.default object

* if present -> read all svg content for header and footer (I could only get inline svg to work for header and footer)

* Loop through all document parts (parts were added so that the title-page can ommit header and footer)
 
   * read markdown file
   * render markdown to html-content (with markdown-it)
   * perform mustache ({{}}) templating on the html-content with data provided by a data.mjs file
   * perform string-replacement to get full-paths for includes in html-content "file://[template-path]" => path from root

   * save transformed html-content to temporary html-file.
 
 
   * if present -> read header html-template and perform mustache 
   * if present -> read footer html-template and perform mustache 

   * load html-file with puppeteer, add header and footer html to the page
   * render pdf to temporary pdf file
   * close pupeteer
   * loop until all parts have been processed
 
 * join all temporary pdfs file in final pdf file
 * remove all temporary files 
 * done. 


