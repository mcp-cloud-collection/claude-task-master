import { useEffect, useState, useCallback } from 'react';
import type { TaskMasterTask } from '../../webview/types';

interface TaskFileData {
	details?: string;
	testStrategy?: string;
}

interface UseTaskDetailsProps {
	taskId: string;
	sendMessage: (message: any) => Promise<any>;
	tasks: TaskMasterTask[];
}

export const useTaskDetails = ({
	taskId,
	sendMessage,
	tasks
}: UseTaskDetailsProps) => {
	const [taskFileData, setTaskFileData] = useState<TaskFileData>({});
	const [taskFileDataError, setTaskFileDataError] = useState<string | null>(
		null
	);
	const [complexity, setComplexity] = useState<any>(null);
	const [currentTask, setCurrentTask] = useState<TaskMasterTask | null>(null);
	const [parentTask, setParentTask] = useState<TaskMasterTask | null>(null);

	// Determine if this is a subtask
	const isSubtask = taskId.includes('.');

	// Parse task ID to determine if it's a subtask (e.g., "13.2")
	const parseTaskId = (id: string) => {
		const parts = id.split('.');
		if (parts.length === 2) {
			return {
				isSubtask: true,
				parentId: parts[0],
				subtaskIndex: parseInt(parts[1]) - 1 // Convert to 0-based index
			};
		}
		return {
			isSubtask: false,
			parentId: id,
			subtaskIndex: -1
		};
	};

	// Find the current task
	useEffect(() => {
		console.log('🔍 TaskDetailsView: Looking for task:', taskId);
		console.log('🔍 TaskDetailsView: Available tasks:', tasks);

		const { isSubtask: isSub, parentId, subtaskIndex } = parseTaskId(taskId);

		if (isSub) {
			const parent = tasks.find((t) => t.id === parentId);
			if (parent && parent.subtasks && parent.subtasks[subtaskIndex]) {
				const subtask = parent.subtasks[subtaskIndex];
				console.log('✅ TaskDetailsView: Found subtask:', subtask);
				setCurrentTask(subtask);
				setParentTask(parent);
				// Use subtask's own details and testStrategy
				setTaskFileData({
					details: subtask.details || '',
					testStrategy: subtask.testStrategy || ''
				});
			} else {
				console.error('❌ TaskDetailsView: Subtask not found');
				setCurrentTask(null);
				setParentTask(null);
			}
		} else {
			const task = tasks.find((t) => t.id === taskId);
			if (task) {
				console.log('✅ TaskDetailsView: Found task:', task);
				setCurrentTask(task);
				setParentTask(null);
				// Use task's own details and testStrategy
				setTaskFileData({
					details: task.details || '',
					testStrategy: task.testStrategy || ''
				});
			} else {
				console.error('❌ TaskDetailsView: Task not found');
				setCurrentTask(null);
				setParentTask(null);
			}
		}
	}, [taskId, tasks]);

	// Fetch complexity score
	const fetchComplexity = useCallback(async () => {
		if (!currentTask) return;

		// First check if the task already has a complexity score
		if (currentTask.complexityScore !== undefined) {
			setComplexity({ score: currentTask.complexityScore });
			return;
		}

		try {
			const result = await sendMessage({
				type: 'getComplexity',
				data: { taskId: currentTask.id }
			});
			if (result) {
				setComplexity(result);
			}
		} catch (error) {
			console.error('❌ TaskDetailsView: Failed to fetch complexity:', error);
		}
	}, [currentTask, sendMessage]);

	useEffect(() => {
		fetchComplexity();
	}, [fetchComplexity]);

	const refreshComplexityAfterAI = () => {
		setTimeout(() => {
			fetchComplexity();
		}, 2000);
	};

	return {
		currentTask,
		parentTask,
		isSubtask,
		taskFileData,
		taskFileDataError,
		complexity,
		refreshComplexityAfterAI
	};
};
