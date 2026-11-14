import { l as companionEndpoint, s as readLimitedBody, t as createBookBridge } from "./book-bridge-BqFQdaGx.mjs";
import { createRequire } from "node:module";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function() {
	return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __require = /* @__PURE__ */ createRequire(import.meta.url);

//#endregion
//#region vendor/readest/apps/readest-app/src/libs/opdsUserAgent.ts
const READEST_OPDS_USER_AGENT = "Readest/1.0 (OPDS Browser)";

//#endregion
//#region vendor/readest/apps/readest-app/src/utils/customHeaders.ts
/**
* RFC 7230 token characters — the only ones an HTTP header name may
* contain. `new Headers()` and `fetch` throw a TypeError on anything else
* (`My Header` with a space is the easy mistake), and KOSyncClient's
* per-request try/catch swallows that into a console error, so the sync
* loop would just stop working with no user-visible signal.
*
* Screened in two places: `parseCustomHeadersInput` rejects it so the
* form shows an actionable error, and `normalizeCustomHeaders` drops it
* so values that never went through the parser — settings written by an
* older build, hand-edited config, a value pulled from another device —
* can't take the request path down either.
*/
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const isValidHeaderName = (name$1) => HEADER_NAME_PATTERN.test(name$1);
const normalizeCustomHeaders = (headers) => {
	return Object.fromEntries(Object.entries(headers ?? {}).map(([key, value]) => [key.trim(), String(value).trim()]).filter(([key, value]) => isValidHeaderName(key) && value.length > 0));
};
const deserializeCustomHeaders = (value) => {
	if (!value) return {};
	try {
		const parsed = JSON.parse(value);
		if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return {};
		return normalizeCustomHeaders(parsed);
	} catch {
		return {};
	}
};

//#endregion
//#region vendor/readest/apps/readest-app/src/utils/network.ts
/** Whether a dotted-decimal IPv4 address falls in a private / reserved range. */
function isBlockedV4(a, b, c, _d) {
	if (a === 0 || a === 10 || a === 127) return true;
	if (a === 169 && b === 254) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	if (a === 192 && b === 0 && c === 0) return true;
	if (a === 198 && (b === 18 || b === 19)) return true;
	if (a >= 224) return true;
	return false;
}
/**
* Canonical SSRF host blocklist, shared by every server route that fetches a
* client-supplied URL (`/api/opds/proxy`, `/api/kosync`, `/api/send/fetch-url`).
* Returns true for hosts that must never be reached: loopback, private,
* link-local, CGNAT, benchmarking, multicast, internal hostname suffixes, and
* bare single-label names.
*
* Input is a hostname as the WHATWG URL parser serializes it (decimal/hex/octal
* IPv4 already normalized to dotted-quad) or a resolved IP address. Trailing
* dots are stripped first: `localhost.` is the same DNS name as `localhost`.
* This is a string check — a public name whose DNS records point at a private
* address is caught at connect time by `publicFetch` on Node servers.
*/
function isBlockedHost(hostname) {
	const h = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
	if (!h) return true;
	if (h === "localhost" || h.endsWith(".localhost")) return true;
	if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return true;
	if (!h.includes(".") && !h.includes(":")) return true;
	const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (v4) return isBlockedV4(Number(v4[1]), Number(v4[2]), Number(v4[3]), Number(v4[4]));
	if (h.includes(":")) {
		if (h === "::" || h === "::1") return true;
		if (/^(fc|fd)/.test(h)) return true;
		if (/^fe[89ab]/.test(h)) return true;
		const mapped = h.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
		if (mapped) return isBlockedV4(Number(mapped[1]), Number(mapped[2]), Number(mapped[3]), Number(mapped[4]));
		const hexMapped = h.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
		if (hexMapped) {
			const hi = parseInt(hexMapped[1] ?? "0", 16);
			const lo = parseInt(hexMapped[2] ?? "0", 16);
			return isBlockedV4(hi >> 8 & 255, hi & 255, lo >> 8 & 255, lo & 255);
		}
		return false;
	}
	return false;
}

//#endregion
//#region vendor/readest/apps/readest-app/src/utils/publicFetch.ts
const DEFAULT_IDLE_TIMEOUT_MS = 3e5;
const blockedError = (subject) => Object.assign(/* @__PURE__ */ new Error(`${subject} an internal address`), { code: "EBLOCKEDADDRESS" });
/**
* Wrap a DNS lookup so a connection is refused when the name resolves to any
* loopback, private, link-local or otherwise internal address. Used as the
* socket's `lookup`, so the address checked is the address connected to.
*/
const createPublicLookup = (lookup) => (hostname, options, callback) => {
	lookup(hostname, {
		...options,
		all: true
	}, (err, addresses) => {
		if (err) return callback(err, "");
		if (!addresses.length || addresses.some(({ address }) => isBlockedHost(address))) return callback(blockedError(`${hostname} resolves to`), "");
		if (options.all) return callback(null, addresses);
		callback(null, addresses[0].address, addresses[0].family);
	});
};
const pools = /* @__PURE__ */ new WeakMap();
let publicLookup;
/** Issue one request over node:http(s) with the given lookup. Never follows redirects. */
async function fetchWithLookup(url, init, lookup) {
	const [http$2, https$1, zlib$1, { Readable: Readable$2, pipeline: pipeline$1 }] = await Promise.all([
		import("node:http"),
		import("node:https"),
		import("node:zlib"),
		import("node:stream")
	]);
	let pool = pools.get(lookup);
	if (!pool) {
		pool = {
			http: new http$2.Agent({ keepAlive: true }),
			https: new https$1.Agent({ keepAlive: true })
		};
		pools.set(lookup, pool);
	}
	const target = new URL(url);
	const isHttps = target.protocol === "https:";
	const method = (init.method ?? "GET").toUpperCase();
	const headers = new Headers(init.headers);
	if (!headers.has("accept-encoding")) headers.set("accept-encoding", "gzip, deflate, br");
	if (init.body != null) headers.set("content-length", String(Buffer.byteLength(init.body)));
	const decoders = {
		gzip: zlib$1.createGunzip,
		"x-gzip": zlib$1.createGunzip,
		deflate: zlib$1.createInflate,
		br: zlib$1.createBrotliDecompress
	};
	return new Promise((resolve, reject) => {
		const request = (isHttps ? https$1 : http$2).request(target, {
			method,
			headers: Object.fromEntries(headers),
			signal: init.signal,
			lookup,
			agent: isHttps ? pool.https : pool.http
		}, (res) => {
			const status = res.statusCode ?? 502;
			const responseHeaders = new Headers();
			for (const [name$1, value] of Object.entries(res.headers)) {
				if (value === void 0) continue;
				for (const item of Array.isArray(value) ? value : [value]) responseHeaders.append(name$1, item);
			}
			if (method === "HEAD" || [
				204,
				205,
				304
			].includes(status)) {
				res.resume();
				return resolve(new Response(null, {
					status,
					headers: responseHeaders
				}));
			}
			const decode = decoders[res.headers["content-encoding"]?.trim().toLowerCase() ?? ""];
			const body = decode ? pipeline$1(res, decode(), () => {}) : res;
			resolve(new Response(Readable$2.toWeb(body), {
				status,
				headers: responseHeaders
			}));
		});
		request.setTimeout(init.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS, () => request.destroy(Object.assign(/* @__PURE__ */ new Error("Request timed out"), { code: "ETIMEDOUT" })));
		request.on("error", reject);
		request.end(init.body ?? void 0);
	});
}
const isNodeServer = () => typeof window === "undefined" && globalThis.process?.release?.name === "node" && globalThis.navigator?.userAgent !== "Cloudflare-Workers";
/**
* Fetch a client-supplied URL that must only reach the public internet. On a
* Node server the resolved address of every connection is checked, so a
* public name pointing at an internal address (including DNS rebinding
* between a check and the connect) is refused. Never follows redirects;
* callers re-validate each hop.
*/
async function publicFetch(url, init) {
	if (!isNodeServer()) return fetch(url, {
		...init,
		redirect: "manual"
	});
	const { hostname } = new URL(url);
	if (isBlockedHost(hostname)) throw blockedError(`${hostname} is`);
	const { default: dns } = await import("node:dns");
	publicLookup ??= createPublicLookup((name$1, options, callback) => dns.lookup(name$1, options, callback));
	return fetchWithLookup(url, init, publicLookup);
}

//#endregion
//#region vendor/readest/apps/readest-app/src/app/api/opds/proxy/route.ts
const MAX_REDIRECTS = 5;
const isPrivateHostAllowed = (hostname) => {
	if (process.env.NODE_ENV === "development") return true;
	const normalize = (host) => {
		const value = host.trim().toLowerCase().replace(/\.+$/, "");
		if (/^\[[\da-f:.]+\]$/.test(value)) try {
			return new URL(`http://${value}`).hostname;
		} catch {
			return "";
		}
		return value;
	};
	return (process.env["READEST_TRUSTED_PRIVATE_HOSTS"] ?? "").split(",").some((host) => normalize(host) !== "" && normalize(host) === normalize(hostname));
};
/**
* Fetch the target while running the SSRF host check on every redirect hop.
* `fetch`'s default `redirect: 'follow'` would let a public URL 302 to an
* internal address (e.g. the cloud metadata endpoint) after our initial host
* check passed, so we follow redirects manually and re-validate each hop.
* Throws `SsrfBlockedError` when a hop targets a blocked host or scheme.
*/
var SsrfBlockedError = class extends Error {};
const sanitizeXmlBuffer = (buf) => {
	let text = "";
	const bytes = new Uint8Array(buf);
	for (const byte of bytes) text += String.fromCharCode(byte);
	let out = "";
	let inCdata = false;
	for (let i = 0; i < text.length; i++) {
		if (!inCdata && text.startsWith("<![CDATA[", i)) {
			inCdata = true;
			out += "<![CDATA[";
			i += 8;
			continue;
		}
		if (inCdata && text.startsWith("]]>", i)) {
			inCdata = false;
			out += "]]>";
			i += 2;
			continue;
		}
		if (!inCdata && text[i] === "&" && !text.slice(i).match(/^&(amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/)) {
			out += "&amp;";
			continue;
		}
		out += text[i];
	}
	const outBytes = new Uint8Array(out.length);
	for (let i = 0; i < out.length; i++) outBytes[i] = out.charCodeAt(i) & 255;
	return outBytes.buffer;
};
async function fetchFollowingRedirects(startUrl, init) {
	let currentUrl = startUrl;
	let headers = new Headers(init.headers);
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const parsed = new URL(currentUrl);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new SsrfBlockedError("Only http(s) URLs are supported");
		const allowPrivateHost = isPrivateHostAllowed(parsed.hostname);
		if (!allowPrivateHost && isBlockedHost(parsed.hostname)) throw new SsrfBlockedError("This URL is not allowed");
		const response = allowPrivateHost ? await fetch(currentUrl, {
			...init,
			headers,
			redirect: "manual"
		}) : await publicFetch(currentUrl, {
			...init,
			headers
		});
		if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
			const nextUrl = new URL(response.headers.get("location"), currentUrl);
			if (nextUrl.origin !== parsed.origin) headers = new Headers({
				"User-Agent": READEST_OPDS_USER_AGENT,
				Accept: "application/atom+xml, application/xml, text/xml, application/json, */*"
			});
			await response.body?.cancel();
			currentUrl = nextUrl.toString();
			continue;
		}
		return response;
	}
	throw new SsrfBlockedError("Too many redirects");
}
async function handleRequest(request, method) {
	const fullUrl = request.url;
	const urlParamStart = fullUrl.indexOf("url=") + 4;
	const streamParam = fullUrl.lastIndexOf("&stream=");
	const authParam = fullUrl.lastIndexOf("&auth=");
	const headersParam = fullUrl.lastIndexOf("&headers=");
	const urlParamEnd = Math.min(...[
		streamParam,
		authParam,
		headersParam
	].filter((i) => i > 0), fullUrl.length);
	const encodedUrl = fullUrl.substring(urlParamStart, urlParamEnd);
	const url = decodeURIComponent(encodedUrl);
	const auth = request.headers.get("authorization") || new URL(request.url).searchParams.get("auth");
	const stream = new URL(request.url).searchParams.get("stream");
	const customHeaders = deserializeCustomHeaders(new URL(request.url).searchParams.get("headers"));
	if (!url) return Response.json({ error: "Missing URL parameter. Usage: /api/opds/proxy?url=YOUR_OPDS_URL" }, { status: 400 });
	let parsedUrl;
	try {
		parsedUrl = new URL(url);
	} catch {
		return Response.json({ error: "Invalid URL format" }, { status: 400 });
	}
	if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return Response.json({ error: "Only http(s) URLs are supported" }, { status: 400 });
	if (!isPrivateHostAllowed(parsedUrl.hostname) && isBlockedHost(parsedUrl.hostname)) return Response.json({ error: "This URL is not allowed" }, { status: 400 });
	try {
		console.log(`[OPDS Proxy] ${method}: ${url}`);
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 2e4);
		const headers = new Headers({
			"User-Agent": READEST_OPDS_USER_AGENT,
			Accept: "application/atom+xml, application/xml, text/xml, application/json, */*"
		});
		for (const [key, value] of Object.entries(customHeaders)) headers.set(key, value);
		if (auth) headers.set("Authorization", auth);
		const response = await fetchFollowingRedirects(url, {
			method,
			headers,
			signal: controller.signal
		});
		clearTimeout(timeout);
		const excludedHeaders = new Set([
			"content-encoding",
			"content-length",
			"transfer-encoding",
			"connection",
			"keep-alive"
		]);
		const upstreamHeaders = Object.fromEntries([...response.headers.entries()].filter(([key]) => !excludedHeaders.has(key.toLowerCase())));
		if (!response.ok) {
			console.error(`[OPDS Proxy] HTTP ${response.status} for ${url}`);
			if (method === "HEAD") {
				if (response.status === 401) return new Response(null, {
					status: 403,
					headers: {
						...upstreamHeaders,
						"Cache-Control": "no-store",
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
						"Access-Control-Allow-Headers": "Content-Type"
					}
				});
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const data = await response.text();
			if (response.status === 401) return new Response(data, {
				status: 403,
				headers: {
					...upstreamHeaders,
					"Cache-Control": "no-store",
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type"
				}
			});
			return new Response(data, {
				status: response.status,
				headers: {
					...upstreamHeaders,
					"Cache-Control": "no-store",
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type"
				}
			});
		}
		const contentType = response.headers.get("Content-Type") || "text/xml";
		const contentLength = response.headers.get("Content-Length");
		const contentEncoding = response.headers.get("Content-Encoding");
		const transferEncoding = response.headers.get("Transfer-Encoding");
		const upstreamContentDisposition = response.headers.get("Content-Disposition");
		console.log(`[OPDS Proxy] upstream OK: ${url} content-type=${contentType} content-length=${contentLength ?? "(none)"} content-encoding=${contentEncoding ?? "(none)"} transfer-encoding=${transferEncoding ?? "(none)"} content-disposition=${upstreamContentDisposition ?? "(none)"}`);
		const buildResponseHeaders = (extras) => {
			const h = new Headers();
			for (const [key, value] of response.headers.entries()) if (!excludedHeaders.has(key.toLowerCase())) h.set(key, value);
			const isFileDownload = stream === "true" || (upstreamContentDisposition ?? "").toLowerCase().includes("attachment");
			h.set("Cache-Control", isFileDownload || auth || Object.keys(customHeaders).length ? "no-store" : "public, max-age=300");
			h.set("Vary", "Authorization");
			h.set("Access-Control-Allow-Origin", "*");
			h.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
			h.set("Access-Control-Allow-Headers", "Content-Type");
			for (const [key, value] of Object.entries(extras)) h.set(key, value);
			return h;
		};
		if (method === "HEAD") {
			console.log(`[OPDS Proxy] HEAD Success: ${url}`);
			return new Response(null, {
				status: 200,
				headers: buildResponseHeaders({
					"Content-Type": contentType,
					...contentLength ? { "Content-Length": contentLength } : {}
				})
			});
		}
		if (stream === "true" && contentLength && parseInt(contentLength) > 1024 * 1024) {
			console.log(`[OPDS Proxy] Streaming: ${url} (${contentLength} bytes)`);
			const headers$1 = buildResponseHeaders({
				"Content-Type": contentType,
				"X-Content-Length": contentLength,
				"Access-Control-Expose-Headers": "X-Content-Length"
			});
			return new Response(response.body, {
				status: 200,
				headers: headers$1
			});
		} else {
			let buf = await response.arrayBuffer();
			if (contentType.toLowerCase().includes("xml")) buf = sanitizeXmlBuffer(buf);
			const length = buf.byteLength;
			console.log(`[OPDS Proxy] Buffered Success: ${url} (${length} bytes)`);
			return new Response(buf, {
				status: 200,
				headers: buildResponseHeaders({
					"Content-Type": contentType,
					"Content-Length": length.toString()
				})
			});
		}
	} catch (error) {
		console.error("[OPDS Proxy] Error:", error);
		if (error instanceof SsrfBlockedError) return Response.json({ error: error.message }, { status: 400 });
		if (error instanceof Error) {
			if (error.name === "AbortError") return Response.json({ error: "Request timeout - the OPDS server took too long to respond" }, { status: 504 });
			return Response.json({
				error: error.message,
				url,
				hint: "Check if the OPDS URL is accessible and returns valid OPDS/Atom/JSON content"
			}, { status: 500 });
		}
		return Response.json({
			error: "Failed to fetch OPDS feed",
			url
		}, { status: 500 });
	}
}
function isolateProxyResponse(response) {
	const allowedHeaders = new Set([
		"content-type",
		"content-length",
		"content-disposition",
		"content-range",
		"accept-ranges",
		"etag",
		"last-modified",
		"cache-control",
		"vary",
		"www-authenticate",
		"x-content-length",
		"access-control-allow-origin",
		"access-control-allow-methods",
		"access-control-allow-headers",
		"access-control-expose-headers"
	]);
	for (const key of [...response.headers.keys()]) if (!allowedHeaders.has(key)) response.headers.delete(key);
	const mime$1 = response.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() ?? "";
	if (!/^(?:image\/(?:png|jpeg|gif|webp|avif|svg\+xml)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|text\/(?:plain|xml)|application\/(?:[a-z0-9.+-]+\+(?:xml|json)|xml|json|pdf|epub\+zip|zip|octet-stream))$/.test(mime$1)) response.headers.set("Content-Type", "application/octet-stream");
	response.headers.set("Content-Security-Policy", "sandbox; default-src 'none'; frame-ancestors 'none'");
	response.headers.set("X-Content-Type-Options", "nosniff");
	return response;
}
async function GET(request) {
	return isolateProxyResponse(await handleRequest(request, "GET"));
}
async function HEAD(request) {
	return isolateProxyResponse(await handleRequest(request, "HEAD"));
}

