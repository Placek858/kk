import React, { useState, useEffect } from 'react';

// Słownik tłumaczeń dla wielojęzyczności
const translations = {
  pl: {
    verify: "Weryfikacja Konta",
    manage: "Panel Zarządzania",
    owner: "Panel Właściciela",
    lang: "Polski",
    unsaved: "Masz niezapisane zmiany!",
    save: "Zapisz",
    pinPrompt: "Wprowadź PIN dostępu:",
    invalidPin: "Nieprawidłowy PIN. Pozostało prób: ",
    blocked: "To urządzenie zostało zablokowane.",
  },
  en: {
    verify: "Account Verification",
    manage: "Management Panel",
    owner: "Owner Panel",
    lang: "English",
    unsaved: "You have unsaved changes!",
    save: "Save",
    pinPrompt: "Enter access PIN:",
    invalidPin: "Invalid PIN. Attempts left: ",
    blocked: "This device has been blocked.",
  }
};

export default function IcarusLanding() {
  const [lang, setLang] = useState('en'); // Domyślnie angielski
  const [darkMode, setDarkMode] = useState(true);
  const [isUnsaved, setIsUnsaved] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [attempts, setAttempts] = useState(5);
  const [isLocked, setIsLocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  const t = translations[lang];

  // Obsługa PINu
  const handlePinSubmit = () => {
    if (pinInput === "15052021") {
      alert("Access Granted");
      // Przekierowanie do panelu właściciela
    } else {
      const newAttempts = attempts - 1;
      setAttempts(newAttempts);
      if (newAttempts <= 0) setIsLocked(true);
      alert(`${t.invalidPin} ${newAttempts}`);
    }
  };

  return (
    <div className={`${darkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} min-h-screen transition-all duration-500 font-sans`}>
      
      {/* Header */}
      <nav className="p-6 flex justify-between items-center backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => setLang('pl')} className="flex items-center gap-1 hover:opacity-80 transition">
            🇵🇱 <span className={lang === 'pl' ? 'font-bold underline' : ''}>Polski</span>
          </button>
          <button onClick={() => setLang('en')} className="flex items-center gap-1 hover:opacity-80 transition">
            🇬🇧 <span className={lang === 'en' ? 'font-bold underline' : ''}>English</span>
          </button>
        </div>

        <div className="flex items-center gap-6">
          {/* Neonowa Emotka Trybu */}
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`text-3xl transition-all duration-300 transform hover:scale-110 ${darkMode ? 'drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]' : 'drop-shadow-[0_0_10px_rgba(255,165,0,0.8)]'}`}
          >
            {darkMode ? '💠' : '☀️'}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto mt-20 text-center px-4">
        <h1 className="text-6xl font-extrabold mb-4 tracking-tight drop-shadow-sm">ICARUS</h1>
        <p className="text-xl opacity-70 mb-12">Professional Security & Verification System</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button className="p-8 rounded-2xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-all text-xl font-semibold">
            {t.verify}
          </button>
          <button className="p-8 rounded-2xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 transition-all text-xl font-semibold">
            {t.manage}
          </button>
        </div>

        <button 
          onClick={() => setShowPinModal(true)}
          className="mt-12 text-sm opacity-50 hover:opacity-100 transition underline"
        >
          {t.owner}
        </button>
      </main>

      {/* Floating Unsaved Changes Alert */}
      {isUnsaved && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-blue-600 px-6 py-4 rounded-full shadow-2xl flex items-center gap-4 animate-bounce">
          <span>{t.unsaved}</span>
          <button className="bg-white text-blue-600 px-4 py-1 rounded-full font-bold">{t.save}</button>
        </div>
      )}

      {/* PIN Modal Placeholder */}
      {showPinModal && !isLocked && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-800 p-8 rounded-3xl border border-white/10 text-center">
            <h2 className="text-2xl mb-4">{t.pinPrompt}</h2>
            <input 
              type="password" 
              className="bg-black/40 border border-white/20 p-3 rounded-xl mb-4 text-center tracking-widest"
              onChange={(e) => setPinInput(e.target.value)}
            />
            <button onClick={handlePinSubmit} className="block w-full bg-blue-600 py-3 rounded-xl font-bold">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
