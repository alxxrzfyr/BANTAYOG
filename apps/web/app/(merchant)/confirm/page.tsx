export default function MerchantConfirmPage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <h1 className="text-xl font-bold text-gray-900">Confirm Transaction</h1>
      <p className="mt-2 text-sm text-gray-600">
        Review items and submit
      </p>
      <div className="mt-8 w-full max-w-sm space-y-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">No items added</p>
        </div>
        <button className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700">
          Submit Transaction
        </button>
      </div>
    </div>
  );
}
