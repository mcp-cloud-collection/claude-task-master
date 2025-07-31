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
		const { isSubtask: isSub, parentId, subtaskIndex } = parseTaskId(taskId);

		if (isSub) {
			const parent = tasks.find((t) => t.id === parentId);
			if (parent && parent.subtasks && parent.subtasks[subtaskIndex]) {
				const subtask = parent.subtasks[subtaskIndex];
				setCurrentTask(subtask);
				setParentTask(parent);
			} else {
				setCurrentTask(null);
				setParentTask(null);
			}
		} else {
			const task = tasks.find((t) => t.id === taskId);
			if (task) {
				setCurrentTask(task);
				setParentTask(null);
			} else {
				setCurrentTask(null);
				setParentTask(null);
			}
		}
	}, [taskId, tasks]);

	// Fetch full task details including details and testStrategy
	useEffect(() => {
		const fetchTaskDetails = async () => {
			if (!currentTask) return;

			try {
				// Use the parent task ID for MCP call since get_task returns parent with subtasks
				const taskIdToFetch =
					isSubtask && parentTask ? parentTask.id : currentTask.id;

				const result = await sendMessage({
					type: 'mcpRequest',
					tool: 'get_task',
					params: {
						id: taskIdToFetch
					}
				});

				// Parse the MCP response - it comes as content[0].text JSON string
				let fullTaskData = null;
				if (result?.data?.content?.[0]?.text) {
					try {
						const parsed = JSON.parse(result.data.content[0].text);
						fullTaskData = parsed.data;
					} catch (e) {
						console.error('Failed to parse MCP response:', e);
					}
				} else if (result?.data?.data) {
					// Fallback if response structure is different
					fullTaskData = result.data.data;
				}

				if (fullTaskData) {
					if (isSubtask && fullTaskData.subtasks) {
						// Find the specific subtask
						const subtaskData = fullTaskData.subtasks.find(
							(st: any) =>
								st.id === currentTask.id ||
								st.id === parseInt(currentTask.id as any)
						);
						if (subtaskData) {
							setTaskFileData({
								details: subtaskData.details || '',
								testStrategy: subtaskData.testStrategy || ''
							});
						}
					} else {
						// Use the main task data
						setTaskFileData({
							details: fullTaskData.details || '',
							testStrategy: fullTaskData.testStrategy || ''
						});
					}
				}
			} catch (error) {
				console.error('❌ Failed to fetch task details:', error);
				setTaskFileDataError('Failed to load task details');
			}
		};

		fetchTaskDetails();
	}, [currentTask, isSubtask, parentTask, sendMessage]);

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
