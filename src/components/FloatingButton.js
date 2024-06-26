// src/components/FloatingButton.js
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import 'tailwindcss/tailwind.css';
import FloatingWindow from './FloatingWindow'; // Import the FloatingWindow component

const FloatingButton = () => {
  const [showWindow, setShowWindow] = useState(false);
  const location = useLocation();

  const toggleWindow = () => {
    setShowWindow(!showWindow);
  };

  // Check if the current path includes "pre-test" or "post-test"
  const isTestPage = location.pathname.includes('pre-test') || location.pathname.includes('post-test');

  // Render the button and window only if not on test pages
  if (isTestPage) {
    return null;
  }

  return (
    <>
      <button
        className="fixed bottom-4 right-4 w-14 h-14 bg-[#01002B] rounded-full shadow-lg flex items-center justify-center z-50"
        onClick={toggleWindow}
      >
        <img src="/algeprologo.png" alt="AlgePRO Logo" className="w-10 h-10" />
      </button>
      {showWindow && <FloatingWindow onClose={toggleWindow} />} {/* Render FloatingWindow conditionally */}
    </>
  );
};

export default FloatingButton;
