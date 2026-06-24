---
title: Preference - Coding Style
tags:
  - preference
  - coding
status: active
area: preferences
---

# Preference - Coding Style

## Default Profile

- Language preference: no strong preference. Follow the language, stack, and conventions already established in the project.
- Code style: prefer explicit, readable, and linear code over compact or clever code.
- Naming style: use very explicit names for variables, functions, components, and files. Clarity is more important than brevity.
- File organization: prefer organizing projects by file type unless the project already has a stronger convention.
- Functions and components: prefer larger and more linear units when that makes the logic easier to follow end to end.
- Comment style: add comments mainly in complex code. When comments are needed, they should explain intent, tradeoffs, and reasoning clearly.
- Dependencies: avoid unnecessary dependencies. Prefer existing platform or project tools when they already solve the problem well.
- Type safety: avoid `any` by default. Use clearer types unless there is a good reason not to.
- File size: large files are acceptable when they are cohesive and the structure still makes sense.

## Naming Conventions

- Classes: use `PascalCase`
- Modules: use `PascalCase`
- Variables: use `camelCase`
- Functions: use `camelCase`
- Methods: use `camelCase`
- CSS: use the BEM methodology
- JavaScript hooks, behavior classes, or DOM reference markers: use the `js-` prefix with `kebab-case`
- Naming rule priority: prefer explicit and descriptive names over short or clever ones

## AI Coding Skill

- Match the current project's language, framework, and local conventions before introducing new patterns.
- Optimize for code that is easy to read in one pass.
- Keep logic linear when possible instead of splitting it into many tiny helpers.
- Apply the preferred naming conventions consistently unless the existing project has a hard conflicting convention that should be preserved.
- Do not create functions whose only job is to call another function unless they add real clarity, reuse, or separation of concerns.
- Avoid implicit magic, hidden behavior, and abstractions introduced too early.
- Avoid generic names when a more explicit name would reduce ambiguity.
- Prefer acting directly by default instead of stopping for confirmation on routine implementation choices.
- Stop and confirm only when the change affects architecture, introduces a new dependency, or has meaningful product risk.

## Things To Avoid

- Excess dependency growth
- Implicit or magical behavior
- Over-abstraction
- Generic naming
- Casual use of `any`
- Helper functions that do not add meaningful value

## Notes

- Related: [[Preference - AI Collaboration]], [[Preference - Project Defaults]]
- This preference set favors clarity of flow over aggressively small functions or rigid file size limits.
- Example JS behavior class naming: `js-modal-trigger`, `js-form-submit`, `js-sidebar-toggle`
