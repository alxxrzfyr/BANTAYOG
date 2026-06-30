export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <h1 className="text-xl font-bold text-gray-900">You are offline</h1>
      <p className="mt-2 text-sm text-gray-600">
        Please check your connection and try again.
      </p>
    </div>
  );
}
