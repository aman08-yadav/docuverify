import { Link } from 'react-router-dom';
import { ArrowLeft, FileQuestion } from 'lucide-react';
export default function NotFound() { return <main className="not-found"><span className="not-found-icon"><FileQuestion size={30} /></span><div className="eyebrow">404 · PAGE NOT FOUND</div><h1>This page went off the record.</h1><p>The page may have moved, or the address might be incomplete.</p><Link className="btn btn-primary" to="/"><ArrowLeft size={16} /> Back to DocuVerify</Link></main>; }
