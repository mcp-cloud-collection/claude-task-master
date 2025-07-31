import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVSCodeContext } from '../contexts/VSCodeContext';
import type { TaskMasterTask, TaskUpdates } from '../types';

// Query keys factory
export const taskKeys = {
	all: ['tasks'] as const,
	lists: () => [...taskKeys.all, 'list'] as const,
	list: (filters: { tag?: string; status?: string }) =>
		[...taskKeys.lists(), filters] as const,
	details: () => [...taskKeys.all, 'detail'] as const,
	detail: (id: string) => [...taskKeys.details(), id] as const
};

// Hook to fetch all tasks
export function useTasks(options?: { tag?: string; status?: string }) {
	const { sendMessage } = useVSCodeContext();

	return useQuery({
		queryKey: taskKeys.list(options || {}),
		queryFn: async () => {
			const response = await sendMessage({
				type: 'getTasks',
				data: {
					tag: options?.tag,
					withSubtasks: true
				}
			});
			return response as TaskMasterTask[];
		}
	});
}

// Hook to fetch a single task with full details
export function useTaskDetails(taskId: string) {
	const { sendMessage } = useVSCodeContext();

	return useQuery({
		queryKey: taskKeys.detail(taskId),
		queryFn: async () => {
			const response = await sendMessage({
				type: 'mcpRequest',
				tool: 'get_task',
				params: {
					id: taskId
				}
			});

			// Parse the MCP response
			let fullTaskData = null;
			if (response?.data?.content?.[0]?.text) {
				try {
					const parsed = JSON.parse(response.data.content[0].text);
					fullTaskData = parsed.data;
				} catch (e) {
					console.error('Failed to parse MCP response:', e);
				}
			} else if (response?.data?.data) {
				fullTaskData = response.data.data;
			}

			return fullTaskData as TaskMasterTask;
		},
		enabled: !!taskId
	});
}

// Hook to update task status
export function useUpdateTaskStatus() {
	const { sendMessage } = useVSCodeContext();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			taskId,
			newStatus
		}: {
			taskId: string;
			newStatus: TaskMasterTask['status'];
		}) => {
			const response = await sendMessage({
				type: 'updateTaskStatus',
				data: { taskId, newStatus }
			});
			return { taskId, newStatus, response };
		},
		// Optimistic update to prevent snap-back
		onMutate: async ({ taskId, newStatus }) => {
			// Cancel any outgoing refetches
			await queryClient.cancelQueries({ queryKey: taskKeys.all });

			// Snapshot the previous value
			const previousTasks = queryClient.getQueriesData({
				queryKey: taskKeys.all
			});

			// Optimistically update all task queries
			queryClient.setQueriesData({ queryKey: taskKeys.all }, (old: any) => {
				if (!old) return old;

				// Handle both array and object responses
				if (Array.isArray(old)) {
					return old.map((task: TaskMasterTask) =>
						task.id === taskId ? { ...task, status: newStatus } : task
					);
				}

				return old;
			});

			// Return a context object with the snapshot
			return { previousTasks };
		},
		// If the mutation fails, roll back to the previous value
		onError: (err, variables, context) => {
			if (context?.previousTasks) {
				context.previousTasks.forEach(([queryKey, data]) => {
					queryClient.setQueryData(queryKey, data);
				});
			}
		},
		// Always refetch after error or success to ensure consistency
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: taskKeys.all });
		}
	});
}

// Hook to update task content
export function useUpdateTask() {
	const { sendMessage } = useVSCodeContext();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			taskId,
			updates,
			options = {}
		}: {
			taskId: string;
			updates: TaskUpdates | { description: string };
			options?: { append?: boolean; research?: boolean };
		}) => {
			await sendMessage({
				type: 'updateTask',
				data: { taskId, updates, options }
			});
		},
		onSuccess: (_, variables) => {
			// Invalidate the specific task and all lists
			queryClient.invalidateQueries({
				queryKey: taskKeys.detail(variables.taskId)
			});
			queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
		}
	});
}

// Hook to update subtask
export function useUpdateSubtask() {
	const { sendMessage } = useVSCodeContext();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			taskId,
			prompt,
			options = {}
		}: {
			taskId: string;
			prompt: string;
			options?: { research?: boolean };
		}) => {
			await sendMessage({
				type: 'updateSubtask',
				data: { taskId, prompt, options }
			});
		},
		onSuccess: (_, variables) => {
			// Extract parent task ID from subtask ID (e.g., "1.2" -> "1")
			const parentTaskId = variables.taskId.split('.')[0];
			// Invalidate the parent task details and all lists
			queryClient.invalidateQueries({
				queryKey: taskKeys.detail(parentTaskId)
			});
			queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
		}
	});
}
