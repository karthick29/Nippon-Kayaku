import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/page/PageHeader';
import { APPLICATIONS, CATEGORIES } from '@/data/masters';
import { auth } from '@/server/auth';
import { can } from '@/server/rbac';
import { repo } from '@/server/repo';
import { ProductEditForm } from './ProductEditForm';

export const metadata: Metadata = { title: 'Edit product' };
export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

export default async function EditProductPage({ params }: { params: Params }) {
  const [{ slug }, session] = await Promise.all([params, auth()]);
  if (!can(session?.user.role, 'product:update')) redirect(`/products/${slug}`);

  const product = await repo.getProduct(slug);
  if (!product) notFound();

  return (
    <div className="astra-page">
      <PageHeader
        title={`Edit ${product.name}`}
        subtitle="Changes are recorded in the product's history with a field-level diff."
        crumbs={[
          { label: 'ASTRA', href: '/dashboard' },
          { label: 'Products', href: '/products' },
          { label: product.name, href: `/products/${product.slug}` },
          { label: 'Edit' },
        ]}
      />

      <ProductEditForm product={product} applications={APPLICATIONS} categories={CATEGORIES} />
    </div>
  );
}
