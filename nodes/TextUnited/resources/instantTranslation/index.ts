import type { INodeProperties } from 'n8n-workflow';

import { fileDownloadMachineTranslationDescription } from '../file/downloadMachineTranslation';
import { fileStartMachineTranslationDescription } from '../file/startMachineTranslation';
import { translationTranslateDescription } from '../translation/translate';

export { downloadMachineTranslation } from '../file/downloadMachineTranslation';
export { startMachineTranslation } from '../file/startMachineTranslation';
export { translateSegments, translateSegmentsForItem } from '../translation/translate';

const showOnlyForInstantTranslation = {
	resource: ['instantTranslation'],
};

export const instantTranslationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForInstantTranslation,
		},
		options: [
			{
				name: 'Translate Instantly',
				value: 'translate',
				description: 'Run machine translation on content without creating a project',
				action: 'Translate text segments instantly',
			},
			{
				name: 'Create Instant File Translation',
				value: 'startMachineTranslation',
				description:
					'Translate files already converted with DocProcessor, without creating a project — the "on the fly" translation flow',
				action: 'Create instant file translation',
			},
			{
				name: 'Get Instant File Translation',
				value: 'downloadMachineTranslation',
				description: 'Download a finished machine translation as a ZIP',
				action: 'Get instant file translation',
			},
		],
		default: 'translate',
	},
];

export const instantTranslationFields: INodeProperties[] = [
	...translationTranslateDescription,
	...fileStartMachineTranslationDescription,
	...fileDownloadMachineTranslationDescription,
];
