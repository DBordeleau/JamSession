# Jam Session

Jam Session is an asynchronous music-collaboration platform inspired by Git and open-source development. Musicians will be able to share stems, propose contributions, and fork songs into new creative directions while preserving history and attribution.

> **Current status:** early MVP foundation. The repository currently contains the Next.js application shell, documentation, quality tooling, and a stack-verification page. Authentication, projects, uploads, contributions, Supabase, and OpenDAW are planned but not implemented yet.

## Planned MVP

- Create music projects and upload stems.
- Arrange and mix compatible audio in a browser workspace.
- Submit a contribution for the project owner to review.
- Accept or reject contributions without rewriting project history.
- Fork a project while preserving its source and contributor credits.
- Discover public projects by musical metadata.

The [product requirements](docs/PRD.md) describe the intended experience. The [technical-design index](docs/technical-design/README.md) explains how it will be built.

## Technology

- [Next.js](https://nextjs.org/) App Router and TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Motion for React](https://motion.dev/docs/react) (formerly Framer Motion) for purposeful interaction animation
- [Supabase](https://supabase.com/) for Postgres, Auth, and Storage once backend work begins
- [OpenDAW](https://github.com/andremichelle/openDAW) behind a client-only adapter once the studio spike begins
- [Vitest](https://vitest.dev/) and React Testing Library for unit/component tests
- [Playwright](https://playwright.dev/) for browser tests
- Vercel for eventual deployment

## Prerequisites

You need:

1. [Git](https://git-scm.com/downloads)
2. [Node.js 24 LTS](https://nodejs.org/en/download) — npm is included with Node
3. A code editor such as [Visual Studio Code](https://code.visualstudio.com/)

Docker and Supabase are **not** required for the current bootstrap application.

After installing, open a new terminal and verify:

```text
node --version
npm --version
git --version
```

`node --version` should begin with `v24`. This repository deliberately rejects other Node major versions so every contributor uses the same runtime baseline.

## First-time setup on Windows

These instructions use PowerShell, which is included with Windows.

1. Install Git using the Git installer linked above. The default installer settings are fine.
2. Install the Node.js 24 LTS Windows installer from the official Node website.
3. Close and reopen PowerShell so it can find the new programs.
4. Clone the repository and enter its directory:

   ```powershell
   git clone <repository-url>
   cd JamSession
   ```

5. Install the exact dependencies recorded in `package-lock.json`:

   ```powershell
   npm ci
   ```

6. Start the development server:

   ```powershell
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser.
8. Stop the server by returning to PowerShell and pressing `Ctrl+C`.

There is no virtual environment to activate. Node projects keep their dependencies in the local `node_modules` directory, which `npm ci` creates for you.

## First-time setup on macOS or Linux

Install Git and Node.js 24 LTS. A Node version manager is recommended if you work on multiple Node projects, but it is not required. This repository includes both `.nvmrc` and `.node-version` files for compatible version managers.

Then run:

```bash
git clone <repository-url>
cd JamSession
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), and stop the server with `Ctrl+C`.

## Environment variables

The bootstrap page does not require environment variables.

When Supabase integration begins, copy `.env.example` to `.env.local` and fill in the documented values:

```powershell
Copy-Item .env.example .env.local
```

On macOS/Linux:

```bash
cp .env.example .env.local
```

Never commit `.env`, `.env.local`, credentials, or service-role keys. These files are ignored by Git.

## Common commands

Run commands from the repository root:

| Command                 | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `npm ci`                | Reproduce dependencies from the lockfile                        |
| `npm run dev`           | Start the local development server                              |
| `npm run check`         | Run formatting, lint, types, unit tests, and a production build |
| `npm run format`        | Format supported files                                          |
| `npm run format:check`  | Check formatting without changing files                         |
| `npm run lint`          | Run ESLint with zero warnings allowed                           |
| `npm run typecheck`     | Run strict TypeScript checking                                  |
| `npm test`              | Run unit and component tests once                               |
| `npm run test:watch`    | Run unit tests while editing                                    |
| `npm run test:coverage` | Generate a local coverage report                                |
| `npm run build`         | Create a production Next.js build                               |
| `npm run start`         | Serve an existing production build                              |
| `npm run test:e2e`      | Run Playwright browser tests                                    |

Before the first browser-test run, download Playwright's Chromium build once:

```powershell
npx playwright install chromium
```

That browser download is only needed for E2E tests, not normal development.

## Repository map

```text
src/app/          Next.js routes, layouts, styles, and route-owned UI
src/features/     Feature-owned code; the future studio adapter boundary lives here
src/test/         Shared unit-test setup
tests/e2e/        Playwright browser journeys
public/           Static files served by Next.js
docs/             Product requirements, technical design, and decisions
local/            Untracked personal implementation plans; never committed
```

Folders for Supabase migrations, server repositories, and reusable components will be introduced with the first real behavior that needs them. We avoid empty architecture placeholders.

## Core architecture vocabulary

| Concept      | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| Project      | Long-lived song identity, metadata, visibility, and current revision     |
| Revision     | Immutable published snapshot of an arrangement and its referenced assets |
| Workspace    | Mutable private draft based on a revision                                |
| Contribution | Review workflow containing an immutable proposed version                 |
| Fork         | New project that points back to an exact source project and revision     |
| Asset        | Immutable audio, editor snapshot, preview, waveform, or image object     |

The backend will form a Git-like revision graph using Postgres relationships and immutable Storage assets rather than literal Git repositories. See the [system architecture](docs/technical-design/01-system-architecture.md) and [data model](docs/technical-design/02-data-model.md) for details.

## Troubleshooting

### `npm ci` reports an unsupported Node version

Run `node --version`. Install or switch to Node 24, then open a new terminal. Do not delete the `engines` rule to bypass the check.

### `npm ci` says the package file and lockfile disagree

Make sure you did not manually edit `package.json`. Restore unintended changes and retry. Contributors should use `npm ci`; dependency updates are deliberate changes performed with `npm install`.

### Port 3000 is already in use

Another development server may still be running. Stop it with `Ctrl+C`, or start Jam Session on another port:

```powershell
npm run dev -- --port 3001
```

Then open `http://localhost:3001`.

### Reinstall dependencies cleanly

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
npm ci
```

On macOS/Linux:

```bash
rm -rf node_modules
npm ci
```

Do not delete `package-lock.json`; it is the reproducibility contract.

### Where are the Supabase instructions?

Supabase is intentionally not configured in the bootstrap commit. Setup commands will be added here and in `AGENTS.md` when the first backend integration lands.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md). Coding agents must also follow [AGENTS.md](AGENTS.md). Product or architectural changes should cite the relevant PRD, technical-design section, or ADR.

## License

No project license has been selected yet. All rights are reserved unless explicitly stated otherwise. Do not redistribute OpenDAW-derived code or assets. Licensing will be revisited before external alpha or public distribution.
