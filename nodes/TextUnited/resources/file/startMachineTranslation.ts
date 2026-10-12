import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';

const showOnlyForFileStartMachineTranslation = {
	resource: ['instantTranslation'],
	operation: ['startMachineTranslation'],
};

export const fileStartMachineTranslationDescription: INodeProperties[] = [
	{
		displayName: 'Document Batch ID',
		name: 'documentBatchId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForFileStartMachineTranslation,
		},
		description:
			'The Document Batch ID from a previous File → Convert run — every file converted under it is translated together',
	},
	{
		displayName: 'Source Language Name or ID',
		name: 'sourceLanguageCode',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getLanguages',
		},
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForFileStartMachineTranslation,
		},
		description:
			'Language the files are written in. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Target Languages Names or IDs',
		name: 'targetLanguageCodes',
		type: 'multiOptions',
		typeOptions: {
			loadOptionsMethod: 'getLanguages',
		},
		default: [],
		required: true,
		displayOptions: {
			show: showOnlyForFileStartMachineTranslation,
		},
		description:
			'Languages to translate the files into. At least one is required. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Target File Name',
		name: 'targetFileName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForFileStartMachineTranslation,
		},
		description: 'Name for the ZIP TextUnited builds once translation finishes, without extension',
	},
	{
		displayName: 'Enhance Quality',
		name: 'enhanceQuality',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: showOnlyForFileStartMachineTranslation,
		},
		description: 'Whether to apply TextUnited\'s quality-enhancement pass to the machine translation',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: showOnlyForFileStartMachineTranslation,
		},
		options: [
			{
				displayName: 'Domain Name or ID',
				name: 'domainId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getDomains',
				},
				default: '',
				description:
					'Domain of the content, used to improve translation quality. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Style Guide Name or ID',
				name: 'styleGuideId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getStyleGuides',
				},
				default: '',
				description:
					'Style guide to apply across every target language. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	},
];

/**
 * Starts machine translation on files already uploaded via File → Convert
 * (`POST /docprocessor/DocumentBatchTranslation`), identified by the
 * Document Batch ID they share. `processName`/`processId` are fixed —
 * required by the endpoint, but not meaningfully configurable.
 *
 * Translation runs in the background on TextUnited's side — this call only
 * kicks it off. The response is a process object (`processGuid`, `state`,
 * ...), the same shape the Process resource already returns elsewhere on
 * this node: poll it via Process → Get until `state` is `Completed` (or a
 * `*Failed` state), then fetch the result via File → Download Machine
 * Translation.
 *
 * Deliberately its own action rather than an automatic next step after
 * Convert, so a workflow can inspect/store the converted files before
 * deciding to translate them, and so status polling (a Wait node loop) sits
 * between this and the download step rather than inside one blocking call.
 */
export async function startMachineTranslation(
	this: IExecuteFunctions,
	i: number,
): Promise<IDataObject> {
	const documentBatchId = this.getNodeParameter('documentBatchId', i) as string;
	const sourceLanguageCode = this.getNodeParameter('sourceLanguageCode', i) as string;
	const targetLanguageCodes = this.getNodeParameter('targetLanguageCodes', i, []) as string[];
	const targetFileName = this.getNodeParameter('targetFileName', i) as string;
	const enhanceQuality = this.getNodeParameter('enhanceQuality', i, false) as boolean;
	const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

	if (targetLanguageCodes.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one target language must be added', {
			itemIndex: i,
		});
	}

	const body: IDataObject = {
		documentBatchId,
		sourceLanguageCode,
		targetLanguageCodes,
		targetFileName,
		enhanceQuality,
		processName: 'DocumentBatchTranslation',
		processId: 7,
		...additionalFields,
	};

	return (await textUnitedApiRequest.call(
		this,
		'POST',
		'/docprocessor/DocumentBatchTranslation',
		body,
	)) as IDataObject;
}
