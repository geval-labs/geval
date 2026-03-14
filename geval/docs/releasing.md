# Publishing a release (so users can install the binary)

The [Installation](installation.md) and main [README](../../README.md) tell users to download binaries from [GitHub Releases](https://github.com/geval-labs/geval/releases). For that to work, you need to **publish a release** with the built binaries attached.

## One-time setup

Nothing special. The repo already has a workflow (`.github/workflows/release-geval.yml`) that builds the Rust binary on Linux, macOS (Intel + Apple Silicon), and Windows, and uploads the files to the release.

## How to release

1. **Bump version** (optional but good practice): in `geval/Cargo.toml`, set `version = "0.1.0"` (or whatever you want).

2. **Commit and push** your changes to `main`.

3. **Create and push a tag** that starts with `v`:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

4. **Let the workflow run.** Go to the **Actions** tab; the “Release Geval binary” workflow will run. It will:
   - Build the binary on Ubuntu, macOS 14 (ARM), macOS 13 (Intel), and Windows
   - Create a **GitHub Release** for that tag
   - Attach the binaries as release assets: `geval-linux-x86_64`, `geval-macos-aarch64`, `geval-macos-x86_64`, `geval-windows-x86_64.exe`

5. **Done.** The “Latest” release will point to this tag, and the install commands in the README and [Installation](installation.md) will work (they use the “latest” download URL).

## If you prefer to draft the release first

1. On GitHub: **Releases → Draft a new release**.
2. Choose a tag (e.g. create `v0.1.0` from `main`) and publish the release.
3. The workflow is triggered by **pushing a tag**, so you still need to push the tag:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
4. The workflow will build the binaries and **attach them to the existing release** (so you may want to delete the draft and let the workflow create the release from the tag, or adjust the workflow to “only upload assets” to an existing release—current setup creates the release from the tag).

## Summary

| You do | Result |
|--------|--------|
| `git tag v0.1.0 && git push origin v0.1.0` | Workflow runs → release created → binaries attached → users can `curl` the install |

No need to build or upload the binaries yourself; the workflow does it.
