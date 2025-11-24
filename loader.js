/** Code from ChatGPT 5.0
 *  Prompt (GERMAN):
 *  
 * Javascript beim 2ten mal "await import('data.mjs')" wird die Datei nicht gelesen, sondern der alte Inhalt returniert. Was kann ich machen?
 * 
 * eine Config Datei, die aber auch JS ausführen sollen kann und zb Kommentare zulässt, deswegen JS und nicht JSON
 * 
 */

import { readFile } from "fs/promises";
import vm from "vm";

/** lädt config.js neu und evaluiert sie */
export async function loadConfig(path) {
  const code = await readFile(path, "utf8");

  const context = {
    module: { exports: {} },
    exports: {},
    console,
  };

  vm.createContext(context);

  // ES-like Default Export → umwandeln
  const wrapped = `
    const exports = {};
    const module = { exports };
    ${code}
    export default module.exports.default ?? module.exports;
  `;

  return vm.runInContext(wrapped, context);
}
