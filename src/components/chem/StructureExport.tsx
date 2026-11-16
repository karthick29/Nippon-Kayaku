'use client';

import { Check, Copy, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/vbds';

/* ════════════════════════════════════════════════════════════════════
   Take a structure out of ASTRA — into a report, a slide or ChemDraw.

   · Copy SMILES — the stored string, as text.
   · MOL  — a 2D molfile; ChemDraw, Ketcher, MarvinSketch and every
            registration system open it.
   · SVG  — vector drawing for documents. The on-screen depiction is drawn
            in `currentColor` so it themes; a file has no theme, so the
            colour is fixed to black here.
   · PNG  — the same drawing rasterised at 3× on white, for tools that
            don't take SVG.

   Everything comes from the existing /api/structure endpoints (RDKit on
   the server); nothing chemical is computed in the browser.
   ════════════════════════════════════════════════════════════════════ */

const WIDTH = 600;
const HEIGHT = 450;

async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = (await response.json()) as { data?: T };
  if (!response.ok || !body.data) throw new Error(`Request failed (${response.status})`);
  return body.data;
}

/** The depiction as a standalone SVG document: fixed size, fixed colours, its own namespace. */
async function standaloneSvg(smiles: string): Promise<string> {
  const { svg } = await fetchData<{ svg: string }>(
    `/api/structure/depict?smiles=${encodeURIComponent(smiles)}&w=${WIDTH}&h=${HEIGHT}`,
  );
  const fixed = svg.replace(/currentColor/g, '#000000').replace(/var\(--[a-z0-9-]+\)/g, '#000000');
  const withSize = fixed.replace(/<svg\b/, `<svg width="${WIDTH}" height="${HEIGHT}"`);
  return /xmlns=/.test(withSize) ? withSize : withSize.replace(/<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"');
}

function rasterise(svg: string, scale: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH * scale;
      canvas.height = HEIGHT * scale;
      const context = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!context) return reject(new Error('No canvas'));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The drawing could not be rendered'));
    };
    image.src = url;
  });
}

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Format = 'mol' | 'svg' | 'png';

export function StructureExport({ smiles, filename }: { smiles: string; /** Without extension. */ filename: string }) {
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState<Format | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    setFailed(null);
    try {
      await navigator.clipboard.writeText(smiles);
      setCopied(true);
    } catch {
      setFailed('Copying was blocked by the browser — select the SMILES text instead.');
    }
  }

  async function download(format: Format) {
    setFailed(null);
    setWorking(format);
    try {
      if (format === 'mol') {
        const { molfile } = await fetchData<{ molfile: string }>(`/api/structure/molfile?smiles=${encodeURIComponent(smiles)}`);
        save(new Blob([molfile], { type: 'chemical/x-mdl-molfile' }), `${filename}.mol`);
      } else {
        const svg = await standaloneSvg(smiles);
        save(format === 'svg' ? new Blob([svg], { type: 'image/svg+xml' }) : await rasterise(svg, 3), `${filename}.${format}`);
      }
    } catch {
      setFailed(`The ${format.toUpperCase()} file couldn’t be created. Try again.`);
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="astra-structure-export">
      <div className="astra-structure-export__actions" role="group" aria-label="Export this structure">
        <Button variant="outlined" size="sm" icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy SMILES'}
        </Button>
        {(['mol', 'svg', 'png'] as const).map((format) => (
          <Button
            key={format}
            variant="outlined"
            size="sm"
            icon={<Download size={13} />}
            loading={working === format}
            disabled={working !== null && working !== format}
            onClick={() => void download(format)}
          >
            {format.toUpperCase()}
          </Button>
        ))}
      </div>
      {failed && (
        <p className="astra-structure-export__error" role="alert">
          {failed}
        </p>
      )}
    </div>
  );
}
