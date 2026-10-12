import { randomUUID } from 'crypto';

import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { convertFilesInDocProcessor } from '../../shared/docProcessor';

const showOnlyForFileConvert = {
	resource: ['file'],
	operation: ['convert'],
};

export const fileConvertDescription: INodeProperties[] = [
	{
		displayName: 'Binary Property',
		name: 'binaryPropertyName',
		type: 'string',
		default: '',
		displayOptions: {
			show: showOnlyForFileConvert,
		},
		description:
			'Name of the binary property, on each input item, holding the file to convert. Leave empty to convert every binary property found on each item instead — useful when a multi-file upload field (e.g. a Form Trigger\'s File field) bundles several files into one item rather than one item per file.',
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
			show: showOnlyForFileConvert,
		},
		description:
			'Language the files are written in. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Paragraph Segmentation',
		name: 'paragraphSegmentation',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: showOnlyForFileConvert,
		},
		description: 'Whether to segment by paragraph instead of by sentence, for every file in this run',
	},
	{
		displayName: 'Word File Options',
		name: 'wordOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: showOnlyForFileConvert,
		},
		description: 'Applied only to files with a .doc or .docx extension in this run; ignored for others',
		options: [
			{
				displayName: 'Extract Comments',
				name: 'extractComments',
				type: 'boolean',
				default: false,
				description: 'Whether to extract comments as translatable content',
			},
			{
				displayName: 'Extract Hidden Text',
				name: 'extractHiddenText',
				type: 'boolean',
				default: false,
				description: 'Whether to extract hidden text as translatable content',
			},
			{
				displayName: 'Extract WordArt',
				name: 'extractWordArt',
				type: 'boolean',
				default: false,
				description: 'Whether to extract WordArt text as translatable content',
			},
		],
	},
	{
		displayName: 'Excel File Options',
		name: 'excelOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: showOnlyForFileConvert,
		},
		description: 'Applied only to files with a .xls or .xlsx extension in this run; ignored for others',
		options: [
			{
				displayName: 'Excluded Colors',
				name: 'excludedColors',
				type: 'multiOptions',
				options: [
					{ name: 'Blue', value: 'Blue' },
					{ name: 'Dark Blue', value: 'Dark Blue' },
					{ name: 'Dark Red', value: 'Dark Red' },
					{ name: 'Green', value: 'Green' },
					{ name: 'Light Blue', value: 'Light Blue' },
					{ name: 'Light Green', value: 'Light Green' },
					{ name: 'Purple', value: 'Purple' },
					{ name: 'Red', value: 'Red' },
					{ name: 'Yellow', value: 'Yellow' },
				],
				default: [],
				description: 'Cell fill colors to exclude from translation',
			},
			{
				displayName: 'Excluded Columns',
				name: 'excludedColumns',
				type: 'string',
				default: '',
				placeholder: 'A,B,Z',
				description: 'Excel column letters to exclude from translation, comma-separated',
			},
			{
				displayName: 'Extract Comments',
				name: 'extractComments',
				type: 'boolean',
				default: false,
				description: 'Whether to extract comments as translatable content',
			},
			{
				displayName: 'Extract Hidden Rows/Columns',
				name: 'extractHiddenRowsColumns',
				type: 'boolean',
				default: false,
				description: 'Whether to extract hidden rows and columns as translatable content',
			},
			{
				displayName: 'Extract Sheet Names',
				name: 'extractSheetNames',
				type: 'boolean',
				default: false,
				description: 'Whether to extract sheet names as translatable content',
			},
			{
				displayName: 'Notes Column',
				name: 'notesColumn',
				type: 'string',
				default: '',
				placeholder: 'C',
				description: 'A single Excel column letter containing translator notes',
			},
		],
	},
	{
		displayName: 'JSON File Options',
		name: 'jsonOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: showOnlyForFileConvert,
		},
		description: 'Applied only to files with a .JSON extension in this run; ignored for others',
		options: [
			{
				displayName: 'Excluded Elements',
				name: 'excludedElements',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				placeholder: 'key.to.exclude\nother.key.*',
				description: 'JSON keys to exclude from translation, one pattern per line; wildcards (*) allowed',
			},
		],
	},
	{
		displayName: 'HTML File Options',
		name: 'htmlOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: showOnlyForFileConvert,
		},
		description: 'Applied only to files with a .html or .htm extension in this run; ignored for others',
		options: [
			{
				displayName: 'Included Elements',
				name: 'includedElements',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				placeholder: 'p\ndiv.translatable',
				description:
					'HTML selectors to include for translation, one pattern per line; wildcards (*) allowed. Unlike JSON, this is an include-list: only matching elements are translated.',
			},
			{
				displayName: 'Input Encoding',
				name: 'inputEncoding',
				type: 'options',
				options: [
					{ name: 'ISO-8859-1', value: 'ISO-8859-1' },
					{ name: 'US-ASCII', value: 'US-ASCII' },
					{ name: 'UTF-8', value: 'UTF-8' },
				],
				default: 'UTF-8',
				description: 'Character encoding of the source file',
			},
			{
				displayName: 'Output Encoding',
				name: 'outputEncoding',
				type: 'options',
				options: [
					{ name: 'ISO-8859-1', value: 'ISO-8859-1' },
					{ name: 'US-ASCII', value: 'US-ASCII' },
					{ name: 'UTF-8', value: 'UTF-8' },
				],
				default: 'UTF-8',
				description: 'Character encoding of the translated output file',
			},
		],
	},
	{
		displayName: 'XML File Options',
		name: 'xmlOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: showOnlyForFileConvert,
		},
		description:
			'Applied only to files with a .xml extension in this run; ignored for others. Per-tag/attribute extraction rules (TextUnited\'s "XML tags extraction settings") aren\'t supported yet — only encoding.',
		options: [
			{
				displayName: 'Input Encoding',
				name: 'inputEncoding',
				type: 'options',
				options: [
					{ name: 'ISO-8859-1', value: 'ISO-8859-1' },
					{ name: 'US-ASCII', value: 'US-ASCII' },
					{ name: 'UTF-8', value: 'UTF-8' },
				],
				default: 'UTF-8',
				description: 'Character encoding of the source file',
			},
			{
				displayName: 'Output Encoding',
				name: 'outputEncoding',
				type: 'options',
				options: [
					{ name: 'ISO-8859-1', value: 'ISO-8859-1' },
					{ name: 'US-ASCII', value: 'US-ASCII' },
					{ name: 'UTF-8', value: 'UTF-8' },
				],
				default: 'UTF-8',
				description: 'Character encoding of the translated output file',
			},
		],
	},
	{
		displayName: 'Regex File Options',
		name: 'regexOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: showOnlyForFileConvert,
		},
		description:
			'A custom regex-based extraction filter, for files that don\'t match any of the extensions above (e.g. .txt, .csv, .md, or an unrecognized format). Applied whenever configured, to any file none of the other option groups already claimed.',
		options: [
			{
				displayName: 'Pattern',
				name: 'pattern',
				type: 'string',
				default: '(.*)',
				description: 'Regular expression matching the text to extract for translation',
			},
			{
				displayName: 'Replace Group',
				name: 'replaceGroup',
				type: 'number',
				typeOptions: {
					minValue: 1,
				},
				default: 1,
				description: 'Capture group index (1 for the first "(...)" group) used to extract the translatable text',
			},
		],
	},
	{
		displayName: 'PDF Type',
		name: 'pdfType',
		type: 'options',
		options: [
			{ name: '- Let DocProcessor Decide -', value: '' },
			{
				name: 'Digital PDF',
				value: '1',
				description: 'Created by software like Word/Excel or "Print to PDF"',
			},
			{
				name: 'Scanned PDF',
				value: '2',
				description: 'A scan or image-based PDF; layout may not be preserved',
			},
		],
		default: '',
		displayOptions: {
			show: showOnlyForFileConvert,
		},
		description: 'Applied only to files with a .pdf extension in this run; ignored for others',
	},
];

