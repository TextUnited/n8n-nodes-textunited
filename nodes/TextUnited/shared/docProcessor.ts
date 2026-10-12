import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { textUnitedApiRequest } from './transport';

const WORD_EXTENSIONS = ['.doc', '.docx'];
const EXCEL_EXTENSIONS = ['.xls', '.xlsx'];
const JSON_EXTENSIONS = ['.json'];
const HTML_EXTENSIONS = ['.html', '.htm'];
const XML_EXTENSIONS = ['.xml'];
const PDF_EXTENSIONS = ['.pdf'];

// DocProcessor's own numeric filter-type IDs, from TextUnited's file-customize
// frontend (its filter catalog).
const WORD_FILTER_ID = 1;
const EXCEL_FILTER_ID = 4;
const JSON_FILTER_ID = 17;
const HTML_FILTER_ID = 37;
const XML_FILTER_ID = 2;
// Regex has no extension of its own — it's the fallback filter for files
// that don't match any of the more specific types above.
const REGEX_FILTER_ID = 38;

export interface ConvertFileOptions {
	paragraphSegmentation: boolean;
	wordOptions: IDataObject;
	excelOptions: IDataObject;
	jsonOptions: IDataObject;
	htmlOptions: IDataObject;
	xmlOptions: IDataObject;
	regexOptions: IDataObject;
	pdfType: string;
}

function getExtension(fileName: string): string {
	const dotIndex = fileName.lastIndexOf('.');
	return dotIndex === -1 ? '' : fileName.slice(dotIndex).toLowerCase();
}

/**
 * Splits a multiline "one pattern per line" field into a clean string array,
 * as DocProcessor expects for JSON/HTML exclusion or inclusion lists.
 */
