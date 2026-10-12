import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

/**
 * Performs an authenticated request against the TextUnited API. Authentication
 * (a personal access token sent as a Bearer header) is added automatically
 * from the `textUnitedApi` credential. The base URL also comes from the
 * credential, so requests can be pointed at a non-production TextUnited
 * environment without any code changes.
 */
export async function textUnitedApiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
): Promise<IDataObject | IDataObject[]> {
	const credentials = await this.getCredentials('textUnitedApi');
	const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		body,
		json: true,
	};

	if (method === 'GET' || Object.keys(body).length === 0) {
		delete options.body;
	}

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'textUnitedApi',
			options,
		)) as IDataObject | IDataObject[];
	} catch (error) {
		// TextUnited's error responses don't always match the `{ message }`
		// shape NodeApiError looks for by default (e.g. ASP.NET-style
		// validation errors nest details under `errors`), so surface the raw
		// response body verbatim. We also include exactly what we sent —
		// n8n's error panel only shows the response by default, and this is
		// the only node-level place that knows the outgoing request.
		const responseBody = (error as { response?: { data?: unknown } })?.response?.data;
		const responseText = responseBody
			? typeof responseBody === 'string'
				? responseBody
				: JSON.stringify(responseBody)
			: '(no response body)';

		const description = [
			`Request: ${method} ${options.url}`,
			`Body sent: ${options.body ? JSON.stringify(options.body) : '(none)'}`,
			`Response: ${responseText}`,
		].join('\n');

		throw new NodeApiError(this.getNode(), error as JsonObject, { description });
	}
}

/**
 * Performs an authenticated request the same way as {@link textUnitedApiRequest},
 * but for an endpoint that returns a raw binary body (e.g. a ZIP file)
 * instead of JSON — used by Machine Translation's download endpoint. Returns
 * the body as a Buffer, along with the response headers (so a filename can
 * be read from `Content-Disposition` when the API provides one).
 */
export async function textUnitedBinaryApiRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
): Promise<{ body: Buffer; headers: IDataObject }> {
	const credentials = await this.getCredentials('textUnitedApi');
	const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');
	const url = `${baseUrl}${endpoint}`;

	try {
		const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'textUnitedApi', {
			method,
			url,
			json: false,
			encoding: 'arraybuffer',
			returnFullResponse: true,
		})) as { body: ArrayBuffer; headers: IDataObject };

		return { body: Buffer.from(response.body), headers: response.headers ?? {} };
	} catch (error) {
		// Unlike the JSON path above, an error response body here comes back
		// as raw bytes too (not pre-parsed), so it's decoded as text and, if
		// it looks like JSON, pretty-printed — otherwise shown as-is.
		const responseBody = (error as { response?: { data?: unknown } })?.response?.data;
		let responseText = '(no response body)';

		if (responseBody) {
			const raw =
				typeof responseBody === 'string'
					? responseBody
					: Buffer.isBuffer(responseBody) || responseBody instanceof ArrayBuffer
						? Buffer.from(responseBody as ArrayBuffer).toString('utf8')
						: JSON.stringify(responseBody);

			try {
				responseText = JSON.stringify(JSON.parse(raw));
			} catch {
				responseText = raw;
			}
		}

		const description = [`Request: ${method} ${url}`, `Response: ${responseText}`].join('\n');

		throw new NodeApiError(this.getNode(), error as JsonObject, { description });
	}
}
