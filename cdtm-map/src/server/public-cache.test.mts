import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_DATA_CACHE_CONTROL,
  createPublicJsonEtag,
  createPublicJsonResponse,
  isRequestEtagMatch,
} from "./public-cache.ts";

test("les ETag publics sont deterministes et changent avec le contenu", () => {
  const first = createPublicJsonEtag({ cases: [{ id: "A1" }] });
  const second = createPublicJsonEtag({ cases: [{ id: "A1" }] });
  const changed = createPublicJsonEtag({ cases: [{ id: "A2" }] });

  assert.equal(first, second);
  assert.notEqual(first, changed);
  assert.match(first, /^"sha256-[A-Za-z0-9_-]{32}"$/);
});

test("la comparaison If-None-Match accepte les listes et le joker", () => {
  const etag = createPublicJsonEtag({ value: "stable" });

  assert.equal(isRequestEtagMatch(null, etag), false);
  assert.equal(isRequestEtagMatch(`"other", ${etag}`, etag), true);
  assert.equal(isRequestEtagMatch("*", etag), true);
});

test("la reponse publique renvoie 304 quand l'ETag correspond", () => {
  const payload = { objects: [{ id: "minas-tirith" }] };
  const etag = createPublicJsonEtag(payload);
  const response = createPublicJsonResponse(
    new Request("https://example.test/api", {
      headers: { "if-none-match": etag },
    }),
    payload,
    PUBLIC_DATA_CACHE_CONTROL,
  );

  assert.equal(response.status, 304);
  assert.equal(response.headers.get("etag"), etag);
  assert.equal(response.headers.get("cache-control"), PUBLIC_DATA_CACHE_CONTROL);
});

test("la reponse publique expose cache-control et ETag en 200", () => {
  const payload = { objects: [] };
  const response = createPublicJsonResponse(
    new Request("https://example.test/api"),
    payload,
    PUBLIC_DATA_CACHE_CONTROL,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("etag"), createPublicJsonEtag(payload));
  assert.equal(response.headers.get("cache-control"), PUBLIC_DATA_CACHE_CONTROL);
});
