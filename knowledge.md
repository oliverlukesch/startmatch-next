# StartMatch Next

A Next.js application for automated grants management.

## Tech Stack

- **Language**: TypeScript
- **Package manager:** pnpm
- **Primary framework**: Next.js 15 with App Router
- **UI**:
  - Tailwind V4 CSS for styling
  - shadcn/ui components (New York style variant)
  - Radix UI primitives
  - Lucide React icons
- **Build Tool**: Turbopack (used in dev mode)

### Code Quality

- ESLint for linting
- Prettier for code formatting
  - Sorts imports using @trivago/prettier-plugin-sort-imports
  - Formats Tailwind classes using prettier-plugin-tailwindcss
- Husky for git hooks
- lint-staged for running linters on staged files

### Conventions

- React Server Components (RSC) enabled by default

- Path aliases configured:
  - `@/components/*`
  - `@/utils/*`
  - `@/ui/*`
  - `@/lib/*`
  - `@/hooks/*`

- Uses pnpm as the package manager. Do not use npm or yarn.

### Comment Preferences

- Use comments very sparsely, do not explain obvious logic
- Do not add a comment on top of every function definition / function call / class / logical block / etc.
- Primarily use comments for explaining complex logic or providing context that cannot be inferred by reading the code alone
- Break up longer code blocks with "headline comments" (like: `// FORM SUBMISSION RELATED` or `// TEXT GENERATION RELATED`)
- Use lowercase letters only (except for special terms like "URL" or variable names)

### UI Components

The project uses shadcn/ui components with the following characteristics:
- Base color scheme: slate
- CSS variables for theming
- All components use the "slot" pattern from Radix UI
- Components include data-* attributes for styling and testing

### Important

- Do not update knowledge.md on your own

- Never commit changes on your own, never execute any Git commands

- Never remove existing comments inside the codebase

- Only add new knowledge to knowledge.md that is generic and can be applied over multiple features
  - Do not add knowledge that is specific to a single feature / a single route
  - Do not add hyper-specific knowledge (like how to treat properties inside a very specific type of response)

- When updating system prompts:
  - Keep system prompt changes minimal and focused
  - Preserve the example structure in system prompts when making changes
  - Update all examples when there are multiple examples inside the a system prompt

- Do not forget to import used libraries, components, utils and functions
