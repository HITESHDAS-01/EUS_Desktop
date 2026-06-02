import { Button } from '@/components/ui/basic';
import { APP_REPO_URL, APP_VERSION } from '@/config/branding';
import { useSettings } from '@/lib/SettingsContext';

export default function AboutModal({ onClose }: { onClose: () => void }) {
  const { brand } = useSettings();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-[#0b3b2f] text-white p-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white text-[#0b3b2f] flex items-center justify-center text-2xl font-bold mb-3 shadow-md">
            {brand.orgShort.slice(0, 3)}
          </div>
          <h2 className="text-xl font-bold">EUS Desktop</h2>
          <p className="text-xs text-white/70 mt-1">
            Offline admin for cooperative-savings societies
          </p>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <Row label="Version" value={APP_VERSION} />
          <Row label="Organisation" value={brand.orgName} />
          <Row label="Built with" value="Tauri 2 · React · Rust · SQLite" />
          <Row label="License" value="Proprietary — internal use" />

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-600 mb-2">Source repository</p>
            <p className="font-mono text-xs break-all bg-gray-50 border border-gray-200 rounded p-2 text-gray-700">
              {APP_REPO_URL}
            </p>
          </div>

          <p className="text-xs text-gray-500 text-center pt-2">
            Made for offline-first cooperative bookkeeping. No cloud, no subscription, no email needed.
          </p>
        </div>

        <div className="border-t border-gray-100 p-4 flex justify-end bg-gray-50/60">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800 text-right">{value}</span>
    </div>
  );
}
