export default function MerchantHomePage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">BANTAYOG</h1>
      <p className="mt-2 text-center text-sm text-gray-600">
        Nutrition Subsidy Tracker
      </p>
      <div className="mt-8 w-full max-w-sm space-y-3">
        <a
          href="/scan"
          className="block w-full rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          Scan QR Code
        </a>
        <a
          href="/login"
          className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Sign In
        </a>
      </div>
    </div>
  );
}
