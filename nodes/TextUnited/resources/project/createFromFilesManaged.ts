import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';
import { buildQualityEvalProcessSettings } from '../../shared/utils';

const showOnlyForProjectCreateFromFilesManaged = {
	resource: ['fileBasedProject'],
	operation: ['createFromFilesManaged', 'createFromFilesManagedQualityEval'],
};

const showOnlyForQualityEval = {
	resource: ['fileBasedProject'],
	operation: ['createFromFilesManagedQualityEval'],
};

// TextUnited's DocProcessor/Multilingual endpoints use PascalCase field
// names on the wire — unlike every other endpoint on this node, which is
// camelCase. This is intentional; don't "fix" the casing below.
function buildTargetLanguages(targetLanguagesUi: IDataObject, agencyId: number): IDataObject[] {
	return ((targetLanguagesUi.language as IDataObject[]) ?? []).map((language) => ({
		TargetLanguageCode: language.targetLanguageCode,
		StyleGuideId: language.styleGuideId || undefined,
		AgencyId: agencyId,
		EnhancedQuality: language.enhancedQuality,
		StateName: 'Enquiry',
	}));
}

export const projectCreateFromFilesManagedDescription: INodeProperties[] = [
	{
		displayName: 'DocProcessor Pack ID',
		name: 'docProcessorPackId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForProjectCreateFromFilesManaged,
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
			show: showOnlyForProjectCreateFromFilesManaged,
		},
		description: 'Name of the project to create',
	},
	{
		displayName: 'End Date',
		name: 'endDateUtc',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: showOnlyForProjectCreateFromFilesManaged,
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
			show: showOnlyForProjectCreateFromFilesManaged,
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
			show: showOnlyForProjectCreateFromFilesManaged,
		},
		description:
			'Language the files are written in. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Agency ID',
		name: 'agencyId',
		type: 'number',
		default: 0,
		required: true,
		displayOptions: {
			show: showOnlyForProjectCreateFromFilesManaged,
		},
		description: 'Agency that will handle every target language of this project',
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
			show: showOnlyForProjectCreateFromFilesManaged,
		},
		description: 'Service type for every target language of this project',
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
			show: showOnlyForProjectCreateFromFilesManaged,
		},
		description:
			'Languages the files should be translated into. At least one is required. The agency handles staffing; a manually assigned team is not offered for this project type.',
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
			show: showOnlyForProjectCreateFromFilesManaged,
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
 * File → Convert step, with every target language handed to the same
 * agency: per-language Style Guide/Enhanced Quality, and the same required
 * project-level Scenario (service type is derived from it server-side,
 * not sent explicitly) — except Agency ID is a single required top-level
 * field applied to every target language instead of per-language, and
 * Team is not offered at all, since TextUnited's own agency allocation
 * overrides (and actively rejects) one.
 *
 * Runs once per *execution*, regardless of how many input items are
 * present — like every other Create From Files operation, since it just
 * references files already uploaded in a prior Convert step rather than
 * reading anything from the current input items.
 */
async function createManagedFileProject(
	this: IExecuteFunctions,
	qualityEval: boolean,
): Promise<IDataObject> {
	const docProcessorPackId = this.getNodeParameter('docProcessorPackId', 0) as string;
	const name = this.getNodeParameter('name', 0) as string;
	const endDateUtc = this.getNodeParameter('endDateUtc', 0, '') as string;
	const domainId = this.getNodeParameter('domainId', 0, '') as string | number;
	const sourceLanguageCode = this.getNodeParameter('sourceLanguageCode', 0) as string;
	const agencyId = this.getNodeParameter('agencyId', 0) as number;
	const scenarioId = this.getNodeParameter('scenarioId', 0) as number;
	const targetLanguagesUi = this.getNodeParameter('targetLanguages', 0, {}) as IDataObject;
	const additionalFields = this.getNodeParameter('additionalFields', 0, {}) as IDataObject;

	const targetLanguages = buildTargetLanguages(targetLanguagesUi, agencyId);

	if (targetLanguages.length === 0) {
		throw new NodeOperationError(this.getNode(), 'At least one target language must be added');
	}

	const body: IDataObject = {
		Name: name,
		EndDateUtc: endDateUtc || undefined,
		DomainId: domainId || undefined,
		SourceLanguageCode: sourceLanguageCode,
		StateName: 'Enquiry',
		ProcessName: qualityEval ? 'ManagedFileProjectQualityEval' : 'ManagedFileProject',
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

export async function createFromFilesManagedProject(
	this: IExecuteFunctions,
): Promise<IDataObject> {
	return createManagedFileProject.call(this, false);
}

/**
 * Same request as {@link createFromFilesManagedProject}, but starts
 * TextUnited's ManagedFileProjectQualityEval process: after machine
 * translation, a quality report is produced, and "Critical Translation"
 * decides whether TextUnited acts on it (see
 * {@link buildQualityEvalProcessSettings}).
 */
export async function createFromFilesManagedQualityEvalProject(
	this: IExecuteFunctions,
): Promise<IDataObject> {
	return createManagedFileProject.call(this, true);
}
