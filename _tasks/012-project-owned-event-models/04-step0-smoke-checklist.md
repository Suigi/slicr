# Step 0 manual editor smoke checklist

Use a disposable browser profile/origin; restore replaces its local data. From the worktree root run `npm run dev --workspace=slicr-editor` and open the printed localhost URL. For Tailnet access, use `npm run dev:tailnet --workspace=slicr-editor` (requires Tailscale), but a plain-HTTP Tailnet IP is **not** a secure browser context: clipboard export/restore will not work there. Use localhost or an HTTPS endpoint for the clipboard check.

- [x] Startup: default project and chapter load; graph workspace is usable.
- [x] Editing: create a slice and rename its real graph node by double-clicking its label; verify the changed label (not a mockup card).
- [x] Scope: add a chapter and another project; create distinct nodes in each; switch back and verify each scope shows its own nodes.
- [x] Reload: reload the same tab, reselect the scopes if necessary, and confirm edited nodes remain.
- [x] Backup/restore: copy full event backup to clipboard; create a disposable node; restore the captured clipboard backup and confirm; disposable node disappears and earlier node remains, including after reload.

Check each box after verifying it. If something fails, leave its box unchecked and report the failure instead of changing the expected result. Automated coverage: `npm run test:browser --workspace=slicr-editor` (Chromium may first require `npx playwright install chromium`).
