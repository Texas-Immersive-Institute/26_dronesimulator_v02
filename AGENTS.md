# Project Agent Instructions

## Start of work

- Read `PROJECT.md` (the design), `CONTEXT.md` (the glossary), `STATUS.md` and `DECISIONS.md` before making material changes. Architecture decisions are in `docs/adr/`.
- Use the terms defined in `CONTEXT.md` in code, UI and docs.
- Preserve sync metadata, conflict files, and existing user work.

## During work

- Keep changes scoped to this project and make the smallest change that solves the request.
- Separate confirmed project facts from suggestions. Mark unknown information rather than inventing it.
- Record consequential choices in `DECISIONS.md` when they would be costly to rediscover.

## End of substantial work

- Update `STATUS.md` at the end of a substantial work session that changes implementation, project state, architecture, priorities, or agreed direction.
- Capture the current focus, completed work, next concrete actions, and known risks or blockers.
- Append meaningful decisions to `DECISIONS.md`; do not use it as a routine activity log.
- State what changed and how it was verified. Do not commit or push unless explicitly requested.
