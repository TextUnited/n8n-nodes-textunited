import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { textUnitedBinaryApiRequest } from '../../shared/transport';

const showOnlyForFileDownloadMachineTranslation = {
	resource: ['instantTranslation'],
	operation: ['downloadMachineTranslation'],
};

export const fileDownloadMachineTranslationDescription: INodeProperties[] = [
	{
		displayName: 'Document Batch ID',
		name: 'documentBatchId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: showOnlyForFileDownloadMachineTranslation,
		},
		description: 'The Document Batch ID a File → Start Machine Translation run was started with',
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: 'translation.zip',
		displayOptions: {
			show: showOnlyForFileDownloadMachineTranslation,
		},
		description:
			'Used only if TextUnited\'s response doesn\'t name the file itself; include the .zip extension',
	},
];

/**
 * Reads a filename out of a Content-Disposition header, if present, in
 * either the plain (`filename="x.zip"`) or RFC 5987 encoded
 * (`filename*=UTF-8''x.zip`) form TextUnited might send. Returns undefined
 * if the header is missing or doesn't match either shape.
 */
function filenameFromContentDisposition(headers: IDataObject): string | undefined {
	const raw = headers['content-disposition'] as string | undefined;
	if (!raw) {
		return undefined;
	}

	const encodedMatch = raw.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
	if (encodedMatch) {
		try {
			return decodeURIComponent(encodedMatch[1].trim());
		} catch {
			// fall through to the plain form below
		}
	}

	const plainMatch = raw.match(/filename="?([^";]+)"?/i);
	return plainMatch?.[1]?.trim();
}

/**
 * Downloads the finished result of a machine translation
 * (`GET /docprocessor/DocumentBatchTranslationDownload/{documentBatchId}`) —
 * always a ZIP, with a separate folder per target language (a translated PDF
 * comes back named `<file>.pdf.docx` inside its folder). Unlike the Convert
 * step, this one returns the file itself rather than JSON, so it's decoded
 * straight to binary data here instead of going through
 * {@link textUnitedApiRequest}.
 *
 * Only make this call once Process → Get (via the `processGuid` from File →
 * Start Machine Translation) reports `state: Completed` — a 404 means
 * translation hasn't finished yet, a 410 means more than a day has passed
 * since it did and the files are already deleted.
 *
 * Like Project → Download Translated Files, this is the one File operation
 * that needs to attach binary data, so it builds its own
 * INodeExecutionData directly instead of returning a plain IDataObject.
 */
export async function downloadMachineTranslation(
	this: IExecuteFunctions,
	i: number,
): Promise<INodeExecutionData> {
	const documentBatchId = this.getNodeParameter('documentBatchId', i) as string;
	const fallbackFileName = this.getNodeParameter('fileName', i, 'translation.zip') as string;

	const { body, headers } = await textUnitedBinaryApiRequest.call(
		this,
		'GET',
		`/docprocessor/DocumentBatchTranslationDownload/${encodeURIComponent(documentBatchId)}`,
	);

	const fileName = filenameFromContentDisposition(headers) || fallbackFileName;
	const binaryData = await this.helpers.prepareBinaryData(body, fileName, 'application/zip');

	return {
		json: { documentBatchId, filename: fileName },
		binary: { data: binaryData },
		pairedItem: { item: i },
	};
}
