# CLAUDE.md

Instructions for agents working in this repo.

## Ship gate

After you finish a **fix** or a **feature**, run the Windows release script before you stop:

```powershell
powershell -ExecutionPolicy Bypass -File .\release.ps1
```

That script is the product check: version alignment, frozen install, dataset build, `tsc` + Vite, then a Tauri release that produces the standalone exe and installers.

**Done** means the script exits 0 and prints the artifact list (`pokestats.exe`, NSIS, MSI). If it fails, fix the failure and run it again. Do not close a fix or feature whose release did not finish.

Skip this gate only for docs/comments with no product code.
