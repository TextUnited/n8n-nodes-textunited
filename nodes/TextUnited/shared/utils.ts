import type { IDataObject, IExecuteFunctions, ILoadOptionsFunctions, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

/**
 * Parses a "Using JSON" field's value into an array of objects. Accepts
 * either an already-resolved array (an expression that itself evaluates to
 * an array) or a JSON string (typed literally, or produced by an expression
 * that returns a string).
 */
export function parseJsonArrayParameter(
	this: IExecuteFunctions,
	value: unknown,
	fieldName: string,
): IDataObject[] {
	let parsed: unknown = value;

	if (typeof value === 'string') {
		const trimmed = value.trim();
		parsed = trimmed === '' ? [] : JSON.parse(trimmed);
	}

	if (!Array.isArray(parsed)) {
		throw new NodeOperationError(this.getNode(), `${fieldName} must be a JSON array`);
	}

	return parsed as IDataObject[];
}

/**
 * Validates a target language's Team against the scenario that will apply
 * to it (its own override, or the project's root Scenario if unset), per
 * the `/projects/automation/multilingual` API's rules — checked client-side
 * since violating them returns an unhelpful HTTP 400 with no field-level
 * detail:
 * - Exactly one member with Translator enabled, for every scenario.
 * - Exactly one member with Proofreader enabled for scenario 2 (Human
 *   Translation + Proofreading) — required, not just allowed.
 * - No Proofreader at all for scenarios 1 (Human Translation) and 4
 *   (Automatic Translation Review).
 *
 * Only called when a team is actually provided for a language — an omitted
 * team (e.g. an agency-routed or auto-assigned language) isn't the caller's
 * responsibility to validate.
 */
export function validateScenarioTeam(
	this: IExecuteFunctions,
	targetLanguageCode: unknown,
	scenarioId: number,
	team: IDataObject[],
	options?: { itemIndex: number },
): void {
	const errorOptions = options ? { itemIndex: options.itemIndex } : undefined;
	// `team`'s entries are already mapped to DocProcessor's PascalCase wire
	// shape (IsTranslator/IsProofreader) by the caller before this runs.
	const translators = team.filter((member) => member.IsTranslator === true);
	const proofreaders = team.filter((member) => member.IsProofreader === true);

	if (translators.length !== 1) {
		throw new NodeOperationError(
			this.getNode(),
			`Team for target language "${targetLanguageCode}" must include exactly one member with Translator enabled (found ${translators.length})`,
			errorOptions,
		);
	}

	if (scenarioId === 2 && proofreaders.length !== 1) {
		throw new NodeOperationError(
			this.getNode(),
			`Team for target language "${targetLanguageCode}" must include exactly one member with Proofreader enabled for the "Human Translation + Proofreading" scenario (found ${proofreaders.length})`,
			errorOptions,
		);
	}

	if (scenarioId !== 2 && proofreaders.length > 0) {
		throw new NodeOperationError(
			this.getNode(),
			`Team for target language "${targetLanguageCode}" must not include a Proofreader for this scenario`,
			errorOptions,
		);
	}
}

/**
 * Retries an async operation once after a short delay if it throws. Used
 * for dropdown load-options calls, which run once per node-panel render and
 * can occasionally hit a transient failure on the first outbound request
 * from a given n8n process (e.g. slow credential resolution or network
 * warm-up right after a workflow is opened for the first time) — retrying
 * once resolves that without masking a genuinely broken credential or API
 * outage, since a second consecutive failure still throws normally.
 */
export async function withRetry<T>(
	this: ILoadOptionsFunctions,
	fn: () => Promise<T>,
	retries = 1,
	delayMs = 500,
): Promise<T> {
	const node = this.getNode();

	async function attempt(remaining: number): Promise<T> {
		try {
			return await fn();
		} catch (error) {
			if (remaining <= 0) {
				throw new NodeApiError(node, error as JsonObject);
			}
			await sleep(delayMs);
			return attempt(remaining - 1);
		}
	}

	return attempt(retries);
}

/**
 * `ProcessSettings` for the file-based Quality Eval processes
 * (ManagedFileProjectQualityEval / InHouseFileProjectQualityEval).
 * PrepareGlossaryTranslation is always false: the process goes straight to
 * machine translation instead of waiting for someone to translate/correct
 * the glossary first. "Critical translation" decides what happens after the
 * quality report: yes -> FollowReport (risks get a translator assigned
 * automatically, then a fresh report; still risky -> manager and client are
 * emailed; no risks -> done), no -> AlwaysComplete (project always ends
 * after machine translation; the report stays available to review).
 */
export function buildQualityEvalProcessSettings(criticalTranslation: boolean): IDataObject {
	return {
		PrepareGlossaryTranslation: false,
		AfterQualityReport: criticalTranslation ? 'FollowReport' : 'AlwaysComplete',
	};
}

/**
 * `processSettings` for the segment-based Quality Eval processes (Managed /
 * In-House Quality Eval, `POST /segments/projects`): the same "Critical
 * translation" behaviour as {@link buildQualityEvalProcessSettings}, but on
 * the segments API's camelCase wire format. The glossary setting isn't sent
 * — leaving it out means no waiting for a glossary, same as false.
 */
export function buildSegmentQualityEvalProcessSettings(criticalTranslation: boolean): IDataObject {
	return {
		afterQualityReport: criticalTranslation ? 'FollowReport' : 'AlwaysComplete',
	};
}
