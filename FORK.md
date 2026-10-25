# 0xAndoroid/playwright fork

This fork ships `playwright-cli` with two privacy fixes on top of an upstream Playwright revision:

- `playwright-cli attach` does not snapshot, save or print the pages that are already open in the attached browser.
- Aria snapshots never contain the value of an `<input type=password>`, neither as the textbox value nor inside another element's accessible name. This applies to frames and shadow roots, because every snapshot goes through the same injected serializer.

Upstream issues and pull requests are not filed from this fork.

## Pin

| Item | Value |
| --- | --- |
| Upstream base | `e8149b8257d32dcf8f72573ecc43e72439da7080`, the `gitHead` of `playwright-core@1.64.0-alpha-1790635538000`, which `@playwright/cli@0.1.22` depends on |
| Fork base branch | `andoroid/1.64.0-alpha-1790635538000` |
| Fork version | `1.64.0-alpha-1790635538000.andoroid.1`, set by `FORK_VERSION` in `.github/workflows/fork_andoroid.yml` |
| Release tag | `v<fork version>` |
| Release asset | `playwright-core-<fork version>.tgz` and `SHA256SUMS` |

Version scheme: `<upstream playwright-core version>.andoroid.<n>`. Increase `<n>` for every fork release on the same upstream base.

## Package

Only `playwright-core` is built. It contains the CLI client, the CLI daemon and the injected scripts, and it has no npm dependencies. The fork adds a `playwright-cli` bin to it, so `@playwright/cli` and `playwright` are not installed: they would bring an upstream `playwright-core`.

Install on macOS or Linux, after removing any other `playwright-cli` (for example `brew uninstall playwright-cli` or `npm uninstall -g @playwright/cli`):

```bash
curl -fsSLo playwright-core.tgz https://github.com/0xAndoroid/playwright/releases/download/v$VERSION/playwright-core-$VERSION.tgz
echo "$SHA256  playwright-core.tgz" | shasum -a 256 -c -
npm install -g ./playwright-core.tgz
test "$(playwright-cli --version)" = "$VERSION"
```

## Release

1. Merge the reviewed pull request into the fork base branch; CI must be green.
2. Tag the merge commit `v$FORK_VERSION` and push the tag. The `release` job rebuilds, retests, packs and attaches the tarball and `SHA256SUMS` to a GitHub release.
3. Pin the new version and SHA-256 in the dotfiles setup flow.

To build the tarball locally:

```bash
npm ci && npm run build
node utils/workspace.js --set-version "$FORK_VERSION"
node utils/pack_package.js playwright-core "playwright-core-$FORK_VERSION.tgz"
```

`--set-version` rewrites every `package.json` and `package-lock.json`; run it in a throwaway checkout.

## Rebase onto a new upstream release

1. Find the upstream revision: `npm view @playwright/cli@<new> dependencies` gives the `playwright-core` version, and `npm view playwright-core@<version> gitHead` gives its commit.
2. Create the base branch `andoroid/<version>` at that commit and push it.
3. Create a branch from it and cherry-pick the fork commits: the attach change in `tools/cli-client`, the password change in `packages/injected`, their tests, the `playwright-cli` bin with the shebang in `cli-client/cli.ts`, this file, `.typos.toml` and `fork_andoroid.yml`. Check whether upstream fixed either problem first.
4. Set `FORK_VERSION` to `<version>.andoroid.1` and update the pin table.
5. Rerun the tests before opening the pull request:

   ```bash
   npx playwright test --config=tests/library/playwright.config.ts --project='chromium-*' \
     tests/page/page-aria-snapshot-ai.spec.ts tests/page/page-aria-snapshot.spec.ts \
     tests/page/to-match-aria-snapshot.spec.ts tests/library/role-utils.spec.ts
   npx playwright test --config=tests/mcp/playwright.config.ts --project=chromium \
     tests/mcp/cli-cdp.spec.ts tests/mcp/cli-test.spec.ts tests/mcp/cli-session.spec.ts tests/mcp/secrets.spec.ts
   ```

   `attach does not capture pages that are already open` and `should not include password values` must fail on the unpatched base and pass after the cherry-picks.
6. Open the pull request against the new base branch, wait for green CI, then follow the release steps.
