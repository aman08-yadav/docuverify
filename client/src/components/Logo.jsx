import { ShieldCheck } from 'lucide-react';
export default function Logo({ compact = false }) { return <span className="brand-lockup"><span className="brand-mark"><ShieldCheck size={21} strokeWidth={2.3} /></span>{!compact && <span className="brand-wordmark">docu<span>verify</span></span>}</span>; }
