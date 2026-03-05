# Reference Index

This folder contains project documentation and historical reference material.

Canonical project/product naming for live docs: **Flyover Flowchart (v0.0.6)**.

## Live Documentation

Use the D&D 2024 Rules Glossary as the nomenclature baseline for rule terms:

- https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary

Use these for current architecture, behavior, and testing workflow:

- [Character Schema Guide](CHARACTER_SCHEMA_GUIDE.md)
- [Data Organization Conceptual](DATA_ORGANIZATION_CONCEPTUAL.md)
- [Schema Reorganization Notes](SCHEMA_REORGANIZATION.md)
- [PDF Parsing Guide](PDF_PARSING_GUIDE.md)
- [Parser Testing Guide](PARSER_TESTING_GUIDE.md)
- [Qualifier Smoke Checklist](QUALIFIER_SMOKE_CHECKLIST.md)
- [Terminology Contract](TERMINOLOGY_CONTRACT.md)
- [Terminology Audit](TERMINOLOGY_AUDIT.md)
- [Character Import Manual](character_import_manual.html)

## Archive (Not Active Runtime Source)

- [Working Summary](Working%20Summary)

`Working Summary` is historical snapshot material and should be treated as archive/reference only.
Do not use files in that subtree as the active runtime source of truth.

## Workspace Conventions (Quick Reminder)

- Runtime app modules stay in project root.
- External integration modules live in `external/`.
- User-provided assets (PDF/images) live in `user data/`.
- Documentation and notes live in `reference/`.
