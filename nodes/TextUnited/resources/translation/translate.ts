import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';
import { parseJsonArrayParameter } from '../../shared/utils';

const showOnlyForTranslationTranslate = {
	resource: ['translation'],
	operation: ['translate'],
};

export const translationTranslateDescription: INodeProperties[] = [
	{
		displayName: 'Domain Name or ID',
		name: 'domainId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getDomains',
		},
		default: '',
		displayOptions: {
			show: showOnlyForTranslationTranslate,
		},
		description:
			'Domain of the content, used to improve translation quality. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
			show: showOnlyForTranslationTranslate,
		},
		description:
			'Language the content is written in. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Translate Into',
		name: 'targetLanguages',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Target Language',
		default: {},
		required: true,
		displayOptions: {
			show: showOnlyForTranslationTranslate,
		},
		description:
			'Languages the content should be translated into. At least one is required. Applies to the whole request — evaluated once, not per input item.',
		options: [
			{
				displayName: 'Language',
				name: 'language',
				values: [
					{
						displayName: 'Target Language Name or ID',
						name: 'targetLanguageCode',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getLanguages',
						},
						default: '',
						required: true,
						description:
							'TextUnited target language. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
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
							'Style guide to apply for this language. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
				],
			},
		],
	},
	{
		displayName: 'Specify Segments',
		name: 'segmentsMode',
		type: 'options',
		options: [
			{
				name: 'One Segment per Input Item',
				value: 'items',
				description:
					'Connect a node that outputs one item per piece of content (e.g. after a Split Out); each item becomes one segment',
			},
			{
				name: 'Define Below',
				value: 'fields',
				description: 'Add and configure each segment through the UI',
			},
			{
				name: 'Using JSON',
				value: 'json',
				description: 'Provide the segments as a JSON array, e.g. from a previous node',
			},
		],
		default: 'items',
		displayOptions: {
			show: showOnlyForTranslationTranslate,
		},
		description: 'How to provide the content segments',
	},
	{
		displayName: 'Content',
		name: 'content',
		type: 'string',
		typeOptions: {
			rows: 3,
		},
		default: '',
		required: true,
		displayOptions: {
			show: {
				...showOnlyForTranslationTranslate,
				segmentsMode: ['items'],
			},
		},
		description:
			'Plain text or HTML markup to translate, evaluated once per input item. Set this with an expression referencing the current item’s data.',
	},
	{
		displayName: 'Custom ID',
		name: 'customId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				...showOnlyForTranslationTranslate,
				segmentsMode: ['items'],
			},
		},
		description: 'Your own identifier for this segment (evaluated per input item, like Content)',
	},
	{
		displayName: 'Notes',
		name: 'notes',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				...showOnlyForTranslationTranslate,
				segmentsMode: ['items'],
			},
		},
		description: 'Additional notes for the translator (evaluated per input item, like Content)',
	},
	{
		displayName: 'Segments',
		name: 'segments',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		placeholder: 'Add Segment',
		default: {},
		required: true,
		displayOptions: {
			show: {
				...showOnlyForTranslationTranslate,
				segmentsMode: ['fields'],
			},
		},
		description: 'Content segments to be translated. At least one is required.',
		options: [
			{
				displayName: 'Segment',
				name: 'segment',
				values: [
					{
						displayName: 'Custom ID',
						name: 'customId',
						type: 'string',
						default: '',
						description: 'Your own identifier for this segment',
					},
					{
						displayName: 'Content',
						name: 'content',
						type: 'string',
						typeOptions: {
							rows: 3,
						},
						default: '',
						required: true,
						description: 'Plain text or HTML markup to translate',
					},
					{
						displayName: 'Notes',
						name: 'notes',
						type: 'string',
						default: '',
						description: 'Additional notes for the translator',
					},
				],
			},
		],
	},
	{
		displayName: 'Segments (JSON)',
		name: 'segmentsJson',
		type: 'json',
		default: JSON.stringify(
			[
				{
					content: 'Text to translate',
					customId: 'seg-1',
					notes: null,
				},
			],
			null,
			2,
		),
		required: true,
		displayOptions: {
			show: {
				...showOnlyForTranslationTranslate,
				segmentsMode: ['json'],
			},
		},
		description:
			'Segments as a JSON array. Each item matches the fields used above: content, customId, notes.',
	},
];

