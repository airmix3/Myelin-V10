'use client';

import DeliverablesList from '@/components/deliverables/DeliverablesList';
import type { DeliverableListItem } from '@/components/deliverables/DeliverableRow';

interface DeliverablesClientProps {
  deliverables: DeliverableListItem[];
}

export default function DeliverablesClient({ deliverables }: DeliverablesClientProps) {
  return (
    <div className="-m-6 h-[calc(100%+48px)] flex flex-col">
      <DeliverablesList deliverables={deliverables} />
    </div>
  );
}