//#endregion
//#region vendor/readest/node_modules/.pnpm/js-md5@0.8.3/node_modules/js-md5/src/md5.js
var require_md5 = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/js-md5@0.8.3/node_modules/js-md5/src/md5.js": ((exports, module) => {
	/**
	* [js-md5]{@link https://github.com/emn178/js-md5}
	*
	* @namespace md5
	* @version 0.8.3
	* @author Chen, Yi-Cyuan [emn178@gmail.com]
	* @copyright Chen, Yi-Cyuan 2014-2023
	* @license MIT
	*/
	(function() {
		var INPUT_ERROR = "input is invalid type";
		var FINALIZE_ERROR = "finalize already called";
		var WINDOW = typeof window === "object";
		var root = WINDOW ? window : {};
		if (root.JS_MD5_NO_WINDOW) WINDOW = false;
		var WEB_WORKER = !WINDOW && typeof self === "object";
		var NODE_JS = !root.JS_MD5_NO_NODE_JS && typeof process === "object" && process.versions && process.versions.node;
		if (NODE_JS) root = global;
		else if (WEB_WORKER) root = self;
		var COMMON_JS = !root.JS_MD5_NO_COMMON_JS && typeof module === "object" && module.exports;
		var AMD = typeof define === "function" && define.amd;
		var ARRAY_BUFFER = !root.JS_MD5_NO_ARRAY_BUFFER && typeof ArrayBuffer !== "undefined";
		var HEX_CHARS = "0123456789abcdef".split("");
		var EXTRA = [
			128,
			32768,
			8388608,
			-2147483648
		];
		var SHIFT = [
			0,
			8,
			16,
			24
		];
		var OUTPUT_TYPES = [
			"hex",
			"array",
			"digest",
			"buffer",
			"arrayBuffer",
			"base64"
		];
		var BASE64_ENCODE_CHAR = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
		var blocks = [], buffer8;
		if (ARRAY_BUFFER) {
			var buffer = /* @__PURE__ */ new ArrayBuffer(68);
			buffer8 = new Uint8Array(buffer);
			blocks = new Uint32Array(buffer);
		}
		var isArray = Array.isArray;
		if (root.JS_MD5_NO_NODE_JS || !isArray) isArray = function(obj) {
			return Object.prototype.toString.call(obj) === "[object Array]";
		};
		var isView = ArrayBuffer.isView;
		if (ARRAY_BUFFER && (root.JS_MD5_NO_ARRAY_BUFFER_IS_VIEW || !isView)) isView = function(obj) {
			return typeof obj === "object" && obj.buffer && obj.buffer.constructor === ArrayBuffer;
		};
		var formatMessage = function(message) {
			var type = typeof message;
			if (type === "string") return [message, true];
			if (type !== "object" || message === null) throw new Error(INPUT_ERROR);
			if (ARRAY_BUFFER && message.constructor === ArrayBuffer) return [new Uint8Array(message), false];
			if (!isArray(message) && !isView(message)) throw new Error(INPUT_ERROR);
			return [message, false];
		};
		/**
		* @method hex
		* @memberof md5
		* @description Output hash as hex string
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {String} Hex string
		* @example
		* md5.hex('The quick brown fox jumps over the lazy dog');
		* // equal to
		* md5('The quick brown fox jumps over the lazy dog');
		*/
		/**
		* @method digest
		* @memberof md5
		* @description Output hash as bytes array
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {Array} Bytes array
		* @example
		* md5.digest('The quick brown fox jumps over the lazy dog');
		*/
		/**
		* @method array
		* @memberof md5
		* @description Output hash as bytes array
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {Array} Bytes array
		* @example
		* md5.array('The quick brown fox jumps over the lazy dog');
		*/
		/**
		* @method arrayBuffer
		* @memberof md5
		* @description Output hash as ArrayBuffer
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {ArrayBuffer} ArrayBuffer
		* @example
		* md5.arrayBuffer('The quick brown fox jumps over the lazy dog');
		*/
		/**
		* @method buffer
		* @deprecated This maybe confuse with Buffer in node.js. Please use arrayBuffer instead.
		* @memberof md5
		* @description Output hash as ArrayBuffer
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {ArrayBuffer} ArrayBuffer
		* @example
		* md5.buffer('The quick brown fox jumps over the lazy dog');
		*/
		/**
		* @method base64
		* @memberof md5
		* @description Output hash as base64 string
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {String} base64 string
		* @example
		* md5.base64('The quick brown fox jumps over the lazy dog');
		*/
		var createOutputMethod = function(outputType) {
			return function(message) {
				return new Md5(true).update(message)[outputType]();
			};
		};
		/**
		* @method create
		* @memberof md5
		* @description Create Md5 object
		* @returns {Md5} Md5 object.
		* @example
		* var hash = md5.create();
		*/
		/**
		* @method update
		* @memberof md5
		* @description Create and update Md5 object
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {Md5} Md5 object.
		* @example
		* var hash = md5.update('The quick brown fox jumps over the lazy dog');
		* // equal to
		* var hash = md5.create();
		* hash.update('The quick brown fox jumps over the lazy dog');
		*/
		var createMethod = function() {
			var method = createOutputMethod("hex");
			if (NODE_JS) method = nodeWrap(method);
			method.create = function() {
				return new Md5();
			};
			method.update = function(message) {
				return method.create().update(message);
			};
			for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
				var type = OUTPUT_TYPES[i];
				method[type] = createOutputMethod(type);
			}
			return method;
		};
		var nodeWrap = function(method) {
			var crypto$1 = __require("crypto");
			var Buffer$1 = __require("buffer").Buffer;
			var bufferFrom;
			if (Buffer$1.from && !root.JS_MD5_NO_BUFFER_FROM) bufferFrom = Buffer$1.from;
			else bufferFrom = function(message) {
				return new Buffer$1(message);
			};
			var nodeMethod = function(message) {
				if (typeof message === "string") return crypto$1.createHash("md5").update(message, "utf8").digest("hex");
				else if (message === null || message === void 0) throw new Error(INPUT_ERROR);
				else if (message.constructor === ArrayBuffer) message = new Uint8Array(message);
				if (isArray(message) || isView(message) || message.constructor === Buffer$1) return crypto$1.createHash("md5").update(bufferFrom(message)).digest("hex");
				else return method(message);
			};
			return nodeMethod;
		};
		/**
		* @namespace md5.hmac
		*/
		/**
		* @method hex
		* @memberof md5.hmac
		* @description Output hash as hex string
		* @param {String|Array|Uint8Array|ArrayBuffer} key key
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {String} Hex string
		* @example
		* md5.hmac.hex('key', 'The quick brown fox jumps over the lazy dog');
		* // equal to
		* md5.hmac('key', 'The quick brown fox jumps over the lazy dog');
		*/
		/**
		* @method digest
		* @memberof md5.hmac
		* @description Output hash as bytes array
		* @param {String|Array|Uint8Array|ArrayBuffer} key key
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {Array} Bytes array
		* @example
		* md5.hmac.digest('key', 'The quick brown fox jumps over the lazy dog');
		*/
		/**
		* @method array
		* @memberof md5.hmac
		* @description Output hash as bytes array
		* @param {String|Array|Uint8Array|ArrayBuffer} key key
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {Array} Bytes array
		* @example
		* md5.hmac.array('key', 'The quick brown fox jumps over the lazy dog');
		*/
		/**
		* @method arrayBuffer
		* @memberof md5.hmac
		* @description Output hash as ArrayBuffer
		* @param {String|Array|Uint8Array|ArrayBuffer} key key
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {ArrayBuffer} ArrayBuffer
		* @example
		* md5.hmac.arrayBuffer('key', 'The quick brown fox jumps over the lazy dog');
		*/
		/**
		* @method buffer
		* @deprecated This maybe confuse with Buffer in node.js. Please use arrayBuffer instead.
		* @memberof md5.hmac
		* @description Output hash as ArrayBuffer
		* @param {String|Array|Uint8Array|ArrayBuffer} key key
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {ArrayBuffer} ArrayBuffer
		* @example
		* md5.hmac.buffer('key', 'The quick brown fox jumps over the lazy dog');
		*/
		/**
		* @method base64
		* @memberof md5.hmac
		* @description Output hash as base64 string
		* @param {String|Array|Uint8Array|ArrayBuffer} key key
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {String} base64 string
		* @example
		* md5.hmac.base64('key', 'The quick brown fox jumps over the lazy dog');
		*/
		var createHmacOutputMethod = function(outputType) {
			return function(key, message) {
				return new HmacMd5(key, true).update(message)[outputType]();
			};
		};
		/**
		* @method create
		* @memberof md5.hmac
		* @description Create HmacMd5 object
		* @param {String|Array|Uint8Array|ArrayBuffer} key key
		* @returns {HmacMd5} HmacMd5 object.
		* @example
		* var hash = md5.hmac.create('key');
		*/
		/**
		* @method update
		* @memberof md5.hmac
		* @description Create and update HmacMd5 object
		* @param {String|Array|Uint8Array|ArrayBuffer} key key
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {HmacMd5} HmacMd5 object.
		* @example
		* var hash = md5.hmac.update('key', 'The quick brown fox jumps over the lazy dog');
		* // equal to
		* var hash = md5.hmac.create('key');
		* hash.update('The quick brown fox jumps over the lazy dog');
		*/
		var createHmacMethod = function() {
			var method = createHmacOutputMethod("hex");
			method.create = function(key) {
				return new HmacMd5(key);
			};
			method.update = function(key, message) {
				return method.create(key).update(message);
			};
			for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
				var type = OUTPUT_TYPES[i];
				method[type] = createHmacOutputMethod(type);
			}
			return method;
		};
		/**
		* Md5 class
		* @class Md5
		* @description This is internal class.
		* @see {@link md5.create}
		*/
		function Md5(sharedMemory) {
			if (sharedMemory) {
				blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
				this.blocks = blocks;
				this.buffer8 = buffer8;
			} else if (ARRAY_BUFFER) {
				var buffer$1 = /* @__PURE__ */ new ArrayBuffer(68);
				this.buffer8 = new Uint8Array(buffer$1);
				this.blocks = new Uint32Array(buffer$1);
			} else this.blocks = [
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0,
				0
			];
			this.h0 = this.h1 = this.h2 = this.h3 = this.start = this.bytes = this.hBytes = 0;
			this.finalized = this.hashed = false;
			this.first = true;
		}
		/**
		* @method update
		* @memberof Md5
		* @instance
		* @description Update hash
		* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
		* @returns {Md5} Md5 object.
		* @see {@link md5.update}
		*/
		Md5.prototype.update = function(message) {
			if (this.finalized) throw new Error(FINALIZE_ERROR);
			var result = formatMessage(message);
			message = result[0];
			var isString = result[1];
			var code, index = 0, i, length = message.length, blocks$1 = this.blocks;
			var buffer8$1 = this.buffer8;
			while (index < length) {
				if (this.hashed) {
					this.hashed = false;
					blocks$1[0] = blocks$1[16];
					blocks$1[16] = blocks$1[1] = blocks$1[2] = blocks$1[3] = blocks$1[4] = blocks$1[5] = blocks$1[6] = blocks$1[7] = blocks$1[8] = blocks$1[9] = blocks$1[10] = blocks$1[11] = blocks$1[12] = blocks$1[13] = blocks$1[14] = blocks$1[15] = 0;
				}
				if (isString) if (ARRAY_BUFFER) for (i = this.start; index < length && i < 64; ++index) {
					code = message.charCodeAt(index);
					if (code < 128) buffer8$1[i++] = code;
					else if (code < 2048) {
						buffer8$1[i++] = 192 | code >>> 6;
						buffer8$1[i++] = 128 | code & 63;
					} else if (code < 55296 || code >= 57344) {
						buffer8$1[i++] = 224 | code >>> 12;
						buffer8$1[i++] = 128 | code >>> 6 & 63;
						buffer8$1[i++] = 128 | code & 63;
					} else {
						code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
						buffer8$1[i++] = 240 | code >>> 18;
						buffer8$1[i++] = 128 | code >>> 12 & 63;
						buffer8$1[i++] = 128 | code >>> 6 & 63;
						buffer8$1[i++] = 128 | code & 63;
					}
				}
				else for (i = this.start; index < length && i < 64; ++index) {
					code = message.charCodeAt(index);
					if (code < 128) blocks$1[i >>> 2] |= code << SHIFT[i++ & 3];
					else if (code < 2048) {
						blocks$1[i >>> 2] |= (192 | code >>> 6) << SHIFT[i++ & 3];
						blocks$1[i >>> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
					} else if (code < 55296 || code >= 57344) {
						blocks$1[i >>> 2] |= (224 | code >>> 12) << SHIFT[i++ & 3];
						blocks$1[i >>> 2] |= (128 | code >>> 6 & 63) << SHIFT[i++ & 3];
						blocks$1[i >>> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
					} else {
						code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
						blocks$1[i >>> 2] |= (240 | code >>> 18) << SHIFT[i++ & 3];
						blocks$1[i >>> 2] |= (128 | code >>> 12 & 63) << SHIFT[i++ & 3];
						blocks$1[i >>> 2] |= (128 | code >>> 6 & 63) << SHIFT[i++ & 3];
						blocks$1[i >>> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
					}
				}
				else if (ARRAY_BUFFER) for (i = this.start; index < length && i < 64; ++index) buffer8$1[i++] = message[index];
				else for (i = this.start; index < length && i < 64; ++index) blocks$1[i >>> 2] |= message[index] << SHIFT[i++ & 3];
				this.lastByteIndex = i;
				this.bytes += i - this.start;
				if (i >= 64) {
					this.start = i - 64;
					this.hash();
					this.hashed = true;
				} else this.start = i;
			}
			if (this.bytes > 4294967295) {
				this.hBytes += this.bytes / 4294967296 << 0;
				this.bytes = this.bytes % 4294967296;
			}
			return this;
		};
		Md5.prototype.finalize = function() {
			if (this.finalized) return;
			this.finalized = true;
			var blocks$1 = this.blocks, i = this.lastByteIndex;
			blocks$1[i >>> 2] |= EXTRA[i & 3];
			if (i >= 56) {
				if (!this.hashed) this.hash();
				blocks$1[0] = blocks$1[16];
				blocks$1[16] = blocks$1[1] = blocks$1[2] = blocks$1[3] = blocks$1[4] = blocks$1[5] = blocks$1[6] = blocks$1[7] = blocks$1[8] = blocks$1[9] = blocks$1[10] = blocks$1[11] = blocks$1[12] = blocks$1[13] = blocks$1[14] = blocks$1[15] = 0;
			}
			blocks$1[14] = this.bytes << 3;
			blocks$1[15] = this.hBytes << 3 | this.bytes >>> 29;
			this.hash();
		};
		Md5.prototype.hash = function() {
			var a, b, c, d, bc, da, blocks$1 = this.blocks;
			if (this.first) {
				a = blocks$1[0] - 680876937;
				a = (a << 7 | a >>> 25) - 271733879 << 0;
				d = (-1732584194 ^ a & 2004318071) + blocks$1[1] - 117830708;
				d = (d << 12 | d >>> 20) + a << 0;
				c = (-271733879 ^ d & (a ^ -271733879)) + blocks$1[2] - 1126478375;
				c = (c << 17 | c >>> 15) + d << 0;
				b = (a ^ c & (d ^ a)) + blocks$1[3] - 1316259209;
				b = (b << 22 | b >>> 10) + c << 0;
			} else {
				a = this.h0;
				b = this.h1;
				c = this.h2;
				d = this.h3;
				a += (d ^ b & (c ^ d)) + blocks$1[0] - 680876936;
				a = (a << 7 | a >>> 25) + b << 0;
				d += (c ^ a & (b ^ c)) + blocks$1[1] - 389564586;
				d = (d << 12 | d >>> 20) + a << 0;
				c += (b ^ d & (a ^ b)) + blocks$1[2] + 606105819;
				c = (c << 17 | c >>> 15) + d << 0;
				b += (a ^ c & (d ^ a)) + blocks$1[3] - 1044525330;
				b = (b << 22 | b >>> 10) + c << 0;
			}
			a += (d ^ b & (c ^ d)) + blocks$1[4] - 176418897;
			a = (a << 7 | a >>> 25) + b << 0;
			d += (c ^ a & (b ^ c)) + blocks$1[5] + 1200080426;
			d = (d << 12 | d >>> 20) + a << 0;
			c += (b ^ d & (a ^ b)) + blocks$1[6] - 1473231341;
			c = (c << 17 | c >>> 15) + d << 0;
			b += (a ^ c & (d ^ a)) + blocks$1[7] - 45705983;
			b = (b << 22 | b >>> 10) + c << 0;
			a += (d ^ b & (c ^ d)) + blocks$1[8] + 1770035416;
			a = (a << 7 | a >>> 25) + b << 0;
			d += (c ^ a & (b ^ c)) + blocks$1[9] - 1958414417;
			d = (d << 12 | d >>> 20) + a << 0;
			c += (b ^ d & (a ^ b)) + blocks$1[10] - 42063;
			c = (c << 17 | c >>> 15) + d << 0;
			b += (a ^ c & (d ^ a)) + blocks$1[11] - 1990404162;
			b = (b << 22 | b >>> 10) + c << 0;
			a += (d ^ b & (c ^ d)) + blocks$1[12] + 1804603682;
			a = (a << 7 | a >>> 25) + b << 0;
			d += (c ^ a & (b ^ c)) + blocks$1[13] - 40341101;
			d = (d << 12 | d >>> 20) + a << 0;
			c += (b ^ d & (a ^ b)) + blocks$1[14] - 1502002290;
			c = (c << 17 | c >>> 15) + d << 0;
			b += (a ^ c & (d ^ a)) + blocks$1[15] + 1236535329;
			b = (b << 22 | b >>> 10) + c << 0;
			a += (c ^ d & (b ^ c)) + blocks$1[1] - 165796510;
			a = (a << 5 | a >>> 27) + b << 0;
			d += (b ^ c & (a ^ b)) + blocks$1[6] - 1069501632;
			d = (d << 9 | d >>> 23) + a << 0;
			c += (a ^ b & (d ^ a)) + blocks$1[11] + 643717713;
			c = (c << 14 | c >>> 18) + d << 0;
			b += (d ^ a & (c ^ d)) + blocks$1[0] - 373897302;
			b = (b << 20 | b >>> 12) + c << 0;
			a += (c ^ d & (b ^ c)) + blocks$1[5] - 701558691;
			a = (a << 5 | a >>> 27) + b << 0;
			d += (b ^ c & (a ^ b)) + blocks$1[10] + 38016083;
			d = (d << 9 | d >>> 23) + a << 0;
			c += (a ^ b & (d ^ a)) + blocks$1[15] - 660478335;
			c = (c << 14 | c >>> 18) + d << 0;
			b += (d ^ a & (c ^ d)) + blocks$1[4] - 405537848;
			b = (b << 20 | b >>> 12) + c << 0;
			a += (c ^ d & (b ^ c)) + blocks$1[9] + 568446438;
			a = (a << 5 | a >>> 27) + b << 0;
			d += (b ^ c & (a ^ b)) + blocks$1[14] - 1019803690;
			d = (d << 9 | d >>> 23) + a << 0;
			c += (a ^ b & (d ^ a)) + blocks$1[3] - 187363961;
			c = (c << 14 | c >>> 18) + d << 0;
			b += (d ^ a & (c ^ d)) + blocks$1[8] + 1163531501;
			b = (b << 20 | b >>> 12) + c << 0;
			a += (c ^ d & (b ^ c)) + blocks$1[13] - 1444681467;
			a = (a << 5 | a >>> 27) + b << 0;
			d += (b ^ c & (a ^ b)) + blocks$1[2] - 51403784;
			d = (d << 9 | d >>> 23) + a << 0;
			c += (a ^ b & (d ^ a)) + blocks$1[7] + 1735328473;
			c = (c << 14 | c >>> 18) + d << 0;
			b += (d ^ a & (c ^ d)) + blocks$1[12] - 1926607734;
			b = (b << 20 | b >>> 12) + c << 0;
			bc = b ^ c;
			a += (bc ^ d) + blocks$1[5] - 378558;
			a = (a << 4 | a >>> 28) + b << 0;
			d += (bc ^ a) + blocks$1[8] - 2022574463;
			d = (d << 11 | d >>> 21) + a << 0;
			da = d ^ a;
			c += (da ^ b) + blocks$1[11] + 1839030562;
			c = (c << 16 | c >>> 16) + d << 0;
			b += (da ^ c) + blocks$1[14] - 35309556;
			b = (b << 23 | b >>> 9) + c << 0;
			bc = b ^ c;
			a += (bc ^ d) + blocks$1[1] - 1530992060;
			a = (a << 4 | a >>> 28) + b << 0;
			d += (bc ^ a) + blocks$1[4] + 1272893353;
			d = (d << 11 | d >>> 21) + a << 0;
			da = d ^ a;
			c += (da ^ b) + blocks$1[7] - 155497632;
			c = (c << 16 | c >>> 16) + d << 0;
			b += (da ^ c) + blocks$1[10] - 1094730640;
			b = (b << 23 | b >>> 9) + c << 0;
			bc = b ^ c;
			a += (bc ^ d) + blocks$1[13] + 681279174;
			a = (a << 4 | a >>> 28) + b << 0;
			d += (bc ^ a) + blocks$1[0] - 358537222;
			d = (d << 11 | d >>> 21) + a << 0;
			da = d ^ a;
			c += (da ^ b) + blocks$1[3] - 722521979;
			c = (c << 16 | c >>> 16) + d << 0;
			b += (da ^ c) + blocks$1[6] + 76029189;
			b = (b << 23 | b >>> 9) + c << 0;
			bc = b ^ c;
			a += (bc ^ d) + blocks$1[9] - 640364487;
			a = (a << 4 | a >>> 28) + b << 0;
			d += (bc ^ a) + blocks$1[12] - 421815835;
			d = (d << 11 | d >>> 21) + a << 0;
			da = d ^ a;
			c += (da ^ b) + blocks$1[15] + 530742520;
			c = (c << 16 | c >>> 16) + d << 0;
			b += (da ^ c) + blocks$1[2] - 995338651;
			b = (b << 23 | b >>> 9) + c << 0;
			a += (c ^ (b | ~d)) + blocks$1[0] - 198630844;
			a = (a << 6 | a >>> 26) + b << 0;
			d += (b ^ (a | ~c)) + blocks$1[7] + 1126891415;
			d = (d << 10 | d >>> 22) + a << 0;
			c += (a ^ (d | ~b)) + blocks$1[14] - 1416354905;
			c = (c << 15 | c >>> 17) + d << 0;
			b += (d ^ (c | ~a)) + blocks$1[5] - 57434055;
			b = (b << 21 | b >>> 11) + c << 0;
			a += (c ^ (b | ~d)) + blocks$1[12] + 1700485571;
			a = (a << 6 | a >>> 26) + b << 0;
			d += (b ^ (a | ~c)) + blocks$1[3] - 1894986606;
			d = (d << 10 | d >>> 22) + a << 0;
			c += (a ^ (d | ~b)) + blocks$1[10] - 1051523;
			c = (c << 15 | c >>> 17) + d << 0;
			b += (d ^ (c | ~a)) + blocks$1[1] - 2054922799;
			b = (b << 21 | b >>> 11) + c << 0;
			a += (c ^ (b | ~d)) + blocks$1[8] + 1873313359;
			a = (a << 6 | a >>> 26) + b << 0;
			d += (b ^ (a | ~c)) + blocks$1[15] - 30611744;
			d = (d << 10 | d >>> 22) + a << 0;
			c += (a ^ (d | ~b)) + blocks$1[6] - 1560198380;
			c = (c << 15 | c >>> 17) + d << 0;
			b += (d ^ (c | ~a)) + blocks$1[13] + 1309151649;
			b = (b << 21 | b >>> 11) + c << 0;
			a += (c ^ (b | ~d)) + blocks$1[4] - 145523070;
			a = (a << 6 | a >>> 26) + b << 0;
			d += (b ^ (a | ~c)) + blocks$1[11] - 1120210379;
			d = (d << 10 | d >>> 22) + a << 0;
			c += (a ^ (d | ~b)) + blocks$1[2] + 718787259;
			c = (c << 15 | c >>> 17) + d << 0;
			b += (d ^ (c | ~a)) + blocks$1[9] - 343485551;
			b = (b << 21 | b >>> 11) + c << 0;
			if (this.first) {
				this.h0 = a + 1732584193 << 0;
				this.h1 = b - 271733879 << 0;
				this.h2 = c - 1732584194 << 0;
				this.h3 = d + 271733878 << 0;
				this.first = false;
			} else {
				this.h0 = this.h0 + a << 0;
				this.h1 = this.h1 + b << 0;
				this.h2 = this.h2 + c << 0;
				this.h3 = this.h3 + d << 0;
			}
		};
		/**
		* @method hex
		* @memberof Md5
		* @instance
		* @description Output hash as hex string
		* @returns {String} Hex string
		* @see {@link md5.hex}
		* @example
		* hash.hex();
		*/
		Md5.prototype.hex = function() {
			this.finalize();
			var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3;
			return HEX_CHARS[h0 >>> 4 & 15] + HEX_CHARS[h0 & 15] + HEX_CHARS[h0 >>> 12 & 15] + HEX_CHARS[h0 >>> 8 & 15] + HEX_CHARS[h0 >>> 20 & 15] + HEX_CHARS[h0 >>> 16 & 15] + HEX_CHARS[h0 >>> 28 & 15] + HEX_CHARS[h0 >>> 24 & 15] + HEX_CHARS[h1 >>> 4 & 15] + HEX_CHARS[h1 & 15] + HEX_CHARS[h1 >>> 12 & 15] + HEX_CHARS[h1 >>> 8 & 15] + HEX_CHARS[h1 >>> 20 & 15] + HEX_CHARS[h1 >>> 16 & 15] + HEX_CHARS[h1 >>> 28 & 15] + HEX_CHARS[h1 >>> 24 & 15] + HEX_CHARS[h2 >>> 4 & 15] + HEX_CHARS[h2 & 15] + HEX_CHARS[h2 >>> 12 & 15] + HEX_CHARS[h2 >>> 8 & 15] + HEX_CHARS[h2 >>> 20 & 15] + HEX_CHARS[h2 >>> 16 & 15] + HEX_CHARS[h2 >>> 28 & 15] + HEX_CHARS[h2 >>> 24 & 15] + HEX_CHARS[h3 >>> 4 & 15] + HEX_CHARS[h3 & 15] + HEX_CHARS[h3 >>> 12 & 15] + HEX_CHARS[h3 >>> 8 & 15] + HEX_CHARS[h3 >>> 20 & 15] + HEX_CHARS[h3 >>> 16 & 15] + HEX_CHARS[h3 >>> 28 & 15] + HEX_CHARS[h3 >>> 24 & 15];
		};
		/**
		* @method toString
		* @memberof Md5
		* @instance
		* @description Output hash as hex string
		* @returns {String} Hex string
		* @see {@link md5.hex}
		* @example
		* hash.toString();
		*/
		Md5.prototype.toString = Md5.prototype.hex;
		/**
		* @method digest
		* @memberof Md5
		* @instance
		* @description Output hash as bytes array
		* @returns {Array} Bytes array
		* @see {@link md5.digest}
		* @example
		* hash.digest();
		*/
		Md5.prototype.digest = function() {
			this.finalize();
			var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3;
			return [
				h0 & 255,
				h0 >>> 8 & 255,
				h0 >>> 16 & 255,
				h0 >>> 24 & 255,
				h1 & 255,
				h1 >>> 8 & 255,
				h1 >>> 16 & 255,
				h1 >>> 24 & 255,
				h2 & 255,
				h2 >>> 8 & 255,
				h2 >>> 16 & 255,
				h2 >>> 24 & 255,
				h3 & 255,
				h3 >>> 8 & 255,
				h3 >>> 16 & 255,
				h3 >>> 24 & 255
			];
		};
		/**
		* @method array
		* @memberof Md5
		* @instance
		* @description Output hash as bytes array
		* @returns {Array} Bytes array
		* @see {@link md5.array}
		* @example
		* hash.array();
		*/
		Md5.prototype.array = Md5.prototype.digest;
		/**
		* @method arrayBuffer
		* @memberof Md5
		* @instance
		* @description Output hash as ArrayBuffer
		* @returns {ArrayBuffer} ArrayBuffer
		* @see {@link md5.arrayBuffer}
		* @example
		* hash.arrayBuffer();
		*/
		Md5.prototype.arrayBuffer = function() {
			this.finalize();
			var buffer$1 = /* @__PURE__ */ new ArrayBuffer(16);
			var blocks$1 = new Uint32Array(buffer$1);
			blocks$1[0] = this.h0;
			blocks$1[1] = this.h1;
			blocks$1[2] = this.h2;
			blocks$1[3] = this.h3;
			return buffer$1;
		};
		/**
		* @method buffer
		* @deprecated This maybe confuse with Buffer in node.js. Please use arrayBuffer instead.
		* @memberof Md5
		* @instance
		* @description Output hash as ArrayBuffer
		* @returns {ArrayBuffer} ArrayBuffer
		* @see {@link md5.buffer}
		* @example
		* hash.buffer();
		*/
		Md5.prototype.buffer = Md5.prototype.arrayBuffer;
		/**
		* @method base64
		* @memberof Md5
		* @instance
		* @description Output hash as base64 string
		* @returns {String} base64 string
		* @see {@link md5.base64}
		* @example
		* hash.base64();
		*/
		Md5.prototype.base64 = function() {
			var v1, v2, v3, base64Str = "", bytes = this.array();
			for (var i = 0; i < 15;) {
				v1 = bytes[i++];
				v2 = bytes[i++];
				v3 = bytes[i++];
				base64Str += BASE64_ENCODE_CHAR[v1 >>> 2] + BASE64_ENCODE_CHAR[(v1 << 4 | v2 >>> 4) & 63] + BASE64_ENCODE_CHAR[(v2 << 2 | v3 >>> 6) & 63] + BASE64_ENCODE_CHAR[v3 & 63];
			}
			v1 = bytes[i];
			base64Str += BASE64_ENCODE_CHAR[v1 >>> 2] + BASE64_ENCODE_CHAR[v1 << 4 & 63] + "==";
			return base64Str;
		};
		/**
		* HmacMd5 class
		* @class HmacMd5
		* @extends Md5
		* @description This is internal class.
		* @see {@link md5.hmac.create}
		*/
		function HmacMd5(key, sharedMemory) {
			var i, result = formatMessage(key);
			key = result[0];
			if (result[1]) {
				var bytes = [], length = key.length, index = 0, code;
				for (i = 0; i < length; ++i) {
					code = key.charCodeAt(i);
					if (code < 128) bytes[index++] = code;
					else if (code < 2048) {
						bytes[index++] = 192 | code >>> 6;
						bytes[index++] = 128 | code & 63;
					} else if (code < 55296 || code >= 57344) {
						bytes[index++] = 224 | code >>> 12;
						bytes[index++] = 128 | code >>> 6 & 63;
						bytes[index++] = 128 | code & 63;
					} else {
						code = 65536 + ((code & 1023) << 10 | key.charCodeAt(++i) & 1023);
						bytes[index++] = 240 | code >>> 18;
						bytes[index++] = 128 | code >>> 12 & 63;
						bytes[index++] = 128 | code >>> 6 & 63;
						bytes[index++] = 128 | code & 63;
					}
				}
				key = bytes;
			}
			if (key.length > 64) key = new Md5(true).update(key).array();
			var oKeyPad = [], iKeyPad = [];
			for (i = 0; i < 64; ++i) {
				var b = key[i] || 0;
				oKeyPad[i] = 92 ^ b;
				iKeyPad[i] = 54 ^ b;
			}
			Md5.call(this, sharedMemory);
			this.update(iKeyPad);
			this.oKeyPad = oKeyPad;
			this.inner = true;
			this.sharedMemory = sharedMemory;
		}
		HmacMd5.prototype = new Md5();
		HmacMd5.prototype.finalize = function() {
			Md5.prototype.finalize.call(this);
			if (this.inner) {
				this.inner = false;
				var innerHash = this.array();
				Md5.call(this, this.sharedMemory);
				this.update(this.oKeyPad);
				this.update(innerHash);
				Md5.prototype.finalize.call(this);
			}
		};
		var exports = createMethod();
		exports.md5 = exports;
		exports.md5.hmac = createHmacMethod();
		if (COMMON_JS) module.exports = exports;
		else {
			/**
			* @method md5
			* @description Md5 hash function, export to global in browsers.
			* @param {String|Array|Uint8Array|ArrayBuffer} message message to hash
			* @returns {String} md5 hashes
			* @example
			* md5(''); // d41d8cd98f00b204e9800998ecf8427e
			* md5('The quick brown fox jumps over the lazy dog'); // 9e107d9d372bb6826bd81d3542a419d6
			* md5('The quick brown fox jumps over the lazy dog.'); // e4d909c290d0fb1ca068ffaddf22cbd0
			*
			* // It also supports UTF-8 encoding
			* md5('中文'); // a7bac2239fcdcb3a067903d8077c4a07
			*
			* // It also supports byte `Array`, `Uint8Array`, `ArrayBuffer`
			* md5([]); // d41d8cd98f00b204e9800998ecf8427e
			* md5(new Uint8Array([])); // d41d8cd98f00b204e9800998ecf8427e
			*/
			root.md5 = exports;
			if (AMD) define(function() {
				return exports;
			});
		}
	})();
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/constants.js
var require_constants = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/constants.js": ((exports, module) => {
	const BINARY_TYPES$2 = [
		"nodebuffer",
		"arraybuffer",
		"fragments"
	];
	const hasBlob$1 = typeof Blob !== "undefined";
	if (hasBlob$1) BINARY_TYPES$2.push("blob");
	module.exports = {
		BINARY_TYPES: BINARY_TYPES$2,
		CLOSE_TIMEOUT: 3e4,
		EMPTY_BUFFER: Buffer.alloc(0),
		GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
		hasBlob: hasBlob$1,
		kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
		kListener: Symbol("kListener"),
		kStatusCode: Symbol("status-code"),
		kWebSocket: Symbol("websocket"),
		NOOP: () => {}
	};
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/buffer-util.js
var require_buffer_util = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/buffer-util.js": ((exports, module) => {
	const { EMPTY_BUFFER: EMPTY_BUFFER$3 } = require_constants();
	const FastBuffer$2 = Buffer[Symbol.species];
	/**
	* Merges an array of buffers into a new buffer.
	*
	* @param {Buffer[]} list The array of buffers to concat
	* @param {Number} totalLength The total length of buffers in the list
	* @return {Buffer} The resulting buffer
	* @public
	*/
	function concat$1(list, totalLength) {
		if (list.length === 0) return EMPTY_BUFFER$3;
		if (list.length === 1) return list[0];
		const target = Buffer.allocUnsafe(totalLength);
		let offset = 0;
		for (let i = 0; i < list.length; i++) {
			const buf = list[i];
			target.set(buf, offset);
			offset += buf.length;
		}
		if (offset < totalLength) return new FastBuffer$2(target.buffer, target.byteOffset, offset);
		return target;
	}
	/**
	* Masks a buffer using the given mask.
	*
	* @param {Buffer} source The buffer to mask
	* @param {Buffer} mask The mask to use
	* @param {Buffer} output The buffer where to store the result
	* @param {Number} offset The offset at which to start writing
	* @param {Number} length The number of bytes to mask.
	* @public
	*/
	function _mask(source, mask, output, offset, length) {
		for (let i = 0; i < length; i++) output[offset + i] = source[i] ^ mask[i & 3];
	}
	/**
	* Unmasks a buffer using the given mask.
	*
	* @param {Buffer} buffer The buffer to unmask
	* @param {Buffer} mask The mask to use
	* @public
	*/
	function _unmask(buffer, mask) {
		for (let i = 0; i < buffer.length; i++) buffer[i] ^= mask[i & 3];
	}
	/**
	* Converts a buffer to an `ArrayBuffer`.
	*
	* @param {Buffer} buf The buffer to convert
	* @return {ArrayBuffer} Converted buffer
	* @public
	*/
	function toArrayBuffer$1(buf) {
		if (buf.length === buf.buffer.byteLength) return buf.buffer;
		return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
	}
	/**
	* Converts `data` to a `Buffer`.
	*
	* @param {*} data The data to convert
	* @return {Buffer} The buffer
	* @throws {TypeError}
	* @public
	*/
	function toBuffer$2(data) {
		toBuffer$2.readOnly = true;
		if (Buffer.isBuffer(data)) return data;
		let buf;
		if (data instanceof ArrayBuffer) buf = new FastBuffer$2(data);
		else if (ArrayBuffer.isView(data)) buf = new FastBuffer$2(data.buffer, data.byteOffset, data.byteLength);
		else {
			buf = Buffer.from(data);
			toBuffer$2.readOnly = false;
		}
		return buf;
	}
	module.exports = {
		concat: concat$1,
		mask: _mask,
		toArrayBuffer: toArrayBuffer$1,
		toBuffer: toBuffer$2,
		unmask: _unmask
	};
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/limiter.js
var require_limiter = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/limiter.js": ((exports, module) => {
	const kDone = Symbol("kDone");
	const kRun = Symbol("kRun");
	/**
	* A very simple job queue with adjustable concurrency. Adapted from
	* https://github.com/STRML/async-limiter
	*/
	var Limiter$1 = class {
		/**
		* Creates a new `Limiter`.
		*
		* @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
		*     to run concurrently
		*/
		constructor(concurrency) {
			this[kDone] = () => {
				this.pending--;
				this[kRun]();
			};
			this.concurrency = concurrency || Infinity;
			this.jobs = [];
			this.pending = 0;
		}
		/**
		* Adds a job to the queue.
		*
		* @param {Function} job The job to run
		* @public
		*/
		add(job) {
			this.jobs.push(job);
			this[kRun]();
		}
		/**
		* Removes a job from the queue and runs it if possible.
		*
		* @private
		*/
		[kRun]() {
			if (this.pending === this.concurrency) return;
			if (this.jobs.length) {
				const job = this.jobs.shift();
				this.pending++;
				job(this[kDone]);
			}
		}
	};
	module.exports = Limiter$1;
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/permessage-deflate.js": ((exports, module) => {
	const zlib = __require("zlib");
	const bufferUtil = require_buffer_util();
	const Limiter = require_limiter();
	const { kStatusCode: kStatusCode$2 } = require_constants();
	const FastBuffer$1 = Buffer[Symbol.species];
	const TRAILER = Buffer.from([
		0,
		0,
		255,
		255
	]);
	const kPerMessageDeflate = Symbol("permessage-deflate");
	const kTotalLength = Symbol("total-length");
	const kCallback = Symbol("callback");
	const kBuffers = Symbol("buffers");
	const kError$1 = Symbol("error");
	let zlibLimiter;
	/**
	* permessage-deflate implementation.
	*/
	var PerMessageDeflate$5 = class {
		/**
		* Creates a PerMessageDeflate instance.
		*
		* @param {Object} [options] Configuration options
		* @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
		*     for, or request, a custom client window size
		* @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
		*     acknowledge disabling of client context takeover
		* @param {Number} [options.concurrencyLimit=10] The number of concurrent
		*     calls to zlib
		* @param {Boolean} [options.isServer=false] Create the instance in either
		*     server or client mode
		* @param {Number} [options.maxPayload=0] The maximum allowed message length
		* @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
		*     use of a custom server window size
		* @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
		*     disabling of server context takeover
		* @param {Number} [options.threshold=1024] Size (in bytes) below which
		*     messages should not be compressed if context takeover is disabled
		* @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
		*     deflate
		* @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
		*     inflate
		*/
		constructor(options) {
			this._options = options || {};
			this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
			this._maxPayload = this._options.maxPayload | 0;
			this._isServer = !!this._options.isServer;
			this._deflate = null;
			this._inflate = null;
			this.params = null;
			if (!zlibLimiter) zlibLimiter = new Limiter(this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10);
		}
		/**
		* @type {String}
		*/
		static get extensionName() {
			return "permessage-deflate";
		}
		/**
		* Create an extension negotiation offer.
		*
		* @return {Object} Extension parameters
		* @public
		*/
		offer() {
			const params = {};
			if (this._options.serverNoContextTakeover) params.server_no_context_takeover = true;
			if (this._options.clientNoContextTakeover) params.client_no_context_takeover = true;
			if (this._options.serverMaxWindowBits) params.server_max_window_bits = this._options.serverMaxWindowBits;
			if (this._options.clientMaxWindowBits) params.client_max_window_bits = this._options.clientMaxWindowBits;
			else if (this._options.clientMaxWindowBits == null) params.client_max_window_bits = true;
			return params;
		}
		/**
		* Accept an extension negotiation offer/response.
		*
		* @param {Array} configurations The extension negotiation offers/reponse
		* @return {Object} Accepted configuration
		* @public
		*/
		accept(configurations) {
			configurations = this.normalizeParams(configurations);
			this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
			return this.params;
		}
		/**
		* Releases all resources used by the extension.
		*
		* @public
		*/
		cleanup() {
			if (this._inflate) {
				this._inflate.close();
				this._inflate = null;
			}
			if (this._deflate) {
				const callback = this._deflate[kCallback];
				this._deflate.close();
				this._deflate = null;
				if (callback) callback(/* @__PURE__ */ new Error("The deflate stream was closed while data was being processed"));
			}
		}
		/**
		*  Accept an extension negotiation offer.
		*
		* @param {Array} offers The extension negotiation offers
		* @return {Object} Accepted configuration
		* @private
		*/
		acceptAsServer(offers) {
			const opts = this._options;
			const accepted = offers.find((params) => {
				if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && !params.client_max_window_bits) return false;
				return true;
			});
			if (!accepted) throw new Error("None of the extension offers can be accepted");
			if (opts.serverNoContextTakeover) accepted.server_no_context_takeover = true;
			if (opts.clientNoContextTakeover) accepted.client_no_context_takeover = true;
			if (typeof opts.serverMaxWindowBits === "number") accepted.server_max_window_bits = opts.serverMaxWindowBits;
			if (typeof opts.clientMaxWindowBits === "number") accepted.client_max_window_bits = opts.clientMaxWindowBits;
			else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) delete accepted.client_max_window_bits;
			return accepted;
		}
		/**
		* Accept the extension negotiation response.
		*
		* @param {Array} response The extension negotiation response
		* @return {Object} Accepted configuration
		* @private
		*/
		acceptAsClient(response) {
			const params = response[0];
			if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) throw new Error("Unexpected parameter \"client_no_context_takeover\"");
			if (!params.client_max_window_bits) {
				if (typeof this._options.clientMaxWindowBits === "number") params.client_max_window_bits = this._options.clientMaxWindowBits;
			} else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) throw new Error("Unexpected or invalid parameter \"client_max_window_bits\"");
			return params;
		}
		/**
		* Normalize parameters.
		*
		* @param {Array} configurations The extension negotiation offers/reponse
		* @return {Array} The offers/response with normalized parameters
		* @private
		*/
		normalizeParams(configurations) {
			configurations.forEach((params) => {
				Object.keys(params).forEach((key) => {
					let value = params[key];
					if (value.length > 1) throw new Error(`Parameter "${key}" must have only a single value`);
					value = value[0];
					if (key === "client_max_window_bits") {
						if (value !== true) {
							const num = +value;
							if (!Number.isInteger(num) || num < 8 || num > 15) throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
							value = num;
						} else if (!this._isServer) throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
					} else if (key === "server_max_window_bits") {
						const num = +value;
						if (!Number.isInteger(num) || num < 8 || num > 15) throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
						value = num;
					} else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
						if (value !== true) throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
					} else throw new Error(`Unknown parameter "${key}"`);
					params[key] = value;
				});
			});
			return configurations;
		}
		/**
		* Decompress data. Concurrency limited.
		*
		* @param {Buffer} data Compressed data
		* @param {Boolean} fin Specifies whether or not this is the last fragment
		* @param {Function} callback Callback
		* @public
		*/
		decompress(data, fin, callback) {
			zlibLimiter.add((done) => {
				this._decompress(data, fin, (err, result) => {
					done();
					callback(err, result);
				});
			});
		}
		/**
		* Compress data. Concurrency limited.
		*
		* @param {(Buffer|String)} data Data to compress
		* @param {Boolean} fin Specifies whether or not this is the last fragment
		* @param {Function} callback Callback
		* @public
		*/
		compress(data, fin, callback) {
			zlibLimiter.add((done) => {
				this._compress(data, fin, (err, result) => {
					done();
					callback(err, result);
				});
			});
		}
		/**
		* Decompress data.
		*
		* @param {Buffer} data Compressed data
		* @param {Boolean} fin Specifies whether or not this is the last fragment
		* @param {Function} callback Callback
		* @private
		*/
		_decompress(data, fin, callback) {
			const endpoint = this._isServer ? "client" : "server";
			if (!this._inflate) {
				const key = `${endpoint}_max_window_bits`;
				const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
				this._inflate = zlib.createInflateRaw({
					...this._options.zlibInflateOptions,
					windowBits
				});
				this._inflate[kPerMessageDeflate] = this;
				this._inflate[kTotalLength] = 0;
				this._inflate[kBuffers] = [];
				this._inflate.on("error", inflateOnError);
				this._inflate.on("data", inflateOnData);
			}
			this._inflate[kCallback] = callback;
			this._inflate.write(data);
			if (fin) this._inflate.write(TRAILER);
			this._inflate.flush(() => {
				const err = this._inflate[kError$1];
				if (err) {
					this._inflate.close();
					this._inflate = null;
					callback(err);
					return;
				}
				const data$1 = bufferUtil.concat(this._inflate[kBuffers], this._inflate[kTotalLength]);
				if (this._inflate._readableState.endEmitted) {
					this._inflate.close();
					this._inflate = null;
				} else {
					this._inflate[kTotalLength] = 0;
					this._inflate[kBuffers] = [];
					if (fin && this.params[`${endpoint}_no_context_takeover`]) this._inflate.reset();
				}
				callback(null, data$1);
			});
		}
		/**
		* Compress data.
		*
		* @param {(Buffer|String)} data Data to compress
		* @param {Boolean} fin Specifies whether or not this is the last fragment
		* @param {Function} callback Callback
		* @private
		*/
		_compress(data, fin, callback) {
			const endpoint = this._isServer ? "server" : "client";
			if (!this._deflate) {
				const key = `${endpoint}_max_window_bits`;
				const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
				this._deflate = zlib.createDeflateRaw({
					...this._options.zlibDeflateOptions,
					windowBits
				});
				this._deflate[kTotalLength] = 0;
				this._deflate[kBuffers] = [];
				this._deflate.on("data", deflateOnData);
			}
			this._deflate[kCallback] = callback;
			this._deflate.write(data);
			this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
				if (!this._deflate) return;
				let data$1 = bufferUtil.concat(this._deflate[kBuffers], this._deflate[kTotalLength]);
				if (fin) data$1 = new FastBuffer$1(data$1.buffer, data$1.byteOffset, data$1.length - 4);
				this._deflate[kCallback] = null;
				this._deflate[kTotalLength] = 0;
				this._deflate[kBuffers] = [];
				if (fin && this.params[`${endpoint}_no_context_takeover`]) this._deflate.reset();
				callback(null, data$1);
			});
		}
	};
	module.exports = PerMessageDeflate$5;
	/**
	* The listener of the `zlib.DeflateRaw` stream `'data'` event.
	*
	* @param {Buffer} chunk A chunk of data
	* @private
	*/
	function deflateOnData(chunk) {
		this[kBuffers].push(chunk);
		this[kTotalLength] += chunk.length;
	}
	/**
	* The listener of the `zlib.InflateRaw` stream `'data'` event.
	*
	* @param {Buffer} chunk A chunk of data
	* @private
	*/
	function inflateOnData(chunk) {
		this[kTotalLength] += chunk.length;
		if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
			this[kBuffers].push(chunk);
			return;
		}
		this[kError$1] = /* @__PURE__ */ new RangeError("Max payload size exceeded");
		this[kError$1].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
		this[kError$1][kStatusCode$2] = 1009;
		this.removeListener("data", inflateOnData);
		this.reset();
	}
	/**
	* The listener of the `zlib.InflateRaw` stream `'error'` event.
	*
	* @param {Error} err The emitted error
	* @private
	*/
	function inflateOnError(err) {
		this[kPerMessageDeflate]._inflate = null;
		if (this[kError$1]) {
			this[kCallback](this[kError$1]);
			return;
		}
		err[kStatusCode$2] = 1007;
		this[kCallback](err);
	}
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/validation.js
var require_validation = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/validation.js": ((exports, module) => {
	const { isUtf8 } = __require("buffer");
	const { hasBlob } = require_constants();
	const tokenChars$2 = [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		0,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		1,
		1,
		0,
		1,
		1,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		1,
		0,
		1,
		0
	];
	/**
	* Checks if a status code is allowed in a close frame.
	*
	* @param {Number} code The status code
	* @return {Boolean} `true` if the status code is valid, else `false`
	* @public
	*/
	function isValidStatusCode$2(code) {
		return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
	}
	/**
	* Checks if a given buffer contains only correct UTF-8.
	* Ported from https://www.cl.cam.ac.uk/%7Emgk25/ucs/utf8_check.c by
	* Markus Kuhn.
	*
	* @param {Buffer} buf The buffer to check
	* @return {Boolean} `true` if `buf` contains only correct UTF-8, else `false`
	* @public
	*/
	function _isValidUTF8(buf) {
		const len = buf.length;
		let i = 0;
		while (i < len) if ((buf[i] & 128) === 0) i++;
		else if ((buf[i] & 224) === 192) {
			if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) return false;
			i += 2;
		} else if ((buf[i] & 240) === 224) {
			if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || buf[i] === 237 && (buf[i + 1] & 224) === 160) return false;
			i += 3;
		} else if ((buf[i] & 248) === 240) {
			if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) return false;
			i += 4;
		} else return false;
		return true;
	}
	/**
	* Determines whether a value is a `Blob`.
	*
	* @param {*} value The value to be tested
	* @return {Boolean} `true` if `value` is a `Blob`, else `false`
	* @private
	*/
	function isBlob$2(value) {
		return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
	}
	module.exports = {
		isBlob: isBlob$2,
		isValidStatusCode: isValidStatusCode$2,
		isValidUTF8: _isValidUTF8,
		tokenChars: tokenChars$2
	};
	if (isUtf8) module.exports.isValidUTF8 = function(buf) {
		return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
	};
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/receiver.js
var require_receiver = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/receiver.js": ((exports, module) => {
	const { Writable } = __require("stream");
	const PerMessageDeflate$4 = require_permessage_deflate();
	const { BINARY_TYPES: BINARY_TYPES$1, EMPTY_BUFFER: EMPTY_BUFFER$2, kStatusCode: kStatusCode$1, kWebSocket: kWebSocket$3 } = require_constants();
	const { concat, toArrayBuffer, unmask } = require_buffer_util();
	const { isValidStatusCode: isValidStatusCode$1, isValidUTF8 } = require_validation();
	const FastBuffer = Buffer[Symbol.species];
	const GET_INFO = 0;
	const GET_PAYLOAD_LENGTH_16 = 1;
	const GET_PAYLOAD_LENGTH_64 = 2;
	const GET_MASK = 3;
	const GET_DATA = 4;
	const INFLATING = 5;
	const DEFER_EVENT = 6;
	/**
	* HyBi Receiver implementation.
	*
	* @extends Writable
	*/
	var Receiver$2 = class extends Writable {
		/**
		* Creates a Receiver instance.
		*
		* @param {Object} [options] Options object
		* @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
		*     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
		*     multiple times in the same tick
		* @param {String} [options.binaryType=nodebuffer] The type for binary data
		* @param {Object} [options.extensions] An object containing the negotiated
		*     extensions
		* @param {Boolean} [options.isServer=false] Specifies whether to operate in
		*     client or server mode
		* @param {Number} [options.maxBufferedChunks=0] The maximum number of
		*     buffered data chunks
		* @param {Number} [options.maxFragments=0] The maximum number of message
		*     fragments
		* @param {Number} [options.maxPayload=0] The maximum allowed message length
		* @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
		*     not to skip UTF-8 validation for text and close messages
		*/
		constructor(options = {}) {
			super();
			this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
			this._binaryType = options.binaryType || BINARY_TYPES$1[0];
			this._extensions = options.extensions || {};
			this._isServer = !!options.isServer;
			this._maxBufferedChunks = options.maxBufferedChunks | 0;
			this._maxFragments = options.maxFragments | 0;
			this._maxPayload = options.maxPayload | 0;
			this._skipUTF8Validation = !!options.skipUTF8Validation;
			this[kWebSocket$3] = void 0;
			this._bufferedBytes = 0;
			this._buffers = [];
			this._compressed = false;
			this._payloadLength = 0;
			this._mask = void 0;
			this._fragmented = 0;
			this._masked = false;
			this._fin = false;
			this._opcode = 0;
			this._totalPayloadLength = 0;
			this._messageLength = 0;
			this._fragments = [];
			this._errored = false;
			this._loop = false;
			this._state = GET_INFO;
		}
		/**
		* Implements `Writable.prototype._write()`.
		*
		* @param {Buffer} chunk The chunk of data to write
		* @param {String} encoding The character encoding of `chunk`
		* @param {Function} cb Callback
		* @private
		*/
		_write(chunk, encoding, cb) {
			if (this._opcode === 8 && this._state == GET_INFO) return cb();
			if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
				cb(this.createError(RangeError, "Too many buffered chunks", false, 1008, "WS_ERR_TOO_MANY_BUFFERED_PARTS"));
				return;
			}
			this._bufferedBytes += chunk.length;
			this._buffers.push(chunk);
			this.startLoop(cb);
		}
		/**
		* Consumes `n` bytes from the buffered data.
		*
		* @param {Number} n The number of bytes to consume
		* @return {Buffer} The consumed bytes
		* @private
		*/
		consume(n) {
			this._bufferedBytes -= n;
			if (n === this._buffers[0].length) return this._buffers.shift();
			if (n < this._buffers[0].length) {
				const buf = this._buffers[0];
				this._buffers[0] = new FastBuffer(buf.buffer, buf.byteOffset + n, buf.length - n);
				return new FastBuffer(buf.buffer, buf.byteOffset, n);
			}
			const dst = Buffer.allocUnsafe(n);
			do {
				const buf = this._buffers[0];
				const offset = dst.length - n;
				if (n >= buf.length) dst.set(this._buffers.shift(), offset);
				else {
					dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
					this._buffers[0] = new FastBuffer(buf.buffer, buf.byteOffset + n, buf.length - n);
				}
				n -= buf.length;
			} while (n > 0);
			return dst;
		}
		/**
		* Starts the parsing loop.
		*
		* @param {Function} cb Callback
		* @private
		*/
		startLoop(cb) {
			this._loop = true;
			do
				switch (this._state) {
					case GET_INFO:
						this.getInfo(cb);
						break;
					case GET_PAYLOAD_LENGTH_16:
						this.getPayloadLength16(cb);
						break;
					case GET_PAYLOAD_LENGTH_64:
						this.getPayloadLength64(cb);
						break;
					case GET_MASK:
						this.getMask();
						break;
					case GET_DATA:
						this.getData(cb);
						break;
					case INFLATING:
					case DEFER_EVENT:
						this._loop = false;
						return;
				}
			while (this._loop);
			if (!this._errored) cb();
		}
		/**
		* Reads the first two bytes of a frame.
		*
		* @param {Function} cb Callback
		* @private
		*/
		getInfo(cb) {
			if (this._bufferedBytes < 2) {
				this._loop = false;
				return;
			}
			const buf = this.consume(2);
			if ((buf[0] & 48) !== 0) {
				cb(this.createError(RangeError, "RSV2 and RSV3 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_2_3"));
				return;
			}
			const compressed = (buf[0] & 64) === 64;
			if (compressed && !this._extensions[PerMessageDeflate$4.extensionName]) {
				cb(this.createError(RangeError, "RSV1 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_1"));
				return;
			}
			this._fin = (buf[0] & 128) === 128;
			this._opcode = buf[0] & 15;
			this._payloadLength = buf[1] & 127;
			if (this._opcode === 0) {
				if (compressed) {
					cb(this.createError(RangeError, "RSV1 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_1"));
					return;
				}
				if (!this._fragmented) {
					cb(this.createError(RangeError, "invalid opcode 0", true, 1002, "WS_ERR_INVALID_OPCODE"));
					return;
				}
				this._opcode = this._fragmented;
			} else if (this._opcode === 1 || this._opcode === 2) {
				if (this._fragmented) {
					cb(this.createError(RangeError, `invalid opcode ${this._opcode}`, true, 1002, "WS_ERR_INVALID_OPCODE"));
					return;
				}
				this._compressed = compressed;
			} else if (this._opcode > 7 && this._opcode < 11) {
				if (!this._fin) {
					cb(this.createError(RangeError, "FIN must be set", true, 1002, "WS_ERR_EXPECTED_FIN"));
					return;
				}
				if (compressed) {
					cb(this.createError(RangeError, "RSV1 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_1"));
					return;
				}
				if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
					cb(this.createError(RangeError, `invalid payload length ${this._payloadLength}`, true, 1002, "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"));
					return;
				}
			} else {
				cb(this.createError(RangeError, `invalid opcode ${this._opcode}`, true, 1002, "WS_ERR_INVALID_OPCODE"));
				return;
			}
			if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
			this._masked = (buf[1] & 128) === 128;
			if (this._isServer) {
				if (!this._masked) {
					cb(this.createError(RangeError, "MASK must be set", true, 1002, "WS_ERR_EXPECTED_MASK"));
					return;
				}
			} else if (this._masked) {
				cb(this.createError(RangeError, "MASK must be clear", true, 1002, "WS_ERR_UNEXPECTED_MASK"));
				return;
			}
			if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
			else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
			else this.haveLength(cb);
		}
		/**
		* Gets extended payload length (7+16).
		*
		* @param {Function} cb Callback
		* @private
		*/
		getPayloadLength16(cb) {
			if (this._bufferedBytes < 2) {
				this._loop = false;
				return;
			}
			this._payloadLength = this.consume(2).readUInt16BE(0);
			this.haveLength(cb);
		}
		/**
		* Gets extended payload length (7+64).
		*
		* @param {Function} cb Callback
		* @private
		*/
		getPayloadLength64(cb) {
			if (this._bufferedBytes < 8) {
				this._loop = false;
				return;
			}
			const buf = this.consume(8);
			const num = buf.readUInt32BE(0);
			if (num > Math.pow(2, 21) - 1) {
				cb(this.createError(RangeError, "Unsupported WebSocket frame: payload length > 2^53 - 1", false, 1009, "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"));
				return;
			}
			this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
			this.haveLength(cb);
		}
		/**
		* Payload length has been read.
		*
		* @param {Function} cb Callback
		* @private
		*/
		haveLength(cb) {
			if (this._payloadLength && this._opcode < 8) {
				this._totalPayloadLength += this._payloadLength;
				if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
					cb(this.createError(RangeError, "Max payload size exceeded", false, 1009, "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"));
					return;
				}
			}
			if (this._masked) this._state = GET_MASK;
			else this._state = GET_DATA;
		}
		/**
		* Reads mask bytes.
		*
		* @private
		*/
		getMask() {
			if (this._bufferedBytes < 4) {
				this._loop = false;
				return;
			}
			this._mask = this.consume(4);
			this._state = GET_DATA;
		}
		/**
		* Reads data bytes.
		*
		* @param {Function} cb Callback
		* @private
		*/
		getData(cb) {
			let data = EMPTY_BUFFER$2;
			if (this._payloadLength) {
				if (this._bufferedBytes < this._payloadLength) {
					this._loop = false;
					return;
				}
				data = this.consume(this._payloadLength);
				if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) unmask(data, this._mask);
			}
			if (this._opcode > 7) {
				this.controlMessage(data, cb);
				return;
			}
			if (this._compressed) {
				this._state = INFLATING;
				this.decompress(data, cb);
				return;
			}
			if (data.length) {
				if (this._maxFragments > 0 && this._fragments.length >= this._maxFragments) {
					cb(this.createError(RangeError, "Too many message fragments", false, 1008, "WS_ERR_TOO_MANY_BUFFERED_PARTS"));
					return;
				}
				this._messageLength = this._totalPayloadLength;
				this._fragments.push(data);
			}
			this.dataMessage(cb);
		}
		/**
		* Decompresses data.
		*
		* @param {Buffer} data Compressed data
		* @param {Function} cb Callback
		* @private
		*/
		decompress(data, cb) {
			this._extensions[PerMessageDeflate$4.extensionName].decompress(data, this._fin, (err, buf) => {
				if (err) return cb(err);
				if (buf.length) {
					this._messageLength += buf.length;
					if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
						cb(this.createError(RangeError, "Max payload size exceeded", false, 1009, "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"));
						return;
					}
					if (this._maxFragments > 0 && this._fragments.length >= this._maxFragments) {
						cb(this.createError(RangeError, "Too many message fragments", false, 1008, "WS_ERR_TOO_MANY_BUFFERED_PARTS"));
						return;
					}
					this._fragments.push(buf);
				}
				this.dataMessage(cb);
				if (this._state === GET_INFO) this.startLoop(cb);
			});
		}
		/**
		* Handles a data message.
		*
		* @param {Function} cb Callback
		* @private
		*/
		dataMessage(cb) {
			if (!this._fin) {
				this._state = GET_INFO;
				return;
			}
			const messageLength = this._messageLength;
			const fragments = this._fragments;
			this._totalPayloadLength = 0;
			this._messageLength = 0;
			this._fragmented = 0;
			this._fragments = [];
			if (this._opcode === 2) {
				let data;
				if (this._binaryType === "nodebuffer") data = concat(fragments, messageLength);
				else if (this._binaryType === "arraybuffer") data = toArrayBuffer(concat(fragments, messageLength));
				else if (this._binaryType === "blob") data = new Blob(fragments);
				else data = fragments;
				if (this._allowSynchronousEvents) {
					this.emit("message", data, true);
					this._state = GET_INFO;
				} else {
					this._state = DEFER_EVENT;
					setImmediate(() => {
						this.emit("message", data, true);
						this._state = GET_INFO;
						this.startLoop(cb);
					});
				}
			} else {
				const buf = concat(fragments, messageLength);
				if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
					cb(this.createError(Error, "invalid UTF-8 sequence", true, 1007, "WS_ERR_INVALID_UTF8"));
					return;
				}
				if (this._state === INFLATING || this._allowSynchronousEvents) {
					this.emit("message", buf, false);
					this._state = GET_INFO;
				} else {
					this._state = DEFER_EVENT;
					setImmediate(() => {
						this.emit("message", buf, false);
						this._state = GET_INFO;
						this.startLoop(cb);
					});
				}
			}
		}
		/**
		* Handles a control message.
		*
		* @param {Buffer} data Data to handle
		* @return {(Error|RangeError|undefined)} A possible error
		* @private
		*/
		controlMessage(data, cb) {
			if (this._opcode === 8) {
				if (data.length === 0) {
					this._loop = false;
					this.emit("conclude", 1005, EMPTY_BUFFER$2);
					this.end();
				} else {
					const code = data.readUInt16BE(0);
					if (!isValidStatusCode$1(code)) {
						cb(this.createError(RangeError, `invalid status code ${code}`, true, 1002, "WS_ERR_INVALID_CLOSE_CODE"));
						return;
					}
					const buf = new FastBuffer(data.buffer, data.byteOffset + 2, data.length - 2);
					if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
						cb(this.createError(Error, "invalid UTF-8 sequence", true, 1007, "WS_ERR_INVALID_UTF8"));
						return;
					}
					this._loop = false;
					this.emit("conclude", code, buf);
					this.end();
				}
				this._state = GET_INFO;
				return;
			}
			if (this._allowSynchronousEvents) {
				this.emit(this._opcode === 9 ? "ping" : "pong", data);
				this._state = GET_INFO;
			} else {
				this._state = DEFER_EVENT;
				setImmediate(() => {
					this.emit(this._opcode === 9 ? "ping" : "pong", data);
					this._state = GET_INFO;
					this.startLoop(cb);
				});
			}
		}
		/**
		* Builds an error object.
		*
		* @param {function(new:Error|RangeError)} ErrorCtor The error constructor
		* @param {String} message The error message
		* @param {Boolean} prefix Specifies whether or not to add a default prefix to
		*     `message`
		* @param {Number} statusCode The status code
		* @param {String} errorCode The exposed error code
		* @return {(Error|RangeError)} The error
		* @private
		*/
		createError(ErrorCtor, message, prefix, statusCode, errorCode) {
			this._loop = false;
			this._errored = true;
			const err = new ErrorCtor(prefix ? `Invalid WebSocket frame: ${message}` : message);
			Error.captureStackTrace(err, this.createError);
			err.code = errorCode;
			err[kStatusCode$1] = statusCode;
			return err;
		}
	};
	module.exports = Receiver$2;
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/sender.js
var require_sender = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/sender.js": ((exports, module) => {
	const { Duplex: Duplex$3 } = __require("stream");
	const { randomFillSync } = __require("crypto");
	const { types: { isUint8Array } } = __require("util");
	const PerMessageDeflate$3 = require_permessage_deflate();
	const { EMPTY_BUFFER: EMPTY_BUFFER$1, kWebSocket: kWebSocket$2, NOOP: NOOP$1 } = require_constants();
	const { isBlob: isBlob$1, isValidStatusCode } = require_validation();
	const { mask: applyMask, toBuffer: toBuffer$1 } = require_buffer_util();
	const kByteLength = Symbol("kByteLength");
	const maskBuffer = Buffer.alloc(4);
	const RANDOM_POOL_SIZE = 8 * 1024;
	let randomPool;
	let randomPoolPointer = RANDOM_POOL_SIZE;
	const DEFAULT = 0;
	const DEFLATING = 1;
	const GET_BLOB_DATA = 2;
	/**
	* HyBi Sender implementation.
	*/
	var Sender$2 = class Sender$2 {
		/**
		* Creates a Sender instance.
		*
		* @param {Duplex} socket The connection socket
		* @param {Object} [extensions] An object containing the negotiated extensions
		* @param {Function} [generateMask] The function used to generate the masking
		*     key
		*/
		constructor(socket, extensions, generateMask) {
			this._extensions = extensions || {};
			if (generateMask) {
				this._generateMask = generateMask;
				this._maskBuffer = Buffer.alloc(4);
			}
			this._socket = socket;
			this._firstFragment = true;
			this._compress = false;
			this._bufferedBytes = 0;
			this._queue = [];
			this._state = DEFAULT;
			this.onerror = NOOP$1;
			this[kWebSocket$2] = void 0;
		}
		/**
		* Frames a piece of data according to the HyBi WebSocket protocol.
		*
		* @param {(Buffer|String)} data The data to frame
		* @param {Object} options Options object
		* @param {Boolean} [options.fin=false] Specifies whether or not to set the
		*     FIN bit
		* @param {Function} [options.generateMask] The function used to generate the
		*     masking key
		* @param {Boolean} [options.mask=false] Specifies whether or not to mask
		*     `data`
		* @param {Buffer} [options.maskBuffer] The buffer used to store the masking
		*     key
		* @param {Number} options.opcode The opcode
		* @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
		*     modified
		* @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
		*     RSV1 bit
		* @return {(Buffer|String)[]} The framed data
		* @public
		*/
		static frame(data, options) {
			let mask;
			let merge = false;
			let offset = 2;
			let skipMasking = false;
			if (options.mask) {
				mask = options.maskBuffer || maskBuffer;
				if (options.generateMask) options.generateMask(mask);
				else {
					if (randomPoolPointer === RANDOM_POOL_SIZE) {
						/* istanbul ignore else  */
						if (randomPool === void 0) randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
						randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
						randomPoolPointer = 0;
					}
					mask[0] = randomPool[randomPoolPointer++];
					mask[1] = randomPool[randomPoolPointer++];
					mask[2] = randomPool[randomPoolPointer++];
					mask[3] = randomPool[randomPoolPointer++];
				}
				skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
				offset = 6;
			}
			let dataLength;
			if (typeof data === "string") if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) dataLength = options[kByteLength];
			else {
				data = Buffer.from(data);
				dataLength = data.length;
			}
			else {
				dataLength = data.length;
				merge = options.mask && options.readOnly && !skipMasking;
			}
			let payloadLength = dataLength;
			if (dataLength >= 65536) {
				offset += 8;
				payloadLength = 127;
			} else if (dataLength > 125) {
				offset += 2;
				payloadLength = 126;
			}
			const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
			target[0] = options.fin ? options.opcode | 128 : options.opcode;
			if (options.rsv1) target[0] |= 64;
			target[1] = payloadLength;
			if (payloadLength === 126) target.writeUInt16BE(dataLength, 2);
			else if (payloadLength === 127) {
				target[2] = target[3] = 0;
				target.writeUIntBE(dataLength, 4, 6);
			}
			if (!options.mask) return [target, data];
			target[1] |= 128;
			target[offset - 4] = mask[0];
			target[offset - 3] = mask[1];
			target[offset - 2] = mask[2];
			target[offset - 1] = mask[3];
			if (skipMasking) return [target, data];
			if (merge) {
				applyMask(data, mask, target, offset, dataLength);
				return [target];
			}
			applyMask(data, mask, data, 0, dataLength);
			return [target, data];
		}
		/**
		* Sends a close message to the other peer.
		*
		* @param {Number} [code] The status code component of the body
		* @param {(String|Buffer)} [data] The message component of the body
		* @param {Boolean} [mask=false] Specifies whether or not to mask the message
		* @param {Function} [cb] Callback
		* @public
		*/
		close(code, data, mask, cb) {
			let buf;
			if (code === void 0) buf = EMPTY_BUFFER$1;
			else if (typeof code !== "number" || !isValidStatusCode(code)) throw new TypeError("First argument must be a valid error code number");
			else if (data === void 0 || !data.length) {
				buf = Buffer.allocUnsafe(2);
				buf.writeUInt16BE(code, 0);
			} else {
				const length = Buffer.byteLength(data);
				if (length > 123) throw new RangeError("The message must not be greater than 123 bytes");
				buf = Buffer.allocUnsafe(2 + length);
				buf.writeUInt16BE(code, 0);
				if (typeof data === "string") buf.write(data, 2);
				else if (isUint8Array(data)) buf.set(data, 2);
				else throw new TypeError("Second argument must be a string or a Uint8Array");
			}
			const options = {
				[kByteLength]: buf.length,
				fin: true,
				generateMask: this._generateMask,
				mask,
				maskBuffer: this._maskBuffer,
				opcode: 8,
				readOnly: false,
				rsv1: false
			};
			if (this._state !== DEFAULT) this.enqueue([
				this.dispatch,
				buf,
				false,
				options,
				cb
			]);
			else this.sendFrame(Sender$2.frame(buf, options), cb);
		}
		/**
		* Sends a ping message to the other peer.
		*
		* @param {*} data The message to send
		* @param {Boolean} [mask=false] Specifies whether or not to mask `data`
		* @param {Function} [cb] Callback
		* @public
		*/
		ping(data, mask, cb) {
			let byteLength;
			let readOnly;
			if (typeof data === "string") {
				byteLength = Buffer.byteLength(data);
				readOnly = false;
			} else if (isBlob$1(data)) {
				byteLength = data.size;
				readOnly = false;
			} else {
				data = toBuffer$1(data);
				byteLength = data.length;
				readOnly = toBuffer$1.readOnly;
			}
			if (byteLength > 125) throw new RangeError("The data size must not be greater than 125 bytes");
			const options = {
				[kByteLength]: byteLength,
				fin: true,
				generateMask: this._generateMask,
				mask,
				maskBuffer: this._maskBuffer,
				opcode: 9,
				readOnly,
				rsv1: false
			};
			if (isBlob$1(data)) if (this._state !== DEFAULT) this.enqueue([
				this.getBlobData,
				data,
				false,
				options,
				cb
			]);
			else this.getBlobData(data, false, options, cb);
			else if (this._state !== DEFAULT) this.enqueue([
				this.dispatch,
				data,
				false,
				options,
				cb
			]);
			else this.sendFrame(Sender$2.frame(data, options), cb);
		}
		/**
		* Sends a pong message to the other peer.
		*
		* @param {*} data The message to send
		* @param {Boolean} [mask=false] Specifies whether or not to mask `data`
		* @param {Function} [cb] Callback
		* @public
		*/
		pong(data, mask, cb) {
			let byteLength;
			let readOnly;
			if (typeof data === "string") {
				byteLength = Buffer.byteLength(data);
				readOnly = false;
			} else if (isBlob$1(data)) {
				byteLength = data.size;
				readOnly = false;
			} else {
				data = toBuffer$1(data);
				byteLength = data.length;
				readOnly = toBuffer$1.readOnly;
			}
			if (byteLength > 125) throw new RangeError("The data size must not be greater than 125 bytes");
			const options = {
				[kByteLength]: byteLength,
				fin: true,
				generateMask: this._generateMask,
				mask,
				maskBuffer: this._maskBuffer,
				opcode: 10,
				readOnly,
				rsv1: false
			};
			if (isBlob$1(data)) if (this._state !== DEFAULT) this.enqueue([
				this.getBlobData,
				data,
				false,
				options,
				cb
			]);
			else this.getBlobData(data, false, options, cb);
			else if (this._state !== DEFAULT) this.enqueue([
				this.dispatch,
				data,
				false,
				options,
				cb
			]);
			else this.sendFrame(Sender$2.frame(data, options), cb);
		}
		/**
		* Sends a data message to the other peer.
		*
		* @param {*} data The message to send
		* @param {Object} options Options object
		* @param {Boolean} [options.binary=false] Specifies whether `data` is binary
		*     or text
		* @param {Boolean} [options.compress=false] Specifies whether or not to
		*     compress `data`
		* @param {Boolean} [options.fin=false] Specifies whether the fragment is the
		*     last one
		* @param {Boolean} [options.mask=false] Specifies whether or not to mask
		*     `data`
		* @param {Function} [cb] Callback
		* @public
		*/
		send(data, options, cb) {
			const perMessageDeflate = this._extensions[PerMessageDeflate$3.extensionName];
			let opcode = options.binary ? 2 : 1;
			let rsv1 = options.compress;
			let byteLength;
			let readOnly;
			if (typeof data === "string") {
				byteLength = Buffer.byteLength(data);
				readOnly = false;
			} else if (isBlob$1(data)) {
				byteLength = data.size;
				readOnly = false;
			} else {
				data = toBuffer$1(data);
				byteLength = data.length;
				readOnly = toBuffer$1.readOnly;
			}
			if (this._firstFragment) {
				this._firstFragment = false;
				if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) rsv1 = byteLength >= perMessageDeflate._threshold;
				this._compress = rsv1;
			} else {
				rsv1 = false;
				opcode = 0;
			}
			if (options.fin) this._firstFragment = true;
			const opts = {
				[kByteLength]: byteLength,
				fin: options.fin,
				generateMask: this._generateMask,
				mask: options.mask,
				maskBuffer: this._maskBuffer,
				opcode,
				readOnly,
				rsv1
			};
			if (isBlob$1(data)) if (this._state !== DEFAULT) this.enqueue([
				this.getBlobData,
				data,
				this._compress,
				opts,
				cb
			]);
			else this.getBlobData(data, this._compress, opts, cb);
			else if (this._state !== DEFAULT) this.enqueue([
				this.dispatch,
				data,
				this._compress,
				opts,
				cb
			]);
			else this.dispatch(data, this._compress, opts, cb);
		}
		/**
		* Gets the contents of a blob as binary data.
		*
		* @param {Blob} blob The blob
		* @param {Boolean} [compress=false] Specifies whether or not to compress
		*     the data
		* @param {Object} options Options object
		* @param {Boolean} [options.fin=false] Specifies whether or not to set the
		*     FIN bit
		* @param {Function} [options.generateMask] The function used to generate the
		*     masking key
		* @param {Boolean} [options.mask=false] Specifies whether or not to mask
		*     `data`
		* @param {Buffer} [options.maskBuffer] The buffer used to store the masking
		*     key
		* @param {Number} options.opcode The opcode
		* @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
		*     modified
		* @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
		*     RSV1 bit
		* @param {Function} [cb] Callback
		* @private
		*/
		getBlobData(blob, compress, options, cb) {
			this._bufferedBytes += options[kByteLength];
			this._state = GET_BLOB_DATA;
			blob.arrayBuffer().then((arrayBuffer) => {
				if (this._socket.destroyed) {
					const err = /* @__PURE__ */ new Error("The socket was closed while the blob was being read");
					process.nextTick(callCallbacks, this, err, cb);
					return;
				}
				this._bufferedBytes -= options[kByteLength];
				const data = toBuffer$1(arrayBuffer);
				if (!compress) {
					this._state = DEFAULT;
					this.sendFrame(Sender$2.frame(data, options), cb);
					this.dequeue();
				} else this.dispatch(data, compress, options, cb);
			}).catch((err) => {
				process.nextTick(onError, this, err, cb);
			});
		}
		/**
		* Dispatches a message.
		*
		* @param {(Buffer|String)} data The message to send
		* @param {Boolean} [compress=false] Specifies whether or not to compress
		*     `data`
		* @param {Object} options Options object
		* @param {Boolean} [options.fin=false] Specifies whether or not to set the
		*     FIN bit
		* @param {Function} [options.generateMask] The function used to generate the
		*     masking key
		* @param {Boolean} [options.mask=false] Specifies whether or not to mask
		*     `data`
		* @param {Buffer} [options.maskBuffer] The buffer used to store the masking
		*     key
		* @param {Number} options.opcode The opcode
		* @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
		*     modified
		* @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
		*     RSV1 bit
		* @param {Function} [cb] Callback
		* @private
		*/
		dispatch(data, compress, options, cb) {
			if (!compress) {
				this.sendFrame(Sender$2.frame(data, options), cb);
				return;
			}
			const perMessageDeflate = this._extensions[PerMessageDeflate$3.extensionName];
			this._bufferedBytes += options[kByteLength];
			this._state = DEFLATING;
			perMessageDeflate.compress(data, options.fin, (_, buf) => {
				if (this._socket.destroyed) {
					callCallbacks(this, /* @__PURE__ */ new Error("The socket was closed while data was being compressed"), cb);
					return;
				}
				this._bufferedBytes -= options[kByteLength];
				this._state = DEFAULT;
				options.readOnly = false;
				this.sendFrame(Sender$2.frame(buf, options), cb);
				this.dequeue();
			});
		}
		/**
		* Executes queued send operations.
		*
		* @private
		*/
		dequeue() {
			while (this._state === DEFAULT && this._queue.length) {
				const params = this._queue.shift();
				this._bufferedBytes -= params[3][kByteLength];
				Reflect.apply(params[0], this, params.slice(1));
			}
		}
		/**
		* Enqueues a send operation.
		*
		* @param {Array} params Send operation parameters.
		* @private
		*/
		enqueue(params) {
			this._bufferedBytes += params[3][kByteLength];
			this._queue.push(params);
		}
		/**
		* Sends a frame.
		*
		* @param {(Buffer | String)[]} list The frame to send
		* @param {Function} [cb] Callback
		* @private
		*/
		sendFrame(list, cb) {
			if (list.length === 2) {
				this._socket.cork();
				this._socket.write(list[0]);
				this._socket.write(list[1], cb);
				this._socket.uncork();
			} else this._socket.write(list[0], cb);
		}
	};
	module.exports = Sender$2;
	/**
	* Calls queued callbacks with an error.
	*
	* @param {Sender} sender The `Sender` instance
	* @param {Error} err The error to call the callbacks with
	* @param {Function} [cb] The first callback
	* @private
	*/
	function callCallbacks(sender, err, cb) {
		if (typeof cb === "function") cb(err);
		for (let i = 0; i < sender._queue.length; i++) {
			const params = sender._queue[i];
			const callback = params[params.length - 1];
			if (typeof callback === "function") callback(err);
		}
	}
	/**
	* Handles a `Sender` error.
	*
	* @param {Sender} sender The `Sender` instance
	* @param {Error} err The error
	* @param {Function} [cb] The first pending callback
	* @private
	*/
	function onError(sender, err, cb) {
		callCallbacks(sender, err, cb);
		sender.onerror(err);
	}
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/event-target.js
var require_event_target = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/event-target.js": ((exports, module) => {
	const { kForOnEventAttribute: kForOnEventAttribute$1, kListener: kListener$1 } = require_constants();
	const kCode = Symbol("kCode");
	const kData = Symbol("kData");
	const kError = Symbol("kError");
	const kMessage = Symbol("kMessage");
	const kReason = Symbol("kReason");
	const kTarget = Symbol("kTarget");
	const kType = Symbol("kType");
	const kWasClean = Symbol("kWasClean");
	/**
	* Class representing an event.
	*/
	var Event = class {
		/**
		* Create a new `Event`.
		*
		* @param {String} type The name of the event
		* @throws {TypeError} If the `type` argument is not specified
		*/
		constructor(type) {
			this[kTarget] = null;
			this[kType] = type;
		}
		/**
		* @type {*}
		*/
		get target() {
			return this[kTarget];
		}
		/**
		* @type {String}
		*/
		get type() {
			return this[kType];
		}
	};
	Object.defineProperty(Event.prototype, "target", { enumerable: true });
	Object.defineProperty(Event.prototype, "type", { enumerable: true });
	/**
	* Class representing a close event.
	*
	* @extends Event
	*/
	var CloseEvent = class extends Event {
		/**
		* Create a new `CloseEvent`.
		*
		* @param {String} type The name of the event
		* @param {Object} [options] A dictionary object that allows for setting
		*     attributes via object members of the same name
		* @param {Number} [options.code=0] The status code explaining why the
		*     connection was closed
		* @param {String} [options.reason=''] A human-readable string explaining why
		*     the connection was closed
		* @param {Boolean} [options.wasClean=false] Indicates whether or not the
		*     connection was cleanly closed
		*/
		constructor(type, options = {}) {
			super(type);
			this[kCode] = options.code === void 0 ? 0 : options.code;
			this[kReason] = options.reason === void 0 ? "" : options.reason;
			this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
		}
		/**
		* @type {Number}
		*/
		get code() {
			return this[kCode];
		}
		/**
		* @type {String}
		*/
		get reason() {
			return this[kReason];
		}
		/**
		* @type {Boolean}
		*/
		get wasClean() {
			return this[kWasClean];
		}
	};
	Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
	Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
	Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
	/**
	* Class representing an error event.
	*
	* @extends Event
	*/
	var ErrorEvent = class extends Event {
		/**
		* Create a new `ErrorEvent`.
		*
		* @param {String} type The name of the event
		* @param {Object} [options] A dictionary object that allows for setting
		*     attributes via object members of the same name
		* @param {*} [options.error=null] The error that generated this event
		* @param {String} [options.message=''] The error message
		*/
		constructor(type, options = {}) {
			super(type);
			this[kError] = options.error === void 0 ? null : options.error;
			this[kMessage] = options.message === void 0 ? "" : options.message;
		}
		/**
		* @type {*}
		*/
		get error() {
			return this[kError];
		}
		/**
		* @type {String}
		*/
		get message() {
			return this[kMessage];
		}
	};
	Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
	Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
	/**
	* Class representing a message event.
	*
	* @extends Event
	*/
	var MessageEvent = class extends Event {
		/**
		* Create a new `MessageEvent`.
		*
		* @param {String} type The name of the event
		* @param {Object} [options] A dictionary object that allows for setting
		*     attributes via object members of the same name
		* @param {*} [options.data=null] The message content
		*/
		constructor(type, options = {}) {
			super(type);
			this[kData] = options.data === void 0 ? null : options.data;
		}
		/**
		* @type {*}
		*/
		get data() {
			return this[kData];
		}
	};
	Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
	/**
	* This provides methods for emulating the `EventTarget` interface. It's not
	* meant to be used directly.
	*
	* @mixin
	*/
	const EventTarget = {
		addEventListener(type, handler, options = {}) {
			for (const listener of this.listeners(type)) if (!options[kForOnEventAttribute$1] && listener[kListener$1] === handler && !listener[kForOnEventAttribute$1]) return;
			let wrapper;
			if (type === "message") wrapper = function onMessage(data, isBinary) {
				const event = new MessageEvent("message", { data: isBinary ? data : data.toString() });
				event[kTarget] = this;
				callListener(handler, this, event);
			};
			else if (type === "close") wrapper = function onClose(code, message) {
				const event = new CloseEvent("close", {
					code,
					reason: message.toString(),
					wasClean: this._closeFrameReceived && this._closeFrameSent
				});
				event[kTarget] = this;
				callListener(handler, this, event);
			};
			else if (type === "error") wrapper = function onError$1(error) {
				const event = new ErrorEvent("error", {
					error,
					message: error.message
				});
				event[kTarget] = this;
				callListener(handler, this, event);
			};
			else if (type === "open") wrapper = function onOpen() {
				const event = new Event("open");
				event[kTarget] = this;
				callListener(handler, this, event);
			};
			else return;
			wrapper[kForOnEventAttribute$1] = !!options[kForOnEventAttribute$1];
			wrapper[kListener$1] = handler;
			if (options.once) this.once(type, wrapper);
			else this.on(type, wrapper);
		},
		removeEventListener(type, handler) {
			for (const listener of this.listeners(type)) if (listener[kListener$1] === handler && !listener[kForOnEventAttribute$1]) {
				this.removeListener(type, listener);
				break;
			}
		}
	};
	module.exports = {
		CloseEvent,
		ErrorEvent,
		Event,
		EventTarget,
		MessageEvent
	};
	/**
	* Call an event listener
	*
	* @param {(Function|Object)} listener The listener to call
	* @param {*} thisArg The value to use as `this`` when calling the listener
	* @param {Event} event The event to pass to the listener
	* @private
	*/
	function callListener(listener, thisArg, event) {
		if (typeof listener === "object" && listener.handleEvent) listener.handleEvent.call(listener, event);
		else listener.call(thisArg, event);
	}
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/extension.js
var require_extension = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/extension.js": ((exports, module) => {
	const { tokenChars: tokenChars$1 } = require_validation();
	/**
	* Adds an offer to the map of extension offers or a parameter to the map of
	* parameters.
	*
	* @param {Object} dest The map of extension offers or parameters
	* @param {String} name The extension or parameter name
	* @param {(Object|Boolean|String)} elem The extension parameters or the
	*     parameter value
	* @private
	*/
	function push(dest, name$1, elem) {
		if (dest[name$1] === void 0) dest[name$1] = [elem];
		else dest[name$1].push(elem);
	}
	/**
	* Parses the `Sec-WebSocket-Extensions` header into an object.
	*
	* @param {String} header The field value of the header
	* @return {Object} The parsed object
	* @public
	*/
	function parse$2(header) {
		const offers = Object.create(null);
		let params = Object.create(null);
		let mustUnescape = false;
		let isEscaping = false;
		let inQuotes = false;
		let extensionName;
		let paramName;
		let start = -1;
		let code = -1;
		let end = -1;
		let i = 0;
		for (; i < header.length; i++) {
			code = header.charCodeAt(i);
			if (extensionName === void 0) if (end === -1 && tokenChars$1[code] === 1) {
				if (start === -1) start = i;
			} else if (i !== 0 && (code === 32 || code === 9)) {
				if (end === -1 && start !== -1) end = i;
			} else if (code === 59 || code === 44) {
				if (start === -1) throw new SyntaxError(`Unexpected character at index ${i}`);
				if (end === -1) end = i;
				const name$1 = header.slice(start, end);
				if (code === 44) {
					push(offers, name$1, params);
					params = Object.create(null);
				} else extensionName = name$1;
				start = end = -1;
			} else throw new SyntaxError(`Unexpected character at index ${i}`);
			else if (paramName === void 0) if (end === -1 && tokenChars$1[code] === 1) {
				if (start === -1) start = i;
			} else if (code === 32 || code === 9) {
				if (end === -1 && start !== -1) end = i;
			} else if (code === 59 || code === 44) {
				if (start === -1) throw new SyntaxError(`Unexpected character at index ${i}`);
				if (end === -1) end = i;
				push(params, header.slice(start, end), true);
				if (code === 44) {
					push(offers, extensionName, params);
					params = Object.create(null);
					extensionName = void 0;
				}
				start = end = -1;
			} else if (code === 61 && start !== -1 && end === -1) {
				paramName = header.slice(start, i);
				start = end = -1;
			} else throw new SyntaxError(`Unexpected character at index ${i}`);
			else if (isEscaping) {
				if (tokenChars$1[code] !== 1) throw new SyntaxError(`Unexpected character at index ${i}`);
				if (start === -1) start = i;
				else if (!mustUnescape) mustUnescape = true;
				isEscaping = false;
			} else if (inQuotes) if (tokenChars$1[code] === 1) {
				if (start === -1) start = i;
			} else if (code === 34 && start !== -1) {
				inQuotes = false;
				end = i;
			} else if (code === 92) isEscaping = true;
			else throw new SyntaxError(`Unexpected character at index ${i}`);
			else if (code === 34 && header.charCodeAt(i - 1) === 61) inQuotes = true;
			else if (end === -1 && tokenChars$1[code] === 1) {
				if (start === -1) start = i;
			} else if (start !== -1 && (code === 32 || code === 9)) {
				if (end === -1) end = i;
			} else if (code === 59 || code === 44) {
				if (start === -1) throw new SyntaxError(`Unexpected character at index ${i}`);
				if (end === -1) end = i;
				let value = header.slice(start, end);
				if (mustUnescape) {
					value = value.replace(/\\/g, "");
					mustUnescape = false;
				}
				push(params, paramName, value);
				if (code === 44) {
					push(offers, extensionName, params);
					params = Object.create(null);
					extensionName = void 0;
				}
				paramName = void 0;
				start = end = -1;
			} else throw new SyntaxError(`Unexpected character at index ${i}`);
		}
		if (start === -1 || inQuotes || code === 32 || code === 9) throw new SyntaxError("Unexpected end of input");
		if (end === -1) end = i;
		const token = header.slice(start, end);
		if (extensionName === void 0) push(offers, token, params);
		else {
			if (paramName === void 0) push(params, token, true);
			else if (mustUnescape) push(params, paramName, token.replace(/\\/g, ""));
			else push(params, paramName, token);
			push(offers, extensionName, params);
		}
		return offers;
	}
	/**
	* Builds the `Sec-WebSocket-Extensions` header field value.
	*
	* @param {Object} extensions The map of extensions and parameters to format
	* @return {String} A string representing the given object
	* @public
	*/
	function format$1(extensions) {
		return Object.keys(extensions).map((extension$2) => {
			let configurations = extensions[extension$2];
			if (!Array.isArray(configurations)) configurations = [configurations];
			return configurations.map((params) => {
				return [extension$2].concat(Object.keys(params).map((k) => {
					let values = params[k];
					if (!Array.isArray(values)) values = [values];
					return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
				})).join("; ");
			}).join(", ");
		}).join(", ");
	}
	module.exports = {
		format: format$1,
		parse: parse$2
	};
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/websocket.js
var require_websocket = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/websocket.js": ((exports, module) => {
	const EventEmitter$1 = __require("events");
	const https = __require("https");
	const http$1 = __require("http");
	const net = __require("net");
	const tls = __require("tls");
	const { randomBytes, createHash: createHash$1 } = __require("crypto");
	const { Duplex: Duplex$2, Readable: Readable$1 } = __require("stream");
	const { URL: URL$1 } = __require("url");
	const PerMessageDeflate$2 = require_permessage_deflate();
	const Receiver$1 = require_receiver();
	const Sender$1 = require_sender();
	const { isBlob } = require_validation();
	const { BINARY_TYPES, CLOSE_TIMEOUT: CLOSE_TIMEOUT$1, EMPTY_BUFFER, GUID: GUID$1, kForOnEventAttribute, kListener, kStatusCode, kWebSocket: kWebSocket$1, NOOP } = require_constants();
	const { EventTarget: { addEventListener, removeEventListener } } = require_event_target();
	const { format, parse: parse$1 } = require_extension();
	const { toBuffer } = require_buffer_util();
	const kAborted = Symbol("kAborted");
	const protocolVersions = [8, 13];
	const readyStates = [
		"CONNECTING",
		"OPEN",
		"CLOSING",
		"CLOSED"
	];
	const subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
	/**
	* Class representing a WebSocket.
	*
	* @extends EventEmitter
	*/
	var WebSocket$3 = class WebSocket$3 extends EventEmitter$1 {
		/**
		* Create a new `WebSocket`.
		*
		* @param {(String|URL)} address The URL to which to connect
		* @param {(String|String[])} [protocols] The subprotocols
		* @param {Object} [options] Connection options
		*/
		constructor(address, protocols, options) {
			super();
			this._binaryType = BINARY_TYPES[0];
			this._closeCode = 1006;
			this._closeFrameReceived = false;
			this._closeFrameSent = false;
			this._closeMessage = EMPTY_BUFFER;
			this._closeTimer = null;
			this._errorEmitted = false;
			this._extensions = {};
			this._paused = false;
			this._protocol = "";
			this._readyState = WebSocket$3.CONNECTING;
			this._receiver = null;
			this._sender = null;
			this._socket = null;
			if (address !== null) {
				this._bufferedAmount = 0;
				this._isServer = false;
				this._redirects = 0;
				if (protocols === void 0) protocols = [];
				else if (!Array.isArray(protocols)) if (typeof protocols === "object" && protocols !== null) {
					options = protocols;
					protocols = [];
				} else protocols = [protocols];
				initAsClient(this, address, protocols, options);
			} else {
				this._autoPong = options.autoPong;
				this._closeTimeout = options.closeTimeout;
				this._isServer = true;
			}
		}
		/**
		* For historical reasons, the custom "nodebuffer" type is used by the default
		* instead of "blob".
		*
		* @type {String}
		*/
		get binaryType() {
			return this._binaryType;
		}
		set binaryType(type) {
			if (!BINARY_TYPES.includes(type)) return;
			this._binaryType = type;
			if (this._receiver) this._receiver._binaryType = type;
		}
		/**
		* @type {Number}
		*/
		get bufferedAmount() {
			if (!this._socket) return this._bufferedAmount;
			return this._socket._writableState.length + this._sender._bufferedBytes;
		}
		/**
		* @type {String}
		*/
		get extensions() {
			return Object.keys(this._extensions).join();
		}
		/**
		* @type {Boolean}
		*/
		get isPaused() {
			return this._paused;
		}
		/**
		* @type {Function}
		*/
		/* istanbul ignore next */
		get onclose() {
			return null;
		}
		/**
		* @type {Function}
		*/
		/* istanbul ignore next */
		get onerror() {
			return null;
		}
		/**
		* @type {Function}
		*/
		/* istanbul ignore next */
		get onopen() {
			return null;
		}
		/**
		* @type {Function}
		*/
		/* istanbul ignore next */
		get onmessage() {
			return null;
		}
		/**
		* @type {String}
		*/
		get protocol() {
			return this._protocol;
		}
		/**
		* @type {Number}
		*/
		get readyState() {
			return this._readyState;
		}
		/**
		* @type {String}
		*/
		get url() {
			return this._url;
		}
		/**
		* Set up the socket and the internal resources.
		*
		* @param {Duplex} socket The network socket between the server and client
		* @param {Buffer} head The first packet of the upgraded stream
		* @param {Object} options Options object
		* @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
		*     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
		*     multiple times in the same tick
		* @param {Function} [options.generateMask] The function used to generate the
		*     masking key
		* @param {Number} [options.maxBufferedChunks=0] The maximum number of
		*     buffered data chunks
		* @param {Number} [options.maxFragments=0] The maximum number of message
		*     fragments
		* @param {Number} [options.maxPayload=0] The maximum allowed message size
		* @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
		*     not to skip UTF-8 validation for text and close messages
		* @private
		*/
		setSocket(socket, head, options) {
			const receiver = new Receiver$1({
				allowSynchronousEvents: options.allowSynchronousEvents,
				binaryType: this.binaryType,
				extensions: this._extensions,
				isServer: this._isServer,
				maxBufferedChunks: options.maxBufferedChunks,
				maxFragments: options.maxFragments,
				maxPayload: options.maxPayload,
				skipUTF8Validation: options.skipUTF8Validation
			});
			const sender = new Sender$1(socket, this._extensions, options.generateMask);
			this._receiver = receiver;
			this._sender = sender;
			this._socket = socket;
			receiver[kWebSocket$1] = this;
			sender[kWebSocket$1] = this;
			socket[kWebSocket$1] = this;
			receiver.on("conclude", receiverOnConclude);
			receiver.on("drain", receiverOnDrain);
			receiver.on("error", receiverOnError);
			receiver.on("message", receiverOnMessage);
			receiver.on("ping", receiverOnPing);
			receiver.on("pong", receiverOnPong);
			sender.onerror = senderOnError;
			if (socket.setTimeout) socket.setTimeout(0);
			if (socket.setNoDelay) socket.setNoDelay();
			if (head.length > 0) socket.unshift(head);
			socket.on("close", socketOnClose);
			socket.on("data", socketOnData);
			socket.on("end", socketOnEnd);
			socket.on("error", socketOnError$1);
			this._readyState = WebSocket$3.OPEN;
			this.emit("open");
		}
		/**
		* Emit the `'close'` event.
		*
		* @private
		*/
		emitClose() {
			if (!this._socket) {
				this._readyState = WebSocket$3.CLOSED;
				this.emit("close", this._closeCode, this._closeMessage);
				return;
			}
			if (this._extensions[PerMessageDeflate$2.extensionName]) this._extensions[PerMessageDeflate$2.extensionName].cleanup();
			this._receiver.removeAllListeners();
			this._readyState = WebSocket$3.CLOSED;
			this.emit("close", this._closeCode, this._closeMessage);
		}
		/**
		* Start a closing handshake.
		*
		*          +----------+   +-----------+   +----------+
		*     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
		*    |     +----------+   +-----------+   +----------+     |
		*          +----------+   +-----------+         |
		* CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
		*          +----------+   +-----------+   |
		*    |           |                        |   +---+        |
		*                +------------------------+-->|fin| - - - -
		*    |         +---+                      |   +---+
		*     - - - - -|fin|<---------------------+
		*              +---+
		*
		* @param {Number} [code] Status code explaining why the connection is closing
		* @param {(String|Buffer)} [data] The reason why the connection is
		*     closing
		* @public
		*/
		close(code, data) {
			if (this.readyState === WebSocket$3.CLOSED) return;
			if (this.readyState === WebSocket$3.CONNECTING) {
				abortHandshake$1(this, this._req, "WebSocket was closed before the connection was established");
				return;
			}
			if (this.readyState === WebSocket$3.CLOSING) {
				if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) this._socket.end();
				return;
			}
			this._readyState = WebSocket$3.CLOSING;
			this._sender.close(code, data, !this._isServer, (err) => {
				if (err) return;
				this._closeFrameSent = true;
				if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) this._socket.end();
			});
			setCloseTimer(this);
		}
		/**
		* Pause the socket.
		*
		* @public
		*/
		pause() {
			if (this.readyState === WebSocket$3.CONNECTING || this.readyState === WebSocket$3.CLOSED) return;
			this._paused = true;
			this._socket.pause();
		}
		/**
		* Send a ping.
		*
		* @param {*} [data] The data to send
		* @param {Boolean} [mask] Indicates whether or not to mask `data`
		* @param {Function} [cb] Callback which is executed when the ping is sent
		* @public
		*/
		ping(data, mask, cb) {
			if (this.readyState === WebSocket$3.CONNECTING) throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
			if (typeof data === "function") {
				cb = data;
				data = mask = void 0;
			} else if (typeof mask === "function") {
				cb = mask;
				mask = void 0;
			}
			if (typeof data === "number") data = data.toString();
			if (this.readyState !== WebSocket$3.OPEN) {
				sendAfterClose(this, data, cb);
				return;
			}
			if (mask === void 0) mask = !this._isServer;
			this._sender.ping(data || EMPTY_BUFFER, mask, cb);
		}
		/**
		* Send a pong.
		*
		* @param {*} [data] The data to send
		* @param {Boolean} [mask] Indicates whether or not to mask `data`
		* @param {Function} [cb] Callback which is executed when the pong is sent
		* @public
		*/
		pong(data, mask, cb) {
			if (this.readyState === WebSocket$3.CONNECTING) throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
			if (typeof data === "function") {
				cb = data;
				data = mask = void 0;
			} else if (typeof mask === "function") {
				cb = mask;
				mask = void 0;
			}
			if (typeof data === "number") data = data.toString();
			if (this.readyState !== WebSocket$3.OPEN) {
				sendAfterClose(this, data, cb);
				return;
			}
			if (mask === void 0) mask = !this._isServer;
			this._sender.pong(data || EMPTY_BUFFER, mask, cb);
		}
		/**
		* Resume the socket.
		*
		* @public
		*/
		resume() {
			if (this.readyState === WebSocket$3.CONNECTING || this.readyState === WebSocket$3.CLOSED) return;
			this._paused = false;
			if (!this._receiver._writableState.needDrain) this._socket.resume();
		}
		/**
		* Send a data message.
		*
		* @param {*} data The message to send
		* @param {Object} [options] Options object
		* @param {Boolean} [options.binary] Specifies whether `data` is binary or
		*     text
		* @param {Boolean} [options.compress] Specifies whether or not to compress
		*     `data`
		* @param {Boolean} [options.fin=true] Specifies whether the fragment is the
		*     last one
		* @param {Boolean} [options.mask] Specifies whether or not to mask `data`
		* @param {Function} [cb] Callback which is executed when data is written out
		* @public
		*/
		send(data, options, cb) {
			if (this.readyState === WebSocket$3.CONNECTING) throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
			if (typeof options === "function") {
				cb = options;
				options = {};
			}
			if (typeof data === "number") data = data.toString();
			if (this.readyState !== WebSocket$3.OPEN) {
				sendAfterClose(this, data, cb);
				return;
			}
			const opts = {
				binary: typeof data !== "string",
				mask: !this._isServer,
				compress: true,
				fin: true,
				...options
			};
			if (!this._extensions[PerMessageDeflate$2.extensionName]) opts.compress = false;
			this._sender.send(data || EMPTY_BUFFER, opts, cb);
		}
		/**
		* Forcibly close the connection.
		*
		* @public
		*/
		terminate() {
			if (this.readyState === WebSocket$3.CLOSED) return;
			if (this.readyState === WebSocket$3.CONNECTING) {
				abortHandshake$1(this, this._req, "WebSocket was closed before the connection was established");
				return;
			}
			if (this._socket) {
				this._readyState = WebSocket$3.CLOSING;
				this._socket.destroy();
			}
		}
	};
	/**
	* @constant {Number} CONNECTING
	* @memberof WebSocket
	*/
	Object.defineProperty(WebSocket$3, "CONNECTING", {
		enumerable: true,
		value: readyStates.indexOf("CONNECTING")
	});
	/**
	* @constant {Number} CONNECTING
	* @memberof WebSocket.prototype
	*/
	Object.defineProperty(WebSocket$3.prototype, "CONNECTING", {
		enumerable: true,
		value: readyStates.indexOf("CONNECTING")
	});
	/**
	* @constant {Number} OPEN
	* @memberof WebSocket
	*/
	Object.defineProperty(WebSocket$3, "OPEN", {
		enumerable: true,
		value: readyStates.indexOf("OPEN")
	});
	/**
	* @constant {Number} OPEN
	* @memberof WebSocket.prototype
	*/
	Object.defineProperty(WebSocket$3.prototype, "OPEN", {
		enumerable: true,
		value: readyStates.indexOf("OPEN")
	});
	/**
	* @constant {Number} CLOSING
	* @memberof WebSocket
	*/
	Object.defineProperty(WebSocket$3, "CLOSING", {
		enumerable: true,
		value: readyStates.indexOf("CLOSING")
	});
	/**
	* @constant {Number} CLOSING
	* @memberof WebSocket.prototype
	*/
	Object.defineProperty(WebSocket$3.prototype, "CLOSING", {
		enumerable: true,
		value: readyStates.indexOf("CLOSING")
	});
	/**
	* @constant {Number} CLOSED
	* @memberof WebSocket
	*/
	Object.defineProperty(WebSocket$3, "CLOSED", {
		enumerable: true,
		value: readyStates.indexOf("CLOSED")
	});
	/**
	* @constant {Number} CLOSED
	* @memberof WebSocket.prototype
	*/
	Object.defineProperty(WebSocket$3.prototype, "CLOSED", {
		enumerable: true,
		value: readyStates.indexOf("CLOSED")
	});
	[
		"binaryType",
		"bufferedAmount",
		"extensions",
		"isPaused",
		"protocol",
		"readyState",
		"url"
	].forEach((property) => {
		Object.defineProperty(WebSocket$3.prototype, property, { enumerable: true });
	});
	[
		"open",
		"error",
		"close",
		"message"
	].forEach((method) => {
		Object.defineProperty(WebSocket$3.prototype, `on${method}`, {
			enumerable: true,
			get() {
				for (const listener of this.listeners(method)) if (listener[kForOnEventAttribute]) return listener[kListener];
				return null;
			},
			set(handler) {
				for (const listener of this.listeners(method)) if (listener[kForOnEventAttribute]) {
					this.removeListener(method, listener);
					break;
				}
				if (typeof handler !== "function") return;
				this.addEventListener(method, handler, { [kForOnEventAttribute]: true });
			}
		});
	});
	WebSocket$3.prototype.addEventListener = addEventListener;
	WebSocket$3.prototype.removeEventListener = removeEventListener;
	module.exports = WebSocket$3;
	/**
	* Initialize a WebSocket client.
	*
	* @param {WebSocket} websocket The client to initialize
	* @param {(String|URL)} address The URL to which to connect
	* @param {Array} protocols The subprotocols
	* @param {Object} [options] Connection options
	* @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether any
	*     of the `'message'`, `'ping'`, and `'pong'` events can be emitted multiple
	*     times in the same tick
	* @param {Boolean} [options.autoPong=true] Specifies whether or not to
	*     automatically send a pong in response to a ping
	* @param {Number} [options.closeTimeout=30000] Duration in milliseconds to wait
	*     for the closing handshake to finish after `websocket.close()` is called
	* @param {Function} [options.finishRequest] A function which can be used to
	*     customize the headers of each http request before it is sent
	* @param {Boolean} [options.followRedirects=false] Whether or not to follow
	*     redirects
	* @param {Function} [options.generateMask] The function used to generate the
	*     masking key
	* @param {Number} [options.handshakeTimeout] Timeout in milliseconds for the
	*     handshake request
	* @param {Number} [options.maxBufferedChunks=1048576] The maximum number of
	*     buffered data chunks
	* @param {Number} [options.maxFragments=131072] The maximum number of message
	*     fragments
	* @param {Number} [options.maxPayload=104857600] The maximum allowed message
	*     size
	* @param {Number} [options.maxRedirects=10] The maximum number of redirects
	*     allowed
	* @param {String} [options.origin] Value of the `Origin` or
	*     `Sec-WebSocket-Origin` header
	* @param {(Boolean|Object)} [options.perMessageDeflate=true] Enable/disable
	*     permessage-deflate
	* @param {Number} [options.protocolVersion=13] Value of the
	*     `Sec-WebSocket-Version` header
	* @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
	*     not to skip UTF-8 validation for text and close messages
	* @private
	*/
	function initAsClient(websocket, address, protocols, options) {
		const opts = {
			allowSynchronousEvents: true,
			autoPong: true,
			closeTimeout: CLOSE_TIMEOUT$1,
			protocolVersion: protocolVersions[1],
			maxBufferedChunks: 1024 * 1024,
			maxFragments: 128 * 1024,
			maxPayload: 100 * 1024 * 1024,
			skipUTF8Validation: false,
			perMessageDeflate: true,
			followRedirects: false,
			maxRedirects: 10,
			...options,
			socketPath: void 0,
			hostname: void 0,
			protocol: void 0,
			timeout: void 0,
			method: "GET",
			host: void 0,
			path: void 0,
			port: void 0
		};
		websocket._autoPong = opts.autoPong;
		websocket._closeTimeout = opts.closeTimeout;
		if (!protocolVersions.includes(opts.protocolVersion)) throw new RangeError(`Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`);
		let parsedUrl;
		if (address instanceof URL$1) parsedUrl = address;
		else try {
			parsedUrl = new URL$1(address);
		} catch {
			throw new SyntaxError(`Invalid URL: ${address}`);
		}
		if (parsedUrl.protocol === "http:") parsedUrl.protocol = "ws:";
		else if (parsedUrl.protocol === "https:") parsedUrl.protocol = "wss:";
		websocket._url = parsedUrl.href;
		const isSecure = parsedUrl.protocol === "wss:";
		const isIpcUrl = parsedUrl.protocol === "ws+unix:";
		let invalidUrlMessage;
		if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) invalidUrlMessage = "The URL's protocol must be one of \"ws:\", \"wss:\", \"http:\", \"https:\", or \"ws+unix:\"";
		else if (isIpcUrl && !parsedUrl.pathname) invalidUrlMessage = "The URL's pathname is empty";
		else if (parsedUrl.hash) invalidUrlMessage = "The URL contains a fragment identifier";
		if (invalidUrlMessage) {
			const err = new SyntaxError(invalidUrlMessage);
			if (websocket._redirects === 0) throw err;
			else {
				emitErrorAndClose(websocket, err);
				return;
			}
		}
		const defaultPort = isSecure ? 443 : 80;
		const key = randomBytes(16).toString("base64");
		const request = isSecure ? https.request : http$1.request;
		const protocolSet = /* @__PURE__ */ new Set();
		let perMessageDeflate;
		opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
		opts.defaultPort = opts.defaultPort || defaultPort;
		opts.port = parsedUrl.port || defaultPort;
		opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
		opts.headers = {
			...opts.headers,
			"Sec-WebSocket-Version": opts.protocolVersion,
			"Sec-WebSocket-Key": key,
			Connection: "Upgrade",
			Upgrade: "websocket"
		};
		opts.path = parsedUrl.pathname + parsedUrl.search;
		opts.timeout = opts.handshakeTimeout;
		if (opts.perMessageDeflate) {
			perMessageDeflate = new PerMessageDeflate$2({
				...opts.perMessageDeflate,
				isServer: false,
				maxPayload: opts.maxPayload
			});
			opts.headers["Sec-WebSocket-Extensions"] = format({ [PerMessageDeflate$2.extensionName]: perMessageDeflate.offer() });
		}
		if (protocols.length) {
			for (const protocol of protocols) {
				if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) throw new SyntaxError("An invalid or duplicated subprotocol was specified");
				protocolSet.add(protocol);
			}
			opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
		}
		if (opts.origin) if (opts.protocolVersion < 13) opts.headers["Sec-WebSocket-Origin"] = opts.origin;
		else opts.headers.Origin = opts.origin;
		if (parsedUrl.username || parsedUrl.password) opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
		if (isIpcUrl) {
			const parts = opts.path.split(":");
			opts.socketPath = parts[0];
			opts.path = parts[1];
		}
		let req;
		if (opts.followRedirects) {
			if (websocket._redirects === 0) {
				websocket._originalIpc = isIpcUrl;
				websocket._originalSecure = isSecure;
				websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
				const headers = options && options.headers;
				options = {
					...options,
					headers: {}
				};
				if (headers) for (const [key$1, value] of Object.entries(headers)) options.headers[key$1.toLowerCase()] = value;
			} else if (websocket.listenerCount("redirect") === 0) {
				const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
				if (!isSameHost || websocket._originalSecure && !isSecure) {
					delete opts.headers.authorization;
					delete opts.headers.cookie;
					if (!isSameHost) delete opts.headers.host;
					opts.auth = void 0;
				}
			}
			if (opts.auth && !options.headers.authorization) options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
			req = websocket._req = request(opts);
			if (websocket._redirects) websocket.emit("redirect", websocket.url, req);
		} else req = websocket._req = request(opts);
		if (opts.timeout) req.on("timeout", () => {
			abortHandshake$1(websocket, req, "Opening handshake has timed out");
		});
		req.on("error", (err) => {
			if (req === null || req[kAborted]) return;
			req = websocket._req = null;
			emitErrorAndClose(websocket, err);
		});
		req.on("response", (res) => {
			const location = res.headers.location;
			const statusCode = res.statusCode;
			if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
				if (++websocket._redirects > opts.maxRedirects) {
					abortHandshake$1(websocket, req, "Maximum redirects exceeded");
					return;
				}
				req.abort();
				let addr;
				try {
					addr = new URL$1(location, address);
				} catch (e) {
					emitErrorAndClose(websocket, /* @__PURE__ */ new SyntaxError(`Invalid URL: ${location}`));
					return;
				}
				initAsClient(websocket, addr, protocols, options);
			} else if (!websocket.emit("unexpected-response", req, res)) abortHandshake$1(websocket, req, `Unexpected server response: ${res.statusCode}`);
		});
		req.on("upgrade", (res, socket, head) => {
			websocket.emit("upgrade", res);
			if (websocket.readyState !== WebSocket$3.CONNECTING) return;
			req = websocket._req = null;
			const upgrade = res.headers.upgrade;
			if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
				abortHandshake$1(websocket, socket, "Invalid Upgrade header");
				return;
			}
			const digest = createHash$1("sha1").update(key + GUID$1).digest("base64");
			if (res.headers["sec-websocket-accept"] !== digest) {
				abortHandshake$1(websocket, socket, "Invalid Sec-WebSocket-Accept header");
				return;
			}
			const serverProt = res.headers["sec-websocket-protocol"];
			let protError;
			if (serverProt !== void 0) {
				if (!protocolSet.size) protError = "Server sent a subprotocol but none was requested";
				else if (!protocolSet.has(serverProt)) protError = "Server sent an invalid subprotocol";
			} else if (protocolSet.size) protError = "Server sent no subprotocol";
			if (protError) {
				abortHandshake$1(websocket, socket, protError);
				return;
			}
			if (serverProt) websocket._protocol = serverProt;
			const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
			if (secWebSocketExtensions !== void 0) {
				if (!perMessageDeflate) {
					abortHandshake$1(websocket, socket, "Server sent a Sec-WebSocket-Extensions header but no extension was requested");
					return;
				}
				let extensions;
				try {
					extensions = parse$1(secWebSocketExtensions);
				} catch (err) {
					abortHandshake$1(websocket, socket, "Invalid Sec-WebSocket-Extensions header");
					return;
				}
				const extensionNames = Object.keys(extensions);
				if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate$2.extensionName) {
					abortHandshake$1(websocket, socket, "Server indicated an extension that was not requested");
					return;
				}
				try {
					perMessageDeflate.accept(extensions[PerMessageDeflate$2.extensionName]);
				} catch (err) {
					abortHandshake$1(websocket, socket, "Invalid Sec-WebSocket-Extensions header");
					return;
				}
				websocket._extensions[PerMessageDeflate$2.extensionName] = perMessageDeflate;
			}
			websocket.setSocket(socket, head, {
				allowSynchronousEvents: opts.allowSynchronousEvents,
				generateMask: opts.generateMask,
				maxBufferedChunks: opts.maxBufferedChunks,
				maxFragments: opts.maxFragments,
				maxPayload: opts.maxPayload,
				skipUTF8Validation: opts.skipUTF8Validation
			});
		});
		if (opts.finishRequest) opts.finishRequest(req, websocket);
		else req.end();
	}
	/**
	* Emit the `'error'` and `'close'` events.
	*
	* @param {WebSocket} websocket The WebSocket instance
	* @param {Error} The error to emit
	* @private
	*/
	function emitErrorAndClose(websocket, err) {
		websocket._readyState = WebSocket$3.CLOSING;
		websocket._errorEmitted = true;
		websocket.emit("error", err);
		websocket.emitClose();
	}
	/**
	* Create a `net.Socket` and initiate a connection.
	*
	* @param {Object} options Connection options
	* @return {net.Socket} The newly created socket used to start the connection
	* @private
	*/
	function netConnect(options) {
		options.path = options.socketPath;
		return net.connect(options);
	}
	/**
	* Create a `tls.TLSSocket` and initiate a connection.
	*
	* @param {Object} options Connection options
	* @return {tls.TLSSocket} The newly created socket used to start the connection
	* @private
	*/
	function tlsConnect(options) {
		options.path = void 0;
		if (!options.servername && options.servername !== "") options.servername = net.isIP(options.host) ? "" : options.host;
		return tls.connect(options);
	}
	/**
	* Abort the handshake and emit an error.
	*
	* @param {WebSocket} websocket The WebSocket instance
	* @param {(http.ClientRequest|net.Socket|tls.Socket)} stream The request to
	*     abort or the socket to destroy
	* @param {String} message The error message
	* @private
	*/
	function abortHandshake$1(websocket, stream, message) {
		websocket._readyState = WebSocket$3.CLOSING;
		const err = new Error(message);
		Error.captureStackTrace(err, abortHandshake$1);
		if (stream.setHeader) {
			stream[kAborted] = true;
			stream.abort();
			if (stream.socket && !stream.socket.destroyed) stream.socket.destroy();
			process.nextTick(emitErrorAndClose, websocket, err);
		} else {
			stream.destroy(err);
			stream.once("error", websocket.emit.bind(websocket, "error"));
			stream.once("close", websocket.emitClose.bind(websocket));
		}
	}
	/**
	* Handle cases where the `ping()`, `pong()`, or `send()` methods are called
	* when the `readyState` attribute is `CLOSING` or `CLOSED`.
	*
	* @param {WebSocket} websocket The WebSocket instance
	* @param {*} [data] The data to send
	* @param {Function} [cb] Callback
	* @private
	*/
	function sendAfterClose(websocket, data, cb) {
		if (data) {
			const length = isBlob(data) ? data.size : toBuffer(data).length;
			if (websocket._socket) websocket._sender._bufferedBytes += length;
			else websocket._bufferedAmount += length;
		}
		if (cb) {
			const err = /* @__PURE__ */ new Error(`WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`);
			process.nextTick(cb, err);
		}
	}
	/**
	* The listener of the `Receiver` `'conclude'` event.
	*
	* @param {Number} code The status code
	* @param {Buffer} reason The reason for closing
	* @private
	*/
	function receiverOnConclude(code, reason) {
		const websocket = this[kWebSocket$1];
		websocket._closeFrameReceived = true;
		websocket._closeMessage = reason;
		websocket._closeCode = code;
		if (websocket._socket[kWebSocket$1] === void 0) return;
		websocket._socket.removeListener("data", socketOnData);
		process.nextTick(resume, websocket._socket);
		if (code === 1005) websocket.close();
		else websocket.close(code, reason);
	}
	/**
	* The listener of the `Receiver` `'drain'` event.
	*
	* @private
	*/
	function receiverOnDrain() {
		const websocket = this[kWebSocket$1];
		if (!websocket.isPaused) websocket._socket.resume();
	}
	/**
	* The listener of the `Receiver` `'error'` event.
	*
	* @param {(RangeError|Error)} err The emitted error
	* @private
	*/
	function receiverOnError(err) {
		const websocket = this[kWebSocket$1];
		if (websocket._socket[kWebSocket$1] !== void 0) {
			websocket._socket.removeListener("data", socketOnData);
			process.nextTick(resume, websocket._socket);
			websocket.close(err[kStatusCode]);
		}
		if (!websocket._errorEmitted) {
			websocket._errorEmitted = true;
			websocket.emit("error", err);
		}
	}
	/**
	* The listener of the `Receiver` `'finish'` event.
	*
	* @private
	*/
	function receiverOnFinish() {
		this[kWebSocket$1].emitClose();
	}
	/**
	* The listener of the `Receiver` `'message'` event.
	*
	* @param {Buffer|ArrayBuffer|Buffer[])} data The message
	* @param {Boolean} isBinary Specifies whether the message is binary or not
	* @private
	*/
	function receiverOnMessage(data, isBinary) {
		this[kWebSocket$1].emit("message", data, isBinary);
	}
	/**
	* The listener of the `Receiver` `'ping'` event.
	*
	* @param {Buffer} data The data included in the ping frame
	* @private
	*/
	function receiverOnPing(data) {
		const websocket = this[kWebSocket$1];
		if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
		websocket.emit("ping", data);
	}
	/**
	* The listener of the `Receiver` `'pong'` event.
	*
	* @param {Buffer} data The data included in the pong frame
	* @private
	*/
	function receiverOnPong(data) {
		this[kWebSocket$1].emit("pong", data);
	}
	/**
	* Resume a readable stream
	*
	* @param {Readable} stream The readable stream
	* @private
	*/
	function resume(stream) {
		stream.resume();
	}
	/**
	* The `Sender` error event handler.
	*
	* @param {Error} The error
	* @private
	*/
	function senderOnError(err) {
		const websocket = this[kWebSocket$1];
		if (websocket.readyState === WebSocket$3.CLOSED) return;
		if (websocket.readyState === WebSocket$3.OPEN) {
			websocket._readyState = WebSocket$3.CLOSING;
			setCloseTimer(websocket);
		}
		this._socket.end();
		if (!websocket._errorEmitted) {
			websocket._errorEmitted = true;
			websocket.emit("error", err);
		}
	}
	/**
	* Set a timer to destroy the underlying raw socket of a WebSocket.
	*
	* @param {WebSocket} websocket The WebSocket instance
	* @private
	*/
	function setCloseTimer(websocket) {
		websocket._closeTimer = setTimeout(websocket._socket.destroy.bind(websocket._socket), websocket._closeTimeout);
	}
	/**
	* The listener of the socket `'close'` event.
	*
	* @private
	*/
	function socketOnClose() {
		const websocket = this[kWebSocket$1];
		this.removeListener("close", socketOnClose);
		this.removeListener("data", socketOnData);
		this.removeListener("end", socketOnEnd);
		websocket._readyState = WebSocket$3.CLOSING;
		if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
			const chunk = this.read(this._readableState.length);
			websocket._receiver.write(chunk);
		}
		websocket._receiver.end();
		this[kWebSocket$1] = void 0;
		clearTimeout(websocket._closeTimer);
		if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) websocket.emitClose();
		else {
			websocket._receiver.on("error", receiverOnFinish);
			websocket._receiver.on("finish", receiverOnFinish);
		}
	}
	/**
	* The listener of the socket `'data'` event.
	*
	* @param {Buffer} chunk A chunk of data
	* @private
	*/
	function socketOnData(chunk) {
		if (!this[kWebSocket$1]._receiver.write(chunk)) this.pause();
	}
	/**
	* The listener of the socket `'end'` event.
	*
	* @private
	*/
	function socketOnEnd() {
		const websocket = this[kWebSocket$1];
		websocket._readyState = WebSocket$3.CLOSING;
		websocket._receiver.end();
		this.end();
	}
	/**
	* The listener of the socket `'error'` event.
	*
	* @private
	*/
	function socketOnError$1() {
		const websocket = this[kWebSocket$1];
		this.removeListener("error", socketOnError$1);
		this.on("error", NOOP);
		if (websocket) {
			websocket._readyState = WebSocket$3.CLOSING;
			this.destroy();
		}
	}
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/stream.js
var require_stream = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/stream.js": ((exports, module) => {
	require_websocket();
	const { Duplex: Duplex$1 } = __require("stream");
	/**
	* Emits the `'close'` event on a stream.
	*
	* @param {Duplex} stream The stream.
	* @private
	*/
	function emitClose$1(stream) {
		stream.emit("close");
	}
	/**
	* The listener of the `'end'` event.
	*
	* @private
	*/
	function duplexOnEnd() {
		if (!this.destroyed && this._writableState.finished) this.destroy();
	}
	/**
	* The listener of the `'error'` event.
	*
	* @param {Error} err The error
	* @private
	*/
	function duplexOnError(err) {
		this.removeListener("error", duplexOnError);
		this.destroy();
		if (this.listenerCount("error") === 0) this.emit("error", err);
	}
	/**
	* Wraps a `WebSocket` in a duplex stream.
	*
	* @param {WebSocket} ws The `WebSocket` to wrap
	* @param {Object} [options] The options for the `Duplex` constructor
	* @return {Duplex} The duplex stream
	* @public
	*/
	function createWebSocketStream$1(ws, options) {
		let terminateOnDestroy = true;
		const duplex = new Duplex$1({
			...options,
			autoDestroy: false,
			emitClose: false,
			objectMode: false,
			writableObjectMode: false
		});
		ws.on("message", function message(msg, isBinary) {
			const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
			if (!duplex.push(data)) ws.pause();
		});
		ws.once("error", function error(err) {
			if (duplex.destroyed) return;
			terminateOnDestroy = false;
			duplex.destroy(err);
		});
		ws.once("close", function close() {
			if (duplex.destroyed) return;
			duplex.push(null);
		});
		duplex._destroy = function(err, callback) {
			if (ws.readyState === ws.CLOSED) {
				callback(err);
				process.nextTick(emitClose$1, duplex);
				return;
			}
			let called = false;
			ws.once("error", function error(err$1) {
				called = true;
				callback(err$1);
			});
			ws.once("close", function close() {
				if (!called) callback(err);
				process.nextTick(emitClose$1, duplex);
			});
			if (terminateOnDestroy) ws.terminate();
		};
		duplex._final = function(callback) {
			if (ws.readyState === ws.CONNECTING) {
				ws.once("open", function open() {
					duplex._final(callback);
				});
				return;
			}
			if (ws._socket === null) return;
			if (ws._socket._writableState.finished) {
				callback();
				if (duplex._readableState.endEmitted) duplex.destroy();
			} else {
				ws._socket.once("finish", function finish() {
					callback();
				});
				ws.close();
			}
		};
		duplex._read = function() {
			if (ws.isPaused) ws.resume();
		};
		duplex._write = function(chunk, encoding, callback) {
			if (ws.readyState === ws.CONNECTING) {
				ws.once("open", function open() {
					duplex._write(chunk, encoding, callback);
				});
				return;
			}
			ws.send(chunk, callback);
		};
		duplex.on("end", duplexOnEnd);
		duplex.on("error", duplexOnError);
		return duplex;
	}
	module.exports = createWebSocketStream$1;
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/subprotocol.js
var require_subprotocol = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/subprotocol.js": ((exports, module) => {
	const { tokenChars } = require_validation();
	/**
	* Parses the `Sec-WebSocket-Protocol` header into a set of subprotocol names.
	*
	* @param {String} header The field value of the header
	* @return {Set} The subprotocol names
	* @public
	*/
	function parse(header) {
		const protocols = /* @__PURE__ */ new Set();
		let start = -1;
		let end = -1;
		let i = 0;
		for (; i < header.length; i++) {
			const code = header.charCodeAt(i);
			if (end === -1 && tokenChars[code] === 1) {
				if (start === -1) start = i;
			} else if (i !== 0 && (code === 32 || code === 9)) {
				if (end === -1 && start !== -1) end = i;
			} else if (code === 44) {
				if (start === -1) throw new SyntaxError(`Unexpected character at index ${i}`);
				if (end === -1) end = i;
				const protocol$1 = header.slice(start, end);
				if (protocols.has(protocol$1)) throw new SyntaxError(`The "${protocol$1}" subprotocol is duplicated`);
				protocols.add(protocol$1);
				start = end = -1;
			} else throw new SyntaxError(`Unexpected character at index ${i}`);
		}
		if (start === -1 || end !== -1) throw new SyntaxError("Unexpected end of input");
		const protocol = header.slice(start, i);
		if (protocols.has(protocol)) throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
		protocols.add(protocol);
		return protocols;
	}
	module.exports = { parse };
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/websocket-server.js
var require_websocket_server = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/websocket-server.js": ((exports, module) => {
	const EventEmitter = __require("events");
	const http = __require("http");
	const { Duplex } = __require("stream");
	const { createHash } = __require("crypto");
	const extension$1 = require_extension();
	const PerMessageDeflate$1 = require_permessage_deflate();
	const subprotocol$1 = require_subprotocol();
	const WebSocket$2 = require_websocket();
	const { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
	const keyRegex = /^[+/0-9A-Za-z]{22}==$/;
	const RUNNING = 0;
	const CLOSING = 1;
	const CLOSED = 2;
	/**
	* Class representing a WebSocket server.
	*
	* @extends EventEmitter
	*/
	var WebSocketServer$1 = class extends EventEmitter {
		/**
		* Create a `WebSocketServer` instance.
		*
		* @param {Object} options Configuration options
		* @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
		*     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
		*     multiple times in the same tick
		* @param {Boolean} [options.autoPong=true] Specifies whether or not to
		*     automatically send a pong in response to a ping
		* @param {Number} [options.backlog=511] The maximum length of the queue of
		*     pending connections
		* @param {Boolean} [options.clientTracking=true] Specifies whether or not to
		*     track clients
		* @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
		*     wait for the closing handshake to finish after `websocket.close()` is
		*     called
		* @param {Function} [options.handleProtocols] A hook to handle protocols
		* @param {String} [options.host] The hostname where to bind the server
		* @param {Number} [options.maxBufferedChunks=1048576] The maximum number of
		*     buffered data chunks
		* @param {Number} [options.maxFragments=131072] The maximum number of message
		*     fragments
		* @param {Number} [options.maxPayload=104857600] The maximum allowed message
		*     size
		* @param {Boolean} [options.noServer=false] Enable no server mode
		* @param {String} [options.path] Accept only connections matching this path
		* @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
		*     permessage-deflate
		* @param {Number} [options.port] The port where to bind the server
		* @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
		*     server to use
		* @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
		*     not to skip UTF-8 validation for text and close messages
		* @param {Function} [options.verifyClient] A hook to reject connections
		* @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
		*     class to use. It must be the `WebSocket` class or class that extends it
		* @param {Function} [callback] A listener for the `listening` event
		*/
		constructor(options, callback) {
			super();
			options = {
				allowSynchronousEvents: true,
				autoPong: true,
				maxBufferedChunks: 1024 * 1024,
				maxFragments: 128 * 1024,
				maxPayload: 100 * 1024 * 1024,
				skipUTF8Validation: false,
				perMessageDeflate: false,
				handleProtocols: null,
				clientTracking: true,
				closeTimeout: CLOSE_TIMEOUT,
				verifyClient: null,
				noServer: false,
				backlog: null,
				server: null,
				host: null,
				path: null,
				port: null,
				WebSocket: WebSocket$2,
				...options
			};
			if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) throw new TypeError("One and only one of the \"port\", \"server\", or \"noServer\" options must be specified");
			if (options.port != null) {
				this._server = http.createServer((req, res) => {
					const body = http.STATUS_CODES[426];
					res.writeHead(426, {
						"Content-Length": body.length,
						"Content-Type": "text/plain"
					});
					res.end(body);
				});
				this._server.listen(options.port, options.host, options.backlog, callback);
			} else if (options.server) this._server = options.server;
			if (this._server) {
				const emitConnection = this.emit.bind(this, "connection");
				this._removeListeners = addListeners(this._server, {
					listening: this.emit.bind(this, "listening"),
					error: this.emit.bind(this, "error"),
					upgrade: (req, socket, head) => {
						this.handleUpgrade(req, socket, head, emitConnection);
					}
				});
			}
			if (options.perMessageDeflate === true) options.perMessageDeflate = {};
			if (options.clientTracking) {
				this.clients = /* @__PURE__ */ new Set();
				this._shouldEmitClose = false;
			}
			this.options = options;
			this._state = RUNNING;
		}
		/**
		* Returns the bound address, the address family name, and port of the server
		* as reported by the operating system if listening on an IP socket.
		* If the server is listening on a pipe or UNIX domain socket, the name is
		* returned as a string.
		*
		* @return {(Object|String|null)} The address of the server
		* @public
		*/
		address() {
			if (this.options.noServer) throw new Error("The server is operating in \"noServer\" mode");
			if (!this._server) return null;
			return this._server.address();
		}
		/**
		* Stop the server from accepting new connections and emit the `'close'` event
		* when all existing connections are closed.
		*
		* @param {Function} [cb] A one-time listener for the `'close'` event
		* @public
		*/
		close(cb) {
			if (this._state === CLOSED) {
				if (cb) this.once("close", () => {
					cb(/* @__PURE__ */ new Error("The server is not running"));
				});
				process.nextTick(emitClose, this);
				return;
			}
			if (cb) this.once("close", cb);
			if (this._state === CLOSING) return;
			this._state = CLOSING;
			if (this.options.noServer || this.options.server) {
				if (this._server) {
					this._removeListeners();
					this._removeListeners = this._server = null;
				}
				if (this.clients) if (!this.clients.size) process.nextTick(emitClose, this);
				else this._shouldEmitClose = true;
				else process.nextTick(emitClose, this);
			} else {
				const server = this._server;
				this._removeListeners();
				this._removeListeners = this._server = null;
				server.close(() => {
					emitClose(this);
				});
			}
		}
		/**
		* See if a given request should be handled by this server instance.
		*
		* @param {http.IncomingMessage} req Request object to inspect
		* @return {Boolean} `true` if the request is valid, else `false`
		* @public
		*/
		shouldHandle(req) {
			if (this.options.path) {
				const index = req.url.indexOf("?");
				if ((index !== -1 ? req.url.slice(0, index) : req.url) !== this.options.path) return false;
			}
			return true;
		}
		/**
		* Handle a HTTP Upgrade request.
		*
		* @param {http.IncomingMessage} req The request object
		* @param {Duplex} socket The network socket between the server and client
		* @param {Buffer} head The first packet of the upgraded stream
		* @param {Function} cb Callback
		* @public
		*/
		handleUpgrade(req, socket, head, cb) {
			socket.on("error", socketOnError);
			const key = req.headers["sec-websocket-key"];
			const upgrade = req.headers.upgrade;
			const version = +req.headers["sec-websocket-version"];
			if (req.method !== "GET") {
				abortHandshakeOrEmitwsClientError(this, req, socket, 405, "Invalid HTTP method");
				return;
			}
			if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
				abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid Upgrade header");
				return;
			}
			if (key === void 0 || !keyRegex.test(key)) {
				abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Missing or invalid Sec-WebSocket-Key header");
				return;
			}
			if (version !== 13 && version !== 8) {
				abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Missing or invalid Sec-WebSocket-Version header", { "Sec-WebSocket-Version": "13, 8" });
				return;
			}
			if (!this.shouldHandle(req)) {
				abortHandshake(socket, 400);
				return;
			}
			const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
			let protocols = /* @__PURE__ */ new Set();
			if (secWebSocketProtocol !== void 0) try {
				protocols = subprotocol$1.parse(secWebSocketProtocol);
			} catch (err) {
				abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid Sec-WebSocket-Protocol header");
				return;
			}
			const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
			const extensions = {};
			if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
				const perMessageDeflate = new PerMessageDeflate$1({
					...this.options.perMessageDeflate,
					isServer: true,
					maxPayload: this.options.maxPayload
				});
				try {
					const offers = extension$1.parse(secWebSocketExtensions);
					if (offers[PerMessageDeflate$1.extensionName]) {
						perMessageDeflate.accept(offers[PerMessageDeflate$1.extensionName]);
						extensions[PerMessageDeflate$1.extensionName] = perMessageDeflate;
					}
				} catch (err) {
					abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid or unacceptable Sec-WebSocket-Extensions header");
					return;
				}
			}
			if (this.options.verifyClient) {
				const info = {
					origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
					secure: !!(req.socket.authorized || req.socket.encrypted),
					req
				};
				if (this.options.verifyClient.length === 2) {
					this.options.verifyClient(info, (verified, code, message, headers) => {
						if (!verified) return abortHandshake(socket, code || 401, message, headers);
						this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
					});
					return;
				}
				if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
			}
			this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
		}
		/**
		* Upgrade the connection to WebSocket.
		*
		* @param {Object} extensions The accepted extensions
		* @param {String} key The value of the `Sec-WebSocket-Key` header
		* @param {Set} protocols The subprotocols
		* @param {http.IncomingMessage} req The request object
		* @param {Duplex} socket The network socket between the server and client
		* @param {Buffer} head The first packet of the upgraded stream
		* @param {Function} cb Callback
		* @throws {Error} If called more than once with the same socket
		* @private
		*/
		completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
			if (!socket.readable || !socket.writable) return socket.destroy();
			if (socket[kWebSocket]) throw new Error("server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration");
			if (this._state > RUNNING) return abortHandshake(socket, 503);
			const headers = [
				"HTTP/1.1 101 Switching Protocols",
				"Upgrade: websocket",
				"Connection: Upgrade",
				`Sec-WebSocket-Accept: ${createHash("sha1").update(key + GUID).digest("base64")}`
			];
			const ws = new this.options.WebSocket(null, void 0, this.options);
			if (protocols.size) {
				const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
				if (protocol) {
					headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
					ws._protocol = protocol;
				}
			}
			if (extensions[PerMessageDeflate$1.extensionName]) {
				const params = extensions[PerMessageDeflate$1.extensionName].params;
				const value = extension$1.format({ [PerMessageDeflate$1.extensionName]: [params] });
				headers.push(`Sec-WebSocket-Extensions: ${value}`);
				ws._extensions = extensions;
			}
			this.emit("headers", headers, req);
			socket.write(headers.concat("\r\n").join("\r\n"));
			socket.removeListener("error", socketOnError);
			ws.setSocket(socket, head, {
				allowSynchronousEvents: this.options.allowSynchronousEvents,
				maxBufferedChunks: this.options.maxBufferedChunks,
				maxFragments: this.options.maxFragments,
				maxPayload: this.options.maxPayload,
				skipUTF8Validation: this.options.skipUTF8Validation
			});
			if (this.clients) {
				this.clients.add(ws);
				ws.on("close", () => {
					this.clients.delete(ws);
					if (this._shouldEmitClose && !this.clients.size) process.nextTick(emitClose, this);
				});
			}
			cb(ws, req);
		}
	};
	module.exports = WebSocketServer$1;
	/**
	* Add event listeners on an `EventEmitter` using a map of <event, listener>
	* pairs.
	*
	* @param {EventEmitter} server The event emitter
	* @param {Object.<String, Function>} map The listeners to add
	* @return {Function} A function that will remove the added listeners when
	*     called
	* @private
	*/
	function addListeners(server, map) {
		for (const event of Object.keys(map)) server.on(event, map[event]);
		return function removeListeners() {
			for (const event of Object.keys(map)) server.removeListener(event, map[event]);
		};
	}
	/**
	* Emit a `'close'` event on an `EventEmitter`.
	*
	* @param {EventEmitter} server The event emitter
	* @private
	*/
	function emitClose(server) {
		server._state = CLOSED;
		server.emit("close");
	}
	/**
	* Handle socket errors.
	*
	* @private
	*/
	function socketOnError() {
		this.destroy();
	}
	/**
	* Close the connection when preconditions are not fulfilled.
	*
	* @param {Duplex} socket The socket of the upgrade request
	* @param {Number} code The HTTP response status code
	* @param {String} [message] The HTTP response body
	* @param {Object} [headers] Additional HTTP response headers
	* @private
	*/
	function abortHandshake(socket, code, message, headers) {
		message = message || http.STATUS_CODES[code];
		headers = {
			Connection: "close",
			"Content-Type": "text/html",
			"Content-Length": Buffer.byteLength(message),
			...headers
		};
		socket.once("finish", socket.destroy);
		socket.end(`HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r\n` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message);
	}
	/**
	* Emit a `'wsClientError'` event on a `WebSocketServer` if there is at least
	* one listener for it, otherwise call `abortHandshake()`.
	*
	* @param {WebSocketServer} server The WebSocket server
	* @param {http.IncomingMessage} req The request object
	* @param {Duplex} socket The socket of the upgrade request
	* @param {Number} code The HTTP response status code
	* @param {String} message The HTTP response body
	* @param {Object} [headers] The HTTP response headers
	* @private
	*/
	function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
		if (server.listenerCount("wsClientError")) {
			const err = new Error(message);
			Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
			server.emit("wsClientError", err, socket, req);
		} else abortHandshake(socket, code, message, headers);
	}
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/index.js
var require_ws = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/ws@8.21.0/node_modules/ws/index.js": ((exports, module) => {
	const createWebSocketStream = require_stream();
	const extension = require_extension();
	const PerMessageDeflate = require_permessage_deflate();
	const Receiver = require_receiver();
	const Sender = require_sender();
	const subprotocol = require_subprotocol();
	const WebSocket$1 = require_websocket();
	const WebSocketServer = require_websocket_server();
	WebSocket$1.createWebSocketStream = createWebSocketStream;
	WebSocket$1.extension = extension;
	WebSocket$1.PerMessageDeflate = PerMessageDeflate;
	WebSocket$1.Receiver = Receiver;
	WebSocket$1.Sender = Sender;
	WebSocket$1.Server = WebSocketServer;
	WebSocket$1.subprotocol = subprotocol;
	WebSocket$1.WebSocket = WebSocket$1;
	WebSocket$1.WebSocketServer = WebSocketServer;
	module.exports = WebSocket$1;
}) });

