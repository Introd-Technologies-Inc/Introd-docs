# Introd Docs

Mintlify documentation for `docs.getintrod.ai`.

## Source of truth

This repository is the canonical docs repository for Introd. The production Mintlify project should connect to:

```text
Introd-Technologies-Inc/introd-docs
```

Use the repository root as the docs path because `docs.json` lives at the top level.

## Local development

```bash
npx mintlify dev
npx mintlify validate
```

## Content model

- `Documentation` is for user-facing product guides.
- `API Reference` is for public API docs and generated inventories.
- `Developers` is for architecture, local setup, deployment, and operational runbooks.

Keep screenshots under `images/product` and brand assets under `images/brand`.
