'use client';

import type { Ketcher } from 'ketcher-core';
import { Editor } from 'ketcher-react';
import 'ketcher-react/dist/index.css';
import { StandaloneStructServiceProvider } from 'ketcher-standalone/dist/binaryWasmNoRender';
import { createRoot, type Root } from 'react-dom/client';

/* ════════════════════════════════════════════════════════════════════
   Ketcher (EPAM, Apache-2.0) — the drawing canvas.

   Never import this module statically: it pulls ~3.3 MB (gzip) of editor
   and Indigo WASM, and it touches `window` at import time. Load it only
   through StructureEditorDialog, which `import()`s it on first open, so the
   cost is paid only when someone opens the editor.

   One editor for the page's lifetime. Ketcher registers document- and
   window-level listeners that it never removes, so mounting a fresh editor
   per open leaked ~800 listeners each time (mousemove handling was ~140×
   slower after 20 opens). Instead it is mounted once into a detached host
   element; each dialog open attaches that element, each close detaches it.
   Reopening is instant and nothing accumulates.

   `binaryWasmNoRender`: Indigo runs as a separate .wasm in a Web Worker
   (compressible, streamed, off the main thread) and without its image
   renderer — Ketcher draws its own canvas and RDKit draws everywhere
   else in ASTRA.
   ════════════════════════════════════════════════════════════════════ */

/**
 * ASTRA stores single molecules as SMILES. Everything that cannot be kept in that
 * form is hidden rather than offered and then refused: atom mapping, R-groups,
 * S-groups, shapes and text, image recognition, 3D, and the links that leave the
 * app (help, about). Fullscreen would fight the dialog.
 *
 * The reaction arrow and "+" tools are NOT in this list. The button set is fixed
 * when the one editor is created, and one use — drawing a route in the route
 * editor — needs them. They stay in the toolbar and are hidden with CSS unless the
 * host carries `data-reactions` (see `attachEditor` and `.astra-sketcher__host`).
 * A reaction drawn anyway, by hotkey, is still refused where a molecule is wanted.
 */
const HIDDEN_BUTTONS = [
  'recognize', 'miew', 'settings', 'help', 'about', 'fullscreen', 'sgroup',
  'reaction-mapping-tools', 'reaction-automap', 'reaction-map', 'reaction-unmap',
  'rgroup', 'rgroup-label', 'rgroup-fragment', 'rgroup-attpoints',
  'shape', 'shape-ellipse', 'shape-rectangle', 'shape-line', 'text', 'create-monomer',
] as const;

const BUTTONS = Object.fromEntries(HIDDEN_BUTTONS.map((name) => [name, { hidden: true }]));

interface Host {
  element: HTMLDivElement;
  root: Root;
  ketcher: Promise<Ketcher>;
}

let provider: StandaloneStructServiceProvider | null = null;
let host: Host | null = null;
let parking: HTMLDivElement | null = null;
/** Who gets the editor's errors right now — the open dialog, if any. */
let errorSink: ((message: string) => void) | null = null;

/**
 * Where the editor waits between opens. It must stay in the document at a real size:
 * Ketcher measures SVG lengths while it re-renders, and a detached (or zero-size)
 * tree throws "Could not resolve relative length" from its ruler and unmounts itself.
 */
function park(element: HTMLElement): void {
  if (!parking) {
    parking = document.createElement('div');
    parking.setAttribute('aria-hidden', 'true');
    parking.setAttribute('inert', '');
    Object.assign(parking.style, {
      position: 'fixed',
      left: '-20000px',
      top: '0',
      width: '1100px',
      height: '700px',
      visibility: 'hidden',
      pointerEvents: 'none',
    });
    document.body.appendChild(parking);
  }
  parking.appendChild(element);
}

function createHost(): Host {
  const element = document.createElement('div');
  element.className = 'astra-sketcher__host';
  const root = createRoot(element);
  provider ??= new StandaloneStructServiceProvider();
  const ketcher = new Promise<Ketcher>((resolve) => {
    root.render(
      <Editor
        staticResourcesUrl=""
        structServiceProvider={provider!}
        buttons={BUTTONS}
        errorHandler={(message: string) => errorSink?.(message)}
        onInit={resolve}
        // ASTRA works with small molecules; the peptide/RNA editor is noise here.
        disableMacromoleculesEditor
      />,
    );
  });
  return { element, root, ketcher };
}

/**
 * Puts the editor inside `container` and resolves with it once it has finished initialising.
 * `reactions` shows the arrow and "+" tools for this open — off everywhere a single molecule is wanted.
 */
export function attachEditor(
  container: HTMLElement,
  onError: (message: string) => void,
  options: { reactions?: boolean } = {},
): Promise<Ketcher> {
  errorSink = onError;
  if (!host) {
    host = createHost();
    park(host.element); // renders at a real size first
  }
  host.element.toggleAttribute('data-reactions', Boolean(options.reactions));
  container.appendChild(host.element);
  // Ketcher sizes itself from window resize events; the container is new to it.
  window.dispatchEvent(new Event('resize'));
  return host.ketcher;
}

/** Takes the editor out of the page (it stays alive for the next open). Pass the container it is leaving. */
export function detachEditor(from?: HTMLElement): void {
  // Only the owner of the editor may take it away: a stale teardown (an earlier dialog's
  // container being removed) must not park an editor that has since moved to a new one.
  if (!host || (from && host.element.parentElement !== from)) return;
  errorSink = null;
  park(host.element);
}

/** Throws the editor away entirely — used when initialisation never completes, so a retry starts clean. */
export function discardEditor(): void {
  errorSink = null;
  const stale = host;
  host = null;
  if (stale) {
    stale.element.remove();
    setTimeout(() => stale.root.unmount(), 0);
  }
}

/**
 * Replaces whatever is on the canvas with `content` (a molfile, SMILES or SMARTS), or
 * with nothing, and makes that the floor of the undo history.
 *
 * The history is cleared *after* loading: `setMolecule` records the load as an undoable
 * step, and leaving it there lets Ctrl/⌘ Z wipe the structure that was opened for editing.
 * Only `clear`, `setMolecule` and `clearHistory` are used — all part of Ketcher's typed API.
 */
export async function loadStructure(ketcher: Ketcher, content: string | null): Promise<void> {
  ketcher.editor.clear();
  try {
    if (content) await ketcher.setMolecule(content);
  } finally {
    ketcher.editor.clearHistory();
  }
}

/**
 * The drawing as KET — Ketcher's JSON format, written locally without Indigo.
 * `inspectDrawing` (lib/drawing) reads it: what the drawing contains, and whether it has changed.
 */
export function readDrawing(ketcher: Ketcher): Promise<string> {
  return ketcher.getKet();
}
