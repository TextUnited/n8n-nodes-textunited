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
