/**
 * U0 helper: Local mock HTTP server for runtime tests.
 *
 * Uses node:http built-in. Returns { server, url, cleanup }.
 * Supports configurable responses: status, headers, body, delay, redirect.
 */
import http from "node:http";

/**
 * @param {object} config
 * @param {number} [config.status=200]
 * @param {object} [config.headers={}]
 * @param {string} [config.body="ok"]
 * @param {number} [config.delay=0] - ms before response
 * @param {string} [config.redirect] - if set, responds with 302 + Location header
 * @param {function} [config.handler] - custom handler(req, res)
 * @returns {Promise<{server: http.Server, url: string, cleanup: () => Promise<void>}>}
 */
export async function createMockServer(config = {}) {
	const {
		status = 200,
		headers = {},
		body = "ok",
		delay = 0,
		redirect = null,
		handler = null,
	} = config;

	const server = http.createServer((req, res) => {
		if (handler) {
			handler(req, res);
			return;
		}

		const responseHeaders = { ...headers };
		let responseStatus = status;

		if (redirect) {
			responseStatus = 302;
			responseHeaders["Location"] = redirect;
		}

		if (delay > 0) {
			setTimeout(() => {
				res.writeHead(responseStatus, responseHeaders);
				res.end(body);
			}, delay);
		} else {
			res.writeHead(responseStatus, responseHeaders);
			res.end(body);
		}
	});

	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

	const addr = server.address();
	const url = `http://127.0.0.1:${addr.port}`;

	const cleanup = () => new Promise((resolve) => server.close(resolve));

	return { server, url, cleanup };
}
