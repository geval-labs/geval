# Installation

Geval is a **single binary**. Download it from [Releases](https://github.com/geval-labs/geval/releases), run it locally or in CI. No npm, no pip, no runtime.

---

## Download and run

**1. Download** (pick your OS):

```bash
# Linux
curl -sSL https://github.com/geval-labs/geval/releases/latest/download/geval-linux-x86_64 -o geval && chmod +x geval

# macOS (Apple Silicon). Intel Mac: build from source.
curl -sSL https://github.com/geval-labs/geval/releases/latest/download/geval-macos-aarch64 -o geval && chmod +x geval
```

**2. (Optional)** Move to PATH so you can run `geval` from anywhere:

```bash
sudo mv geval /usr/local/bin/geval
# or
mv geval ~/bin/geval
```

**3. Verify:**

```bash
geval --help
```

Done. Use the same binary in GitHub Actions or any CI — just download the artifact for the runner OS and run `geval check --signals ... --policy ...`. See [GitHub Actions](github-actions.md).

---

## Use in CI

Same binary. In your workflow:

- Download the release for the runner (e.g. `geval-linux-x86_64` on `ubuntu-latest`).
- Run `./geval check --signals signals.json --policy policy.yaml --env prod`.

No Rust, no npm, no pip. Full workflow examples: [GitHub Actions](github-actions.md).

---

## Build from source

Only needed if you’re contributing or there’s no release for your platform. Requires [Rust](https://rustup.rs/).

```bash
git clone https://github.com/geval-labs/geval.git
cd geval
cargo build --release --manifest-path geval/Cargo.toml
```

Binary: `geval/target/release/geval`. Copy to PATH if you like.

---

**Maintainers:** To publish new binaries, see [Releasing](releasing.md).
