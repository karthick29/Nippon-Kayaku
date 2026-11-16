'use client';

import * as RDialog from '@radix-ui/react-dialog';
import type { Ketcher } from 'ketcher-core';
import { FileUp, PenTool, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { NameLookupResult } from '@/app/api/structure/lookup/route';
import type { ReactionReading } from '@/app/api/structure/reaction/route';
import { Button, Chip, IconButton, TextField } from '@/components/vbds';
import { inspectDrawing, joinPhrases, type DrawingReport } from '@/lib/drawing';
import { MAX_STRUCTURE_LENGTH } from '@/lib/validation';
import type { StructureProperties } from '@/server/chem/rdkit';
import { Formula } from './Formula';

/* ════════════════════════════════════════════════════════════════════
   Structure editor dialog — draw a molecule, get SMILES back.

   Ketcher is `import()`ed on first open; pages that never open it never
   download it. It is mounted once and re-attached on every open (see
   KetcherCanvas), so each open starts from a reset canvas.

   Rules this dialog keeps:
   · "Use structure" is disabled until the editor has finished initialising
     AND loading the starting structure — applying earlier would return an
     empty drawing and silently clear the field.
   · "Changed" means the drawing's content differs from what was loaded
     (`inspectDrawing(...).fingerprint`) — never Ketcher's undo position,
     which returns to its starting value after undo-then-draw.
   · Nothing is thrown away silently. Escape, Cancel and ✕ ask first when the
     drawing has changed.
   · Applying an unchanged drawing returns the original string exactly, so
     opening and closing the editor can never alter a stored structure.
   · What is returned means what was drawn. Ketcher writes *something* for
     any drawing (an atom list becomes `*`), so the drawing is inspected
     first: query features go out as SMARTS where a query is wanted and are
     refused where a molecule is stored. The server then confirms RDKit can
     read the result while the drawing is still open to fix.
   · The dialog does not close on an outside click: Ketcher's own popups can
     render outside this element.
   · The analysis strip follows the drawing (formula, masses, cLogP, TPSA…),
     calculated by RDKit on the server like every other number in ASTRA. It
     is advisory: it never blocks or changes what "Use structure" returns.
   · A structure file dropped on the dialog (or picked with "Open file") is
     loaded as an ordinary edit — undoable, and counted as a change. So is a
     structure found by name or CAS number.
   · With `onApplyReaction` the dialog draws a reaction instead: the arrow
     and "+" tools appear, and what comes back is the reaction read into
     route inputs by the server — never a string the caller has to parse.
   ════════════════════════════════════════════════════════════════════ */

type Phase = 'loading' | 'ready' | 'failed';
type EditorModule = typeof import('./KetcherCanvas');

interface Notice {
  tone: 'error' | 'info';
  text: string;
}

/** One open of the editor, once the starting structure is on the canvas. */
interface Session {
  ketcher: Ketcher;
  mod: EditorModule;
  /** Fingerprint of the canvas right after loading. */
  baseline: string;
  /** The string to hand back if nothing changes — null when the starting text never made it onto the canvas. */
  original: string | null;
}

/** Longest we wait for the editor (Indigo worker included) before offering a retry. */
const INIT_TIMEOUT_MS = 30_000;
/** Longest we wait for one of the structure endpoints. */
const REQUEST_TIMEOUT_MS = 15_000;

const CANCELLED = Symbol('cancelled');
const TIMED_OUT = Symbol('timed out');

const error = (text: string): Notice => ({ tone: 'error', text });

/** What the analysis strip shows: the numbers, or one line saying why there are none. */
type Analysis = { kind: 'idle' } | { kind: 'note'; text: string } | { kind: 'values'; values: StructureProperties; stale: boolean };

/** Pause after the last edit before the drawing is analysed. */
const ANALYSIS_DELAY_MS = 350;
/** Formats Ketcher reads as text. Binary ChemDraw files (.cdx) are not text — see `readStructureFile`. */
const FILE_ACCEPT = '.mol,.sdf,.cdxml,.ket,.smi,.smiles,.inchi,.cml,.cdx';
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** A structure file as the string Ketcher loads: text as-is, binary CDX as base64. */
async function readStructureFile(file: File): Promise<string> {
  if (!/\.cdx$/i.test(file.name)) return file.text();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Rejects as soon as `signal` aborts, whatever `promise` is doing. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    if (signal.aborted) return onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/**
 * Calls one of the /api/structure endpoints.
 *
 * A 422 is an answer — "not a structure" — and comes back as null. Anything else
 * that isn't a success (offline, timeout, 5xx, an expired session) throws: the
 * caller must not mistake "couldn't ask" for "the answer was no".
 */
async function askServer<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 422) return null;
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    const body = (await response.json()) as { data?: T };
    if (!body.data) throw new Error('Malformed response');
    return body.data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function StructureEditorDialog({
  open,
  onOpenChange,
  initialSmiles,
  onApply,
  title = 'Draw a structure',
  allowQuery = false,
  onApplyReaction,
  reactionProductId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Loaded into the canvas on open, so an existing structure can be edited. */
  initialSmiles?: string;
  /** Receives the drawing as canonical SMILES (or SMARTS, when `allowQuery` and the drawing needs it). */
  onApply: (structure: string) => void;
  title?: string;
  /** Substructure search: write SMARTS when the drawing has query features SMILES can't express. */
  allowQuery?: boolean;
  /** Reaction mode: draw reactants → product; receives the reaction read into route inputs. `onApply` is not called. */
  onApplyReaction?: (reading: ReactionReading) => void;
  /** Reaction mode: the product the route makes, so the server can say whether the drawn product is it. */
  reactionProductId?: string;
}) {
  const reactionMode = Boolean(onApplyReaction);
  const reactionModeRef = useRef(reactionMode);
  reactionModeRef.current = reactionMode;
  /** The live canvas element. State, not a ref: Radix mounts the content a render after `open` flips. */
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);
  const moduleRef = useRef<EditorModule | null>(null);
  const sessionRef = useRef<Session | null>(null);
  /** Set when Escape was pressed while one of Ketcher's own popups was open — that Escape is the popup's. */
  const popupEscapeRef = useRef(false);
  /** An apply or a close decision is in flight; a second request must not start alongside it. */
  const busyRef = useRef(false);
  const startRef = useRef('');
  startRef.current = initialSmiles?.trim() ?? '';
  const allowQueryRef = useRef(allowQuery);
  allowQueryRef.current = allowQuery;

  const [phase, setPhase] = useState<Phase>('loading');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [applying, setApplying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis>({ kind: 'idle' });
  const [dropping, setDropping] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [finding, setFinding] = useState(false);
  const [suggestions, setSuggestions] = useState<NameLookupResult['suggestions']>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Ketcher reported an error since this was last cleared — it reports a bad file here rather than throwing. */
  const editorErrorRef = useRef(false);

  // Each open starts from scratch. Runs the moment `open` flips — the load below waits for the
  // canvas element, which Radix mounts a render later, and until then nothing may look ready.
  useEffect(() => {
    if (!open) return;
    sessionRef.current = null;
    busyRef.current = false;
    setPhase('loading');
    setNotice(null);
    setConfirming(false);
    setApplying(false);
    setAnalysis({ kind: 'idle' });
    setDropping(false);
    setNameQuery('');
    setFinding(false);
    setSuggestions([]);
  }, [open]);

  useEffect(() => {
    if (!open || !canvasEl) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    sessionRef.current = null;
    setPhase('loading');
    setNotice(null);
    setConfirming(false);

    (async () => {
      /** Which step a failure belongs to — it decides the message and whether the editor is rebuilt. */
      let step: 'editor' | 'structure' = 'editor';
      try {
        const initTimer = setTimeout(() => controller.abort(TIMED_OUT), INIT_TIMEOUT_MS);
        let mod: EditorModule;
        let ketcher: Ketcher;
        try {
          mod = moduleRef.current ??= await abortable(import('./KetcherCanvas'), signal);
          ketcher = await abortable(
            mod.attachEditor(
              canvasEl,
              (message) => {
                editorErrorRef.current = true;
                setNotice(error(message || 'The editor reported an error.'));
              },
              { reactions: reactionModeRef.current },
            ),
            signal,
          );
        } finally {
          clearTimeout(initTimer);
        }

        step = 'structure';
        const start = startRef.current;
        let content: string | null = null;
        let unreadable = false;
        if (start) {
          // Through the server as a molfile — see `molfileFor` for why not SMILES. A network failure
          // throws and ends in "Try again": quietly falling back to Ketcher's SMILES reader here would
          // bring back the invented E/Z geometry the molfile exists to avoid.
          const loaded =
            start.length <= MAX_STRUCTURE_LENGTH
              ? await askServer<{ molfile: string }>(`/api/structure/molfile?smiles=${encodeURIComponent(start)}`, signal)
              : null;
          // Not a molecule RDKit can read. A search box may hold SMARTS, which Ketcher reads itself.
          content = loaded?.molfile ?? (allowQueryRef.current ? start : null);
          unreadable = content === null;
        }

        let report: DrawingReport;
        try {
          await abortable(mod.loadStructure(ketcher, content), signal);
          report = inspectDrawing(await mod.readDrawing(ketcher));
          if (content && report.atomCount === 0) throw new Error('Nothing was loaded');
        } catch (cause) {
          if (signal.aborted) throw cause;
          unreadable = true;
          await mod.loadStructure(ketcher, null);
          report = inspectDrawing(await mod.readDrawing(ketcher));
        }
        if (signal.aborted) return;

        sessionRef.current = { ketcher, mod, baseline: report.fingerprint, original: start && !unreadable ? start : null };
        if (unreadable) {
          setNotice({
            tone: 'info',
            text: 'The current text couldn’t be opened as a structure, so the canvas starts empty. Cancel keeps the text as it is.',
          });
        }
        setPhase('ready');
      } catch {
        if (signal.reason === CANCELLED) return;
        if (step === 'editor') {
          // Start the next attempt from a clean editor — a half-initialised one never recovers.
          moduleRef.current?.discardEditor();
          setNotice(error('The structure editor didn’t load. Check your connection and try again.'));
        } else {
          setNotice(error('The current structure couldn’t be fetched from the server. Try again, or cancel to keep it as it is.'));
        }
        setPhase('failed');
      }
    })();

    return () => {
      controller.abort(CANCELLED);
      sessionRef.current = null;
      moduleRef.current?.detachEditor(canvasEl);
    };
  }, [open, attempt, canvasEl]);

  // Live analysis: re-read the drawing a moment after each edit and ask the server for its numbers.
  useEffect(() => {
    const session = sessionRef.current;
    if (!open || phase !== 'ready' || !session) return undefined;
    const { ketcher, mod } = session;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let run = 0;

    const note = (text: string) => setAnalysis({ kind: 'note', text });
    const analyse = async () => {
      const mine = ++run;
      controller?.abort();
      controller = new AbortController();
      try {
        const report = inspectDrawing(await mod.readDrawing(ketcher));
        if (mine !== run) return;
        if (report.atomCount === 0) return setAnalysis({ kind: 'idle' });
        if (report.hasReaction || ketcher.containsReaction()) {
          return note(
            reactionModeRef.current
              ? 'Reactants go left of the arrow, reagents and catalysts over it, the product on the right.'
              : 'A reaction has no single set of properties.',
          );
        }
        if (report.queryFeatures.length > 0) return note('A search pattern has no fixed formula — properties apply to specific molecules.');
        const smiles = (await ketcher.getSmiles()).trim();
        if (mine !== run) return;
        if (!smiles || smiles.length > MAX_STRUCTURE_LENGTH) return note('This structure is too large to analyse.');
        const values = await askServer<StructureProperties>(
          `/api/structure/properties?smiles=${encodeURIComponent(smiles)}`,
          controller.signal,
        );
        if (mine !== run) return;
        if (values) setAnalysis({ kind: 'values', values, stale: false });
        else note('Not a complete structure yet — check for atoms with too many bonds.');
      } catch {
        if (mine === run) note('Properties are unavailable right now.');
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      // Keep the last numbers on screen, dimmed, until the new ones arrive.
      setAnalysis((current) => (current.kind === 'values' ? { ...current, stale: true } : current));
      timer = setTimeout(() => void analyse(), ANALYSIS_DELAY_MS);
    };

    const subscription = ketcher.editor.subscribe('change', schedule);
    void analyse();
    return () => {
      run += 1;
      clearTimeout(timer);
      controller?.abort();
      ketcher.editor.unsubscribe('change', subscription);
    };
  }, [open, phase, attempt]);

  /**
   * Puts `content` on the canvas as an edit (undoable, and it counts as a change).
   * False when the canvas didn't take it. Ketcher neither throws nor reports when it
   * can't read the text (measured on 3.18: the canvas is simply left as it was), so an
   * unchanged canvas is the only sign of failure.
   */
  const placeOnCanvas = useCallback(async (session: Session, content: string): Promise<boolean> => {
    editorErrorRef.current = false;
    const before = inspectDrawing(await session.mod.readDrawing(session.ketcher));
    await session.ketcher.setMolecule(content);
    const after = inspectDrawing(await session.mod.readDrawing(session.ketcher));
    return !editorErrorRef.current && after.atomCount > 0 && after.fingerprint !== before.fingerprint;
  }, []);

  /** Loads a structure file onto the canvas. */
  const openFile = useCallback(
    async (file: File | undefined) => {
      const session = sessionRef.current;
      if (!file || !session || busyRef.current) return;
      if (file.size > MAX_FILE_BYTES) return setNotice(error(`“${file.name}” is too large to open (the limit is 2 MB).`));
      busyRef.current = true;
      setNotice(null);
      try {
        // Not trimmed: a molfile's first three lines are positional, and the first is often blank.
        const content = await readStructureFile(file);
        if (!content.trim()) throw new Error('empty');
        const placed = await placeOnCanvas(session, content);
        if (sessionRef.current !== session) return;
        setNotice(
          placed
            ? { tone: 'info', text: `Opened “${file.name}”.` }
            : error(
                `“${file.name}” didn’t change the canvas — it isn’t a structure file the editor can read, or it is already what’s drawn. MOL, SDF, CDXML, CDX, KET, SMILES and InChI files are supported.`,
              ),
        );
      } catch {
        if (sessionRef.current === session) setNotice(error(`“${file.name}” couldn’t be opened as a structure.`));
      } finally {
        busyRef.current = false;
      }
    },
    [placeOnCanvas],
  );

  /** Name or CAS number → structure on the canvas. Close catalogue matches are offered when there is no exact one. */
  const findByName = useCallback(
    async (query: string) => {
      const session = sessionRef.current;
      const q = query.trim();
      if (!session || busyRef.current || q.length < 2) return;
      busyRef.current = true;
      setFinding(true);
      setNotice(null);
      setSuggestions([]);
      try {
        const result = await askServer<NameLookupResult>(`/api/structure/lookup?q=${encodeURIComponent(q)}`);
        if (sessionRef.current !== session) return;
        if (result?.match) {
          const placed = await placeOnCanvas(session, result.match.molfile);
          if (sessionRef.current !== session) return;
          const from = result.match.source === 'catalogue' ? 'the catalogue' : 'its systematic name (OPSIN)';
          setNotice(
            placed
              ? { tone: 'info', text: `Drew ${result.match.name} from ${from}.` }
              : { tone: 'info', text: `${result.match.name} is already what’s drawn.` },
          );
          if (placed) setNameQuery('');
        } else if (result?.suggestions.length) {
          setSuggestions(result.suggestions);
        } else {
          setNotice(
            error(
              result?.externalLookup
                ? `No structure found for “${q}”. Try its systematic name or a CAS number from the catalogue.`
                : `“${q}” isn’t a product, synonym or CAS number in the catalogue. Names from outside the catalogue aren’t looked up in this deployment.`,
            ),
          );
        }
      } catch {
        if (sessionRef.current === session) setNotice(error('The name couldn’t be looked up — the server didn’t respond.'));
      } finally {
        busyRef.current = false;
        setFinding(false);
      }
    },
    [placeOnCanvas],
  );

  /** Parks the editor as the canvas element is removed, before React takes the DOM away from under it. */
  const setCanvas = useCallback((element: HTMLDivElement | null) => {
    setCanvasEl(element);
    return () => {
      if (element) moduleRef.current?.detachEditor(element);
      setCanvasEl(null);
    };
  }, []);

  /** Every way of leaving without applying goes through here. */
  const requestClose = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return onOpenChange(false); // still loading, or failed: there is nothing to lose
    if (busyRef.current) return;
    busyRef.current = true;
    let changed = true; // if the drawing can't be read, assume there is something to lose
    try {
      changed = inspectDrawing(await session.mod.readDrawing(session.ketcher)).fingerprint !== session.baseline;
    } catch {
      /* keep `changed` */
    } finally {
      busyRef.current = false;
    }
    if (sessionRef.current !== session) return; // closed or reloaded while we were reading
    if (changed) setConfirming(true);
    else onOpenChange(false);
  }, [onOpenChange]);

  /** The drawing as the string to hand back, or the reason it can't be used. */
  async function resolveDrawing(session: Session): Promise<{ structure: string } | { problem: string }> {
    const { ketcher, mod } = session;
    let report: DrawingReport;
    try {
      report = inspectDrawing(await mod.readDrawing(ketcher));
    } catch {
      return { problem: 'The editor couldn’t read this drawing. Try again, or simplify it.' };
    }

    // Unchanged: hand back exactly what we were given.
    if (session.original !== null && report.fingerprint === session.baseline) return { structure: session.original };

    if (report.hasReaction || ketcher.containsReaction()) {
      return { problem: 'This drawing contains a reaction (arrows or “+” signs). ASTRA stores single molecules — remove them.' };
    }
    if (report.atomCount === 0) return { problem: 'The canvas is empty. Draw a structure, or cancel.' };

    const isQuery = report.queryFeatures.length > 0;
    if (isQuery && !allowQuery) {
      const many = report.queryFeatures.length > 1;
      return {
        problem: `This drawing uses ${joinPhrases(report.queryFeatures)} — ${many ? 'features' : 'a feature'} for search patterns, which a stored structure can’t hold. Replace ${many ? 'them' : 'it'} with specific atoms and bonds.`,
      };
    }

    let written: string;
    try {
      written = (isQuery ? await ketcher.getSmarts() : await ketcher.getSmiles()).trim();
    } catch {
      return { problem: `This drawing can’t be written as ${isQuery ? 'SMARTS' : 'SMILES'}. Simplify it and try again.` };
    }
    const tooLong = (text: string) =>
      `This structure is too large (${text.length} characters as ${isQuery ? 'SMARTS' : 'SMILES'}; the limit is ${MAX_STRUCTURE_LENGTH}).`;
    if (!written) return { problem: 'The editor couldn’t read this drawing. Try again, or simplify it.' };
    if (written.length > MAX_STRUCTURE_LENGTH) return { problem: tooLong(written) };

    let checked: { structure: string } | null;
    try {
      checked = await askServer<{ structure: string }>(
        `/api/structure/check?structure=${encodeURIComponent(written)}${allowQuery ? '&query=1' : ''}`,
      );
    } catch {
      return { problem: 'The drawing couldn’t be checked — the server didn’t respond. It is still here; try again.' };
    }
    if (!checked) {
      return {
        problem: 'This drawing isn’t a structure ASTRA can read. Look for atoms with too many bonds or an unfinished fragment, then try again.',
      };
    }
    if (checked.structure.length > MAX_STRUCTURE_LENGTH) return { problem: tooLong(checked.structure) };
    return { structure: checked.structure };
  }

  /** Reaction mode: the drawing read into route inputs, or the reason it can't be. */
  async function resolveReaction(session: Session): Promise<{ reading: ReactionReading } | { problem: string }> {
    const { ketcher, mod } = session;
    let report: DrawingReport;
    try {
      report = inspectDrawing(await mod.readDrawing(ketcher));
    } catch {
      return { problem: 'The editor couldn’t read this drawing. Try again, or simplify it.' };
    }
    if (report.atomCount === 0) return { problem: 'The canvas is empty. Draw the reaction, or cancel.' };
    if (!(report.hasReaction || ketcher.containsReaction())) {
      return { problem: 'There is no reaction arrow yet. Add one from the left toolbar: inputs on its left, the product on its right.' };
    }
    if (report.queryFeatures.length > 0) {
      return { problem: `This drawing uses ${joinPhrases(report.queryFeatures)}, which a route input can’t hold. Use specific atoms and bonds.` };
    }
    let written: string;
    try {
      written = (await ketcher.getSmiles()).trim();
    } catch {
      return { problem: 'This reaction can’t be written out. Simplify it and try again.' };
    }
    try {
      const response = await fetch(
        `/api/structure/reaction?smiles=${encodeURIComponent(written)}${reactionProductId ? `&productId=${encodeURIComponent(reactionProductId)}` : ''}`,
        { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
      );
      const body = (await response.json()) as { data?: ReactionReading; error?: { fields?: { smiles?: string } } };
      if (response.status === 422) return { problem: body.error?.fields?.smiles ?? 'This drawing isn’t a reaction ASTRA can read.' };
      if (!response.ok || !body.data) throw new Error('failed');
      return { reading: body.data };
    } catch {
      return { problem: 'The reaction couldn’t be checked — the server didn’t respond. It is still here; try again.' };
    }
  }

  async function apply() {
    const session = sessionRef.current;
    if (!session || phase !== 'ready' || busyRef.current) return;
    busyRef.current = true;
    setApplying(true);
    setNotice(null);
    try {
      if (onApplyReaction) {
        const reaction = await resolveReaction(session);
        if (sessionRef.current !== session) return;
        if ('problem' in reaction) {
          setNotice(error(reaction.problem));
          return;
        }
        onApplyReaction(reaction.reading);
        onOpenChange(false);
        return;
      }
      const result = await resolveDrawing(session);
      if (sessionRef.current !== session) return; // the dialog was closed or reloaded meanwhile
      if ('problem' in result) {
        setNotice(error(result.problem));
        return;
      }
      onApply(result.structure);
      onOpenChange(false);
    } finally {
      busyRef.current = false;
      setApplying(false);
    }
  }

  return (
    <RDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else if (popupEscapeRef.current) popupEscapeRef.current = false;
        else void requestClose();
      }}
    >
      <RDialog.Portal>
        <RDialog.Overlay className="vbds-dialog-scrim" />
        <RDialog.Content
          className="astra-sketcher"
          data-dropping={dropping || undefined}
          // Capture phase: the file is ours before Ketcher's canvas (or the browser) sees the drop.
          onDragEnterCapture={(e) => {
            if (e.dataTransfer.types.includes('Files')) setDropping(true);
          }}
          onDragOverCapture={(e) => {
            if (!e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = phase === 'ready' ? 'copy' : 'none';
          }}
          onDragLeaveCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
          }}
          onDropCapture={(e) => {
            if (!e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            e.stopPropagation();
            setDropping(false);
            void openFile(e.dataTransfer.files[0]);
          }}
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
                {reactionMode ? (
                  <>
                    Draw what goes in on the left of an arrow, reagents and catalysts over it, and the product on the
                    right. <b>Use reaction</b> fills the route’s inputs from the drawing.
                  </>
                ) : (
                  <>
                    Draw with the tools around the canvas, paste a structure (Ctrl/⌘ V), or drop a ChemDraw or MOL file
                    here. <b>Use structure</b> copies it back as SMILES
                    {allowQuery ? ' — or as SMARTS, if it uses query features such as atom lists or “any” bonds' : ''}.
                  </>
                )}
              </RDialog.Description>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_ACCEPT}
              hidden
              onChange={(e) => {
                void openFile(e.target.files?.[0]);
                e.target.value = ''; // the same file can be picked again
              }}
            />
            <Button
              variant="outlined"
              size="sm"
              icon={<FileUp size={14} />}
              disabled={phase !== 'ready'}
              onClick={() => fileInputRef.current?.click()}
            >
              Open file
            </Button>
            <IconButton icon={<X size={16} />} label="Close the structure editor" variant="plain" onClick={() => void requestClose()} />
          </header>

          <div className="astra-sketcher__lookup">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation(); // this dialog can sit inside another form (the route editor)
                void findByName(nameQuery);
              }}
            >
              <TextField
                aria-label="Find a structure by name or CAS number"
                placeholder={reactionMode ? 'Add a substance by name or CAS number' : 'Name or CAS number'}
                fullWidth
                value={nameQuery}
                onChange={(e) => {
                  setNameQuery(e.target.value);
                  setSuggestions([]);
                }}
                leadingIcon={<Search size={14} />}
                autoComplete="off"
                spellCheck={false}
                disabled={phase !== 'ready'}
              />
              <Button type="submit" variant="outlined" size="sm" loading={finding} disabled={phase !== 'ready' || nameQuery.trim().length < 2}>
                Draw it
              </Button>
            </form>
            {suggestions.length > 0 && (
              <>
                <span className="astra-sketcher__lookup-hint">No exact match — did you mean:</span>
                <span className="astra-sketcher__suggestions">
                  {suggestions.map((s) => (
                    <Chip key={s.casNumber} label={s.name} onClick={() => void findByName(s.casNumber)} />
                  ))}
                </span>
              </>
            )}
          </div>

          <div className="astra-sketcher__canvas" ref={setCanvas}>
            {phase === 'loading' && (
              <div className="astra-sketcher__loading" role="status">
                <span className="vbds-spinner" aria-hidden="true" />
                Loading the structure editor…
              </div>
            )}
            {phase === 'failed' && (
              <div className="astra-sketcher__loading">
                <Button variant="outlined" onClick={() => setAttempt((n) => n + 1)}>
                  Try again
                </Button>
              </div>
            )}
          </div>

          <AnalysisStrip analysis={analysis} />

          <footer className="astra-sketcher__foot">
            {confirming ? (
              <>
                <p className="astra-sketcher__notice astra-sketcher__notice--confirm" role="alert">
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
                <p
                  className={`astra-sketcher__notice${notice?.tone === 'info' ? ' astra-sketcher__notice--info' : ''}`}
                  role="status"
                  aria-live="polite"
                >
                  {notice?.text}
                </p>
                <Button variant="ghost" disabled={applying} onClick={() => void requestClose()}>
                  Cancel
                </Button>
                <Button onClick={() => void apply()} loading={applying} disabled={phase !== 'ready'}>
                  {reactionMode ? 'Use reaction' : 'Use structure'}
                </Button>
              </>
            )}
          </footer>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/** ChemDraw's "Analysis" window, as one line under the canvas. */
