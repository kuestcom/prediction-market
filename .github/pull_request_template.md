## Pull Request Rules

Please make sure your PR follows these rules:

- One PR must address only one feature or one bugfix.
- Keep PRs small, focused, and easy to review.
- Use commit prefixes such as `fix:`, `feat:`, `refactor:`, `docs:`, and `style:`.
- Use English for branch names and commit subjects.
- Review your own diff before opening the PR.
- Rebase on the latest `main` before pushing. Do not merge `main` into your branch.
- If dependencies changed, include the updated `package-lock.json`.
- Avoid unrelated refactors, drive-by fixes, or config/policy changes in the same PR.
- Avoid commented-out code and unnecessary inline comments. Keep comments only when they explain non-obvious constraints or decisions.
- If you use AI/LLM tools, use the highest reasoning mode available and full repository context/access when safe, then manually review and test the final diff before submitting. Examples: OpenAI/Codex `xhigh`; Claude extended thinking with the highest available thinking budget.
- Bugfix PRs should include a regression test whenever feasible.
- PR descriptions should clearly state scope, reason for the change, testing performed, and any relevant risks.

## Summary

Describe what changed and why.

## Testing

Describe how this was tested.

## Risks

Describe any relevant risks, tradeoffs, or follow-up work.

## Checklist

- [ ] I ran `npm run lint`, `npm test`, and `npm run build` before submitting.
- [ ] I tested the changes in my browser.
