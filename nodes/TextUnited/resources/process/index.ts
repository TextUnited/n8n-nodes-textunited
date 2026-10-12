import type { INodeProperties } from 'n8n-workflow';

import { processCancelDescription } from './cancel';
import { processGetDescription } from './get';
import { processRetryDescription } from './retry';

export { cancelProcess } from './cancel';
export { getProcess } from './get';
export { retryProcess } from './retry';

const showOnlyForProcess = {
	resource: ['process'],
};

export const processOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForProcess,
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get the status of an automated process',
				action: 'Get process info',
			},
			{
				name: 'Cancel',
				value: 'cancel',
				description: 'Stop a process',
				action: 'Cancel process',
			},
			{
				name: 'Retry',
				value: 'retry',
				description: 'Resume a failed process',
				action: 'Retry process',
			},
		],
		default: 'get',
	},
];

export const processFields: INodeProperties[] = [
	...processGetDescription,
	...processRetryDescription,
	...processCancelDescription,
];
