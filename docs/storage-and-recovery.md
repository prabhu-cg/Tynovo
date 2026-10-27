# Browser storage: what it is, its limits, and recovery

Projects live in the browser's **IndexedDB** (database `brand-typography-studio`, store `projects`, JSON only). Font binaries are never stored: they are rebuilt from the glyph model on export. Nothing is sent anywhere. The architecture is in [architecture.md](architecture.md); this page is the honest list of what that storage can and cannot promise.

## The one preference

Apart from projects, Tynovo keeps a single display preference: whether the sample project on the Projects page is collapsed (`localStorage` key `tynovo.sampleCollapsed`, value `1` or `0`; nothing is written until the person uses the control). It is not part of any project, is not exported, and clearing site data removes it, which simply shows the sample again. If the browser blocks `localStorage`, the choice still holds while the person moves around the app (it is kept in memory) and is forgotten afterwards. Tested in `e2e/cards-and-sample.spec.ts` and `e2e/hardening.spec.ts`.

## What the storage cannot promise

| Limit | Consequence | What the app does |
|---|---|---|
| It belongs to one **origin** in one **browser profile** | Another browser, another device, a private window, or the same site under a different address (`gettynovo.vercel.app` vs a custom domain) sees an empty app. Moving the domain moves nothing. | Export a project file to move or back up work. The Settings and Privacy pages say where data lives. |
| The user can clear it | "Clear site data" deletes every project. There is no server copy. | Deleting a project offers a backup file first. The FAQ and Privacy page say it plainly. |
| The browser may evict it | Storage is *best-effort* unless the site is granted persistence. Browsers may clear it under disk pressure; Safari clears script-writable storage for sites not used for about a week. | **Not mitigated.** Tynovo does not request persistent storage (`navigator.storage.persist()`); that is a known gap, listed in [known-limitations.md](known-limitations.md). |
| It has a quota | A full disk or a small quota makes a write fail. | See below. |
| It can be unavailable | Some private windows and blocked-site-data settings expose no IndexedDB. | See below. |
| Two tabs can edit one project | The second to save would overwrite the first. | See below. |

## What happens when it fails

All of these are exercised in `e2e/storage-failures.spec.ts`.

- **Quota exceeded on save.** The write is refused whole (nothing partial is stored; the stored project stays as it was). The status reads "Could not save"; an alert says "Browser storage is full. Export your projects, free some space and try again", that the edits are still on screen, and offers **Try again** and **Download project file**. The edit is never dropped. When space is freed, Try again saves it.
- **Quota exceeded on create.** The drawer shows the error, creates nothing, and the button is usable again.
- **IndexedDB unavailable.** The app falls back to memory for the session and shows a persistent warning on the dashboard and in Settings: projects will be gone when the tab closes; export a project file to keep work. Creating and editing still work.
- **Two tabs.** Saving is compare-and-put on `updatedAt`. The second tab's save is refused with "changed somewhere else"; autosave pauses; the person chooses *Save mine as a copy* or *Load the latest*. Nothing is overwritten.
- **Reload or tab close with unsaved edits.** Autosave runs 1.2 s after the last change, and immediately when the tab is hidden (`visibilitychange`). If a save is still pending when the tab closes, the browser's own "leave site?" prompt appears. Tested: an edit made just before hiding the tab is stored and survives a reload.
- **Browser restart.** Saved projects are read back from IndexedDB; the project page and its unsaved/saved state are reconstructed from the stored record.

## Recovering from bad data

- **Old format.** A project saved by an older version is upgraded on opening (the migration chain is tested). The stored copy is replaced only on the next save, and the original can be downloaded first.
- **Newer format.** A project saved by a *newer* version is refused, not truncated. It is listed as unreadable and left untouched. This matters for rollback: see [deployment.md](deployment.md).
- **Damaged project or file.** Unreadable records and files are listed with the reason, can be downloaded raw, and the readable parts can be recovered into a **new** project with a list of what was lost. The damaged original stays until the person removes it.
- **Import** never replaces: an id clash becomes "(imported)". Files over 25 MB are refused before being read.

## What recovery cannot do

- If the browser has already deleted the data, there is nothing to recover; Tynovo keeps no copy.
- There is no cross-device sync, version history beyond the in-project restore points, or automatic backup. Exporting a `.tynovo.json` file is the backup.
