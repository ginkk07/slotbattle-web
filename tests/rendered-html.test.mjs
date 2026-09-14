import assert from "node:assert/strict";
import test from "node:test";

test("serves the game document with metadata and hydration scripts", async () => {
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
  const html = await response.text();
  assert.match(html, /<html[^>]+lang="zh-Hant"/);
  assert.match(html, /<title>拉霸 Battle｜3×3 卡片戰鬥<\/title>/);
  assert.match(html, /SLOT/);
  assert.match(html, /<script[^>]*>import\("\/assets\/[^"\s]+\.js"\)<\/script>/);
  assert.doesNotMatch(html, /name="codex-preview"/);
});
