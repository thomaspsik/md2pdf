# md2pdf
Small commandline application that converts markdown files to pdf through puppeteer.

The dataflow works like this:
 * read markdown file -> 
 * render markdown to html-content (with markdown-it)
 * perform mustache ({{}}) templating on the html-content with data provided by a data.mjs file
 * perform string-replacement to get full-paths for includes in html-content "file://[template-path]" => path from root

 * save html-content to temporary html-file.
 
 * if present -> read svg content for header and footer (I could only get inline svg to work for header and footer)

 * if present -> read header.html and perform mustache 
 * if present -> read footer.html and perform mustache 

 * load html-file with puppeteer, add header and footer html to the page
 * render pdf to temporary pdf file
 * close pupeteer
 * remove all temporary files 
 
 * loop until all parts have been processed
 * join all temporary pdfs file in final pdf file
 * done. 

Library used:  

* puppeteer -> converts html to pdf by command (puppeteer uses headless chromium in the background)

* muhammara (follow up to hummus) -> a pdf library that allows to combine several pdfs into one pdf

* markdown-it -> converts markdown to html
* bunch of markdown addons

* mustache -> allow for data insertion into html templates

