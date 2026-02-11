# Contributing to Geval

Thank you for your interest in contributing to Geval! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 10.0.0
- Git

### Development Setup

1. **Fork the repository**

   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/geval.git
   cd geval
   ```

3. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/geval-labs/geval.git
   ```

4. **Install dependencies**

   ```bash
   npm install
   ```

5. **Build the project**

   ```bash
   npm run build
   ```

6. **Run tests**

   ```bash
   npm test
   ```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feat/add-new-adapter` - New features
- `fix/contract-parsing-error` - Bug fixes
- `docs/improve-readme` - Documentation
- `refactor/engine-cleanup` - Code refactoring
- `test/add-diff-tests` - Adding tests

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:

```
feat(core): add support for custom baseline sources
fix(cli): handle missing baseline file gracefully
docs(readme): add CI/CD integration examples
```

### Keeping Up to Date

Before starting work:

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

## Pull Request Process

1. **Create a feature branch**

   ```bash
   git checkout -b feat/your-feature
   ```

2. **Make your changes**
   - Write clean, readable code
   - Add tests for new functionality
   - Update documentation if needed

3. **Run checks locally**

   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

5. **Push to your fork**

   ```bash
   git push origin feat/your-feature
   ```

6. **Open a Pull Request**
   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changes you made and why
   - Include screenshots for UI changes

### PR Checklist

- [ ] Code follows the project's style guidelines
- [ ] Tests pass locally
- [ ] New code has test coverage
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] PR description is complete

## Coding Standards

### TypeScript

- Use strict TypeScript settings
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Document public APIs with JSDoc

```typescript
/**
 * Evaluate a contract against eval results.
 *
 * @param input - Engine input containing contract and results
 * @returns Decision object with status and violations
 */
export function evaluate(input: EngineInput): Decision {
  // ...
}
```

### Code Style

- Use 2 spaces for indentation
- Use semicolons
- Use double quotes for strings
- Maximum line length: 100 characters

We use Prettier and ESLint to enforce style. Run:

```bash
npm run format        # Format code
npm run lint:fix      # Fix linting issues
```

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions/Variables**: `camelCase`
- **Constants**: `SCREAMING_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`

### Project Principles

When contributing, keep these principles in mind:

1. **Determinism** - Same inputs must always produce same outputs
2. **Simplicity** - Prefer simple, readable code over clever solutions
3. **Testability** - All logic should be testable
4. **No Side Effects** - Core library should be pure functions
5. **CI/CD First** - Everything should work in automated pipelines

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for a specific package
cd packages/core && npm test
```

### Writing Tests

- Put tests in `__tests__` directories or `*.test.ts` files
- Use descriptive test names
- Test edge cases and error conditions
- Mock external dependencies

```typescript
import { describe, it, expect } from "vitest";
import { evaluate } from "../src/engine/evaluator";

describe("evaluate", () => {
  it("should return PASS when all rules are satisfied", () => {
    const result = evaluate({
      contract: mockContract,
      evalResults: mockResults,
      baselines: {},
    });

    expect(result.status).toBe("PASS");
  });

  it("should return BLOCK when a rule is violated", () => {
    // ...
  });
});
```

## Documentation

### Code Documentation

- Add JSDoc comments to all public APIs
- Include examples in documentation
- Document parameters and return types

### README and Docs

- Keep README up to date with changes
- Add examples for new features
- Update CLI help text for new commands

## Package-Specific Guidelines

### @geval/core

The core library must be:

- Pure (no side effects)
- Deterministic (no randomness)
- Framework-agnostic (no Node.js-specific APIs in core logic)

### @geval/cli

The CLI should:

- Provide clear error messages
- Support both human and machine-readable output
- Use appropriate exit codes

## Questions?

If you have questions:

1. Check existing issues and discussions
2. Open a new discussion for general questions
3. Open an issue for bugs or feature requests

## Recognition

Contributors are recognized in our [CONTRIBUTORS.md](CONTRIBUTORS.md) file. Thank you for helping make Geval better!

---

Thank you for contributing to Geval! 🎉
