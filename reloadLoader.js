// reload-loader.js
// code from ChatGPT 5.0
// not used until now - is needed to reload also the data.mjs file during restart
// this requires a change in the start script
// TODO pending integration

export async function load(url, context, defaultLoad) {
  // hier Cache-Busting: hänge einen Zeitstempel an
  const busted = url.includes("?")
    ? `${url}&reload=${Date.now()}`
    : `${url}?reload=${Date.now()}`;

  return defaultLoad(busted, context);
}