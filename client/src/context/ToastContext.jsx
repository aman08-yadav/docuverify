import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';
const ToastContext = createContext(() => {});
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, kind = 'success') => { const id = Date.now(); setToast({ id, message, kind }); window.setTimeout(() => setToast((current) => current?.id === id ? null : current), 4200); }, []);
  return <ToastContext.Provider value={showToast}>{children}{toast && <div className={`toast toast-${toast.kind}`} role="status"><span className="toast-icon">{toast.kind === 'error' ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}</span><span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={16} /></button></div>}</ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
