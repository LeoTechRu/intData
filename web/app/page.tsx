import Link from 'next/link';

export default function Home() {
  return (
    <main className="p-4">
      <Link href="/inbox" className="text-blue-600 underline">
        Входящие
      </Link>
    </main>
  );
}
