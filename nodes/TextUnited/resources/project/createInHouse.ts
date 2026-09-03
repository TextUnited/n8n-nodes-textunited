import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';
import { parseJsonArrayParameter } from '../../shared/utils';

const showOnlyForProjectCreateInHouse = {
	resource: ['project'],
	operation: ['createInHouse'],
};

function buildTargetLanguages(targetLanguagesUi: IDataObject): IDataObject[] {
	return ((targetLanguagesUi.language as IDataObject[]) ?? []).map((language) => {
		const teamUi = (language.team as IDataObject) ?? {};
		const team = ((teamUi.member as IDataObject[]) ?? []).map((member) => ({
			id: Number(member.id),
			isProjectManager: member.isProjectManager,
			isTranslator: member.isTranslator,
			isProofreader: member.isProofreader,
			isInCountryReviewer: member.isInCountryReviewer,
		}));

		return {
			targetLanguageCode: language.targetLanguageCode,
			serviceProofreading: language.serviceProofreading,
			styleGuideId: language.styleGuideId || undefined,
			team: team.length > 0 ? team : undefined,
			serviceTranslation: true,
			serviceAutomaticTranslation: true,
			serviceAdaptiveTranslation: false,
			managedProject: false,
		};
	});
}

/**
 * TextUnited requires a team either for every target language or for none,
 * and each provided team must include at least one translator — otherwise
 * the process stalls with a missing-translator error. Checking this here
 * gives a clear error immediately instead of a failed request.
 */
function validateTeams(
	this: IExecuteFunctions,
	targetLanguages: IDataObject[],
	options?: { itemIndex: number },
): void {
	const languagesWithTeam = targetLanguages.filter(
		(language) => Array.isArray(language.team) && (language.team as unknown[]).length > 0,
	);

	if (languagesWithTeam.length > 0 && languagesWithTeam.length < targetLanguages.length) {
		throw new NodeOperationError(
			this.getNode(),
			'Team must be provided for either every target language or none',
			options ? { itemIndex: options.itemIndex } : undefined,
		);
	}

	for (const language of languagesWithTeam) {
		const team = language.team as IDataObject[];
		const hasTranslator = team.some((member) => member.isTranslator === true);
		if (!hasTranslator) {
			throw new NodeOperationError(
				this.getNode(),
				`Team for target language "${language.targetLanguageCode}" must include at least one member with Translator enabled`,
				options ? { itemIndex: options.itemIndex } : undefined,
			);
		}
	}
}

export const projectCreateInHouseDescription: INodeProperties[] = [
	{
		displayName: 'Project Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForProjectCreateInHouse,
		},
		description: 'Name of the project to create',
	},
	{
		displayName: 'Custom ID',
		name: 'customId',
		type: 'string',
		default: '',
		displayOptions: {
			show: showOnlyForProjectCreateInHouse,
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
			show: showOnlyForProjectCreateInHouse,
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
			show: showOnlyForProjectCreateInHouse,
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
			show: showOnlyForProjectCreateInHouse,
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
			show: showOnlyForProjectCreateInHouse,
		},
		description:
			'Languages the content should be translated into. At least one is required. Automatic translation is always requested; adaptive translation and the managed-project flag are not allowed for this process.',
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
						displayName: 'Proofreading',
						name: 'serviceProofreading',
						type: 'boolean',
						default: false,
						description: 'Whether proofreading service should be ordered for this language',
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
					{
						displayName: 'Team',
						name: 'team',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						placeholder: 'Add Team Member',
						default: {},
						description:
							'People assigned to translate/review this language. Optional — if left empty for every target language, TextUnited automatically assigns a translator from your Engagement team (matched by language pair), or the project creator if none match. If you provide a team for any language, you must provide one for every target language, and each one must include at least one Translator.',
						options: [
							{
								displayName: 'Member',
								name: 'member',
								values: [
									{
										displayName: 'In-Country Reviewer',
										name: 'isInCountryReviewer',
										type: 'boolean',
										default: false,
										description: 'Whether this member reviews translations in-country',
									},
									{
										displayName: 'Member Name or ID',
										name: 'id',
										type: 'options',
										typeOptions: {
											loadOptionsMethod: 'getTeamMembers',
										},
										default: '',
										required: true,
										description:
											'The company user or collaborator to assign. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
									},
									{
										displayName: 'Project Manager',
										name: 'isProjectManager',
										type: 'boolean',
										default: false,
										description: 'Whether this member manages the project',
									},
									{
										displayName: 'Proofreader',
										name: 'isProofreader',
										type: 'boolean',
										default: false,
										description: 'Whether this member proofreads translations',
									},
									{
										displayName: 'Translator',
										name: 'isTranslator',
										type: 'boolean',
										default: false,
										description: 'Whether this member translates content',
									},
								],
							},
						],
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
			show: showOnlyForProjectCreateInHouse,
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
				...showOnlyForProjectCreateInHouse,
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
				...showOnlyForProjectCreateInHouse,
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
				...showOnlyForProjectCreateInHouse,
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
				...showOnlyForProjectCreateInHouse,
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
				...showOnlyForProjectCreateInHouse,
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
			show: showOnlyForProjectCreateInHouse,
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
 * Creates a project and kicks off TextUnited's In-House Project Quality Eval
 * process (processId 2): the same saga as the Managed process, but the
 * project is staffed with a translator from the company's own Engagement
 * team (matched by language pair) instead of an agency — or with the
 * project creator when no matching team exists. A team can optionally be
 * assigned manually per target language instead; TextUnited requires this
 * either for every target language or none, and each team must include at
 * least one translator.
 *
 * Segments can be provided three ways, via "Specify Segments":
 * - "items": one segment per input item (see {@link createInHouseProject})
 *   — the only mode where this operation runs once per *execution* rather
 *   than once per item, since it needs every item to build one project.
 * - "fields" / "json": a self-contained list configured on the node itself
 *   (see {@link createInHouseProjectForItem}), evaluated the same way for
 *   every input item — one project created per item, like every other
 *   Create operation on this node.
 */
export async function createInHouseProject(this: IExecuteFunctions): Promise<IDataObject> {
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

	validateTeams.call(this, targetLanguages);

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
		processId: 2,
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
export async function createInHouseProjectForItem(
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

	validateTeams.call(this, targetLanguages, { itemIndex: i });

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
		processId: 2,
		targetLanguages,
		segments,
		...additionalFields,
	};

	return (await textUnitedApiRequest.call(this, 'POST', '/segments/projects', body)) as IDataObject;
}
