# Privacy Policy for IaC Module Linker

Last updated: September 7, 2026

IaC Module Linker is a Chrome extension that converts Terraform module sources
into clickable links. This policy describes every piece of data it handles.

## What the extension reads

The extension reads the text of `.tf` and `.hcl` files rendered on github.com
pages you visit, to locate Terraform module source strings. It reads only the
content already displayed on the page you are viewing.

## What the extension stores

Two values are stored in `chrome.storage.local`, on your own device:

- `MODULES`, the list of module names and source types parsed from the current page.
- `CurrentTabUrl`, the URL of the current tab, used to detect when you navigate to a different page.

Both are cleared when you navigate away from GitHub or hide the page. Neither
is transmitted anywhere.

## What leaves your device

The extension sends module source paths to the public Terraform Registry API at
`https://registry.terraform.io` to resolve module versions and paths. Outbound
requests are restricted to that single host by an allowlist in the source. No
other network requests are made.

## What the extension does not do

- Does not collect personally identifiable information.
- Does not read credentials, form data, or personal communications.
- Does not record browsing history. Only the current tab URL is stored, one at a time.
- Does not run analytics, telemetry, or tracking of any kind.
- Does not sell or transfer user data to third parties.
- Does not execute remote code.

## Limited use

IaC Module Linker's use of information received from Chrome APIs adheres to the
Chrome Web Store User Data Policy, including the Limited Use requirements. Data
is used only to provide the extension's single purpose, and is not transferred,
sold, or used for any unrelated purpose.

## Source

The extension is open source under GPL-3.0. Every claim above can be verified
in the source: https://github.com/NickSpaghetti/iac-module-linker

## Contact

Open an issue at
https://github.com/NickSpaghetti/iac-module-linker/issues
