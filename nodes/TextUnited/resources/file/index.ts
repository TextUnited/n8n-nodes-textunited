import type { INodeProperties } from 'n8n-workflow';

import { fileConvertDescription } from './convert';

export { convertFiles } from './convert';

const showOnlyForFile = {
	resource: ['file'],
};

export const fileOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForFile,
		},
		options: [
			{
				name: 'Convert',
				value: 'convert',
				description:
					'Convert one or more files with DocProcessor, ready to be referenced by a Create From Files project operation',
				action: 'Upload files to document batch',
			},
		],
		default: 'convert',
	},
];

export const fileFields: INodeProperties[] = [...fileConvertDescription];
