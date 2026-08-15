import assert from "node:assert/strict";
import test from "node:test";

import { PRODUCT_COPY, PRODUCT_IDENTITY } from "../lib/product.ts";

test("keeps the current public identity separate from the global candidate", () => {
  assert.equal(PRODUCT_IDENTITY.publicName, "Cebimde Kur");
  assert.equal(PRODUCT_IDENTITY.globalNameCandidate, "PriceRoam");
  assert.equal(PRODUCT_IDENTITY.canonicalOrigin, "https://xchange.oakwoodapps.co.uk");
  assert.match(PRODUCT_COPY.title, /^Cebimde Kur/);
  assert.doesNotMatch(PRODUCT_COPY.title, /PriceRoam/);
  assert.equal(PRODUCT_COPY.ownerCredit, "Oakwood Apps tarafından hazırlandı.");
});
