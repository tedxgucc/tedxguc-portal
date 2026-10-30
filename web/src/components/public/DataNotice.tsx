'use client';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
export function DataNotice({ message, retry, loading = false }: { message: string; retry: () => void; loading?: boolean }) {
  return <div className="public-data-notice" role="alert"><p>{message}</p><Button small variant="secondary" loading={loading} onClick={retry}><RefreshCw size={16} aria-hidden="true" />Try again</Button></div>;
}
