# Third-party notices

ASTRA bundles the open-source components below in addition to the ordinary npm dependencies listed
in `package.json`. Their licences are all permissive; none is copyleft.

## Structure editor — Ketcher and Indigo

| Component | Licence | Copyright |
|---|---|---|
| `ketcher-react`, `ketcher-core`, `ketcher-standalone` (Ketcher 3.x) | Apache-2.0 | © EPAM Systems |
| `indigo-ketcher` (Indigo cheminformatics toolkit, WebAssembly build) | Apache-2.0 | © EPAM Systems |
| `eve-raphael`, Raphaël (canvas drawing used by Ketcher) | Apache-2.0 / MIT | © Dmitry Baranovskiy |

Apache-2.0 full text: <https://www.apache.org/licenses/LICENSE-2.0>. Ketcher's source and its own
notices: <https://github.com/epam/ketcher>.

The editor is loaded on demand (`src/components/chem/KetcherCanvas.tsx`) and is unmodified: ASTRA
configures it (toolbar, struct-service provider) but does not patch it.

Checked across Ketcher's whole dependency closure (318 packages): MIT 251, ISC 42, Apache-2.0 9,
BSD-3-Clause 6, BlueOak-1.0.0 6, 0BSD 1, BSD 1, Unlicense 1, and `eve-raphael` (Apache-2.0 per its
LICENSE file; its package.json declares no licence field).

## Chemistry — RDKit

`@rdkit/rdkit` (RDKit.js, WebAssembly) — BSD-3-Clause, © the RDKit contributors. Runs on the server only.
