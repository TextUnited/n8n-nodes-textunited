import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { buildQualityEvalProcessSettings, validateScenarioTeam } from '../../shared/utils';
import { textUnitedApiRequest } from '../../shared/transport';

const showOnlyForProjectCreateFromFilesInHouse = {
	resource: ['fileBasedProject'],
	operation: ['createFromFilesInHouse', 'createFromFilesInHouseQualityEval'],
};

const showOnlyForQualityEval = {
	resource: ['fileBasedProject'],
	operation: ['createFromFilesInHouseQualityEval'],
};

// TextUnited's DocProcessor/Multilingual endpoints use PascalCase field
// names on the wire — unlike every other endpoint on this node, which is
// camelCase. This is intentional; don't "fix" the casing below.
function buildTargetLanguages(
	this: IExecuteFunctions,
	targetLanguagesUi: IDataObject,
	rootScenarioId: number,
	options?: { itemIndex: number },
): IDataObject[] {
	return ((targetLanguagesUi.language as IDataObject[]) ?? []).map((language) => {
		const teamUi = (language.team as IDataObject) ?? {};
		const team = ((teamUi.member as IDataObject[]) ?? []).map((member) => ({
			Id: Number(member.id),
			IsProjectManager: member.isProjectManager,
			IsTranslator: member.isTranslator,
			IsProofreader: member.isProofreader,
			IsInCountryReviewer: member.isInCountryReviewer,
		}));

		// The API resolves each language's effective scenario as
		// `target scenarioId ?? root scenarioId` itself — the override is
		// only sent here when set, letting the server do that resolution.
		// Client-side, the same resolution is used just to validate Team.
		const scenarioOverride = language.scenarioId as number | '' | undefined;
		const effectiveScenarioId = scenarioOverride || rootScenarioId;

		if (team.length > 0) {
			validateScenarioTeam.call(
				this,
				language.targetLanguageCode,
				effectiveScenarioId,
				team,
				options,
			);
		}

		return {
			TargetLanguageCode: language.targetLanguageCode,
			StyleGuideId: language.styleGuideId || undefined,
			Team: team.length > 0 ? team : undefined,
			EnhancedQuality: language.enhancedQuality,
			ScenarioId: scenarioOverride || undefined,
			StateName: 'InProgress',
		};
	});
}

