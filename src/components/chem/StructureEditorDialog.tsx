'use client';

import * as RDialog from '@radix-ui/react-dialog';
import type { Ketcher } from 'ketcher-core';
import { PenTool, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, IconButton } from '@/components/vbds';
import { MAX_STRUCTURE_LENGTH } from '@/lib/validation';

/* ════════════════════════════════════════════════════════════════════
   Structure editor dialog — draw a molecule, get SMILES back.

   Ketcher is `import()`ed on first open; pages that never open it never
   download it. It is mounted once and re-attached on every open (see
   KetcherCanvas), so each open starts from a reset canvas.

   Rules this dialog keeps:
   · "Use structure" is disabled until the editor has finished initialising
     AND loading the starting structure — applying earlier would return an
     empty drawing and silently clear the field.
   · Nothing is thrown away silently. Escape, Cancel and ✕ ask first when the
     drawing has changed since it was loaded.
   · Applying an untouched drawing returns the original string exactly, so
     opening and closing the editor can never alter a stored structure.
   · The dialog does not close on an outside click: Ketcher's own popups can
     render outside this element.
   ════════════════════════════════════════════════════════════════════ */

type Phase = 'loading' | 'ready' | 'failed';
type EditorModule = typeof import('./KetcherCanvas');

/** Longest we wait for the editor (Indigo worker included) before offering a retry. */
const INIT_TIMEOUT_MS = 30_000;

