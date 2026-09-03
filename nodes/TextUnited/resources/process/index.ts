import type { INodeProperties } from 'n8n-workflow';

import { processCancelDescription } from './cancel';
import { processFinishGlossaryDescription } from './finishGlossary';
import { processGetDescription } from './get';
import { processRetryDescription } from './retry';
import { processSubmitClientReviewDescription } from './submitClientReview';

export { cancelProcess } from './cancel';
export { finishGlossary } from './finishGlossary';
export { getProcess } from './get';
export { retryProcess } from './retry';
export { submitClientReview } from './submitClientReview';

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
				name: 'Cancel',
				value: 'cancel',
				description: 'Stop a process',
				action: 'Cancel process',
			},
			{
				name: 'Finish Glossary',
				value: 'finishGlossary',
				description: 'Mark the glossary as translated so the process can continue',
				action: 'Finish glossary translation',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the status of an automated process',
				action: 'Get process',
			},
			{
				name: 'Retry',
				value: 'retry',
				description: 'Resume a failed process',
				action: 'Retry process',
			},
			{
				name: 'Submit Client Review',
				value: 'submitClientReview',
				description: 'Approve or reject a quality evaluation report',
				action: 'Submit client review',
			},
		],
		default: 'get',
	},
];

export const processFields: INodeProperties[] = [
	...processGetDescription,
	...processFinishGlossaryDescription,
	...processSubmitClientReviewDescription,
	...processRetryDescription,
	...processCancelDescription,
];