//#endregion
//#region vendor/readest/node_modules/.pnpm/isomorphic-ws@5.0.0_ws@8.21.0/node_modules/isomorphic-ws/node.js
var require_node = /* @__PURE__ */ __commonJS({ "vendor/readest/node_modules/.pnpm/isomorphic-ws@5.0.0_ws@8.21.0/node_modules/isomorphic-ws/node.js": ((exports, module) => {
	module.exports = require_ws();
}) });

//#endregion
//#region vendor/readest/apps/readest-app/src/utils/misc.ts
var import_node = /* @__PURE__ */ __toESM(require_node(), 1);
var import_md5$1 = /* @__PURE__ */ __toESM(require_md5(), 1);
const randomMd5 = () => (0, import_md5$1.md5)(Math.random().toString());

//#endregion
//#region vendor/readest/apps/readest-app/src/utils/lru.ts
var LRUCache = class {
	capacity;
	map;
	onEvict;
	constructor(capacity, onEvict) {
		if (capacity <= 0) throw new Error("LRUCache capacity must be greater than 0");
		this.capacity = capacity;
		this.map = /* @__PURE__ */ new Map();
		this.onEvict = onEvict;
	}
	get(key) {
		if (!this.map.has(key)) return;
		const value = this.map.get(key);
		this.map.delete(key);
		this.map.set(key, value);
		return value;
	}
	set(key, value) {
		if (this.map.has(key)) {
			const oldValue = this.map.get(key);
			this.map.delete(key);
			if (this.onEvict) this.onEvict(key, oldValue);
		} else if (this.map.size === this.capacity) {
			const oldestKey = this.map.keys().next().value;
			if (oldestKey) {
				const oldestValue = this.map.get(oldestKey);
				this.map.delete(oldestKey);
				if (this.onEvict) this.onEvict(oldestKey, oldestValue);
			}
		}
		this.map.set(key, value);
	}
	has(key) {
		return this.map.has(key);
	}
	delete(key) {
		if (this.map.has(key)) {
			const value = this.map.get(key);
			const deleted = this.map.delete(key);
			if (deleted && this.onEvict) this.onEvict(key, value);
			return deleted;
		}
		return false;
	}
	clear() {
		if (this.onEvict) for (const [key, value] of this.map) this.onEvict(key, value);
		this.map.clear();
	}
	size() {
		return this.map.size;
	}
	entries() {
		return Array.from(this.map).reverse();
	}
};

