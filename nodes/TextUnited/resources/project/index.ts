import type { INodeProperties } from 'n8n-workflow';

import { projectCreateInHouseDescription } from './createInHouse';
import { projectCreateInHouseTranslationDescription } from './createInHouseTranslation';
import { projectCreateManagedDescription } from './createManaged';
import { projectCreateManagedTranslationDescription } from './createManagedTranslation';
import { projectGetDescription } from './get';
import { projectGetAllDescription } from './getAll';
import { projectGetSegmentsDescription } from './getSegments';

export { createInHouseProject, createInHouseProjectForItem } from './createInHouse';
export {
	createInHouseTranslationProject,
	createInHouseTranslationProjectForItem,
} from './createInHouseTranslation';
export { createManagedProject, createManagedProjectForItem } from './createManaged';
export {
	createManagedTranslationProject,
	createManagedTranslationProjectForItem,
} from './createManagedTranslation';
export { getProject } from './get';
export { getAllProjects } from './getAll';
export { getProjectSegments } from './getSegments';

const showOnlyForProject = {
	resource: ['project'],
};

export const projectOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForProject,
		},
		options: [
			{
				name: 'Create (In-House Quality Eval)',
				value: 'createInHouse',
				description:
					'Create a project and start the In-House Project Quality Eval process: automatic translation staffed by your own team (or the project creator), then quality evaluation',
				action: 'In house project with quality evaluation',
			},
			{
				name: 'Create (Managed Quality Eval)',
				value: 'createManaged',
				description:
					'Create a project and start the Managed Project Quality Eval process: agency-staffed automatic translation, then quality evaluation',
				action: 'Managed project with quality evaluation',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a project by its TextUnited ID or custom ID',
				action: 'Get project',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many projects in your company',
				action: 'Get many projects',
			},
			{
				name: 'Get Segments (Segments Project)',
				value: 'getSegments',
				description: 'Get the segments of a project by its TextUnited ID or custom ID',
				action: 'Get segment project translations',
			},
			{
				name: 'In-House Translation Project',
				value: 'createInHouseTranslation',
				description:
					'Create a plain translation project staffed in-house, optionally with a manually assigned team, and no automated process',
				action: 'In house translation project',
			},
			{
				name: 'Managed Translation Project',
				value: 'createManagedTranslation',
				description:
					'Create a plain translation project flagged as agency-managed, with no automated process',
				action: 'Managed translation project',
			},
		],
		default: 'createManagedTranslation',
	},
];

export const projectFields: INodeProperties[] = [
	...projectCreateManagedTranslationDescription,
	...projectCreateInHouseTranslationDescription,
	...projectCreateManagedDescription,
	...projectCreateInHouseDescription,
	...projectGetDescription,
	...projectGetAllDescription,
	...projectGetSegmentsDescription,
];
