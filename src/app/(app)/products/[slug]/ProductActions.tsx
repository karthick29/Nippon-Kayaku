'use client';

import { AlertTriangle, Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Role } from '@/lib/types';
import { Button, Dialog, IconButton, Menu, MenuItem, MenuSeparator } from '@/components/vbds';
import { can } from '@/server/rbac';

export function ProductActions({
  productId,
  productName,
  productSlug,
  role,
}: {
  productId: string;
  productName: string;
  productSlug: string;
  role: Role;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message: string } };
        throw new Error(body.error?.message ?? 'Could not delete');
      }
      toast.success(`${productName} deleted`);
      router.push('/products');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  async function duplicate() {
    try {
      const response = await fetch(`/api/products/${productId}/duplicate`, { method: 'POST' });
      const body = (await response.json()) as { data?: { slug: string }; error?: { message: string } };
      if (!response.ok) throw new Error(body.error?.message ?? 'Could not duplicate');
      toast.success('Product duplicated');
      router.push(`/products/${body.data!.slug}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  }

  return (
    <>
      {can(role, 'product:update') && (
        <Button variant="outlined" icon={<Pencil size={14} />} href={`/products/${productSlug}/edit`}>
          Edit
        </Button>
      )}

      <Menu trigger={<IconButton icon={<MoreHorizontal size={16} />} label="More actions" variant="outlined" />}>
        {can(role, 'product:create') && (
          <MenuItem icon={<Copy size={14} />} onSelect={() => void duplicate()}>
            Duplicate
          </MenuItem>
        )}
        {can(role, 'product:delete') && (
          <>
            <MenuSeparator />
            <MenuItem icon={<Trash2 size={14} />} danger onSelect={() => setConfirmOpen(true)}>
              Delete product
            </MenuItem>
          </>
        )}
      </Menu>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="danger"
        icon={<AlertTriangle size={18} />}
        title={`Delete ${productName}?`}
        description="The product is removed from search, tables and reports. This is a soft delete — the record and its supplier links stay in the audit trail and can be restored by an administrator."
        cancelLabel="Cancel"
        confirmLabel="Delete product"
        confirmLoading={busy}
        onConfirm={() => void remove()}
      />
    </>
  );
}
