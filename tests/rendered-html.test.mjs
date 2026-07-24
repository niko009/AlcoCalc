import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("build includes a valid PWA manifest and service worker", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../dist/client/manifest.webmanifest", import.meta.url), "utf8"),
  );
  assert.equal(manifest.name, "AlcoCalc — калькулятор BAC");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.ok(manifest.icons.some((icon) => icon.src === "/pwa-icon.svg"));

  const serviceWorker = await readFile(
    new URL("../dist/client/sw.js", import.meta.url),
    "utf8",
  );
  assert.match(serviceWorker, /const OFFLINE_URL = "\/offline"/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
});
