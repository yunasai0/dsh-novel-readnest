import { useRouter } from 'next/router';
import { AuthProvider } from '@/context/AuthContext';
import { EnvProvider } from '@/context/EnvContext';
import { CSPostHogProvider } from '@/context/PHContext';
import { SyncProvider } from '@/context/SyncContext';
import Reader from '@/app/reader/components/Reader';

export default function Page() {
  const router = useRouter();
  const ids = typeof router.query['ids'] === 'string' ? router.query['ids'] : undefined;
  return (
    <CSPostHogProvider>
      <EnvProvider>
        <AuthProvider>
          <SyncProvider>
            <Reader ids={ids} />
          </SyncProvider>
        </AuthProvider>
      </EnvProvider>
    </CSPostHogProvider>
  );
}
