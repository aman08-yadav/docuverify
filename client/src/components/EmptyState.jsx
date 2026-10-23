import { FileSearch } from 'lucide-react';
export default function EmptyState({ title = 'Nothing here yet', message = 'Your records will appear here when you get started.', action }) { return <div className="empty-state"><div className="empty-icon"><FileSearch size={22} /></div><h3>{title}</h3><p>{message}</p>{action}</div>; }
