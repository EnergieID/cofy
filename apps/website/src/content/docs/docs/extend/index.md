---
title: Build and extend
description: Where to start when you add to COFY or build on its parts.
sidebar:
  label: Overview
---

COFY is open source and built from separate packages, so you can extend it, or take only the parts you need. The details live next to the code, in each package's README; this page tells you where to look.

| Package | What it is |
| --- | --- |
| [packages/api](https://github.com/EnergieID/cofy/tree/main/packages/api) | `cofy-api`: the COFY API itself, its modules, sources and formats |
| [packages/management-api](https://github.com/EnergieID/cofy/tree/main/packages/management-api) | Stores community settings, and who may change them |
| [packages/runner](https://github.com/EnergieID/cofy/tree/main/packages/runner) | Serves each community's settings as its own COFY API |
| [packages/frontend-sdk](https://github.com/EnergieID/cofy/tree/main/packages/frontend-sdk) | A typed TypeScript client and state stores for the management API |
| [packages/web-components](https://github.com/EnergieID/cofy/tree/main/packages/web-components) | The building blocks of the console: generated forms, a YAML editor, lists and theming |
| [apps/management-web](https://github.com/EnergieID/cofy/tree/main/apps/management-web) | The console, built from the two above |
| [energy-cost](https://github.com/EnergieID/energy-cost) | The library that calculates energy costs; see [energy cost](/docs/energy-cost/) |

## A source or module of your own

Every source belongs to a family, such as prices or production, and fits wherever that family does. A new source subclasses its family and fetches its data; once its package is installed, it shows up in settings files and in the console's forms. [packages/api](https://github.com/EnergieID/cofy/tree/main/packages/api#sources-and-families) shows how, and how a separate package registers its types with an entry point.

## Your own console, or your own branding

The console takes your brand colour, language and icons without code changes. [apps/management-web](https://github.com/EnergieID/cofy/tree/main/apps/management-web#customising) describes how, and how to add a page.

## Contributing

The [repository README](https://github.com/EnergieID/cofy#quick-start-this-repository) sets up a development environment and runs the demos. Questions, ideas and bug reports are welcome as [GitHub issues](https://github.com/EnergieID/cofy/issues).
