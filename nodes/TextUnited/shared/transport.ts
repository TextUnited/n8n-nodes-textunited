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
