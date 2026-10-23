export default function Loading({ label = 'Loading your workspace…' }) { return <div className="loading-state" role="status"><span className="spinner" /><span>{label}</span></div>; }