//#endregion
//#region vendor/readest/apps/readest-app/src/utils/ssml.ts
const genSSML = (lang, text, voice, rate) => {
	return `
    <speak version="1.0" xml:lang="${lang}">
      <voice name="${voice}">
        <prosody rate="${rate}" >
            ${text.replace(/^<break\b[^>]*>/i, "")}
        </prosody>
      </voice>
    </speak>
  `;
};

//#endregion
//#region vendor/readest/apps/readest-app/src/libs/edgeTTSGenders.ts
const EDGE_VOICE_GENDERS = {
	"af-ZA-AdriNeural": "female",
	"af-ZA-WillemNeural": "male",
	"am-ET-AmehaNeural": "male",
	"am-ET-MekdesNeural": "female",
	"ar-AE-FatimaNeural": "female",
	"ar-AE-HamdanNeural": "male",
	"ar-BH-AliNeural": "male",
	"ar-BH-LailaNeural": "female",
	"ar-DZ-AminaNeural": "female",
	"ar-DZ-IsmaelNeural": "male",
	"ar-EG-SalmaNeural": "female",
	"ar-EG-ShakirNeural": "male",
	"ar-IQ-BasselNeural": "male",
	"ar-IQ-RanaNeural": "female",
	"ar-JO-SanaNeural": "female",
	"ar-JO-TaimNeural": "male",
	"ar-KW-FahedNeural": "male",
	"ar-KW-NouraNeural": "female",
	"ar-LB-LaylaNeural": "female",
	"ar-LB-RamiNeural": "male",
	"ar-LY-ImanNeural": "female",
	"ar-LY-OmarNeural": "male",
	"ar-MA-JamalNeural": "male",
	"ar-MA-MounaNeural": "female",
	"ar-OM-AbdullahNeural": "male",
	"ar-OM-AyshaNeural": "female",
	"ar-QA-AmalNeural": "female",
	"ar-QA-MoazNeural": "male",
	"ar-SA-HamedNeural": "male",
	"ar-SA-ZariyahNeural": "female",
	"ar-SY-AmanyNeural": "female",
	"ar-SY-LaithNeural": "male",
	"ar-TN-HediNeural": "male",
	"ar-TN-ReemNeural": "female",
	"ar-YE-MaryamNeural": "female",
	"ar-YE-SalehNeural": "male",
	"az-AZ-BabekNeural": "male",
	"az-AZ-BanuNeural": "female",
	"bg-BG-BorislavNeural": "male",
	"bg-BG-KalinaNeural": "female",
	"bn-BD-NabanitaNeural": "female",
	"bn-BD-PradeepNeural": "male",
	"bn-IN-BashkarNeural": "male",
	"bn-IN-TanishaaNeural": "female",
	"bs-BA-GoranNeural": "male",
	"bs-BA-VesnaNeural": "female",
	"ca-ES-EnricNeural": "male",
	"ca-ES-JoanaNeural": "female",
	"cs-CZ-AntoninNeural": "male",
	"cs-CZ-VlastaNeural": "female",
	"cy-GB-AledNeural": "male",
	"cy-GB-NiaNeural": "female",
	"da-DK-ChristelNeural": "female",
	"da-DK-JeppeNeural": "male",
	"de-AT-IngridNeural": "female",
	"de-AT-JonasNeural": "male",
	"de-CH-JanNeural": "male",
	"de-CH-LeniNeural": "female",
	"de-DE-AmalaNeural": "female",
	"de-DE-ConradNeural": "male",
	"de-DE-FlorianMultilingualNeural": "male",
	"de-DE-KatjaNeural": "female",
	"de-DE-KillianNeural": "male",
	"de-DE-SeraphinaMultilingualNeural": "female",
	"el-GR-AthinaNeural": "female",
	"el-GR-NestorasNeural": "male",
	"en-AU-NatashaNeural": "female",
	"en-AU-WilliamNeural": "male",
	"en-CA-ClaraNeural": "female",
	"en-CA-LiamNeural": "male",
	"en-GB-LibbyNeural": "female",
	"en-GB-MaisieNeural": "female",
	"en-GB-RyanNeural": "male",
	"en-GB-SoniaNeural": "female",
	"en-GB-ThomasNeural": "male",
	"en-HK-SamNeural": "male",
	"en-HK-YanNeural": "female",
	"en-IE-ConnorNeural": "male",
	"en-IE-EmilyNeural": "female",
	"en-IN-NeerjaExpressiveNeural": "female",
	"en-IN-NeerjaNeural": "female",
	"en-IN-PrabhatNeural": "male",
	"en-KE-AsiliaNeural": "female",
	"en-KE-ChilembaNeural": "male",
	"en-NG-AbeoNeural": "male",
	"en-NG-EzinneNeural": "female",
	"en-NZ-MitchellNeural": "male",
	"en-NZ-MollyNeural": "female",
	"en-PH-JamesNeural": "male",
	"en-PH-RosaNeural": "female",
	"en-SG-LunaNeural": "female",
	"en-SG-WayneNeural": "male",
	"en-TZ-ElimuNeural": "male",
	"en-TZ-ImaniNeural": "female",
	"en-US-AnaNeural": "female",
	"en-US-AndrewMultilingualNeural": "male",
	"en-US-AndrewNeural": "male",
	"en-US-AriaNeural": "female",
	"en-US-AvaMultilingualNeural": "female",
	"en-US-AvaNeural": "female",
	"en-US-BrianMultilingualNeural": "male",
	"en-US-BrianNeural": "male",
	"en-US-ChristopherNeural": "male",
	"en-US-EmmaMultilingualNeural": "female",
	"en-US-EmmaNeural": "female",
	"en-US-EricNeural": "male",
	"en-US-GuyNeural": "male",
	"en-US-JennyNeural": "female",
	"en-US-MichelleNeural": "female",
	"en-US-RogerNeural": "male",
	"en-US-SteffanNeural": "male",
	"es-AR-ElenaNeural": "female",
	"es-AR-TomasNeural": "male",
	"es-BO-MarceloNeural": "male",
	"es-BO-SofiaNeural": "female",
	"es-CL-CatalinaNeural": "female",
	"es-CL-LorenzoNeural": "male",
	"es-CO-GonzaloNeural": "male",
	"es-CO-SalomeNeural": "female",
	"es-CR-JuanNeural": "male",
	"es-CR-MariaNeural": "female",
	"es-CU-BelkysNeural": "female",
	"es-CU-ManuelNeural": "male",
	"es-DO-EmilioNeural": "male",
	"es-DO-RamonaNeural": "female",
	"es-EC-AndreaNeural": "female",
	"es-EC-LuisNeural": "male",
	"es-ES-AlvaroNeural": "male",
	"es-ES-ElviraNeural": "female",
	"es-ES-XimenaNeural": "female",
	"es-US-AlonsoNeural": "male",
	"es-US-PalomaNeural": "female",
	"et-EE-AnuNeural": "female",
	"et-EE-KertNeural": "male",
	"fa-IR-DilaraNeural": "female",
	"fa-IR-FaridNeural": "male",
	"fi-FI-HarriNeural": "male",
	"fi-FI-NooraNeural": "female",
	"fil-PH-AngeloNeural": "male",
	"fil-PH-BlessicaNeural": "female",
	"fr-BE-CharlineNeural": "female",
	"fr-BE-GerardNeural": "male",
	"fr-CA-AntoineNeural": "male",
	"fr-CA-JeanNeural": "male",
	"fr-CA-SylvieNeural": "female",
	"fr-CA-ThierryNeural": "male",
	"fr-CH-ArianeNeural": "female",
	"fr-CH-FabriceNeural": "male",
	"fr-FR-DeniseNeural": "female",
	"fr-FR-EloiseNeural": "female",
	"fr-FR-HenriNeural": "male",
	"fr-FR-RemyMultilingualNeural": "male",
	"fr-FR-VivienneMultilingualNeural": "female",
	"ga-IE-ColmNeural": "male",
	"ga-IE-OrlaNeural": "female",
	"gl-ES-RoiNeural": "male",
	"gl-ES-SabelaNeural": "female",
	"gu-IN-DhwaniNeural": "female",
	"gu-IN-NiranjanNeural": "male",
	"he-IL-AvriNeural": "male",
	"he-IL-HilaNeural": "female",
	"hi-IN-MadhurNeural": "male",
	"hi-IN-SwaraNeural": "female",
	"hr-HR-GabrijelaNeural": "female",
	"hr-HR-SreckoNeural": "male",
	"hu-HU-NoemiNeural": "female",
	"hu-HU-TamasNeural": "male",
	"id-ID-ArdiNeural": "male",
	"id-ID-GadisNeural": "female",
	"is-IS-GudrunNeural": "female",
	"is-IS-GunnarNeural": "male",
	"it-IT-DiegoNeural": "male",
	"it-IT-ElsaNeural": "female",
	"it-IT-GiuseppeMultilingualNeural": "male",
	"it-IT-IsabellaNeural": "female",
	"iu-Cans-CA-SiqiniqNeural": "female",
	"iu-Cans-CA-TaqqiqNeural": "male",
	"iu-Latn-CA-SiqiniqNeural": "female",
	"iu-Latn-CA-TaqqiqNeural": "male",
	"ja-JP-KeitaNeural": "male",
	"ja-JP-NanamiNeural": "female",
	"jv-ID-DimasNeural": "male",
	"jv-ID-SitiNeural": "female",
	"ka-GE-EkaNeural": "female",
	"ka-GE-GiorgiNeural": "male",
	"kk-KZ-AigulNeural": "female",
	"kk-KZ-DauletNeural": "male",
	"km-KH-PisethNeural": "male",
	"km-KH-SreymomNeural": "female",
	"kn-IN-GaganNeural": "male",
	"kn-IN-SapnaNeural": "female",
	"ko-KR-HyunsuMultilingualNeural": "male",
	"ko-KR-InJoonNeural": "male",
	"ko-KR-SunHiNeural": "female",
	"lo-LA-ChanthavongNeural": "male",
	"lo-LA-KeomanyNeural": "female",
	"lt-LT-LeonasNeural": "male",
	"lt-LT-OnaNeural": "female",
	"lv-LV-EveritaNeural": "female",
	"lv-LV-NilsNeural": "male",
	"mk-MK-AleksandarNeural": "male",
	"mk-MK-MarijaNeural": "female",
	"ml-IN-MidhunNeural": "male",
	"ml-IN-SobhanaNeural": "female",
	"mn-MN-BataaNeural": "male",
	"mn-MN-YesuiNeural": "female",
	"mr-IN-AarohiNeural": "female",
	"mr-IN-ManoharNeural": "male",
	"ms-MY-OsmanNeural": "male",
	"ms-MY-YasminNeural": "female",
	"mt-MT-GraceNeural": "female",
	"mt-MT-JosephNeural": "male",
	"my-MM-NilarNeural": "female",
	"my-MM-ThihaNeural": "male",
	"nb-NO-FinnNeural": "male",
	"nb-NO-PernilleNeural": "female",
	"ne-NP-HemkalaNeural": "female",
	"ne-NP-SagarNeural": "male",
	"nl-BE-ArnaudNeural": "male",
	"nl-BE-DenaNeural": "female",
	"nl-NL-ColetteNeural": "female",
	"nl-NL-FennaNeural": "female",
	"nl-NL-MaartenNeural": "male",
	"pl-PL-MarekNeural": "male",
	"pl-PL-ZofiaNeural": "female",
	"ps-AF-GulNawazNeural": "male",
	"ps-AF-LatifaNeural": "female",
	"pt-BR-AntonioNeural": "male",
	"pt-BR-FranciscaNeural": "female",
	"pt-BR-ThalitaMultilingualNeural": "female",
	"pt-PT-DuarteNeural": "male",
	"pt-PT-RaquelNeural": "female",
	"ro-RO-AlinaNeural": "female",
	"ro-RO-EmilNeural": "male",
	"ru-RU-DmitryNeural": "male",
	"ru-RU-SvetlanaNeural": "female",
	"si-LK-SameeraNeural": "male",
	"si-LK-ThiliniNeural": "female",
	"sk-SK-LukasNeural": "male",
	"sk-SK-ViktoriaNeural": "female",
	"sl-SI-PetraNeural": "female",
	"sl-SI-RokNeural": "male",
	"so-SO-MuuseNeural": "male",
	"so-SO-UbaxNeural": "female",
	"sq-AL-AnilaNeural": "female",
	"sq-AL-IlirNeural": "male",
	"sr-RS-NicholasNeural": "male",
	"sr-RS-SophieNeural": "female",
	"su-ID-JajangNeural": "male",
	"su-ID-TutiNeural": "female",
	"sv-SE-MattiasNeural": "male",
	"sv-SE-SofieNeural": "female",
	"sw-KE-RafikiNeural": "male",
	"sw-KE-ZuriNeural": "female",
	"sw-TZ-DaudiNeural": "male",
	"sw-TZ-RehemaNeural": "female",
	"ta-IN-PallaviNeural": "female",
	"ta-IN-ValluvarNeural": "male",
	"ta-LK-KumarNeural": "male",
	"ta-LK-SaranyaNeural": "female",
	"ta-MY-KaniNeural": "female",
	"ta-MY-SuryaNeural": "male",
	"ta-SG-AnbuNeural": "male",
	"ta-SG-VenbaNeural": "female",
	"te-IN-MohanNeural": "male",
	"te-IN-ShrutiNeural": "female",
	"th-TH-NiwatNeural": "male",
	"th-TH-PremwadeeNeural": "female",
	"tr-TR-AhmetNeural": "male",
	"tr-TR-EmelNeural": "female",
	"uk-UA-OstapNeural": "male",
	"uk-UA-PolinaNeural": "female",
	"ur-IN-GulNeural": "female",
	"ur-IN-SalmanNeural": "male",
	"ur-PK-AsadNeural": "male",
	"ur-PK-UzmaNeural": "female",
	"uz-UZ-MadinaNeural": "female",
	"uz-UZ-SardorNeural": "male",
	"vi-VN-HoaiMyNeural": "female",
	"vi-VN-NamMinhNeural": "male",
	"zh-CN-liaoning-XiaobeiNeural": "female",
	"zh-CN-shaanxi-XiaoniNeural": "female",
	"zh-CN-XiaoxiaoNeural": "female",
	"zh-CN-XiaoyiNeural": "female",
	"zh-CN-YunjianNeural": "male",
	"zh-CN-YunxiaNeural": "male",
	"zh-CN-YunxiNeural": "male",
	"zh-CN-YunyangNeural": "male",
	"zh-HK-HiuGaaiNeural": "female",
	"zh-HK-HiuMaanNeural": "female",
	"zh-HK-WanLungNeural": "male",
	"zh-TW-HsiaoChenNeural": "female",
	"zh-TW-HsiaoYuNeural": "female",
	"zh-TW-YunJheNeural": "male",
	"zu-ZA-ThandoNeural": "female",
	"zu-ZA-ThembaNeural": "male"
};

