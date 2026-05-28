import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

export default function Modal({ isOpen, onClose, children, title }) {
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  };

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return undefined;
    }

    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen && !closing) return null;

  return ReactDOM.createPortal(
    <div className="modal-backdrop" onClick={handleClose}>
      <div className={`modal-panel ${closing ? 'aqua-modal-exit' : 'aqua-modal-enter'}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title || ''}</h2>
          <button type="button" className="modal-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
