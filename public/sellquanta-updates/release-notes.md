SellQuanta 1.1.1 for Windows 10/11 64-bit.

Includes Banking settlement reconciliation, Purchase Management, read-only Warehouse, Sales & Returns Reports, Agent Wallet date filters, and unified SellQuanta Excel branding.

Core business features do not require Ollama. Optional local AI setup is available in Settings, with explicit consent before starting Ollama. No automatic Ollama installation or model download.

Existing v1.0.2 users must upgrade manually: create a backup in SellQuanta, close SellQuanta, and run the new official installer over the existing installation. Do not uninstall or remove %APPDATA%\SellQuanta Data. The application identity com.sellquanta.desktop and existing business-data/profile paths are retained.

Future updates use authenticated metadata and verified installer checksums, with download/install confirmation and a pre-update data backup.

Built by GitHub Actions from commit 76b6b49487247e1d726050da61d6613e6e4ea591. This installer is unsigned. Metadata signing is not Windows Authenticode signing.

Validation: 145 repository tests pass locally and in Windows GitHub Actions; production frontend and NSIS installer builds pass. Synthetic old-backend-to-new-backend compatibility and read-only export tests pass. Actual fresh installation, in-place installer upgrade, auto-update installation, SmartScreen behavior and uninstall/reinstall retention are not physically verified; a separate Windows test environment is required for those checks.

The v1.1.0 tag was an unsuccessful unpublished CI attempt (test dependency path); no v1.1.0 public installer was released.
