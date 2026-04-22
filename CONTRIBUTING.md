# Contributing to Kuest

Thank you for your interest in contributing! We welcome all forms of contribution including bug reports, feature requests, documentation improvements, and code contributions.

---

## Reporting Issues

Before creating a new issue, please check if it already exists. When reporting bugs, include:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, Node version)
- Code examples or screenshots if relevant

---

## Feature Requests

For new features, open an issue describing:

- What problem the feature solves
- How it should work
- Examples or mockups if applicable

Please check if a similar request already exists first.

---

## Pull Requests

For code contributions:

- Open an issue first for major changes.
- One PR must address only one feature or one bugfix.
- Keep PRs small, focused, and easy to review.
- Follow existing code style and conventions.
- Use commit prefixes such as `fix:`, `feat:`, `refactor:`, `docs:`, and `style:`.
- Use English for branch names and commit subjects.
- Review your own diff before opening the PR.
- Rebase on the latest `main` before pushing. Do not merge `main` into your branch.
- Run `npm run lint`, `npm test`, and `npm run build` before submitting.
- If dependencies changed, include the updated `package-lock.json`.
- Avoid unrelated refactors, drive-by fixes, or config/policy changes in the same PR.
- Avoid commented-out code and unnecessary inline comments. Keep comments only when they explain non-obvious constraints or decisions.
- If you use AI/LLM tools, use the highest reasoning mode available and full repository context/access when safe, then manually review and test the final diff before submitting. Examples: OpenAI/Codex `xhigh`; Claude extended thinking with the highest available thinking budget.
- Bugfix PRs should include a regression test whenever feasible.
- PR descriptions should clearly state scope, reason for the change, testing performed, and any relevant risks.

---

### Development Setup

1. Fork and clone the repository
2. Use Node.js 24.x (see `.nvmrc`)
3. Install dependencies: `npm install`
4. Create a branch using the appropriate prefix, for example `feat/name-in-english` or `fix/name-in-english`
5. Make your changes
6. Review your diff before opening the PR
7. Run `npm run lint`, `npm test`, and `npm run build`
8. Rebase on the latest `main`
9. Commit and push to your fork
10. Open a pull request with a clear description

---

## Code of Conduct

Be respectful and inclusive. Harassment and discrimination are not tolerated.

## License

By contributing, you agree that your contributions will be licensed under the Kuest Modified MIT License (with Custom Commons Clause), as described in [`LICENSE`](LICENSE).
