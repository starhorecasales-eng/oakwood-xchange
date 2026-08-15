# Product identity and migration boundary

## Current public identity

- Public product name: **Cebimde Kur**
- Production host: **xchange.oakwoodapps.co.uk**
- Product owner: **Oakwood Apps**
- Current primary audience and language: Turkish travellers converting TRY and GBP

These values remain public until a deliberate brand launch is approved. The repository,
Windows service name, Cloudflare tunnel and production hostname are deployment identities;
they do not need to change when the visible brand eventually changes.

## Global candidate

**PriceRoam** is the working global product-name candidate, not yet the launched public
brand. It should not replace Cebimde Kur in metadata, the manifest, install prompts or
visible UI until the following checks are complete:

1. UK and target-market trademark/name screening.
2. Suitable domain and social/app-store name availability.
3. A global icon that does not imply only TRY and GBP.
4. A redirect, canonical and installed-PWA migration plan.
5. A decision on whether Cebimde Kur remains the Turkish localized name or becomes a
   transitional endorsement such as “PriceRoam — Cebimde Kur”.

## Code boundary

Runtime identity and shared copy live in `lib/product.ts`. UI, metadata and the PWA
manifest consume that module so a future launch is controlled and reviewable. Secrets,
deployment service names and host-routing configuration must not be placed in this
client-readable module.

## Recommended launch sequence

1. Keep the existing host and service stable while testing the global product experience.
2. Introduce the new icon and dual-brand presentation for a short transition if required.
3. Update public metadata, manifest and install copy in one release.
4. Add the new canonical domain only after redirects and analytics attribution are ready.
5. Retain the old host as a permanent redirect rather than breaking saved PWA/bookmarks.

This boundary lets conversion, OCR and SEO work proceed without coupling those features
to an irreversible public rename.
