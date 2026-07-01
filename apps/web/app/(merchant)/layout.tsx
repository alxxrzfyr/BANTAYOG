export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <main className="flex-1 pb-16">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-around py-2 text-xs text-gray-500">
          <a href="/scan" className="flex flex-col items-center gap-0.5">Scan</a>
          <a href="/items" className="flex flex-col items-center gap-0.5">Items</a>
          <a href="/transact" className="flex flex-col items-center gap-0.5">History</a>
        </div>
      </nav>
    </div>
  );
}
