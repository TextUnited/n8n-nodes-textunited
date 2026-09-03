import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';
import { parseJsonArrayParameter } from '../../shared/utils';

const showOnlyForProjectCreateManagedTranslation = {
	resource: ['project'],
	operation: ['createManagedTranslation'],
};

function buildTargetLanguages(targetLanguagesUi: IDataObject): IDataObject[] {
	return ((targetLanguagesUi.language as IDataObject[]) ?? []).map((language) => ({
		targetLanguageCode: language.targetLanguageCode,
		styleGuideId: language.styleGuideId || undefined,
		state: 'InProgress',
		managedProject: true,
		serviceTranslation: true,
		serviceProofreading: false,
		serviceAutomaticTranslation: true,
		serviceAdaptiveTranslation: false,
		serviceScoring: false,
	}));
}

export const projectCreateManagedTranslationDescription: INodeProperties[] = [
	{
		displayName: 'Project Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForProjectCreateManagedTranslation,
		},
		description: 'Name of the project to create',
	},
	{
		displayName: 'Custom ID',
		name: 'customId',
		type: 'string',
		default: '',
		displayOptions: {
			show: showOnlyForProjectCreateManagedTranslation,
		},
		description: 'ID of the project in your external system',
	},
	{
		displayName: 'End Date',
		name: 'endDateUtc',
		type: 'dateTime',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForProjectCreateManagedTranslation,
		},
		description: 'Date and time (UTC) the project should be completed by',
	},
	{
		displayName: 'Domain Name or ID',
		name: 'domainId',
		type: 'options',
		typeOptions: {
			loadOptionsMethod: 'getDomains',
		},
		default: '',
		displayOptions: {
			show: showOnlyForProjectCreateManagedTranslation,
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
			show: showOnlyForProjectCreateManagedTranslation,
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
			show: showOnlyForProjectCreateManagedTranslation,
		},
		description:
			'Languages the content should be translated into. At least one is required. The agency handles staffing; a manually assigned team is not offered for this project type.',
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
					'Connect a node that outputs one item per piece of content (e.g. after a Split Out); each item becomes one segment of a single project',
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
			show: showOnlyForProjectCreateManagedTranslation,
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
				...showOnlyForProjectCreateManagedTranslation,
				segmentsMode: ['items'],
			},
		},
		description:
			'Plain text or HTML markup to translate, evaluated once per input item. Set this with an expression referencing the current item’s data.',
	},
	{
		displayName: 'Custom ID',
		name: 'segmentCustomId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				...showOnlyForProjectCreateManagedTranslation,
				segmentsMode: ['items'],
			},
		},
		description: 'Your own identifier for this segment (evaluated per input item, like Content)',
	},
	{
		displayName: 'Notes',
		name: 'segmentNotes',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				...showOnlyForProjectCreateManagedTranslation,
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
				...showOnlyForProjectCreateManagedTranslation,
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
				...showOnlyForProjectCreateManagedTranslation,
				segmentsMode: ['json'],
			},
		},
		description:
			'Segments as a JSON array. Each item matches the fields used above: content, customId, notes.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: showOnlyForProjectCreateManagedTranslation,
		},
		options: [
			{
				displayName: 'Custom Field 1',
				name: 'customField1',
				type: 'string',
				default: '',
				description: 'Additional information identifying the project in an external system',
			},
			{
				displayName: 'Custom Field 2',
				name: 'customField2',
				type: 'string',
				default: '',
				description: 'Additional information identifying the project in an external system',
			},
			{
				displayName: 'Event URL',
				name: 'eventUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/webhook',
				description: 'URL of a webhook TextUnited calls when a project segment or setting changes',
			},
			{
				displayName: 'Reference Number',
				name: 'referenceNumber',
				type: 'string',
				default: '',
				description: 'Your own custom value for the project',
			},
			{
				displayName: 'Task ID',
				name: 'taskId',
				type: 'string',
				default: '',
				description: 'Initial task ID for the project',
			},
		],
	},
];