//#endregion
//#region vendor/readest/apps/readest-app/src/libs/edgeTTS.ts
var import_md5 = /* @__PURE__ */ __toESM(require_md5(), 1);
const isCloudflareWorkers = () => typeof globalThis.WebSocketPair !== "undefined";
const EDGE_SPEECH_URL = "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1";
const EDGE_API_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "143.0.3650.75";
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split(".")[0];
const EDGE_TTS_VOICES = {
	"af-ZA": ["af-ZA-AdriNeural", "af-ZA-WillemNeural"],
	"am-ET": ["am-ET-AmehaNeural", "am-ET-MekdesNeural"],
	"ar-AE": ["ar-AE-FatimaNeural", "ar-AE-HamdanNeural"],
	"ar-BH": ["ar-BH-AliNeural", "ar-BH-LailaNeural"],
	"ar-DZ": ["ar-DZ-AminaNeural", "ar-DZ-IsmaelNeural"],
	"ar-EG": ["ar-EG-SalmaNeural", "ar-EG-ShakirNeural"],
	"ar-IQ": ["ar-IQ-BasselNeural", "ar-IQ-RanaNeural"],
	"ar-JO": ["ar-JO-SanaNeural", "ar-JO-TaimNeural"],
	"ar-KW": ["ar-KW-FahedNeural", "ar-KW-NouraNeural"],
	"ar-LB": ["ar-LB-LaylaNeural", "ar-LB-RamiNeural"],
	"ar-LY": ["ar-LY-ImanNeural", "ar-LY-OmarNeural"],
	"ar-MA": ["ar-MA-JamalNeural", "ar-MA-MounaNeural"],
	"ar-OM": ["ar-OM-AbdullahNeural", "ar-OM-AyshaNeural"],
	"ar-QA": ["ar-QA-AmalNeural", "ar-QA-MoazNeural"],
	"ar-SA": ["ar-SA-HamedNeural", "ar-SA-ZariyahNeural"],
	"ar-SY": ["ar-SY-AmanyNeural", "ar-SY-LaithNeural"],
	"ar-TN": ["ar-TN-HediNeural", "ar-TN-ReemNeural"],
	"ar-YE": ["ar-YE-MaryamNeural", "ar-YE-SalehNeural"],
	"az-AZ": ["az-AZ-BabekNeural", "az-AZ-BanuNeural"],
	"bg-BG": ["bg-BG-BorislavNeural", "bg-BG-KalinaNeural"],
	"bn-BD": ["bn-BD-NabanitaNeural", "bn-BD-PradeepNeural"],
	"bn-IN": ["bn-IN-BashkarNeural", "bn-IN-TanishaaNeural"],
	"bs-BA": ["bs-BA-GoranNeural", "bs-BA-VesnaNeural"],
	"ca-ES": ["ca-ES-EnricNeural", "ca-ES-JoanaNeural"],
	"cs-CZ": ["cs-CZ-AntoninNeural", "cs-CZ-VlastaNeural"],
	"cy-GB": ["cy-GB-AledNeural", "cy-GB-NiaNeural"],
	"da-DK": ["da-DK-ChristelNeural", "da-DK-JeppeNeural"],
	"de-AT": ["de-AT-IngridNeural", "de-AT-JonasNeural"],
	"de-CH": ["de-CH-JanNeural", "de-CH-LeniNeural"],
	"de-DE": [
		"de-DE-AmalaNeural",
		"de-DE-ConradNeural",
		"de-DE-FlorianMultilingualNeural",
		"de-DE-KatjaNeural",
		"de-DE-KillianNeural",
		"de-DE-SeraphinaMultilingualNeural"
	],
	"el-GR": ["el-GR-AthinaNeural", "el-GR-NestorasNeural"],
	"en-AU": ["en-AU-NatashaNeural", "en-AU-WilliamNeural"],
	"en-CA": ["en-CA-ClaraNeural", "en-CA-LiamNeural"],
	"en-GB": [
		"en-GB-LibbyNeural",
		"en-GB-MaisieNeural",
		"en-GB-RyanNeural",
		"en-GB-SoniaNeural",
		"en-GB-ThomasNeural"
	],
	"en-HK": ["en-HK-SamNeural", "en-HK-YanNeural"],
	"en-IE": ["en-IE-ConnorNeural", "en-IE-EmilyNeural"],
	"en-IN": [
		"en-IN-NeerjaExpressiveNeural",
		"en-IN-NeerjaNeural",
		"en-IN-PrabhatNeural"
	],
	"en-KE": ["en-KE-AsiliaNeural", "en-KE-ChilembaNeural"],
	"en-NG": ["en-NG-AbeoNeural", "en-NG-EzinneNeural"],
	"en-NZ": ["en-NZ-MitchellNeural", "en-NZ-MollyNeural"],
	"en-PH": ["en-PH-JamesNeural", "en-PH-RosaNeural"],
	"en-SG": ["en-SG-LunaNeural", "en-SG-WayneNeural"],
	"en-TZ": ["en-TZ-ElimuNeural", "en-TZ-ImaniNeural"],
	"en-US": [
		"en-US-AnaNeural",
		"en-US-AndrewMultilingualNeural",
		"en-US-AndrewNeural",
		"en-US-AriaNeural",
		"en-US-AvaMultilingualNeural",
		"en-US-AvaNeural",
		"en-US-BrianMultilingualNeural",
		"en-US-BrianNeural",
		"en-US-ChristopherNeural",
		"en-US-EmmaMultilingualNeural",
		"en-US-EmmaNeural",
		"en-US-EricNeural",
		"en-US-GuyNeural",
		"en-US-JennyNeural",
		"en-US-MichelleNeural",
		"en-US-RogerNeural",
		"en-US-SteffanNeural"
	],
	"es-AR": ["es-AR-ElenaNeural", "es-AR-TomasNeural"],
	"es-BO": ["es-BO-MarceloNeural", "es-BO-SofiaNeural"],
	"es-CL": ["es-CL-CatalinaNeural", "es-CL-LorenzoNeural"],
	"es-CO": ["es-CO-GonzaloNeural", "es-CO-SalomeNeural"],
	"es-CR": ["es-CR-JuanNeural", "es-CR-MariaNeural"],
	"es-CU": ["es-CU-BelkysNeural", "es-CU-ManuelNeural"],
	"es-DO": ["es-DO-EmilioNeural", "es-DO-RamonaNeural"],
	"es-EC": ["es-EC-AndreaNeural", "es-EC-LuisNeural"],
	"es-ES": [
		"es-ES-AlvaroNeural",
		"es-ES-ElviraNeural",
		"es-ES-XimenaNeural"
	],
	"es-US": ["es-US-AlonsoNeural", "es-US-PalomaNeural"],
	"et-EE": ["et-EE-AnuNeural", "et-EE-KertNeural"],
	"fa-IR": ["fa-IR-DilaraNeural", "fa-IR-FaridNeural"],
	"fi-FI": ["fi-FI-HarriNeural", "fi-FI-NooraNeural"],
	"fil-PH": ["fil-PH-AngeloNeural", "fil-PH-BlessicaNeural"],
	"fr-BE": ["fr-BE-CharlineNeural", "fr-BE-GerardNeural"],
	"fr-CA": [
		"fr-CA-AntoineNeural",
		"fr-CA-JeanNeural",
		"fr-CA-SylvieNeural",
		"fr-CA-ThierryNeural"
	],
	"fr-CH": ["fr-CH-ArianeNeural", "fr-CH-FabriceNeural"],
	"fr-FR": [
		"fr-FR-DeniseNeural",
		"fr-FR-EloiseNeural",
		"fr-FR-HenriNeural",
		"fr-FR-RemyMultilingualNeural",
		"fr-FR-VivienneMultilingualNeural"
	],
	"ga-IE": ["ga-IE-ColmNeural", "ga-IE-OrlaNeural"],
	"gl-ES": ["gl-ES-RoiNeural", "gl-ES-SabelaNeural"],
	"gu-IN": ["gu-IN-DhwaniNeural", "gu-IN-NiranjanNeural"],
	"he-IL": ["he-IL-AvriNeural", "he-IL-HilaNeural"],
	"hi-IN": ["hi-IN-MadhurNeural", "hi-IN-SwaraNeural"],
	"hr-HR": ["hr-HR-GabrijelaNeural", "hr-HR-SreckoNeural"],
	"hu-HU": ["hu-HU-NoemiNeural", "hu-HU-TamasNeural"],
	"id-ID": ["id-ID-ArdiNeural", "id-ID-GadisNeural"],
	"is-IS": ["is-IS-GudrunNeural", "is-IS-GunnarNeural"],
	"it-IT": [
		"it-IT-DiegoNeural",
		"it-IT-ElsaNeural",
		"it-IT-GiuseppeMultilingualNeural",
		"it-IT-IsabellaNeural"
	],
	"iu-Cans-CA": ["iu-Cans-CA-SiqiniqNeural", "iu-Cans-CA-TaqqiqNeural"],
	"iu-Latn-CA": ["iu-Latn-CA-SiqiniqNeural", "iu-Latn-CA-TaqqiqNeural"],
	"ja-JP": ["ja-JP-KeitaNeural", "ja-JP-NanamiNeural"],
	"jv-ID": ["jv-ID-DimasNeural", "jv-ID-SitiNeural"],
	"ka-GE": ["ka-GE-EkaNeural", "ka-GE-GiorgiNeural"],
	"kk-KZ": ["kk-KZ-AigulNeural", "kk-KZ-DauletNeural"],
	"km-KH": ["km-KH-PisethNeural", "km-KH-SreymomNeural"],
	"kn-IN": ["kn-IN-GaganNeural", "kn-IN-SapnaNeural"],
	"ko-KR": [
		"ko-KR-HyunsuMultilingualNeural",
		"ko-KR-InJoonNeural",
		"ko-KR-SunHiNeural"
	],
	"lo-LA": ["lo-LA-ChanthavongNeural", "lo-LA-KeomanyNeural"],
	"lt-LT": ["lt-LT-LeonasNeural", "lt-LT-OnaNeural"],
	"lv-LV": ["lv-LV-EveritaNeural", "lv-LV-NilsNeural"],
	"mk-MK": ["mk-MK-AleksandarNeural", "mk-MK-MarijaNeural"],
	"ml-IN": ["ml-IN-MidhunNeural", "ml-IN-SobhanaNeural"],
	"mn-MN": ["mn-MN-BataaNeural", "mn-MN-YesuiNeural"],
	"mr-IN": ["mr-IN-AarohiNeural", "mr-IN-ManoharNeural"],
	"ms-MY": ["ms-MY-OsmanNeural", "ms-MY-YasminNeural"],
	"mt-MT": ["mt-MT-GraceNeural", "mt-MT-JosephNeural"],
	"my-MM": ["my-MM-NilarNeural", "my-MM-ThihaNeural"],
	"nb-NO": ["nb-NO-FinnNeural", "nb-NO-PernilleNeural"],
	"ne-NP": ["ne-NP-HemkalaNeural", "ne-NP-SagarNeural"],
	"nl-BE": ["nl-BE-ArnaudNeural", "nl-BE-DenaNeural"],
	"nl-NL": [
		"nl-NL-ColetteNeural",
		"nl-NL-FennaNeural",
		"nl-NL-MaartenNeural"
	],
	"pl-PL": ["pl-PL-MarekNeural", "pl-PL-ZofiaNeural"],
	"ps-AF": ["ps-AF-GulNawazNeural", "ps-AF-LatifaNeural"],
	"pt-BR": [
		"pt-BR-AntonioNeural",
		"pt-BR-FranciscaNeural",
		"pt-BR-ThalitaMultilingualNeural"
	],
	"pt-PT": ["pt-PT-DuarteNeural", "pt-PT-RaquelNeural"],
	"ro-RO": ["ro-RO-AlinaNeural", "ro-RO-EmilNeural"],
	"ru-RU": ["ru-RU-DmitryNeural", "ru-RU-SvetlanaNeural"],
	"si-LK": ["si-LK-SameeraNeural", "si-LK-ThiliniNeural"],
	"sk-SK": ["sk-SK-LukasNeural", "sk-SK-ViktoriaNeural"],
	"sl-SI": ["sl-SI-PetraNeural", "sl-SI-RokNeural"],
	"so-SO": ["so-SO-MuuseNeural", "so-SO-UbaxNeural"],
	"sq-AL": ["sq-AL-AnilaNeural", "sq-AL-IlirNeural"],
	"sr-RS": ["sr-RS-NicholasNeural", "sr-RS-SophieNeural"],
	"su-ID": ["su-ID-JajangNeural", "su-ID-TutiNeural"],
	"sv-SE": ["sv-SE-MattiasNeural", "sv-SE-SofieNeural"],
	"sw-KE": ["sw-KE-RafikiNeural", "sw-KE-ZuriNeural"],
	"sw-TZ": ["sw-TZ-DaudiNeural", "sw-TZ-RehemaNeural"],
	"ta-IN": ["ta-IN-PallaviNeural", "ta-IN-ValluvarNeural"],
	"ta-LK": ["ta-LK-KumarNeural", "ta-LK-SaranyaNeural"],
	"ta-MY": ["ta-MY-KaniNeural", "ta-MY-SuryaNeural"],
	"ta-SG": ["ta-SG-AnbuNeural", "ta-SG-VenbaNeural"],
	"te-IN": ["te-IN-MohanNeural", "te-IN-ShrutiNeural"],
	"th-TH": ["th-TH-NiwatNeural", "th-TH-PremwadeeNeural"],
	"tr-TR": ["tr-TR-AhmetNeural", "tr-TR-EmelNeural"],
	"uk-UA": ["uk-UA-OstapNeural", "uk-UA-PolinaNeural"],
	"ur-IN": ["ur-IN-GulNeural", "ur-IN-SalmanNeural"],
	"ur-PK": ["ur-PK-AsadNeural", "ur-PK-UzmaNeural"],
	"uz-UZ": ["uz-UZ-MadinaNeural", "uz-UZ-SardorNeural"],
	"vi-VN": ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"],
	"zh-CN": [
		"zh-CN-XiaoxiaoNeural",
		"zh-CN-XiaoyiNeural",
		"zh-CN-YunjianNeural",
		"zh-CN-YunxiNeural",
		"zh-CN-YunxiaNeural",
		"zh-CN-YunyangNeural",
		"zh-CN-liaoning-XiaobeiNeural",
		"zh-CN-shaanxi-XiaoniNeural"
	],
	"zh-HK": [
		"zh-HK-HiuGaaiNeural",
		"zh-HK-HiuMaanNeural",
		"zh-HK-WanLungNeural"
	],
	"zh-TW": [
		"zh-TW-HsiaoChenNeural",
		"zh-TW-HsiaoYuNeural",
		"zh-TW-YunJheNeural"
	],
	"zu-ZA": ["zu-ZA-ThandoNeural", "zu-ZA-ThembaNeural"]
};
const WIN_EPOCH_OFFSET = 11644473600;
const S_TO_NS = 1e9;
const GEC_PREFIX_WORDS = [
	2037411651,
	1751607666,
	1126703220,
	1766662185,
	1936683619,
	544499311,
	1886547779,
	1952543343,
	778989417,
	1819033888,
	1734963744,
	544437352,
	1702061426,
	1684371058,
	46
];
const GEC_PREFIX_LENGTH = 57;
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
const rol16 = (x) => (x << 16 | x >>> 16) >>> 0;
const toWords = (bytes) => {
	const padded = new Uint8Array(Math.ceil(bytes.length / 8) * 8);
	padded.set(bytes);
	const view = new DataView(padded.buffer);
	return Array.from({ length: padded.length / 4 }, (_, i) => view.getUint32(i * 4, true));
};
const cs64WordSwap = (words, a, b) => {
	let acc = 0;
	let last = 0;
	for (let i = 0; i < words.length; i += 2) {
		const x = words[i];
		const y = words[i + 1];
		let t = rol16(Math.imul(rol16(x), 4010109435) + Math.imul(x, a) >>> 0);
		let q = Math.imul(t, 1995771700) >>> 0;
		acc = acc + Math.imul(rol16(q), 3287280279) + q >>> 0;
		t = rol16(Math.imul(rol16(y), 3273069531) + Math.imul(y, b) >>> 0);
		q = Math.imul(t, 411160124) >>> 0;
		last = Math.imul(rol16(q), 901586633) + q >>> 0;
		acc = acc + last >>> 0;
	}
	return [last, acc];
};
const cs64Reversible = (words, a, b) => {
	let state = 0;
	let acc = 0;
	for (let i = 0; i < words.length; i += 2) {
		state = Math.imul(state + words[i], a) >>> 0;
		for (const c of [
			3482890513,
			2265471903,
			315537773,
			629022083
		]) state = Math.imul(rol16(state), c) >>> 0;
		let t = Math.imul(words[i + 1] + state, b) >>> 0;
		t = Math.imul(rol16(t), 2725517045) >>> 0;
		t = rol16(Math.imul(rol16(t), 3548616447) >>> 0);
		acc = acc + state >>> 0;
		state = Math.imul(rol16(Math.imul(t, 2090019721) >>> 0), 3215236969) >>> 0;
		acc = acc + state >>> 0;
	}
	return [state, acc];
};
/**
* Generates a v2 Sec-MS-GEC token: `<CS64 hex>-<SHA256 hex>` over the prefix words followed
* by the Windows file time (rounded down to 5 minutes) and the trusted client token.
*
* @see https://github.com/rany2/edge-tts/pull/492
*/
const generateSecMsGec = async (now = Date.now()) => {
	let ticks = Math.floor(now / 1e3);
	ticks += WIN_EPOCH_OFFSET;
	ticks -= ticks % 300;
	ticks *= S_TO_NS / 100;
	const suffix = new TextEncoder().encode(`${ticks.toFixed(0)}${EDGE_API_TOKEN}`);
	const data = new Uint8Array(GEC_PREFIX_LENGTH + suffix.length);
	const view = new DataView(data.buffer);
	GEC_PREFIX_WORDS.forEach((word, i) => view.setUint32(i * 4, word, true));
	data.set(suffix, GEC_PREFIX_LENGTH);
	const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
	const words = toWords(data);
	const [key0, key1] = toWords(digest);
	const a = (key0 | 1) >>> 0;
	const b = (key1 | 1) >>> 0;
	const [s0, s1] = cs64WordSwap(words, a, b);
	const [r0, r1] = cs64Reversible(words, a, b);
	const cs64 = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(8));
	cs64.setUint32(0, s0 ^ r0, true);
	cs64.setUint32(4, s1 ^ r1, true);
	return `${toHex(new Uint8Array(cs64.buffer))}-${toHex(digest)}`;
};
const generateMuid = () => {
	const array = new Uint8Array(16);
	crypto.getRandomValues(array);
	return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
};
const genVoiceList = (voices) => {
	return Object.entries(voices).flatMap(([lang, voices$1]) => {
		return voices$1.map((id) => {
			const name$1 = id.replace(`${lang}-`, "").replace("Neural", "");
			const variant = name$1.match(/(Multilingual|Expressive)$/)?.[1];
			const voice = {
				name: variant ? name$1.slice(0, -variant.length) : name$1,
				id,
				lang
			};
			if (variant) voice.variant = variant.toLowerCase();
			const gender = EDGE_VOICE_GENDERS[id];
			if (gender) voice.gender = gender;
			return voice;
		});
	});
};
const parseAudioMetadataBody = (body) => {
	try {
		const parsed = JSON.parse(body);
		const boundaries = [];
		for (const entry of parsed.Metadata ?? []) {
			if (entry.Type !== "WordBoundary") continue;
			const offset = entry.Data?.Offset;
			const text = entry.Data?.text?.Text;
			if (typeof offset !== "number" || typeof text !== "string" || !text) continue;
			boundaries.push({
				offset,
				duration: entry.Data?.Duration ?? 0,
				text
			});
		}
		return boundaries;
	} catch {
		return [];
	}
};
const WORD_BOUNDARIES_HEADER = "X-TTS-Word-Boundaries";
const serializeWordBoundaries = (boundaries) => encodeURIComponent(JSON.stringify(boundaries));
const parseWordBoundariesHeader = (value) => {
	if (!value) return [];
	try {
		const parsed = JSON.parse(decodeURIComponent(value));
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((b) => !!b && typeof b.offset === "number" && typeof b.duration === "number" && typeof b.text === "string");
	} catch {
		return [];
	}
};
const hashTTSPayload = (payload) => {
	return (0, import_md5.md5)(JSON.stringify(payload));
};
const WS_INACTIVITY_TIMEOUT_MS = 3e4;
const inactivityWatchdog = (onTimeout) => {
	let timer = setTimeout(onTimeout, WS_INACTIVITY_TIMEOUT_MS);
	return {
		touch: () => {
			clearTimeout(timer);
			timer = setTimeout(onTimeout, WS_INACTIVITY_TIMEOUT_MS);
		},
		stop: () => clearTimeout(timer)
	};
};
var EdgeSpeechTTS = class EdgeSpeechTTS {
	static voices = genVoiceList(EDGE_TTS_VOICES);
	static audioCache = new LRUCache(200);
	static boundariesCache = new LRUCache(200);
	static inflight = /* @__PURE__ */ new Map();
	protocol = "wss";
	constructor(protocol) {
		if (protocol) this.protocol = protocol;
	}
	async #fetchEdgeSpeechHttp({ lang, text, voice, rate }) {
		throw new Error("The DSH speech relay uses the WebSocket transport.");
	}
	async #fetchEdgeSpeechWs({ lang, text, voice, rate }) {
		const connectId = randomMd5();
		const url = `${EDGE_SPEECH_URL}?${new URLSearchParams({
			ConnectionId: connectId,
			"Ocp-Apim-Subscription-Key": EDGE_API_TOKEN,
			"Sec-MS-GEC": await generateSecMsGec(),
			"Sec-MS-GEC-Version": `2-${CHROMIUM_FULL_VERSION}`
		}).toString()}`;
		const date = (/* @__PURE__ */ new Date()).toString();
		const baseHeaders = {
			"User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
			"Accept-Encoding": "gzip, deflate, br, zstd",
			"Accept-Language": "en-US,en;q=0.9",
			Pragma: "no-cache",
			"Cache-Control": "no-cache",
			Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
			"Sec-WebSocket-Version": "13",
			Cookie: `muid=${generateMuid()};`
		};
		const configHeaders = {
			"Content-Type": "application/json; charset=utf-8",
			Path: "speech.config",
			"X-Timestamp": date
		};
		const contentHeaders = {
			"Content-Type": "application/ssml+xml",
			Path: "ssml",
			"X-RequestId": connectId,
			"X-Timestamp": date
		};
		const configContent = JSON.stringify({ context: { synthesis: { audio: {
			metadataoptions: {
				sentenceBoundaryEnabled: false,
				wordBoundaryEnabled: true
			},
			outputFormat: "audio-24khz-48kbitrate-mono-mp3"
		} } } });
		const genSendContent = (headerObj, content$1) => {
			let header = "";
			for (const key of Object.keys(headerObj)) header += `${key}: ${headerObj[key]}\r\n`;
			return `${header}\r\n${content$1}`;
		};
		const getHeadersAndData = (message) => {
			const lines = message.split("\n");
			const headers = {};
			let body = "";
			let lineIdx = 0;
			for (lineIdx = 0; lineIdx < lines.length; lineIdx++) {
				const line = lines[lineIdx].trim();
				if (!line) break;
				const separatorIndex = line.indexOf(":");
				if (separatorIndex === -1) continue;
				const key = line.slice(0, separatorIndex).trim();
				headers[key] = line.slice(separatorIndex + 1).trim();
			}
			for (lineIdx = lineIdx + 1; lineIdx < lines.length; lineIdx++) body += lines[lineIdx] + "\n";
			return {
				headers,
				body
			};
		};
		const content = genSendContent(contentHeaders, genSSML(lang, text, voice, rate));
		const config = genSendContent(configHeaders, configContent);
		if (isCloudflareWorkers()) return new Promise((resolveAudio, rejectAudio) => {
			let settled = false;
			let closeSocket = () => {};
			const connecting = new AbortController();
			const watchdog = inactivityWatchdog(() => {
				if (settled) return;
				settled = true;
				connecting.abort();
				closeSocket();
				rejectAudio(/* @__PURE__ */ new Error("WebSocket timed out waiting for audio."));
			});
			const resolve = (audio) => {
				watchdog.stop();
				resolveAudio(audio);
			};
			const reject = (error) => {
				watchdog.stop();
				rejectAudio(error);
			};
			(async () => {
				try {
					const { connectWorkersWebSocket } = await import("./workersWebSocket-DXifIOci.mjs");
					const ws = await connectWorkersWebSocket(url, baseHeaders, connecting.signal);
					closeSocket = () => {
						try {
							ws.close();
						} catch {}
					};
					if (settled) return closeSocket();
					let audioData = /* @__PURE__ */ new ArrayBuffer(0);
					const boundaries = [];
					let pendingBinary = Promise.resolve();
					const appendBinary = (buffer) => {
						const headerLength = new DataView(buffer).getInt16(0);
						if (buffer.byteLength > headerLength + 2) {
							const newBody = new Uint8Array(buffer).slice(2 + headerLength);
							const merged = new Uint8Array(audioData.byteLength + newBody.byteLength);
							merged.set(new Uint8Array(audioData), 0);
							merged.set(newBody, audioData.byteLength);
							audioData = merged.buffer;
						}
					};
					const enqueueBinary = (getBuffer) => {
						pendingBinary = pendingBinary.then(async () => {
							if (settled) return;
							const buffer = await getBuffer();
							if (settled) return;
							appendBinary(buffer);
						});
					};
					const finalize = () => {
						if (settled) return;
						settled = true;
						if (!audioData.byteLength) reject(/* @__PURE__ */ new Error("No audio data received."));
						else resolve({
							response: new Response(audioData),
							boundaries
						});
					};
					const onMessage = (event) => {
						if (settled) return;
						watchdog.touch();
						const data = event.data;
						if (typeof data === "string") {
							const { headers, body } = getHeadersAndData(data);
							if (headers["Path"] === "audio.metadata") {
								boundaries.push(...parseAudioMetadataBody(body.trim()));
								return;
							}
							if (headers["Path"] === "turn.end") pendingBinary.then(() => {
								try {
									ws.close();
								} catch {}
								finalize();
							}).catch(() => {
								if (settled) return;
								settled = true;
								reject(/* @__PURE__ */ new Error("No audio data received."));
							});
							return;
						}
						if (data instanceof ArrayBuffer) {
							enqueueBinary(() => data);
							return;
						}
						if (data instanceof Uint8Array) {
							enqueueBinary(() => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
							return;
						}
						if (typeof Blob !== "undefined" && data instanceof Blob) {
							enqueueBinary(() => data.arrayBuffer());
							return;
						}
					};
					ws.addEventListener("message", onMessage);
					ws.addEventListener("close", () => {
						if (settled) return;
						pendingBinary.then(() => finalize()).catch(() => {
							if (settled) return;
							settled = true;
							reject(/* @__PURE__ */ new Error("No audio data received."));
						});
					});
					ws.addEventListener("error", () => {
						if (settled) return;
						settled = true;
						reject(/* @__PURE__ */ new Error("WebSocket error occurred."));
					});
					ws.accept();
					ws.send(config);
					ws.send(content);
				} catch (error) {
					reject(/* @__PURE__ */ new Error(`WebSocket error occurred: ${error instanceof Error ? error.message : String(error)}`));
				}
			})();
		});
		else return new Promise((resolveAudio, rejectAudio) => {
			const watchdog = inactivityWatchdog(() => {
				ws.close();
				rejectAudio(/* @__PURE__ */ new Error("WebSocket timed out waiting for audio."));
			});
			const resolve = (audio) => {
				watchdog.stop();
				resolveAudio(audio);
			};
			const reject = (error) => {
				watchdog.stop();
				rejectAudio(error);
			};
			const ws = typeof window === "undefined" ? new import_node.default(url, { headers: baseHeaders }) : new import_node.default(url);
			ws.binaryType = "arraybuffer";
			let audioData = /* @__PURE__ */ new ArrayBuffer(0);
			const boundaries = [];
			ws.addEventListener("open", () => {
				watchdog.touch();
				ws.send(config);
				ws.send(content);
			});
			ws.addEventListener("message", (event) => {
				watchdog.touch();
				if (typeof event.data === "string") {
					const { headers, body } = getHeadersAndData(event.data);
					if (headers["Path"] === "audio.metadata") boundaries.push(...parseAudioMetadataBody(body.trim()));
					else if (headers["Path"] === "turn.end") {
						ws.close();
						if (!audioData.byteLength) return reject(/* @__PURE__ */ new Error("No audio data received."));
						resolve({
							response: new Response(audioData),
							boundaries
						});
					}
				} else if (event.data instanceof ArrayBuffer) {
					const headerLength = new DataView(event.data).getInt16(0);
					if (event.data.byteLength > headerLength + 2) {
						const newBody = event.data.slice(2 + headerLength);
						const merged = new Uint8Array(audioData.byteLength + newBody.byteLength);
						merged.set(new Uint8Array(audioData), 0);
						merged.set(new Uint8Array(newBody), audioData.byteLength);
						audioData = merged.buffer;
					}
				}
			});
			ws.addEventListener("close", () => {
				if (!audioData.byteLength) reject(/* @__PURE__ */ new Error("No audio data received."));
			});
			ws.addEventListener("error", () => {
				reject(/* @__PURE__ */ new Error("WebSocket error occurred."));
			});
		});
	}
	async #fetchEdgeSpeech(payload) {
		if (this.protocol === "https") {
			const response = await this.#fetchEdgeSpeechHttp(payload);
			return {
				response,
				boundaries: parseWordBoundariesHeader(response.headers.get(WORD_BOUNDARIES_HEADER))
			};
		} else return this.#fetchEdgeSpeechWs(payload);
	}
	async create(payload) {
		return (await this.#fetchEdgeSpeech(payload)).response;
	}
	async createWithBoundaries(payload) {
		return this.#fetchEdgeSpeech(payload);
	}
	async #fetchAndCache(payload) {
		const cacheKey = hashTTSPayload(payload);
		const cachedBlob = EdgeSpeechTTS.audioCache.get(cacheKey);
		if (cachedBlob) return {
			blob: cachedBlob,
			boundaries: EdgeSpeechTTS.boundariesCache.get(cacheKey) ?? []
		};
		const pending = EdgeSpeechTTS.inflight.get(cacheKey);
		if (pending) return pending;
		const promise = (async () => {
			const { response, boundaries } = await this.#fetchEdgeSpeech(payload);
			const arrayBuffer = await response.arrayBuffer();
			const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });
			EdgeSpeechTTS.audioCache.set(cacheKey, blob);
			EdgeSpeechTTS.boundariesCache.set(cacheKey, boundaries);
			return {
				blob,
				boundaries
			};
		})();
		EdgeSpeechTTS.inflight.set(cacheKey, promise);
		try {
			return await promise;
		} finally {
			EdgeSpeechTTS.inflight.delete(cacheKey);
		}
	}
	async createAudioData(payload) {
		const { blob, boundaries } = await this.#fetchAndCache(payload);
		return {
			data: await blob.arrayBuffer(),
			boundaries
		};
	}
};

