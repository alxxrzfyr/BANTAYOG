export default function MerchantLoginPage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <h1 className="text-xl font-bold text-gray-900">Merchant Sign In</h1>
      <p className="mt-2 text-sm text-gray-600">
        Connect your Ronin wallet to continue
      </p>
      <div className="mt-8 w-full max-w-sm">
        <button className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700">
          Connect Wallet
        </button>
      </div>
    </div>
  );
}
