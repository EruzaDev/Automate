import React, { useState, useCallback } from 'react';
import Navbar from './components/Shared/Navbar';
import LayoutStudio from './components/InteractiveStudio/LayoutStudio';
import FrameEditor from './components/FrameCompositor/FrameEditor';
import BatchProgressBar from './components/Shared/BatchProgressBar';
import UnsavedWarningModal from './components/Shared/UnsavedWarningModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('interactive');
  const [pendingTab, setPendingTab] = useState(null);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [hasProgress, setHasProgress] = useState(false);

  // Global Theme State ('dark' | 'light')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('autogen_theme') || 'dark';
  });

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('autogen_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Batch Export Progress Modal State
  const [exportStatus, setExportStatus] = useState({
    isExporting: false,
    isFinished: false,
    progress: 0,
    total: 0
  });

  const cancelExportRef = React.useRef(null);

  const handleRegisterCancel = useCallback((cancelFn) => {
    cancelExportRef.current = cancelFn;
  }, []);

  const handleCancelExport = useCallback(() => {
    if (cancelExportRef.current) {
      cancelExportRef.current();
    }
    setExportStatus({ isExporting: false, isFinished: false, progress: 0, total: 0 });
  }, []);

  const tabNames = {
    interactive: 'Certificate Layout Studio',
    frames: 'Frame Compositor'
  };

  const handleProgressChange = useCallback((progressState) => {
    setHasProgress(Boolean(progressState));
  }, []);

  const handleRequestTabChange = (newTab) => {
    if (newTab === activeTab) return;

    if (hasProgress) {
      setPendingTab(newTab);
      setIsWarningOpen(true);
    } else {
      setActiveTab(newTab);
    }
  };

  const handleConfirmTabChange = () => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      setHasProgress(false);
    }
    setPendingTab(null);
    setIsWarningOpen(false);
  };

  const handleCancelTabChange = () => {
    setPendingTab(null);
    setIsWarningOpen(false);
  };

  const handleStartExport = () => {
    setExportStatus({ isExporting: true, isFinished: false, progress: 0, total: 0 });
  };

  const handleCloseExportModal = () => {
    setExportStatus({ isExporting: false, isFinished: false, progress: 0, total: 0 });
  };

  const handleLoadPresetData = () => {
    if (hasProgress) {
      if (!window.confirm("Reloading preset data will refresh the app and reset your current session. Continue?")) {
        return;
      }
    }
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleRequestTabChange}
        onLoadPresetData={handleLoadPresetData}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8">
        {activeTab === 'interactive' && (
          <LayoutStudio
            onStartExport={handleStartExport}
            setExportStatus={setExportStatus}
            onProgressChange={handleProgressChange}
            onRegisterCancel={handleRegisterCancel}
          />
        )}

        {activeTab === 'frames' && (
          <FrameEditor
            onStartExport={handleStartExport}
            setExportStatus={setExportStatus}
            onProgressChange={handleProgressChange}
            onRegisterCancel={handleRegisterCancel}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>AutomateCert Studio • Interactive Drag & Resize Batch Generator</span>
          <div className="flex items-center gap-2">
            <span>Developed by <a href="https://github.com/EruzaDev" target="_blank" rel="noopener noreferrer" className="font-bold text-amber-400 hover:text-amber-300 hover:underline">EruzaDev</a></span>
            <span>•</span>
            <span>HTML5 Canvas • XLSX Reader • JSZip Exporter</span>
          </div>
        </div>
      </footer>

      {/* Global Batch Progress Modal */}
      <BatchProgressBar
        progress={exportStatus.progress}
        total={exportStatus.total}
        isExporting={exportStatus.isExporting}
        isFinished={exportStatus.isFinished}
        onClose={handleCloseExportModal}
        onCancel={handleCancelExport}
      />

      {/* Unsaved Progress Warning Modal (Only pops up when hasProgress is true) */}
      <UnsavedWarningModal
        isOpen={isWarningOpen}
        targetTabName={tabNames[pendingTab] || pendingTab}
        onConfirm={handleConfirmTabChange}
        onCancel={handleCancelTabChange}
      />
    </div>
  );
}