//#endregion
//#region vendor/readest/apps/readest-app/src/libs/edgeSpeechResponse.ts
const getLangFromVoice = (voiceId) => {
	const match = voiceId.match(/^([a-z]{2}-[A-Z]{2})/);
	return match ? match[1] : "en-US";
};
async function edgeSpeechResponse(request, admittedByDsh) {
	try {
		const body = await request.json();
		const { input: text, voice, speed = 1 } = body;
		let { rate, lang } = body;
		if (!text || typeof text !== "string") return Response.json({ error: {
			message: "Missing or invalid \"input\" field",
			type: "invalid_request_error"
		} }, { status: 400 });
		if (admittedByDsh && text.length > 2e3) return Response.json({ error: "Speech input is too long" }, { status: 413 });
		if (!voice || typeof voice !== "string") return Response.json({ error: {
			message: "Missing or invalid \"voice\" field",
			type: "invalid_request_error"
		} }, { status: 400 });
		const voiceConfig = EdgeSpeechTTS.voices.find((v) => v.id === voice);
		if (!voiceConfig) return Response.json({ error: {
			message: `Invalid voice "${voice}". Use GET /api/tts/edge to list available voices.`,
			type: "invalid_request_error"
		} }, { status: 400 });
		lang = admittedByDsh ? voiceConfig.lang : lang || getLangFromVoice(voice);
		const clampedSpeed = Math.max(.25, Math.min(4, speed));
		let mappedSpeed;
		if (clampedSpeed <= 1) mappedSpeed = .5 + (clampedSpeed - .25) / .75 * .5;
		else mappedSpeed = 1 + (clampedSpeed - 1) / 3 * 1;
		rate = admittedByDsh ? 1 : rate || mappedSpeed;
		const payload = {
			lang,
			text: admittedByDsh ? text.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/gi, "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") : text,
			voice,
			rate,
			pitch: 1
		};
		const { response, boundaries } = await new EdgeSpeechTTS().createWithBoundaries(payload);
		const arrayBuffer = await response.arrayBuffer();
		const headers = {
			"Content-Type": "audio/mpeg",
			"Content-Length": arrayBuffer.byteLength.toString()
		};
		const serializedBoundaries = serializeWordBoundaries(boundaries);
		if (serializedBoundaries.length <= 8192) headers[WORD_BOUNDARIES_HEADER] = serializedBoundaries;
		return new Response(arrayBuffer, {
			status: 200,
			headers
		});
	} catch (error) {
		console.error("Edge TTS API error:", error);
		return Response.json({ error: {
			message: error instanceof Error ? error.message : "Internal server error",
			type: "internal_error"
		} }, { status: 500 });
	}
}

