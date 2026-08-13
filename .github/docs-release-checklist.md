# Docs release checklist

Use this checklist for a change that affects public trust boundaries, navigation, or machine-readable documentation.

## Before merge

- [ ] `npm ci --ignore-scripts` and `npm run check` pass from a clean checkout.
- [ ] The preview contains no internal API, authentication, environment, infrastructure, deployment, or operator content.
- [ ] The preview has no unverified screenshots, ratings, availability claims, or product behavior.
- [ ] Introduction actions distinguish stored workflow state from external delivery.
- [ ] Product, privacy, security, and legal contacts match the live marketing site.
- [ ] Disable the Mintlify Assistant in the dashboard while the new corpus deploys and reindexes.

## After deploy

- [ ] Run `npm run check:live` until it passes.
- [ ] Confirm every retired internal route returns 404 as HTML, `.md`, and negotiated Markdown.
- [ ] Confirm every retired screenshot and contributor-only repository file returns 404.
- [ ] Confirm `/skill.md`, both discovery indexes and resources, both `llms` files, the exact sitemap set, robots policy, and MCP contain no internal material.
- [ ] Confirm the agent-skills digest matches the custom skill after Mintlify regeneration completes; this can lag the page deploy.
- [ ] Confirm MCP search and direct filesystem reads cannot retrieve retired files or sentinel terms.
- [ ] Test search and Assistant answers for credentials, deployment, API authentication, extension availability, and introduction delivery.
- [ ] Re-enable the Assistant only after its answers stay within the verified customer corpus.
