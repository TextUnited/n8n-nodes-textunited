import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodeListSearchResult,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { convertFiles, fileFields, fileOperations } from './resources/file';
import {
	downloadMachineTranslation,
	instantTranslationFields,
	instantTranslationOperations,
	startMachineTranslation,
	translateSegments,
	translateSegmentsForItem,
} from './resources/instantTranslation';
import {
	cancelProcess,
	getProcess,
	processFields,
	processOperations,
	retryProcess,
} from './resources/process';
import {
	createFromFilesInHouseProject,
	createFromFilesInHouseQualityEvalProject,
	createFromFilesManagedProject,
	createFromFilesManagedQualityEvalProject,
	createInHouseProject,
	createInHouseProjectForItem,
	createInHouseTranslationProject,
	createInHouseTranslationProjectForItem,
	createManagedProject,
	createManagedProjectForItem,
	createManagedTranslationProject,
	createManagedTranslationProjectForItem,
	downloadTranslatedFiles,
	getProject,
	getProjectSegments,
	projectFields,
	projectOperations,
} from './resources/project';
import {
	getDomains,
	getLanguages,
	getStyleGuides,
	getTeamMembers,
	searchProjects,
} from './shared/methods';

export class TextUnited implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TextUnited',
		name: 'textUnited',
		icon: { light: 'file:textunited.svg', dark: 'file:textunited.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Create and manage TextUnited translation projects',
		defaults: {
			name: 'TextUnited',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'textUnitedApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'File',
						value: 'file',
					},
					{
						name: 'File-Based Project',
						value: 'fileBasedProject',
					},
					{
						name: 'General Project',
						value: 'generalProject',
					},
					{
						name: 'Instant Translation',
						value: 'instantTranslation',
					},
					{
						name: 'Process',
						value: 'process',
					},
					{
						name: 'Text-Based Project',
						value: 'textBasedProject',
					},
				],
				default: 'textBasedProject',
			},
			...fileOperations,
			...fileFields,
			...projectOperations,
			...projectFields,
			...instantTranslationOperations,
			...instantTranslationFields,
			...processOperations,
			...processFields,
		],
	};

	methods = {
		loadOptions: {
			async getLanguages(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return getLanguages.call(this);
			},
			async getDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return getDomains.call(this);
			},
			async getTeamMembers(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return getTeamMembers.call(this);
			},
			async getStyleGuides(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return getStyleGuides.call(this);
			},
		},
		listSearch: {
			async searchProjects(
				this: ILoadOptionsFunctions,
				filter?: string,
			): Promise<INodeListSearchResult> {
				return searchProjects.call(this, filter);
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Every operation with a "Specify Segments" field shares the same
		// "One Segment per Input Item" mode: instead of running once per
		// input item like every other operation on this node, it aggregates
		// every input item into a single request (one segment each). That
		// mode is dispatched here, before the per-item loop below, since it
		// needs every item at once. Its other two Segments modes ("Define
		// Below" / "Using JSON") are self-contained per item and run through
		// the normal per-item loop, via the matching "ForItem" function.
		const aggregateOperations: Record<
			string,
			Record<string, (this: IExecuteFunctions) => Promise<IDataObject | IDataObject[]>>
		> = {
			textBasedProject: {
				createManagedTranslation: createManagedTranslationProject,
				createInHouseTranslation: createInHouseTranslationProject,
				createManaged: createManagedProject,
				createInHouse: createInHouseProject,
			},
			fileBasedProject: {
				createFromFilesManaged: createFromFilesManagedProject,
				createFromFilesManagedQualityEval: createFromFilesManagedQualityEvalProject,
				createFromFilesInHouse: createFromFilesInHouseProject,
				createFromFilesInHouseQualityEval: createFromFilesInHouseQualityEvalProject,
			},
			instantTranslation: {
				translate: translateSegments,
			},
			file: {
				convert: convertFiles,
			},
		};

		const aggregateFn = aggregateOperations[resource]?.[operation];

		if (aggregateFn) {
			const segmentsMode = this.getNodeParameter('segmentsMode', 0, 'items') as string;

			if (segmentsMode === 'items') {
				try {
					const responseData = await aggregateFn.call(this);
					return [
						this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(responseData), {
							itemData: { item: 0 },
						}),
					];
				} catch (error) {
					if (this.continueOnFail()) {
						return [
							this.helpers.constructExecutionMetaData(
								this.helpers.returnJsonArray({ error: (error as Error).message }),
								{ itemData: { item: 0 } },
							),
						];
					}
					throw new NodeApiError(this.getNode(), error as JsonObject);
				}
			}
		}

		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: IDataObject | IDataObject[];

				if (resource === 'textBasedProject' && operation === 'createManagedTranslation') {
					responseData = await createManagedTranslationProjectForItem.call(this, i);
				} else if (resource === 'textBasedProject' && operation === 'createInHouseTranslation') {
					responseData = await createInHouseTranslationProjectForItem.call(this, i);
				} else if (resource === 'textBasedProject' && operation === 'createManaged') {
					responseData = await createManagedProjectForItem.call(this, i);
				} else if (resource === 'textBasedProject' && operation === 'createInHouse') {
					responseData = await createInHouseProjectForItem.call(this, i);
				} else if (resource === 'textBasedProject' && operation === 'getSegments') {
					responseData = await getProjectSegments.call(this, i);
				} else if (resource === 'generalProject' && operation === 'get') {
					responseData = await getProject.call(this, i);
				} else if (resource === 'fileBasedProject' && operation === 'downloadTranslatedFiles') {
					// Unlike every other operation, this one needs to attach binary
					// data (the downloaded ZIP) to the output item, so it builds its
					// own INodeExecutionData directly instead of returning a plain
					// IDataObject for the generic returnJsonArray() path below.
					returnData.push(await downloadTranslatedFiles.call(this, i));
					continue;
				} else if (resource === 'instantTranslation' && operation === 'startMachineTranslation') {
					responseData = await startMachineTranslation.call(this, i);
				} else if (
					resource === 'instantTranslation' &&
					operation === 'downloadMachineTranslation'
				) {
					// Same reason as File-Based Project → Download Translated Files
					// above: this is another operation that attaches binary data, so
					// it builds its own INodeExecutionData directly.
					returnData.push(await downloadMachineTranslation.call(this, i));
					continue;
				} else if (resource === 'instantTranslation' && operation === 'translate') {
					responseData = await translateSegmentsForItem.call(this, i);
				} else if (resource === 'process' && operation === 'get') {
					responseData = await getProcess.call(this, i);
				} else if (resource === 'process' && operation === 'retry') {
					responseData = await retryProcess.call(this, i);
				} else if (resource === 'process' && operation === 'cancel') {
					responseData = await cancelProcess.call(this, i);
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for resource "${resource}"!`,
						{ itemIndex: i },
					);
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					const executionErrorData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray({ error: (error as Error).message }),
						{ itemData: { item: i } },
					);
					returnData.push(...executionErrorData);
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