//#endregion
//#region src/path.ts
const readerPath = "/novel-reader";

//#endregion
//#region src/host.ts
const pdfAssets = "/vendor/pdfjs";
const fontAssets = ["/fonts/InterVariable.woff2", "/fonts/InterVariable-Italic.woff2"];
const assets = fileURLToPath(new URL("../reader/", import.meta.url));
const mime = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".woff2": "font/woff2",
	".woff": "font/woff",
	".ttf": "font/ttf",
	".otf": "font/otf",
	".wasm": "application/wasm",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".ico": "image/x-icon"
};
async function serveAsset(path, req, res) {
	const decoded = decodeURIComponent(path);
	const segments = decoded.split("/").filter(Boolean);
	if (decoded.includes("\\") || segments.some((part) => part.startsWith(".") || /[:\x00-\x1f]/.test(part))) {
		res.writeHead(404).end();
		return;
	}
	const key = segments.join("/");
	const name$1 = key || "index";
	const file = join(assets, extname(name$1) ? name$1 : name$1 + ".html");
	const info = await stat(file).catch(() => void 0);
	if (!info?.isFile()) {
		res.writeHead(404).end();
		return;
	}
	res.writeHead(200, {
		"content-type": mime[extname(file)] ?? "application/octet-stream",
		"content-length": info.size,
		"cache-control": key.startsWith("_next/static/") ? "public, max-age=31536000, immutable" : "no-cache",
		"x-frame-options": "SAMEORIGIN",
		"x-content-type-options": "nosniff"
	});
	if (req.method === "HEAD") res.end();
	else await pipeline(createReadStream(file), res);
}
async function sendResponse(response, res) {
	res.writeHead(response.status, Object.fromEntries(response.headers));
	if (response.body) await pipeline(Readable.fromWeb(response.body), res);
	else res.end();
}
async function speech(req, res, url) {
	if (req.headers["content-type"]?.split(";")[0] !== "application/json") return res.writeHead(415).end();
	const body = await readLimitedBody(req, 16 * 1024);
	if (body === null) {
		res.shouldKeepAlive = false;
		return res.writeHead(413).end();
	}
	if (!body) return res.writeHead(411).end();
	await sendResponse(await edgeSpeechResponse(new Request(url, {
		method: "POST",
		body
	}), true), res);
}
const name = "dsh-novel-readnest";
const inject = [
	"webServer",
	"connection",
	"agents"
];
function apply(ctx) {
	ctx.effect(() => {
		const bridge = createBookBridge((id) => ctx.agents.get(id)?.session);
		ctx.provide("novelReader", bridge);
		const handleReaderRequest = async (req, res) => {
			const admission = ctx.connection.admit(req);
			if ("rejection" in admission) {
				res.writeHead(admission.rejection).end();
				return;
			}
			try {
				const url = new URL(req.url ?? "/", "http://127.0.0.1");
				if (url.pathname === companionEndpoint) {
					await bridge.handle(req, res);
					return;
				}
				if (req.method === "POST" && url.pathname === readerPath + "/api/tts/edge") {
					await speech(req, res, url);
					return;
				}
				if (req.method !== "GET" && req.method !== "HEAD") {
					res.writeHead(405, { Allow: "GET, HEAD" }).end();
					return;
				}
				if (url.pathname === readerPath + "/api/opds/proxy") {
					const headers = new Headers();
					if (req.headers.authorization) headers.set("authorization", req.headers.authorization);
					const request = new Request(url, {
						method: req.method,
						headers
					});
					await sendResponse(await (req.method === "HEAD" ? HEAD : GET)(request), res);
					return;
				}
				const path = url.pathname.startsWith(readerPath) ? url.pathname.slice(readerPath.length) : url.pathname;
				const previousRoute = /^\/reader\/([a-zA-Z0-9,;_+%-]+)\/?$/.exec(path);
				if (previousRoute) {
					url.searchParams.set("ids", decodeURIComponent(previousRoute[1]));
					res.writeHead(302, { location: readerPath + "/reader?" + url.searchParams.toString() }).end();
					return;
				}
				await serveAsset(path, req, res);
			} catch (error) {
				if (res.destroyed) return;
				console.error("[dsh-novel-readnest]", error);
				if (!res.headersSent) res.writeHead(error instanceof URIError ? 400 : 500);
				res.end();
			}
		};
		const unregister = [
			ctx.webServer.register({
				kind: "prefix",
				path: readerPath,
				handler: handleReaderRequest
			}),
			ctx.webServer.register({
				kind: "prefix",
				path: pdfAssets,
				handler: handleReaderRequest
			}),
			...fontAssets.map((path) => ctx.webServer.register({
				kind: "exact",
				path,
				handler: handleReaderRequest
			}))
		];
		return () => {
			bridge.dispose();
			unregister.forEach((dispose) => dispose());
		};
	});
}

//#endregion
export { apply, inject, name };