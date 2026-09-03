import type { INodeProperties } from 'n8n-workflow';

import { translationTranslateDescription } from './translate';

export { translateSegments, translateSegmentsForItem } from './translate';

const showOnlyForTranslation = {
	resource: ['translation'],
};

export const translationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForTranslation,
		},
		options: [
			{
				name: 'Translate Instantly',
				value: 'translate',
				description: 'Run machine translation on content without creating a project',
				action: 'Translate instantly',
			},
		],
		default: 'translate',
	},
];

export const translationFields: INodeProperties[] = [...translationTranslateDescription];
