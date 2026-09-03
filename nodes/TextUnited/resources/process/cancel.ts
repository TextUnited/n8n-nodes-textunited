import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';

const showOnlyForProcessCancel = {
	resource: ['process'],
	operation: ['cancel'],
};

export const processCancelDescription: INodeProperties[] = [
	{
		displayName: 'Process GUID',
		name: 'processGuid',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForProcessCancel,
		},
		description: 'GUID of the process to stop, from the project creation response or Process → Get',
	},
];

export async function cancelProcess(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const processGuid = this.getNodeParameter('processGuid', i) as string;

	return (await textUnitedApiRequest.call(
		this,
		'POST',
		`/ProcessManagement/processes/${encodeURIComponent(processGuid)}/cancel`,
	)) as IDataObject;
}
