# Contributing to Geval

Thank you for your interest in contributing to Geval! This document provides guidelines for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- Git

### Development Setup

1. **Fork the repository** and clone your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/geval.git
   cd geval
   ```

2. **Add upstream remote** (optional):

   ```bash
   git remote add upstream https://github.com/geval-labs/geval.git
   ```

3. **Build the Geval binary**:

   ```bash
   cargo build --release --manifest-path geval/Cargo.toml
   ```

4. **Run tests**:

   ```bash
   cargo test --manifest-path geval/Cargo.toml
   ```

The binary is at `geval/target/release/geval` (or `geval.exe` on Windows). You can run it from the repo root, e.g. `./geval/target/release/geval demo`.

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feat/...` - New features
- `fix/...` - Bug fixes
- `docs/...` - Documentation
- `refactor/...` - Code refactoring
- `test/...` - Adding tests

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) when possible:

```
<type>(<scope>): <description>
```

Examples: `feat(engine): add rule X`, `fix(cli): handle missing file`, `docs(readme): update install steps`.

### Keeping Up to Date

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

## Pull Request Process

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes in the `geval/` crate.
3. Run checks locally:
   ```bash
   cargo test --manifest-path geval/Cargo.toml
   cargo build --release --manifest-path geval/Cargo.toml
   ```
4. Commit and push to your fork, then open a Pull Request with a clear title and description.

### PR Checklist

- [ ] Tests pass (`cargo test --manifest-path geval/Cargo.toml`)
- [ ] Code builds in release mode
- [ ] Documentation updated if needed
- [ ] Commit messages are clear

## Coding Standards

- **Rust**: Follow standard Rust style (`cargo fmt`, `cargo clippy`).
- **Naming**: Use snake_case for Rust; keep CLI flags and help text consistent with existing commands.
- **Principles**: Determinism (same signals + policy → same outcome), simplicity, and CI-friendly exit codes (0 = PASS, 1 = REQUIRE_APPROVAL, 2 = BLOCK).

## Testing

- **Unit tests**: `cargo test --manifest-path geval/Cargo.toml`
- Add tests for new behavior in the same crate under `geval/src/` (e.g. next to the code or in a `tests` module).
- The CI workflow runs the same build and test commands; see [geval/docs/installation.md](geval/docs/installation.md) and [geval/docs/github-actions.md](geval/docs/github-actions.md) for local and CI usage.

## Documentation

- User-facing docs live in `geval/docs/` (installation, GitHub Actions, signals and rules, auditing).
- Keep the main [README.md](README.md) and [geval/docs](geval/docs/) in sync with new commands or behavior.

## Questions?

- Check existing [issues](https://github.com/geval-labs/geval/issues) and discussions.
- Open an issue for bugs or feature requests.

Thank you for contributing to Geval!
