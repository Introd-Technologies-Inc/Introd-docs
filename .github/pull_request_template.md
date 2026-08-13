## What changed

<!-- Describe the customer task or trust boundary this change improves. -->

## Evidence

<!-- Link the current product source, approved screenshot, or live behavior used to verify the guide. Do not include secrets or private customer data. -->

## Review checklist

- [ ] I verified the documented behavior against the current product.
- [ ] I removed future-state or aspirational wording presented as current behavior.
- [ ] I did not expose internal routes, authentication details, credentials, infrastructure, or operator procedures.
- [ ] Introduction actions are described as drafts or tracked workflow state unless external delivery is proven.
- [ ] Extension docs distinguish contextual browsing capture from full-network import, automatic resume, and each stop control.
- [ ] New screenshots are current, approved, and free of sensitive data.
- [ ] I updated `llms.txt`, `llms-full.txt`, or `skill.md` if the public product boundary changed.
- [ ] `npm run check` passes locally.
- [ ] If this is a post-deploy verification PR, `npm run check:live` passes against production.
