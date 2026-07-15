export default function CSSTest() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-4xl font-bold text-indigo-600 mb-4">
          CSS Test Page
        </h1>
        <p className="text-lg text-gray-700 mb-6">
          If you can see this page with proper styling, CSS is working correctly.
        </p>

        <div className="space-y-4">
          <div className="bg-green-100 border-l-4 border-green-500 p-4 rounded">
            <p className="text-green-700 font-semibold">✓ Green test box visible</p>
          </div>

          <div className="bg-blue-100 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-blue-700 font-semibold">✓ Blue test box visible</p>
          </div>

          <div className="bg-red-100 border-l-4 border-red-500 p-4 rounded">
            <p className="text-red-700 font-semibold">✓ Red test box visible</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-purple-100 p-4 rounded">
            <p className="text-purple-700">Responsive Grid Test (1 col on mobile, 2 on desktop)</p>
          </div>
          <div className="bg-purple-100 p-4 rounded">
            <p className="text-purple-700">If you see this side-by-side on desktop, responsive CSS works!</p>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold">
            Hover Test Button
          </button>
          <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold">
            Another Button
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-600 text-sm">
            If this page looks properly styled with colors, spacing, and responsive layout,
            then Tailwind CSS is working correctly!
          </p>
        </div>
      </div>
    </div>
  );
}