/**
 * Creates a plain multilingual translation project with each target
 * language flagged as agency-managed. This is a curated, simplified form of
 * project creation: everything not shown above (adaptive/automatic
 * translation, proofreading, scoring, description, instant translation,
 * team) is fixed to a sensible default and never exposed.
 *
 * Segments can be provided three ways, via "Specify Segments":
 * - "items": one segment per input item (see
 *   {@link createManagedTranslationProject}) — the only mode where this
 *   operation runs once per *execution* rather than once per item, since it
 *   needs every item to build one project.
 * - "fields" / "json": a self-contained list configured on the node itself
 *   (see {@link createManagedTranslationProjectForItem}), evaluated the same
 *   way for every input item — one project created per item, like every
 *   other Create operation on this node.
 */
export async function createManagedTranslationProject(
	this: IExecuteFunctions,
): Promise<IDataObject> {
	const items = this.getInputData();

	const name = this.getNodeParameter('name', 0) as string;
	const customId = this.getNodeParameter('customId', 0, '') as string;
	const endDateUtc = this.getNodeParameter('endDateUtc', 0) as string;
	const domainId = this.getNodeParameter('domainId', 0, '') as string | number;
	const sourceLanguageCode = this.getNodeParameter('sourceLanguageCode', 0) as string;
	const targetLanguagesUi = this.getNodeParameter('targetLanguages', 0, {}) as IDataObject;
	const additionalFields = this.getNodeParameter('additionalFields', 0, {}) as IDataObject;

	const targetLanguages = buildTargetLanguages(targetLanguagesUi);

	if (targetLanguages.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one target language must be added');
	}

	const segments = items.map((_, i) => {
		const content = this.getNodeParameter('content', i) as string;
		const segmentCustomId = this.getNodeParameter('segmentCustomId', i, '') as string;
		const segmentNotes = this.getNodeParameter('segmentNotes', i, '') as string;

		return {
			content,
			customId: segmentCustomId || undefined,
			notes: segmentNotes || undefined,
		};
	});

	if (segments.length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'At least one input item is required — each input item becomes one segment',
		);
	}

	const body: IDataObject = {
		name,
		customId: customId || undefined,
		startDateUtc: new Date().toISOString(),
		endDateUtc,
		domainId: domainId || undefined,
		sourceLanguageCode,
		targetLanguages,
		segments,
		...additionalFields,
	};

	return (await textUnitedApiRequest.call(this, 'POST', '/segments/projects', body)) as IDataObject;
}

/**
 * Handles the "Define Below" and "Using JSON" Segments modes: a
 * self-contained request built from this single item's own parameters, run
 * once per input item — one project created per item, like every other
 * Create operation on this node.
 */
export async function createManagedTranslationProjectForItem(
	this: IExecuteFunctions,
	i: number,
): Promise<IDataObject> {
	const name = this.getNodeParameter('name', i) as string;
	const customId = this.getNodeParameter('customId', i, '') as string;
	const endDateUtc = this.getNodeParameter('endDateUtc', i) as string;
	const domainId = this.getNodeParameter('domainId', i, '') as string | number;
	const sourceLanguageCode = this.getNodeParameter('sourceLanguageCode', i) as string;
	const targetLanguagesUi = this.getNodeParameter('targetLanguages', i, {}) as IDataObject;
	const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
	const segmentsMode = this.getNodeParameter('segmentsMode', i, 'fields') as 'fields' | 'json';

	const targetLanguages = buildTargetLanguages(targetLanguagesUi);

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
		name,
		customId: customId || undefined,
		startDateUtc: new Date().toISOString(),
		endDateUtc,
		domainId: domainId || undefined,
		sourceLanguageCode,
		targetLanguages,
		segments,
		...additionalFields,
	};

	return (await textUnitedApiRequest.call(this, 'POST', '/segments/projects', body)) as IDataObject;
}
