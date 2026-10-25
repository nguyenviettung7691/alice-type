# AliceType Copilot Instructions

- Treat `doc/tech-design.md` as the product-level source of truth and the relevant phase detail design under `doc/` as the implementation contract.
- The product name is **AliceType**.
- Use the documented stack and existing project patterns. Do not introduce another framework, dependency, or architecture without a concrete requirement.
- Respect roadmap boundaries: do not implement behavior assigned to a later phase unless the user explicitly changes scope.
- Keep UI components accessible, responsive, and consistent with the charcoal theme and `#FF5D00` accent.
- Keep changes focused; update directly related documentation and validate the smallest relevant build, lint, and test commands.
- Do not claim a placeholder feature is functional. Surface errors rather than masking them with silent fallbacks.

