import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface InstallAppButtonProps {
  compact?: boolean;
}

export function InstallAppButton({ compact = false }: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    if (standalone) {
      setIsInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent;
    const iosDevice = /iPhone|iPad|iPod/i.test(ua);
    setIsIos(iosDevice);

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowIosHelp(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled || (!deferredPrompt && !isIos)) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }

    if (isIos) {
      setShowIosHelp(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstallClick()}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer'
            : 'w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer'
        }
      >
        <Download className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
        <span>{compact ? 'Install' : 'Install Mobile App'}</span>
      </button>

      {showIosHelp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Install Aadhunik Krishak on iPhone
              </h3>
              <button
                type="button"
                onClick={() => setShowIosHelp(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside">
              <li>
                Tap the{' '}
                <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                  <Share className="w-3.5 h-3.5 text-sky-600" /> Share
                </span>{' '}
                button in Safari&apos;s toolbar.
              </li>
              <li>
                Scroll down and tap{' '}
                <strong className="text-slate-800">Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong className="text-slate-800">Add</strong> in the top
                right corner.
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}