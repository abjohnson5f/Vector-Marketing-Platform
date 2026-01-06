import React, { useState, useEffect } from 'react';
import { Shield, X } from 'lucide-react';
import { updateConsent } from '../services/tracking';

interface ConsentPreferences {
  analytics: boolean;
  advertising: boolean;
}

const CONSENT_STORAGE_KEY = 'vector_consent_preferences';

export function ConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    analytics: false,
    advertising: false,
  });

  useEffect(() => {
    // Check if consent has already been given
    const storedConsent = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!storedConsent) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    } else {
      // Apply stored preferences
      const parsed = JSON.parse(storedConsent) as ConsentPreferences;
      updateConsent(parsed.analytics, parsed.advertising);
    }
  }, []);

  const handleAcceptAll = () => {
    const allConsent: ConsentPreferences = { analytics: true, advertising: true };
    saveConsent(allConsent);
  };

  const handleRejectAll = () => {
    const noConsent: ConsentPreferences = { analytics: false, advertising: false };
    saveConsent(noConsent);
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
  };

  const saveConsent = (consent: ConsentPreferences) => {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    updateConsent(consent.analytics, consent.advertising);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto origin-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg mt-0.5">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg mb-2">
                Cookie Preferences
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                We use cookies to enhance your experience, analyze site traffic, and for marketing purposes. 
                By clicking "Accept All", you consent to our use of cookies. 
                You can customize your preferences or reject non-essential cookies.
              </p>
            </div>
          </div>
          <button
            onClick={handleRejectAll}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Analytics Cookies</p>
                <p className="text-xs text-gray-400">Help us understand how visitors use our site</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(e) => setPreferences(prev => ({ ...prev, analytics: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Advertising Cookies</p>
                <p className="text-xs text-gray-400">Used for personalized ads and remarketing</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.advertising}
                  onChange={(e) => setPreferences(prev => ({ ...prev, advertising: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
              </label>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            {showDetails ? 'Hide Details' : 'Customize'}
          </button>
          
          {showDetails ? (
            <button
              onClick={handleSavePreferences}
              className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Save Preferences
            </button>
          ) : (
            <>
              <button
                onClick={handleRejectAll}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Accept All
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}