/**
 * Converts every input item's binary file with DocProcessor
 * (`POST /docprocessor/Convert/old`) — the first of the "classic" file-based
 * project flow's two API calls, and deliberately its own standalone action
 * rather than an automatic first step of project creation: a workflow can
 * convert files here, inspect/store the result, and create the project in
 * a later, independent run of a "Create From Files" project operation,
 * referencing this step's pack ID (echoed back per file as `DocumentBatchId`,
 * DocProcessor's main identifier) as that operation's DocProcessor Pack ID
 * field.
 *
 * Runs once per *execution* like the "One Segment per Input Item" Segments
 * mode elsewhere on this node: every input item is converted as one file,
 * all sharing one pack ID, and one output item is returned per file.
 */
export async function convertFiles(this: IExecuteFunctions): Promise<IDataObject[]> {
	const sourceLanguageCode = this.getNodeParameter('sourceLanguageCode', 0) as string;
	// Every Convert run is its own new document batch: all files converted
	// in this run share one freshly generated ID.
	const packId = randomUUID();

	return convertFilesInDocProcessor.call(this, sourceLanguageCode, packId, {
		paragraphSegmentation: this.getNodeParameter('paragraphSegmentation', 0, false) as boolean,
		wordOptions: this.getNodeParameter('wordOptions', 0, {}) as IDataObject,
		excelOptions: this.getNodeParameter('excelOptions', 0, {}) as IDataObject,
		jsonOptions: this.getNodeParameter('jsonOptions', 0, {}) as IDataObject,
		htmlOptions: this.getNodeParameter('htmlOptions', 0, {}) as IDataObject,
		xmlOptions: this.getNodeParameter('xmlOptions', 0, {}) as IDataObject,
		regexOptions: this.getNodeParameter('regexOptions', 0, {}) as IDataObject,
		pdfType: this.getNodeParameter('pdfType', 0, '') as string,
	});
}
