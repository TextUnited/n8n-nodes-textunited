import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';

const showOnlyForProjectGetAll = {
	resource: ['project'],
	operation: ['getAll'],
};

export const projectGetAllDescription: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: showOnlyForProjectGetAll,
		},
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: {
			minValue: 1,
		},
		displayOptions: {
			show: {
				...showOnlyForProjectGetAll,
				returnAll: [false],
			},
		},
		description: 'Max number of results to return',
	},
];

export async function getAllProjects(this: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	// The TextUnited API does not support server-side pagination for this
	// endpoint, so "Limit" is applied client-side after fetching everything.
	const projects = (await textUnitedApiRequest.call(
		this,
		'GET',
		'/segments/projects',
	)) as IDataObject[];

	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	if (returnAll) {
		return projects;
	}

	const limit = this.getNodeParameter('limit', i) as number;
	return projects.slice(0, limit);
}
