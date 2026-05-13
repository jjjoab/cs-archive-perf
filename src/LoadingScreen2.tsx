import React, { useEffect, useState } from 'react';

interface LoadingScreen2Props {
  onComplete: () => void;
}

const LoadingScreen2: React.FC<LoadingScreen2Props> = ({ onComplete }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hide = setTimeout(() => setVisible(false), 1800);
    const done = setTimeout(onComplete, 2100);
    return () => { clearTimeout(hide); clearTimeout(done); };
  }, [onComplete]);

  return (
    <div
      onClick={onComplete}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#101010',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      <div style={{ textAlign: 'center', letterSpacing: '0.2em', lineHeight: 1.6 }}>
        {['CORSICA', 'STUDIOS', 'ARCHIVE'].map((word) => (
          <div
            key={word}
            style={{
              color: '#fff',
              fontSize: 'clamp(18px, 5vw, 32px)',
              fontFamily: 'inherit',
              animation: 'cs-fade-in 0.6s ease forwards',
            }}
          >
            {word}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes cs-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen2;
