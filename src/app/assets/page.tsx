import AssetsClient from './AssetsClient';

export default async function AssetsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3011';
  let assets = [];
  try {
    const res = await fetch(`${baseUrl}/api/assets`, { cache: 'no-store' });
    if (res.ok) assets = await res.json();
  } catch {
    /* SSR fetch may fail during build */
  }

  return <AssetsClient initialAssets={assets} />;
}