function parseLines(value: unknown): string[] {
	if (typeof value !== 'string' || value.trim() === '') {
		return [];
	}
	return value
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

/**
 * Builds the `FileFilters` object DocProcessor expects when overriding its
 * auto-detected filter for a file, mirroring the shape TextUnited's own
 * file-customize frontend sends (`Filters` chain + `ProjectFileFilterOptions`
 * bag) — everything here is PascalCase on the wire, like the rest of
 * DocProcessor's endpoints.
 */
function buildFileFilters(
	filterId: number,
	filterName: string,
	filterOptions: IDataObject,
): IDataObject {
	return {
		Filters: [
			{
				Id: filterId,
				FilterName: filterName,
				TemplateId: null,
				TemplateName: null,
				Order: 1,
				DefaultForExtension: true,
			},
		],
		ProjectFileFilterOptions: {
			FilterId: filterId,
			Extensions: '',
			TemplateId: null,
			Subfilter: 0,
			...filterOptions,
		},
	};
}

/**
 * Works out everything filter-related for one file, based on its extension:
 * the `FileFilters` chain override (if any type-specific option was
 * configured for that extension), plus whichever of the top-level
 * `XMLFilterOptions`/`HTMLFilterOptions`/`RegexFilterOptions`/
 * `JsonFilterOptions`/`PdfType` fields DocProcessor actually reads from for
 * conversion (`FileFilters` itself appears to be more of an audit/template
 * record than what drives conversion, per TextUnited's own frontend).
 *
 * Each type-specific option group only applies to its own extension(s) —
 * Regex is the exception, applying whenever configured and no more specific
 * type already matched, since it has no extension of its own.
 */
function buildFileConversionOptions(
	extension: string,
	options: ConvertFileOptions,
): IDataObject {
	const { paragraphSegmentation, wordOptions, excelOptions, jsonOptions, htmlOptions, xmlOptions, regexOptions, pdfType } =
		options;

	if (WORD_EXTENSIONS.includes(extension) && Object.keys(wordOptions).length > 0) {
		return {
			FileFilters: buildFileFilters(WORD_FILTER_ID, 'MS Word', {
				SegmentationParagraph: paragraphSegmentation,
				MSWordExtractHiddenText: wordOptions.extractHiddenText ?? false,
				MSWordExtractComments: wordOptions.extractComments ?? false,
				MSWordExtractWordArt: wordOptions.extractWordArt ?? false,
			}),
		};
	}

	if (EXCEL_EXTENSIONS.includes(extension) && Object.keys(excelOptions).length > 0) {
		return {
			FileFilters: buildFileFilters(EXCEL_FILTER_ID, 'MS Excel', {
				SegmentationParagraph: paragraphSegmentation,
				MSExcelExtractHiddenRowsColumns: excelOptions.extractHiddenRowsColumns ?? false,
				MSExcelExtractSheetNames: excelOptions.extractSheetNames ?? false,
				MSExcelExtractComments: excelOptions.extractComments ?? false,
				MSExcelExcludedColumns: excelOptions.excludedColumns ?? '',
				MSExcelNotesColumn: excelOptions.notesColumn ?? '',
				MSExcelExcludedColors: ((excelOptions.excludedColors as string[]) ?? []).join(','),
			}),
		};
	}

	if (JSON_EXTENSIONS.includes(extension) && Object.keys(jsonOptions).length > 0) {
		const regexExceptions = parseLines(jsonOptions.excludedElements);
		return {
			FileFilters: buildFileFilters(JSON_FILTER_ID, 'JSON', {
				SegmentationParagraph: paragraphSegmentation,
				JsonHtmlRegex: jsonOptions.excludedElements ?? '',
				JsonHtmlRegexInclude: false,
			}),
			JsonFilterOptions: { JsonHtmlRegexInclude: false, regexExceptions },
		};
	}

	if (HTML_EXTENSIONS.includes(extension) && Object.keys(htmlOptions).length > 0) {
		const regexExceptions = parseLines(htmlOptions.includedElements);
		const inputEncoding = (htmlOptions.inputEncoding as string) || 'UTF-8';
		const outputEncoding = (htmlOptions.outputEncoding as string) || 'UTF-8';
		return {
			FileFilters: buildFileFilters(HTML_FILTER_ID, 'HTML', {
				SegmentationParagraph: paragraphSegmentation,
				JsonHtmlRegex: htmlOptions.includedElements ?? '',
				JsonHtmlRegexInclude: true,
			}),
			HTMLFilterOptions: { InputEncoding: inputEncoding, OutputEncoding: outputEncoding },
			// Quirk carried over from TextUnited's own file-customize tooling:
			// HTML's include-list is actually sent on the wire via
			// JsonFilterOptions, not HTMLFilterOptions.
			JsonFilterOptions: { JsonHtmlRegexInclude: true, regexExceptions },
		};
	}

	if (XML_EXTENSIONS.includes(extension) && Object.keys(xmlOptions).length > 0) {
		const inputEncoding = (xmlOptions.inputEncoding as string) || 'UTF-8';
		const outputEncoding = (xmlOptions.outputEncoding as string) || 'UTF-8';
		return {
			FileFilters: buildFileFilters(XML_FILTER_ID, 'XML', {
				SegmentationParagraph: paragraphSegmentation,
				XMLInputEncoding: inputEncoding,
				XMLOutputEncoding: outputEncoding,
			}),
			XMLFilterOptions: {
				InputEncoding: inputEncoding,
				OutputEncoding: outputEncoding,
				UseEncodingDeclaration: true,
				Extensions: extension,
			},
		};
	}

	if (Object.keys(regexOptions).length > 0) {
		const pattern = (regexOptions.pattern as string) || '(.*)';
		const replaceGroup = (regexOptions.replaceGroup as number) ?? 1;
		return {
			FileFilters: buildFileFilters(REGEX_FILTER_ID, 'Regex', {
				SegmentationParagraph: paragraphSegmentation,
				RegexPattern: pattern,
				RegexReplaceGroup: replaceGroup,
			}),
			RegexFilterOptions: { RegexPattern: pattern, RegexReplaceGroup: replaceGroup },
		};
	}

	if (PDF_EXTENSIONS.includes(extension) && pdfType) {
		return { PdfType: Number(pdfType) };
	}

	return {};
}

/**
 * Uploads every input item's binary file to DocProcessor
 * (`POST /docprocessor/Convert/old`), tagging every upload with the given pack
 * ID so a later, separate `POST /projects/automation/multilingual` call
 * (the "Create From Files" project operations) can pull every file into one
 * project via `DocProcessorPackId`. Used by the standalone File → Convert
 * action — converting and project creation are deliberately two separate
 * node actions, not one chained flow, so a workflow can convert files in
 * one step and create the project in a later, independent step.
 *
 * Every `*Options` field in {@link ConvertFileOptions} is applied per file
 * based on its own extension (detected from its filename) rather than
 * blindly on every file in the run — so a batch mixing file types never
 * sends e.g. Word options for an Excel file. Regex is the one exception: it
 * has no extension of its own, so it applies whenever configured and no
 * more specific type already matched that file.
 *
 * An input item usually holds exactly one file (e.g. one item per file from
 * Read/Write Files from Disk) — but a multi-file upload field (e.g. an n8n
 * Form Trigger's "File" field allowing multiple files) instead bundles every
 * file into a *single* item, one binary property per file (`data_0`,
 * `data_1`, ...). To handle both shapes: if **Binary Property** names a
 * specific property, only that one file is converted per item (the
 * original, explicit behavior); if left empty, every binary property found
 * on the item is converted.
 *
 * DocProcessor's endpoints use PascalCase field names on the wire — unlike
 * every other endpoint on this node, which is camelCase. This is
 * intentional; don't "fix" the casing below.
 */
export async function convertFilesInDocProcessor(
	this: IExecuteFunctions,
	sourceLanguageCode: string,
	packId: string,
	fileOptions: ConvertFileOptions,
): Promise<IDataObject[]> {
	const items = this.getInputData();

	if (items.length === 0) {
		throw new NodeOperationError(
			this.getNode(),
			'At least one input item is required — each input item is converted as one file',
		);
	}

	const results: IDataObject[] = [];

	for (let i = 0; i < items.length; i++) {
		const binaryPropertyNameInput = this.getNodeParameter('binaryPropertyName', i, '') as string;
		const binaryPropertyNames = binaryPropertyNameInput
			? [binaryPropertyNameInput]
			: Object.keys(items[i].binary ?? {});

		if (binaryPropertyNames.length === 0) {
			throw new NodeOperationError(this.getNode(), `Item ${i} has no binary data to convert`, {
				itemIndex: i,
			});
		}

		for (const binaryPropertyName of binaryPropertyNames) {
			const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
			const fileBuffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
			const fileName = binaryData.fileName ?? binaryPropertyName;
			const extension = getExtension(fileName);
			const conversionOptions = buildFileConversionOptions(extension, fileOptions);

			const conversionResult = (await textUnitedApiRequest.call(
				this,
				'POST',
				'/docprocessor/Convert/old',
				{
					DocumentBatchId: packId,
					FileName: fileName,
					// No real filesystem path exists for an n8n binary item, so —
					// same as TextUnited's own portal does when it has no path
					// either — this is set to the file name. Required: without it,
					// project creation fails later with FILE_ORGFILEPATH NOT NULL.
					FilePath: fileName,
					Base64File: fileBuffer.toString('base64'),
					SourceLanguageCode: sourceLanguageCode,
					FileSource: 0,
					ParagraphSegmentation: fileOptions.paragraphSegmentation,
					...conversionOptions,
				},
			)) as IDataObject;

			// A non-zero DocProcessingError means DocProcessor accepted the HTTP
			// request but failed to actually process this specific file (e.g. an
			// unsupported/corrupt file) — that failure never surfaces as an HTTP
			// error, so it has to be checked explicitly here rather than left for
			// a later project-creation call to trip over a broken pack.
			const docProcessingError = conversionResult?.DocProcessingError;
			if (typeof docProcessingError === 'number' && docProcessingError !== 0) {
				throw new NodeOperationError(
					this.getNode(),
					`DocProcessor failed to process "${fileName}" (DocProcessingError: ${docProcessingError})${
						conversionResult.Warning ? ` — ${conversionResult.Warning as string}` : ''
					}`,
					{ itemIndex: i },
				);
			}

			results.push(conversionResult);
		}
	}

	return results;
}
