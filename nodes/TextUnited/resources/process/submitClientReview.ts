import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';

const showOnlyForProcessSubmitClientReview = {
	resource: ['process'],
	operation: ['submitClientReview'],
};

export const processSubmitClientReviewDescription: INodeProperties[] = [
	{
		displayName: 'Process GUID',
		name: 'processGuid',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForProcessSubmitClientReview,
		},
		description:
			'GUID of the process, from the project creation response or Process → Get. Use when the process is in the "Waiting For Client Review" state.',
	},
	{
		displayName: 'Approved',
		name: 'approved',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: showOnlyForProcessSubmitClientReview,
		},
		description: 'Whether the client approves the quality evaluation report',
	},
];

export async function submitClientReview(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const processGuid = this.getNodeParameter('processGuid', i) as string;
	const approved = this.getNodeParameter('approved', i) as boolean;

	return (await textUnitedApiRequest.call(
		this,
		'POST',
		`/ProcessManagement/processes/${encodeURIComponent(processGuid)}/client-review`,
		{ approved },
	)) as IDataObject;
}
