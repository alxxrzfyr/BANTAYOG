export default function MerchantTransactPage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <h1 className="text-xl font-bold text-gray-900">Transaction</h1>
      <p className="mt-2 text-sm text-gray-600">Enter PIN and confirm items</p>
      <div className="mt-8 w-full max-w-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            4-Digit PIN
          </label>
          <input
            type="password"
            maxLength={4}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-2xl tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="••••"
          />
        </div>
        <button className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700">
          Verify &amp; Continue
        </button>
      </div>
    </div>
  );
}