export const projectCreateFromFilesInHouseDescription: INodeProperties[] = [
	{
		displayName: 'DocProcessor Pack ID',
		name: 'docProcessorPackId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForProjectCreateFromFilesInHouse,
		},
		description:
			'The pack ID from a previous File → Convert step (its output\'s ProjectId field) — every file converted under that pack ID is pulled into this project. Converting files is a separate action; this operation does not upload anything itself.',
	},
	{
		displayName: 'Project Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForProjectCreateFromFilesInHouse,
		},
		description: 'Name of the project to create',
	},
	{
		displayName: 'End Date',
		name: 'endDateUtc',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: showOnlyForProjectCreateFromFilesInHouse,
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
			show: showOnlyForProjectCreateFromFilesInHouse,
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
			show: showOnlyForProjectCreateFromFilesInHouse,
		},
		description:
			'Language the files are written in. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Scenario',
		name: 'scenarioId',
		type: 'options',
		options: [
			{
				name: 'Automatic Translation Review',
				value: 4,
				description: 'Machine translation, then review',
			},
			{
				name: 'Human Translation',
				value: 1,
				description: 'Translation only',
			},
			{
				name: 'Human Translation + Proofreading',
				value: 2,
				description: 'Translation, then proofreading',
			},
		],
		default: 1,
		required: true,
		displayOptions: {
			show: showOnlyForProjectCreateFromFilesInHouse,
		},
		description:
			'Service type for the whole project. Applies to every target language, unless a language sets its own Scenario override below. Determines what Team composition each language needs (a Translator is always required; a Proofreader is required only for Human Translation + Proofreading, and not allowed otherwise).',
	},
	{
		displayName: 'Critical Translation',
		name: 'criticalTranslation',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: showOnlyForQualityEval,
		},
		description:
			'Whether TextUnited should act on the quality report. If enabled, any risks the report finds get a translator assigned automatically to fix them, then a new report is run — and if risks remain, the manager and client are emailed. If disabled, the project always finishes after machine translation even if the report finds risks (the report stays available to review).',
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
			show: showOnlyForProjectCreateFromFilesInHouse,
		},
		description: 'Languages the files should be translated into. At least one is required.',
		options: [
			{
				displayName: 'Language',
				name: 'language',
				values: [
					{
						displayName: 'Enhanced Quality',
						name: 'enhancedQuality',
						type: 'boolean',
						default: false,
						description: 'Whether to use an LLM to improve the machine translation output',
					},
					{
						displayName: 'Scenario',
						name: 'scenarioId',
						type: 'options',
						options: [
							{ name: '- Use Project Default -', value: '' },
							{
								name: 'Automatic Translation Review',
								value: 4,
								description: 'Machine translation, then review',
							},
							{
								name: 'Human Translation',
								value: 1,
								description: 'Translation only',
							},
							{
								name: 'Human Translation + Proofreading',
								value: 2,
								description: 'Translation, then proofreading',
							},
						],
						default: '',
						description: 'Overrides the project-level Scenario for this language only',
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
						displayName: 'Team',
						name: 'team',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						placeholder: 'Add Team Member',
						default: {},
						description: 'People assigned to work on this language',
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
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: showOnlyForProjectCreateFromFilesInHouse,
		},
		options: [
			{
				displayName: 'Custom Field 1',
				name: 'CustomField1',
				type: 'string',
				default: '',
				description: 'Additional information identifying the project in an external system',
			},
			{
				displayName: 'Custom Field 2',
				name: 'CustomField2',
				type: 'string',
				default: '',
				description: 'Additional information identifying the project in an external system',
			},
			{
				displayName: 'Description',
				name: 'Description',
				type: 'string',
				default: '',
				description: 'Additional information about the project',
			},
			{
				displayName: 'Post-Back URL',
				name: 'PostBackUrl',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/webhook',
				description: 'URL TextUnited sends the translated file back to once the project completes',
			},
			{
				displayName: 'Reference Number',
				name: 'ReferenceNumber',
				type: 'string',
				default: '',
				description: 'Your own custom value for the project',
			},
			{
				displayName: 'Start Date',
				name: 'StartDateUtc',
				type: 'dateTime',
				default: '',
				description:
					'Date and time (UTC) the project should start. Defaults to TextUnited’s own default if left unset.',
			},
		],
	},
];

/**
 * Creates a project from files already converted by a prior, separate
 * File → Convert step, with every target language staffed in-house rather
 * than by an agency: per-language Style Guide/Enhanced Quality, and the
 * same required project-level Scenario (with a per-language override,
 * service type is derived from it server-side, not sent explicitly) —
 * except Agency ID is never sent at all (every target language stays
 * in-house), and a per-language Team can optionally be assigned instead.
 *
 * Runs once per *execution*, regardless of how many input items are
 * present — like every other Create From Files operation, since it just
 * references files already uploaded in a prior Convert step rather than
 * reading anything from the current input items.
 */
async function createInHouseFileProject(
	this: IExecuteFunctions,
	qualityEval: boolean,
): Promise<IDataObject> {
	const docProcessorPackId = this.getNodeParameter('docProcessorPackId', 0) as string;
	const name = this.getNodeParameter('name', 0) as string;
	const endDateUtc = this.getNodeParameter('endDateUtc', 0, '') as string;
	const domainId = this.getNodeParameter('domainId', 0, '') as string | number;
	const sourceLanguageCode = this.getNodeParameter('sourceLanguageCode', 0) as string;
	const scenarioId = this.getNodeParameter('scenarioId', 0) as number;
	const targetLanguagesUi = this.getNodeParameter('targetLanguages', 0, {}) as IDataObject;
	const additionalFields = this.getNodeParameter('additionalFields', 0, {}) as IDataObject;

	const targetLanguages = buildTargetLanguages.call(this, targetLanguagesUi, scenarioId);

	if (targetLanguages.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one target language must be added');
	}

	const body: IDataObject = {
		Name: name,
		EndDateUtc: endDateUtc || undefined,
		DomainId: domainId || undefined,
		SourceLanguageCode: sourceLanguageCode,
		StateName: 'InProgress',
		ProcessName: qualityEval ? 'InHouseFileProjectQualityEval' : 'InHouseFileProject',
		...(qualityEval
			? {
					ProcessSettings: buildQualityEvalProcessSettings(
						this.getNodeParameter('criticalTranslation', 0, false) as boolean,
					),
				}
			: {}),
		ScenarioId: scenarioId,
		DocProcessorPackId: docProcessorPackId,
		TargetLanguages: targetLanguages,
		...additionalFields,
	};

	return (await textUnitedApiRequest.call(
		this,
		'POST',
		'/projects/automation/multilingual',
		body,
	)) as IDataObject;
}

export async function createFromFilesInHouseProject(
	this: IExecuteFunctions,
): Promise<IDataObject> {
	return createInHouseFileProject.call(this, false);
}

/**
 * Same request as {@link createFromFilesInHouseProject}, but starts
 * TextUnited's InHouseFileProjectQualityEval process: after machine
 * translation, a quality report is produced, and "Critical Translation"
 * decides whether TextUnited acts on it (see
 * {@link buildQualityEvalProcessSettings}).
 */
export async function createFromFilesInHouseQualityEvalProject(
	this: IExecuteFunctions,
): Promise<IDataObject> {
	return createInHouseFileProject.call(this, true);
}
