import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';

const showOnlyForProjectGetSegments = {
	resource: ['project'],
	operation: ['getSegments'],
};

export const projectGetSegmentsDescription: INodeProperties[] = [
	{
		displayName: 'Project',
		name: 'projectId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: showOnlyForProjectGetSegments,
		},
		description: 'The project to get segments for',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchProjects',
					searchable: true,
				},
			},
			{
				displayName: 'TextUnited ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 334413',
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
			{
				displayName: 'Custom ID',
				name: 'customId',
				type: 'string',
				placeholder: 'e.g. TU-Website-7',
			},
		],
	},
];

export async function getProjectSegments(
	this: IExecuteFunctions,
	i: number,
): Promise<IDataObject[]> {
	const projectId = this.getNodeParameter('projectId', i) as {
		mode: 'list' | 'id' | 'customId';
		value: string;
	};

	const endpoint =
		projectId.mode === 'customId'
			? `/segments/projects/custom/${encodeURIComponent(projectId.value)}/segments`
			: `/segments/projects/${encodeURIComponent(projectId.value)}/segments`;

	return (await textUnitedApiRequest.call(this, 'GET', endpoint)) as IDataObject[];
}
