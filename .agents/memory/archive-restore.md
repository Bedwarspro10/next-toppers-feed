---
name: Archive restore
description: Safe procedure for replacing the project root from an uploaded archive
---

When replacing the project root from an uploaded archive, stage and validate the archive outside the root before deleting anything; uploaded files may themselves live inside the root and be deleted during cleanup.

**Why:** A direct root cleanup can remove the only copy of the uploaded archive before extraction or copying completes.

**How to apply:** Extract to `/tmp`, validate the expected top-level directory and key files, then clear the root, copy the staged contents, reinstall dependencies from the lockfile, and restart the configured workflow.