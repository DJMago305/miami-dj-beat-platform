/**
 * Fetch portal pages + critical module URLs from Vite dev server.
 * TICKET-V2-BOOTSTRAP-RUNTIME-P0-001
 */
const BASE = 'http://localhost:5173';
const portals = ['client', 'artist', 'staff'];

async function checkPortal(portal) {
  const pageUrl = `${BASE}/${portal}/`;
  const pageRes = await fetch(pageUrl);
  const html = await pageRes.text();
  const mainMatch = html.match(/src="([^"]*main\.ts)"/);
  const mainSrc = mainMatch?.[1] ?? null;
  const mainUrl = mainSrc ? new URL(mainSrc, pageUrl).href : null;
  const mainRes = mainUrl ? await fetch(mainUrl) : null;

  return {
    portal,
    pageStatus: pageRes.status,
    pageBytes: html.length,
    title: html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '',
    mainModule: mainSrc,
    mainStatus: mainRes?.status ?? null,
    mainBytes: mainRes ? (await mainRes.text()).length : 0,
    hasAppMount: html.includes('id="app"'),
  };
}

const results = [];
for (const portal of portals) {
  try {
    results.push(await checkPortal(portal));
  } catch (error) {
    results.push({ portal, error: error instanceof Error ? error.message : String(error) });
  }
}

for (const result of results) {
  console.log(JSON.stringify(result));
}

const failed = results.filter(
  (result) =>
    result.error ||
    result.pageStatus !== 200 ||
    result.mainStatus !== 200 ||
    !result.hasAppMount,
);

if (failed.length > 0) {
  process.exit(1);
}

console.log('localhost-module-check: PASS');
