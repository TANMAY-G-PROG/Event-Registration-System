import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, Upload, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Loader2, Camera } from 'lucide-react';

export default function Scanner() {
  // ---------------------------------------------------------------------------
  // LOGIC SECTION: EXACTLY AS PROVIDED (NO CHANGES)
  // ---------------------------------------------------------------------------
  const [pageState, setPageState] = useState('loading');
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastResult, setLastResult] = useState('');
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userUSN, setUserUSN] = useState(null);

  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const fileScannerRef = useRef(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const role = urlParams.get('role');
    const detectedRole = role === 'volunteer' ? 'volunteer' : 'participant';
    setUserRole(detectedRole);
    console.log('✅ User role detected:', detectedRole);
    fetchUserData();
    loadQRLibrary();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUserUSN(data.userUSN);
        console.log('✅ User USN loaded:', data.userUSN);
      } else {
        setErrorMsg('User not authenticated. Please sign in first.');
        setPageState('error');
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
      setErrorMsg('Failed to load user information. Please try again.');
      setPageState('error');
    }
  };

  useEffect(() => {
    if (pageState === 'loading' && userUSN && libraryLoaded) {
      console.log('🚀 Prerequisites met. Switching to scanning state.');
      setPageState('scanning');
    }
  }, [pageState, userUSN, libraryLoaded]);

  useEffect(() => {
    if (pageState === 'scanning') {
      const timer = setTimeout(() => initScanner(), 100);
      return () => clearTimeout(timer);
    }
    if (pageState !== 'scanning') {
      cleanupScanner();
    }
    return () => cleanupScanner();
  }, [pageState]);

  const cleanupScanner = () => {
    if (html5QrcodeScannerRef.current) {
      try {
        html5QrcodeScannerRef.current.clear();
        html5QrcodeScannerRef.current = null;
        console.log('🧹 Scanner cleaned up');
      } catch (err) {
        console.error('Cleanup error:', err);
      }
    }
  };

  const loadQRLibrary = () => {
    if (window.Html5QrcodeScanner) {
      console.log('✅ QR library already loaded');
      setLibraryLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
    script.onload = () => {
      console.log('✅ QR library loaded');
      setLibraryLoaded(true);
    };
    script.onerror = () => {
      setErrorMsg('Failed to load QR scanner library. Please refresh the page.');
      setPageState('error');
    };
    document.head.appendChild(script);
  };

  const initScanner = () => {
    if (!window.Html5QrcodeScanner || !scannerRef.current || html5QrcodeScannerRef.current) {
      console.log('⚠️ Scanner not ready or already initialized');
      return;
    }
    console.log('🎥 Initializing scanner');
    try {
      const scanner = new window.Html5QrcodeScanner(
        'reader',
        {
          qrbox: { width: 250, height: 250 },
          fps: 10,
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true,
          videoConstraints: {
            facingMode: { ideal: 'environment' },
          },
          supportedScanTypes: [0, 1],
          formatsToSupport: [0, 1],
        },
        false
      );
      scanner.render(onScanSuccess, onScanError);
      html5QrcodeScannerRef.current = scanner;
      setIsScanning(true);
      console.log('✅ Scanner rendered');
    } catch (err) {
      console.error('Scanner initialization error:', err);
      setErrorMsg('Failed to initialize scanner. Check camera permissions and try again.');
      setPageState('error');
    }
  };

  const onScanSuccess = async (decodedText) => {
    // Prevent multiple scans while processing
    if (pageState !== 'scanning') return;
   
    console.log(`✅ QR Code detected: ${decodedText}`);
    setIsScanning(false);
    setPageState('processing'); // Temporary state to prevent duplicate scans
    setLastResult(decodedText);
   
    // Stop scanner immediately
    cleanupScanner();
   
    if (decodedText.startsWith('eventId:')) {
      const eventId = decodedText.split(':')[1];
      await markAttendance(eventId);
    } else {
      setErrorMsg('Invalid QR code format. Please scan the event QR code.');
      setPageState('error');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    console.log('📁 File selected:', file.name);
    if (!window.Html5Qrcode) {
      setErrorMsg('QR scanner library not loaded. Please refresh and try again.');
      setPageState('error');
      return;
    }
    try {
      if (!fileScannerRef.current) {
        fileScannerRef.current = new window.Html5Qrcode('file-reader');
      }
      const decodedText = await fileScannerRef.current.scanFile(file, true);
      console.log('✅ QR decoded from file:', decodedText);
      await onScanSuccess(decodedText);
    } catch (err) {
      console.error('File scan error:', err);
      setErrorMsg('Could not read QR code from image. Please try another image.');
      setPageState('error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const markAttendance = async (eventId) => {
    if (!userUSN || !userRole) {
      setErrorMsg('User session error. Please sign in again.');
      setPageState('error');
      return;
    }
    console.log(`🎯 Marking attendance - Role: ${userRole}, USN: ${userUSN}, Event: ${eventId}`);
    try {
      const endpoint = userRole === 'volunteer' ? '/api/mark-volunteer-attendance' : '/api/mark-participant-attendance';
      console.log(`📡 Calling endpoint: ${endpoint}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: eventId,
          usn: userUSN,
        }),
      });
      const data = await response.json();
      console.log('📥 Response:', data);
      if (response.ok && data.success) {
        setPageState('success');
        setErrorMsg(null);
        console.log(`✅ ${userRole} attendance marked successfully`);
      } else {
        setErrorMsg(data.error || 'Failed to mark attendance');
        setPageState('error');
      }
    } catch (err) {
      console.error('Error marking attendance:', err);
      setErrorMsg('Network error. Please try again.');
      setPageState('error');
    }
  };

  const onScanError = (errorMessage) => {
    if (errorMessage.includes('NotFoundException') || errorMessage.includes('No MultiFormat Readers')) {
      return;
    }
    console.log(`Scan error: ${errorMessage}`);
  };

  const scanAgain = () => {
    console.log('🔄 Restarting scanner');
    setLastResult('');
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setPageState('scanning');
  };

  const restartScanner = () => {
    setErrorMsg(null);
    setUserUSN(null);
    setPageState('loading');
    fetchUserData();
  };

  const goBack = () => {
    window.history.back();
  };

  // ---------------------------------------------------------------------------
  // UI SECTION: COMPLETELY REDESIGNED (VERCEL / STRIPE AESTHETIC)
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-500/30 flex items-center justify-center p-4 sm:p-6 overflow-hidden relative">
      {/* Abstract Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[128px] pointer-events-none" />

      {/* Hidden container for file reading (Logic Requirement) */}
      <div id="file-reader" style={{ display: 'none' }} />

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {/* Main Glass Card */}
        <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/5 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden ring-1 ring-white/10">
          
          {/* Header */}
          <div className="px-6 pt-8 pb-2 text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 mb-4 shadow-lg shadow-indigo-500/10"
            >
              <Scan className="w-6 h-6 text-indigo-400" />
            </motion.div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Mark Attendance</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
                <span className={`px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider rounded-full border ${userRole === 'volunteer' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                    {userRole === 'volunteer' ? 'Volunteer' : 'Participant'}
                </span>
                {userUSN && <span className="text-xs text-zinc-500 font-mono">{userUSN}</span>}
            </div>
          </div>

          <div className="p-6 min-h-[400px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              
              {/* STATE: LOADING */}
              {pageState === 'loading' && (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center space-y-4 py-12"
                >
                  <div className="relative">
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                  </div>
                  <p className="text-zinc-400 text-sm animate-pulse">Authenticating...</p>
                </motion.div>
              )}

              {/* STATE: SCANNING */}
              {(pageState === 'scanning' || pageState === 'processing') && (
                <motion.div
                  key="scanning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-6"
                >
                  {/* Camera Frame */}
                  <div className="relative group rounded-2xl overflow-hidden bg-black border border-white/10 aspect-square shadow-inner">
                    
                    {/* The HTML5QRcode div - logic controlled */}
                    <div id="reader" ref={scannerRef} className="w-full h-full object-cover [&>video]:object-cover" />
                    
                    {/* Visual Overlay (No Logic) */}
                    {isScanning && (
                      <div className="absolute inset-0 pointer-events-none z-20">
                         {/* Corners */}
                        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-indigo-500 rounded-tl-lg" />
                        <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-indigo-500 rounded-tr-lg" />
                        <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-indigo-500 rounded-bl-lg" />
                        <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-indigo-500 rounded-br-lg" />
                        
                        {/* Scanning Line Animation */}
                        <motion.div 
                          className="absolute left-4 right-4 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_15px_rgba(99,102,241,0.6)]"
                          animate={{ top: ['10%', '90%', '10%'] }}
                          transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                        />
                      </div>
                    )}

                    {/* Processing Overlay */}
                    {pageState === 'processing' && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-center justify-center">
                            <div className="flex flex-col items-center">
                                <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                                <span className="text-sm font-medium text-white">Verifying...</span>
                            </div>
                        </div>
                    )}
                  </div>

                  {/* Manual Actions */}
                  <div className="flex flex-col gap-3">
                    <p className="text-center text-xs text-zinc-500 mb-1">
                      Align QR code within the frame
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {/* File Upload Button */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            id="qr-file-input"
                        />
                        <label 
                            htmlFor="qr-file-input"
                            className="cursor-pointer flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm font-medium text-zinc-300 group"
                        >
                            <Upload className="w-4 h-4 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
                            Upload Image
                        </label>

                         {/* Go Back Button (Secondary) */}
                        <button 
                            onClick={goBack} 
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm font-medium text-zinc-300"
                        >
                            <ArrowLeft className="w-4 h-4 text-zinc-400" />
                            Cancel
                        </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STATE: SUCCESS */}
              {pageState === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center py-6"
                >
                  <motion.div 
                    initial={{ scale: 0 }} 
                    animate={{ scale: 1 }} 
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20"
                  >
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </motion.div>
                  
                  <h2 className="text-2xl font-bold text-white mb-2">Verified</h2>
                  <p className="text-zinc-400 text-sm mb-8 px-4">
                    Attendance recorded successfully for<br/>
                    <span className="text-zinc-200 font-medium">Event ID: {lastResult.replace('eventId:', '')}</span>
                  </p>

                  <div className="w-full space-y-3">
                    <button 
                        onClick={scanAgain}
                        className="w-full py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <Scan className="w-4 h-4" />
                        Scan Another
                    </button>
                    <button 
                        onClick={goBack}
                        className="w-full py-3 px-4 bg-transparent text-zinc-400 font-medium rounded-xl hover:text-white transition-colors"
                    >
                        Back to Dashboard
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STATE: ERROR */}
              {pageState === 'error' && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center py-6"
                >
                  <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                  </div>
                  
                  <h2 className="text-xl font-bold text-white mb-2">Scan Failed</h2>
                  <p className="text-zinc-400 text-sm mb-8 px-4 leading-relaxed">
                    {errorMsg}
                  </p>

                  <div className="w-full grid grid-cols-2 gap-3">
                    <button 
                        onClick={goBack}
                        className="w-full py-3 px-4 bg-white/5 border border-white/10 text-zinc-300 font-medium rounded-xl hover:bg-white/10 transition-colors"
                    >
                        Exit
                    </button>
                    <button 
                        onClick={restartScanner}
                        className="w-full py-3 px-4 bg-red-600/90 hover:bg-red-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-zinc-600 mt-6 font-medium tracking-wide uppercase">
          Secured Attendance System
        </p>
      </motion.div>

      {/* Global Style Overrides for html5-qrcode library specific elements */}
      <style>{`
        /* Hide the library's default stop/start buttons as we control them via state */
        #reader__dashboard_section_csr button { display: none !important; }
        
        /* Hide the status text generated by the lib */
        #reader__status_span { display: none !important; }

        /* Force video to cover area */
        #reader video { 
            object-fit: cover; 
            border-radius: 1rem;
            width: 100% !important;
            height: 100% !important;
        }

        /* Style the camera selection dropdown if it appears */
        #reader__dashboard_section_csr select {
            background: #18181b;
            color: #a1a1aa;
            border: 1px solid #27272a;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 12px;
            margin-bottom: 10px;
            width: 100%;
            outline: none;
        }
      `}</style>
    </div>
  );
}
