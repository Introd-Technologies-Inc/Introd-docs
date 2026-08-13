# Introd Docs

Mintlify source for [docs.getintrod.ai](https://docs.getintrod.ai).

## Source of truth

The production Mintlify project connects to `Introd-Technologies-Inc/introd-docs` with this repository root as the docs path. Keep `docs.json` at the top level.

## Public-content boundary

This site contains customer-facing product guidance. Do not publish:

- internal application routes or authentication headers;
- environment variables, credentials, or secret names;
- architecture, infrastructure, deployment, migration, or rollback runbooks;
- operator-only procedures; or
- speculative product behavior presented as current functionality.

`.mintignore` provides a publish boundary for internal directory names. The automated quality check also rejects navigation into those directories. These controls are defense in depth, not a place to store secrets.

The public `llms.txt`, `llms-full.txt`, and `skill.md` files are curated product surfaces. Review them whenever navigation or product boundaries change.

## Local verification

Use the pinned toolchain:

```bash
npm ci --ignore-scripts
npm run check
```

`npm run check` validates public boundaries, metadata, local links, machine-readable surfaces, the Mintlify configuration, and accessibility.

The pinned Mintlify build tool currently brings 7 high and 2 moderate upstream development-only advisories. CI reports them and blocks critical findings. They are not shipped application dependencies; re-evaluate on every Mintlify update and do not use the audit tool's forced CLI downgrade without a compatibility review.

For a local preview:

```bash
npx mintlify dev
```

After an approved production deployment, run `npm run check:live`. It verifies all retired internal routes in HTML and Markdown forms, every removed screenshot, contributor-only files, the exact sitemap, skill discovery and digest, `llms` files, robots policy, MCP search/filesystem caches, and key public pages against the release boundary.

## Content rules

- Describe verified current behavior in task-oriented language.
- Link to the exact app destination when it is stable.
- Label missing, weak, stale, or conditional data honestly.
- Treat introduction records as drafts or tracked workflow state, not proof of external message delivery.
- Describe contextual LinkedIn browsing capture separately from full-network import, automatic resume, and each stop control.
- Use screenshots only when they were captured from the current product and contain no sensitive data.
- Store approved product screenshots in `images/product` and brand assets in `images/brand`.