/**
 * Runs pure machine translation without creating a project: no name, no
 * team, no project state. TextUnited returns the translated content
 * directly in `instantTranslationSegments`.
 *
 * Segments can be provided three ways, via the "Specify Segments" mode:
 * - "items": one segment per input item (see {@link translateSegments}) —
 *   the only mode where this operation runs once per *execution* rather
 *   than once per item, since it needs every item to build one request.
 * - "fields" / "json": a self-contained list configured on the node itself,
 *   evaluated the same way for every input item (see
 *   {@link translateSegmentsForItem}), matching how every other operation on
 *   this node behaves.
 */
export async function translateSegments(this: IExecuteFunctions): Promise<IDataObject> {
	const items = this.getInputData();

	const domainId = this.getNodeParameter('domainId', 0, '') as string | number;
	const sourceLanguageCode = this.getNodeParameter('sourceLanguageCode', 0) as string;
	const targetLanguagesUi = this.getNodeParameter('targetLanguages', 0, {}) as IDataObject;

	const targetLanguages = ((targetLanguagesUi.language as IDataObject[]) ?? []).map((language) => ({
		targetLanguageCode: language.targetLanguageCode,
		styleGuideId: language.styleGuideId || undefined,
	}));

	if (targetLanguages.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one target language must be added');
	}

	const segments = items.map((_, i) => {
		const content = this.getNodeParameter('content', i) as string;
		const customId = this.getNodeParameter('customId', i, '') as string;
		const notes = this.getNodeParameter('notes', i, '') as string;

		return {
			content,
			customId: customId || undefined,
			notes: notes || undefined,
		};
	});

	if (segments.length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'At least one input item is required — each input item becomes one segment',
		);
	}

	const body: IDataObject = {
		sourceLanguageCode,
		targetLanguages,
		segments,
		domainId: domainId || undefined,
	};

	return (await textUnitedApiRequest.call(
		this,
		'POST',
		'/segments/Translation',
		body,
	)) as IDataObject;
}

/**
 * Handles the "Define Below" and "Using JSON" Segments modes: a
 * self-contained request built from this single item's own parameters, run
 * once per input item like every other operation on this node.
 */
export async function translateSegmentsForItem(
	this: IExecuteFunctions,
	i: number,
): Promise<IDataObject> {
	const domainId = this.getNodeParameter('domainId', i, '') as string | number;
	const sourceLanguageCode = this.getNodeParameter('sourceLanguageCode', i) as string;
	const targetLanguagesUi = this.getNodeParameter('targetLanguages', i, {}) as IDataObject;
	const segmentsMode = this.getNodeParameter('segmentsMode', i, 'fields') as 'fields' | 'json';

	const targetLanguages = ((targetLanguagesUi.language as IDataObject[]) ?? []).map((language) => ({
		targetLanguageCode: language.targetLanguageCode,
		styleGuideId: language.styleGuideId || undefined,
	}));

	if (targetLanguages.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one target language must be added', {
			itemIndex: i,
		});
	}

	let segments: IDataObject[];

	if (segmentsMode === 'json') {
		const segmentsJson = this.getNodeParameter('segmentsJson', i, '[]');
		segments = parseJsonArrayParameter.call(this, segmentsJson, 'Segments (JSON)');
	} else {
		const segmentsUi = this.getNodeParameter('segments', i, {}) as IDataObject;
		segments = ((segmentsUi.segment as IDataObject[]) ?? []).map((segment) => ({
			content: segment.content,
			customId: segment.customId || undefined,
			notes: segment.notes || undefined,
		}));
	}

	if (segments.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one segment must be added', {
			itemIndex: i,
		});
	}

	const body: IDataObject = {
		sourceLanguageCode,
		targetLanguages,
		segments,
		domainId: domainId || undefined,
	};

	return (await textUnitedApiRequest.call(
		this,
		'POST',
		'/segments/Translation',
		body,
	)) as IDataObject;
}