function AnalysisStrip({ analysis }: { analysis: Analysis }) {
  if (analysis.kind !== 'values') {
    return (
      <div className="astra-analysis astra-analysis--empty">
        {analysis.kind === 'note' ? analysis.text : 'Formula, mass and calculated properties appear here as you draw.'}
      </div>
    );
  }
  const { values, stale } = analysis;
  const items: Array<[string, ReactNode]> = [
    ['Formula', <Formula key="f" value={values.formula} />],
    ['Mol. weight', values.molecularWeight.toFixed(2)],
    ['Exact mass', values.exactMass.toFixed(4)],
    ['cLogP', values.logP.toFixed(2)],
    ['TPSA', `${values.tpsa.toFixed(1)} Å²`],
    ['H-bond donors / acceptors', `${values.hBondDonors} / ${values.hBondAcceptors}`],
    ['Rotatable bonds', values.rotatableBonds],
  ];
  return (
    <dl className="astra-analysis" data-stale={stale || undefined}>
      {items.map(([term, value]) => (
        <div className="astra-analysis__item" key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
      {values.composition.length > 0 && (
        <div className="astra-analysis__item astra-analysis__item--wide">
          <dt>Elemental analysis</dt>
          <dd>{values.composition.map((c) => `${c.symbol} ${c.percent.toFixed(2)}`).join(' · ')} %</dd>
        </div>
      )}
    </dl>
  );
}
