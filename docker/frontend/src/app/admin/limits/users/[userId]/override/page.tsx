'use client';

import { useParams } from 'next/navigation';
import { UserLimitOverride } from '@/components/admin/limits';

export default function UserLimitOverridePage() {
  const params = useParams();
  const userId = params?.userId as string;

  return (
    <div className="p-6">
      <UserLimitOverride userId={userId} />
    </div>
  );
}
