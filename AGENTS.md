# Introd Docs Agent Notes

This repository is the standalone Mintlify source for `docs.getintrod.ai`.

## Rules

- Keep `docs.json` at the repository root.
- Keep the production docs source pointed at `Introd-Technologies-Inc/introd-docs`, not `introd-api/docs`.
- Publish customer-facing guidance only. Verify current behavior against the product source before documenting it.
- Do not publish internal routes, authentication headers, secret or environment-variable names, architecture, infrastructure, deployment, migration, rollback, or operator runbooks.
- Do not create an API reference unless Introd has an explicitly supported external API contract and the public authentication model has completed security review.
- Keep `llms.txt`, `llms-full.txt`, and `skill.md` aligned with the same public boundary as the visible site.
- Treat introduction records as drafts or workflow state unless external delivery is proven by the current implementation. Keep saving a draft, creating a review link, and sending a connector review distinct, and never state that email delivery is on or off without production evidence.
- Describe the Chrome extension only as the current store version behaves: first-degree sync after a consent prompt, the read-only on-page lookup, background resume, and what each stop control really stops. The popup has no pause control. Re-verify against the extension manifest and source before changing these claims.
- Store only current, approved, non-sensitive product screenshots in `images/product`.
- Store logo and favicon assets in `images/brand`.

## Verification

Before committing documentation changes, run:

```bash
npm ci --ignore-scripts
npm run check
```
