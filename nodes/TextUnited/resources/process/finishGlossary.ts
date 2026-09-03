import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';

const showOnlyForProcessFinishGlossary = {
	resource: ['process'],
	operation: ['finishGlossary'],
};

export const processFinishGlossaryDescription: INodeProperties[] = [
	{
		displayName: 'Process GUID',
		name: 'processGuid',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForProcessFinishGlossary,
		},
		description:
			'GUID of the process, from the project creation response or Process → Get. Use when the process is in the "Waiting For Glossary Translation" state.',
	},
];

export async function finishGlossary(this: IExecuteFunctions, i: number): Promise<IDataObject> {
	const processGuid = this.getNodeParameter('processGuid', i) as string;

	return (await textUnitedApiRequest.call(
		this,
		'POST',
		`/ProcessManagement/processes/${encodeURIComponent(processGuid)}/glossary-translated`,
	)) as IDataObject;
}
