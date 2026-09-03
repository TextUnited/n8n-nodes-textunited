import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';

const showOnlyForProcessRetry = {
	resource: ['process'],
	operation: ['retry'],
};

export const processRetryDescription: INodeProperties[] = [
	{
		displayName: 'Process GUID',
		name: 'processGuid',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForProcessRetry,
		},
		description:
			'GUID of the failed process to resume, from the project creation response or Process → Get',
	},
];

export async function retryProcess(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const processGuid = this.getNodeParameter('processGuid', i) as string;

	return (await textUnitedApiRequest.call(
		this,
		'POST',
		`/ProcessManagement/processes/${encodeURIComponent(processGuid)}/retry`,
	)) as IDataObject;
}
