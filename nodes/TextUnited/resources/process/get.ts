import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';

const showOnlyForProcessGet = {
	resource: ['process'],
	operation: ['get'],
};

export const processGetDescription: INodeProperties[] = [
	{
		displayName: 'Process',
		name: 'processIdentifier',
		type: 'resourceLocator',
		default: { mode: 'processGuid', value: '' },
		required: true,
		displayOptions: {
			show: showOnlyForProcessGet,
		},
		description: 'The automated process to look up the status of',
		modes: [
			{
				displayName: 'Process GUID',
				name: 'processGuid',
				type: 'string',
				placeholder: 'e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6',
			},
			{
				displayName: 'Project ID',
				name: 'projectId',
				type: 'string',
				placeholder: 'e.g. 432090',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[0-9]+$',
							errorMessage: 'Not a valid TextUnited project ID',
						},
					},
				],
			},
		],
	},
];

export async function getProcess(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const processIdentifier = this.getNodeParameter('processIdentifier', i) as {
		mode: 'processGuid' | 'projectId';
		value: string;
	};

	const endpoint =
		processIdentifier.mode === 'projectId'
			? `/ProcessManagement/processes/project/${encodeURIComponent(processIdentifier.value)}`
			: `/ProcessManagement/processes/${encodeURIComponent(processIdentifier.value)}`;

	return (await textUnitedApiRequest.call(this, 'GET', endpoint)) as IDataObject;
}
