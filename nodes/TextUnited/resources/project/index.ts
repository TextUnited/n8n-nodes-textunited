import type { INodeProperties } from 'n8n-workflow';

import { projectCreateFromFilesInHouseDescription } from './createFromFilesInHouse';
import { projectCreateFromFilesManagedDescription } from './createFromFilesManaged';
import { projectCreateInHouseDescription } from './createInHouse';
import { projectCreateInHouseTranslationDescription } from './createInHouseTranslation';
import { projectCreateManagedDescription } from './createManaged';
import { projectCreateManagedTranslationDescription } from './createManagedTranslation';
import { projectDownloadTranslatedFilesDescription } from './downloadTranslatedFiles';
import { projectGetDescription } from './get';
import { projectGetSegmentsDescription } from './getSegments';

export {
	createFromFilesInHouseProject,
	createFromFilesInHouseQualityEvalProject,
} from './createFromFilesInHouse';
export {
	createFromFilesManagedProject,
	createFromFilesManagedQualityEvalProject,
} from './createFromFilesManaged';
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
export { downloadTranslatedFiles } from './downloadTranslatedFiles';
export { getProject } from './get';
export { getProjectSegments } from './getSegments';

const showOnlyForFileBasedProject = {
	resource: ['fileBasedProject'],
};

const showOnlyForTextBasedProject = {
	resource: ['textBasedProject'],
};

const showOnlyForGeneralProject = {
	resource: ['generalProject'],
};

export const projectOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForFileBasedProject,
		},
		options: [
			{
				name: 'Create From Files (In-House Quality Eval)',
				value: 'createFromFilesInHouseQualityEval',
				description:
					'Create a project from uploaded files and start the In-House File Project Quality Eval process: translation staffed in-house, then a quality report, optionally acted on automatically',
				action: 'Create file based in house project with quality evaluation',
			},
			{
				name: 'Create From Files (In-House)',
				value: 'createFromFilesInHouse',
				description:
					'Create a project from uploaded files, with every target language staffed in-house and an optional per-language team',
				action: 'Create file based in house project',
			},
			{
				name: 'Create From Files (Managed Quality Eval)',
				value: 'createFromFilesManagedQualityEval',
				description:
					'Create a project from uploaded files and start the Managed File Project Quality Eval process: translation handed to an agency, then a quality report, optionally acted on automatically',
				action: 'Create file based managed project with quality evaluation',
			},
			{
				name: 'Create From Files (Managed)',
				value: 'createFromFilesManaged',
				description:
					'Create a project from uploaded files, with every target language handed to the same agency',
				action: 'Create file based managed project',
			},
			{
				name: 'Download Translated Files',
				value: 'downloadTranslatedFiles',
				description: 'Download a project\'s translated files as a ZIP',
				action: 'Get file based translation',
			},
		],
		default: 'createFromFilesManaged',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForTextBasedProject,
		},
		options: [
			{
				name: 'Create (In-House Quality Eval)',
				value: 'createInHouse',
				description:
					'Create a project and start the In-House Project Quality Eval process: automatic translation staffed by your own team (or the project creator), then quality evaluation',
				action: 'Create text based in house project with quality evaluation',
			},
			{
				name: 'Create (Managed Quality Eval)',
				value: 'createManaged',
				description:
					'Create a project and start the Managed Project Quality Eval process: agency-staffed automatic translation, then quality evaluation',
				action: 'Create text based managed project with quality evaluation',
			},
			{
				name: 'Get Segments (Segments Project)',
				value: 'getSegments',
				description: 'Get the segments of a project by its TextUnited ID or custom ID',
				action: 'Get text based translation',
			},
			{
				name: 'In-House Translation Project',
				value: 'createInHouseTranslation',
				description:
					'Create a plain translation project staffed in-house, optionally with a manually assigned team, and no automated process',
				action: 'Create text based in house project',
			},
			{
				name: 'Managed Translation Project',
				value: 'createManagedTranslation',
				description:
					'Create a plain translation project flagged as agency-managed, with no automated process',
				action: 'Create text based managed project',
			},
		],
		default: 'createManagedTranslation',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForGeneralProject,
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get a project by its TextUnited ID or custom ID',
				action: 'Get project',
			},
		],
		default: 'get',
	},
];

export const projectFields: INodeProperties[] = [
	...projectCreateManagedTranslationDescription,
	...projectCreateInHouseTranslationDescription,
	...projectCreateManagedDescription,
	...projectCreateInHouseDescription,
	...projectCreateFromFilesManagedDescription,
	...projectCreateFromFilesInHouseDescription,
	...projectDownloadTranslatedFilesDescription,
	...projectGetDescription,
	...projectGetSegmentsDescription,
];
