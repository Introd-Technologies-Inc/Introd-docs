# Introd Docs Agent Notes

This repo is the standalone Mintlify source for `docs.getintrod.ai`.

## Rules

- Keep `docs.json` at the repository root.
- Keep the production docs source pointed at `Introd-Technologies-Inc/introd-docs`, not `introd-api/docs`.
- Use user-facing language in the `Documentation` tab.
- Put API details in `API Reference`.
- Put architecture, operations, migration, and local setup in `Developers`.
- Store product screenshots in `images/product`.
- Store logo and favicon assets in `images/brand`.

## Verification

Before committing docs changes, run:

```bash
npx mintlify validate
```
