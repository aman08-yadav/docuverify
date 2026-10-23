import { CheckCircle2, AlertCircle, Clock3, LoaderCircle, XCircle, Eye } from 'lucide-react';
const MAP = {
  processed: ['success', CheckCircle2, 'Processed'], eligible: ['success', CheckCircle2, 'Eligible'], pass: ['success', CheckCircle2, 'Pass'], match: ['success', CheckCircle2, 'Match'], confirmed: ['success', CheckCircle2, 'Confirmed'],
  needs_review: ['warning', Eye, 'Needs review'], review: ['warning', Eye, 'Review'], potential_match: ['warning', Eye, 'Potential match'],
  failed: ['danger', XCircle, 'Failed'], not_eligible: ['danger', XCircle, 'Not eligible'], mismatch: ['danger', AlertCircle, 'Mismatch'], fail: ['danger', XCircle, 'Fail'],
  queued: ['neutral', Clock3, 'Queued'], uploaded: ['neutral', Clock3, 'Uploaded'], processing: ['info', LoaderCircle, 'Processing'], unknown: ['warning', Eye, 'Unknown'], not_enough_information: ['neutral', Clock3, 'Not enough info']
};
export default function StatusBadge({ status, children }) { const [tone, Icon, label] = MAP[status] || ['neutral', Clock3, String(status || 'Unknown').replaceAll('_', ' ')]; return <span className={`status-badge status-${tone}`}><Icon size={13} />{children || label}</span>; }