/** Loads a stored structure through the server as a molfile — see `molfileFor` for why not SMILES. */
async function fetchMolfile(smiles: string): Promise<string | null> {
  if (smiles.length > MAX_STRUCTURE_LENGTH) return null;
  try {
    const response = await fetch(`/api/structure/molfile?smiles=${encodeURIComponent(smiles)}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { molfile?: string } };
    return body.data?.molfile ?? null;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function StructureEditorDialog({
  open,
  onOpenChange,
  initialSmiles,
  onApply,
  title = 'Draw a structure',
  allowQuery = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Loaded into the canvas on open, so an existing structure can be edited. */
  initialSmiles?: string;
  /** Receives the drawing as SMILES (or SMARTS, when `allowQuery` and the drawing needs it). */
  onApply: (structure: string) => void;
  title?: string;
  /** Substructure search: fall back to SMARTS when the drawing has query features SMILES can't express. */
  allowQuery?: boolean;
}) {
  /** The live canvas element. State, not a ref: Radix mounts the content a render after `open` flips. */
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);
  const moduleRef = useRef<EditorModule | null>(null);
  const ketcherRef = useRef<Ketcher | null>(null);
  /** Undo position right after loading — the drawing is "changed" when it differs. */
  const baselineRef = useRef(0);
  /** Whether the starting structure made it onto the canvas (so it can be returned untouched). */
  const loadedRef = useRef(false);
  /** Set when Escape was pressed while one of Ketcher's own popups was open — that Escape is the popup's. */
  const popupEscapeRef = useRef(false);
  const startRef = useRef('');
  startRef.current = initialSmiles?.trim() ?? '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [notice, setNotice] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Each open starts from scratch. Runs the moment `open` flips — the load below waits for the
  // canvas element, which Radix mounts a render later, and until then nothing may look ready.
  useEffect(() => {
    if (!open) return;
    ketcherRef.current = null;
    loadedRef.current = false;
    setPhase('loading');
    setNotice(null);
    setConfirming(false);
    setApplying(false);
  }, [open]);

  useEffect(() => {
    if (!open || !canvasEl) return undefined;
    let cancelled = false;
    ketcherRef.current = null;
    loadedRef.current = false;
    setPhase('loading');
    setNotice(null);
    setConfirming(false);

    (async () => {
      try {
        const mod = (moduleRef.current ??= await import('./KetcherCanvas'));
        if (cancelled) return;
        const container = canvasEl;

        await withTimeout(
          (async () => {
            const ketcher = await mod.attachEditor(container, (message) =>
              setNotice(message || 'The editor reported an error.'),
            );
            if (cancelled) return;
            const start = startRef.current;
            let content: string | null = null;
            if (start) content = (await fetchMolfile(start)) ?? start;
            if (cancelled) return;
            try {
              await mod.loadStructure(ketcher, content);
              loadedRef.current = Boolean(start);
            } catch {
              await mod.loadStructure(ketcher, null).catch(() => undefined);
              setNotice('The current structure couldn’t be loaded into the editor. Draw it again, or cancel to keep it.');
            }
            if (cancelled) return;
            baselineRef.current = mod.historyPosition(ketcher);
            ketcherRef.current = ketcher;
          })(),
          INIT_TIMEOUT_MS,
        );
        if (cancelled) return;
        setPhase('ready');
      } catch {
        if (cancelled) return;
        // Start the next attempt from a clean editor — a half-initialised one never recovers.
        moduleRef.current?.discardEditor();
        setPhase('failed');
        setNotice('The structure editor didn’t load. Check your connection and try again.');
      }
    })();

    return () => {
      cancelled = true;
      ketcherRef.current = null;
      moduleRef.current?.detachEditor(canvasEl);
    };
  }, [open, attempt, canvasEl]);

  /** Parks the editor as the canvas element is removed, before React takes the DOM away from under it. */
  const setCanvas = useCallback((element: HTMLDivElement | null) => {
    setCanvasEl(element);
    return () => {
      if (element) moduleRef.current?.detachEditor(element);
      setCanvasEl(null);
    };
  }, []);

  const isDirty = useCallback(() => {
    const ketcher = ketcherRef.current;
    const mod = moduleRef.current;
    return Boolean(ketcher && mod && mod.historyPosition(ketcher) !== baselineRef.current);
  }, []);

  /** Every way of leaving without applying goes through here. */
  const requestClose = useCallback(() => {
    if (isDirty()) setConfirming(true);
    else onOpenChange(false);
  }, [isDirty, onOpenChange]);

  async function apply() {
    const ketcher = ketcherRef.current;
    if (!ketcher || phase !== 'ready') return;

    // Untouched: hand back exactly what we were given.
    if (!isDirty() && loadedRef.current && startRef.current) {
      onApply(startRef.current);
      onOpenChange(false);
      return;
    }

    setApplying(true);
    setNotice(null);
    try {
      if (await ketcher.containsReaction()) {
        setNotice('This drawing contains a reaction (arrows or “+” signs). ASTRA stores single molecules — remove them.');
        return;
      }

      let structure = '';
      try {
        structure = (await ketcher.getSmiles()).trim();
      } catch {
        // Query atoms/bonds (lists, "any" bonds) have no SMILES form.
        if (!allowQuery) {
          setNotice('This drawing uses query features (atom lists or “any” bonds) that a stored structure can’t hold. Draw a specific molecule.');
          return;
        }
        try {
          structure = (await ketcher.getSmarts()).trim();
        } catch {
          setNotice('This drawing can’t be turned into SMILES or SMARTS. Simplify it and try again.');
          return;
        }
      }

      if (!structure) {
        setNotice('The canvas is empty. Draw a structure, or cancel.');
        return;
      }
      if (structure.length > MAX_STRUCTURE_LENGTH) {
        setNotice(`This structure is too large (${structure.length} characters; the limit is ${MAX_STRUCTURE_LENGTH}).`);
        return;
      }
      onApply(structure);
      onOpenChange(false);
    } catch {
      setNotice('The editor couldn’t read this drawing. Try again, or simplify it.');
    } finally {
      setApplying(false);
    }
  }

  return (
    <RDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else if (popupEscapeRef.current) popupEscapeRef.current = false;
        else requestClose();
      }}
    >
      <RDialog.Portal>
        <RDialog.Overlay className="vbds-dialog-scrim" />
        <RDialog.Content
          className="astra-sketcher"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={() => {
            // Escape closes Ketcher's own popup (periodic table, atom properties…) first; only a
            // bare Escape on the canvas leaves the dialog. Don't preventDefault here — Ketcher's own
            // handler needs the keystroke. Radix is stopped from closing us via `popupEscapeRef`.
            const popup = canvasEl?.querySelector('dialog[open]');
            popupEscapeRef.current = Boolean(
              popup ?? canvasEl?.querySelector('[role="dialog"], [class*="Dialog-module"], [class*="Modal"]'),
            );
            // Observed: with focus on one of our buttons (e.g. just after "Use structure") Ketcher's popup
            // ignores Escape, and the key would otherwise do nothing at all.
            if (popup) {
              // Give Ketcher a frame to handle it; if the popup is still there, press its own close
              // button — that goes through Ketcher's handlers, so its state stays consistent.
              setTimeout(() => {
                if (!popup.isConnected || !popup.hasAttribute('open')) return;
                const close =
                  popup.querySelector<HTMLElement>('[class*="buttonTop"]') ??
                  [...popup.querySelectorAll<HTMLElement>('button')].find((b) => /^(cancel|close)/i.test(b.textContent?.trim() ?? ''));
                close?.click();
              }, 120);
            }
          }}
        >
          <header className="astra-sketcher__head">
            <span className="astra-sketcher__icon" aria-hidden="true">
              <PenTool size={16} />
            </span>
            <div className="astra-sketcher__titles">
              <RDialog.Title className="astra-sketcher__title">{title}</RDialog.Title>
              <RDialog.Description className="astra-sketcher__desc">
                Draw with the tools around the canvas, or paste a structure (Ctrl/⌘ V). <b>Use structure</b> copies it
                back as SMILES.
              </RDialog.Description>
            </div>
            <IconButton icon={<X size={16} />} label="Close the structure editor" variant="plain" onClick={requestClose} />
          </header>

          <div className="astra-sketcher__canvas" ref={setCanvas}>
            {phase === 'loading' && (
              <div className="astra-sketcher__loading" role="status">
                <span className="vbds-spinner" aria-hidden="true" />
                Loading the structure editor…
              </div>
            )}
            {phase === 'failed' && (
              <div className="astra-sketcher__loading" role="alert">
                <Button variant="outlined" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </Button>
              </div>
            )}
          </div>

          <footer className="astra-sketcher__foot">
            {confirming ? (
              <>
                <p className="astra-sketcher__notice astra-sketcher__notice--confirm" role="alertdialog" aria-label="Discard your drawing?">
                  Discard your drawing?
                </p>
                <Button variant="ghost" autoFocus onClick={() => setConfirming(false)}>
                  Keep editing
                </Button>
                <Button variant="danger" onClick={() => onOpenChange(false)}>
                  Discard
                </Button>
              </>
            ) : (
              <>
                <p className="astra-sketcher__notice" role="status" aria-live="polite">
                  {notice}
                </p>
                <Button variant="ghost" onClick={requestClose}>
                  Cancel
                </Button>
                <Button onClick={() => void apply()} loading={applying} disabled={phase !== 'ready'}>
                  Use structure
                </Button>
              </>
            )}
          </footer>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
