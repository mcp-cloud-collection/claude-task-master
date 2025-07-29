/**
 * Application constants
 */

import type { Status } from '@/components/ui/shadcn-io/kanban';

export const kanbanStatuses: Status[] = [
	{ id: 'pending', name: 'Pending', color: 'yellow' },
	{ id: 'in-progress', name: 'In Progress', color: 'blue' },
	{ id: 'review', name: 'Review', color: 'purple' },
	{ id: 'done', name: 'Done', color: 'green' },
	{ id: 'deferred', name: 'Deferred', color: 'gray' }
];

export const CACHE_DURATION = 30000; // 30 seconds
export const REQUEST_TIMEOUT = 30000; // 30 seconds
export const HEADER_HEIGHT = 73; // Header with padding and border
