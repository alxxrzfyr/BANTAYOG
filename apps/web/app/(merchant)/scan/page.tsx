export default function MerchantScanPage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <h1 className="text-xl font-bold text-gray-900">Scan Nutri-Pass</h1>
      <p className="mt-2 text-sm text-gray-600">
        Point your camera at the beneficiary&apos;s QR code
      </p>
      <div className="mt-8 w-full max-w-sm">
        <div className="aspect-square w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-100 flex items-center justify-center">
          <span className="text-sm text-gray-500">Camera Preview</span>
        </div>
      </div>
    </div>
  );
}
