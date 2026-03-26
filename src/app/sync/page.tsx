'use client';

import { useState } from 'react';
import { SyncModal } from '@/components/sync/SyncModal';

export default function SyncPage() {
  const [isModalOpen, setIsModalOpen] = useState(true);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {!isModalOpen && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="neon-btn px-8 py-4 rounded-lg font-semibold text-white"
        >
          Open Sync Dialog
        </button>
      )}

      <SyncModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
