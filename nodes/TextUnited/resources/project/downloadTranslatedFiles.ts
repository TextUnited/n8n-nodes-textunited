import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { textUnitedApiRequest } from '../../shared/transport';

const showOnlyForProjectDownloadTranslatedFiles = {
	resource: ['fileBasedProject'],
	operation: ['downloadTranslatedFiles'],
};

export const projectDownloadTranslatedFilesDescription: INodeProperties[] = [
	{
		displayName: 'Project',
		name: 'projectId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		displayOptions: {
			show: showOnlyForProjectDownloadTranslatedFiles,
		},
		description: 'The project to download the translated files of',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'searchProjects',
					searchable: true,
				},
			},
			{
				displayName: 'TextUnited ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 334413',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[0-9]+$',
							errorMessage: 'Not a valid TextUnited project ID',
						},
					},
				],
			},
		],
	},
];

interface TextUnitedTranslatedDocuments {
	stateId: number;
	stateName: string;
	filename?: string;
	content?: string;
	createdUTC?: string;
}

/**
 * Downloads a project's translated files as a single ZIP, returned by the
 * API as a base64 string. Decoded here into binary data on the output item
 * so it can be saved, emailed, or uploaded downstream (e.g. via Write Binary
 * File, Move Binary Data, or Respond to Webhook) — or downloaded directly
 * from the item in the n8n UI.
 *
 * Unlike every other operation on this node, this one builds its own
 * INodeExecutionData (to carry binary data) instead of returning a plain
 * IDataObject for the generic dispatch loop to wrap.
 */
export async function downloadTranslatedFiles(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData> {
	const projectId = this.getNodeParameter('projectId', i) as {
		mode: 'list' | 'id';
		value: string;
	};

	const response = (await textUnitedApiRequest.call(
		this,
		'GET',
		`/projects/${encodeURIComponent(projectId.value)}/documents/translated`,
	)) as unknown as TextUnitedTranslatedDocuments;

	if (!response.content) {
		throw new NodeOperationError(
			this.getNode(),
			`Translated files are not available yet (state: ${response.stateName ?? 'unknown'})`,
			{ itemIndex: i },
		);
	}

	const fileName = response.filename || 'translation.zip';
	const binaryData = await this.helpers.prepareBinaryData(
		Buffer.from(response.content, 'base64'),
		fileName,
		'application/zip',
	);

	return {
		json: {
			stateId: response.stateId,
			stateName: response.stateName,
			filename: fileName,
			createdUTC: response.createdUTC,
		},
		binary: { data: binaryData },
		pairedItem: { item: i },
	};
}
