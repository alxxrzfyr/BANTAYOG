export default function MerchantItemsPage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <h1 className="text-xl font-bold text-gray-900">Add Items</h1>
      <p className="mt-2 text-sm text-gray-600">
        Select or photograph items for this transaction
      </p>
      <div className="mt-8 w-full max-w-sm space-y-3">
        <button className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Take Photo
        </button>
        <button className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Enter Manually
        </button>
      </div>
    </div>
  );
}
