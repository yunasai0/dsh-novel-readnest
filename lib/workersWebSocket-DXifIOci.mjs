//#region vendor/readest/apps/readest-app/src/libs/workersWebSocket.ts
const concat = (a, b) => {
	const merged = new Uint8Array(a.byteLength + b.byteLength);
	merged.set(a, 0);
	merged.set(b, a.byteLength);
	return merged;
};
const encodeFrame = (opcode, payload) => {
	const length = payload.byteLength;
	const extended = length < 126 ? 0 : length < 65536 ? 2 : 8;
	const frame = new Uint8Array(2 + extended + 4 + length);
	const view = new DataView(frame.buffer);
	frame[0] = 128 | opcode;
	if (extended === 0) frame[1] = 128 | length;
	else if (extended === 2) {
		frame[1] = 254;
		view.setUint16(2, length);
	} else {
		frame[1] = 255;
		view.setBigUint64(2, BigInt(length));
	}
	const mask = crypto.getRandomValues(new Uint8Array(4));
	frame.set(mask, 2 + extended);
	for (let i = 0; i < length; i++) frame[2 + extended + 4 + i] = payload[i] ^ mask[i % 4];
	return frame;
};
const SOCKETS_MODULE = "cloudflare:sockets";
const connectWorkersWebSocket = async (url, headers, signal) => {
	const { connect } = await import(
		/* webpackIgnore: true */
		SOCKETS_MODULE
).catch((error) => {
		throw error;
	});
	const target = new URL(url);
	const socket = connect({
		hostname: target.hostname,
		port: 443
	}, { secureTransport: "on" });
	const abort = () => void socket.close().catch(() => {});
	if (signal?.aborted) abort();
	signal?.addEventListener("abort", abort, { once: true });
	const reader = socket.readable.getReader();
	const writer = socket.writable.getWriter();
	const key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
	const request = [
		`GET ${target.pathname}${target.search} HTTP/1.1`,
		`Host: ${target.hostname}`,
		"Upgrade: websocket",
		"Connection: Upgrade",
		`Sec-WebSocket-Key: ${key}`,
		...Object.entries(headers).map(([name, value]) => `${name}: ${value}`)
	];
	await writer.write(new TextEncoder().encode(`${request.join("\r\n")}\r\n\r\n`));
	let buffer = new Uint8Array(0);
	let headerEnd = -1;
	while (headerEnd < 0) {
		const { value, done } = await reader.read();
		if (done) throw new Error("WebSocket upgrade failed: connection closed");
		buffer = concat(buffer, value);
		headerEnd = new TextDecoder().decode(buffer).indexOf("\r\n\r\n");
	}
	const statusLine = new TextDecoder().decode(buffer).split("\r\n")[0];
	const status = Number(statusLine.split(" ")[1]);
	if (status !== 101) {
		socket.close().catch(() => {});
		throw new Error(`WebSocket upgrade failed with status ${status}`);
	}
	buffer = buffer.slice(headerEnd + 4);
	signal?.removeEventListener("abort", abort);
	const listeners = {};
	const emit = (type, event) => {
		for (const listener of listeners[type] ?? []) listener(event);
	};
	let closed = false;
	const write = (frame) => {
		writer.write(frame).catch((error) => {
			if (!closed) emit("error", error);
		});
	};
	const finish = () => {
		if (closed) return;
		closed = true;
		socket.close().catch(() => {});
		emit("close");
	};
	let fragments = null;
	let fragmentOpcode = 0;
	const drainFrames = () => {
		while (buffer.byteLength >= 2) {
			const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			const fin = (buffer[0] & 128) !== 0;
			const opcode = buffer[0] & 15;
			let length = buffer[1] & 127;
			let offset = 2;
			if (length === 126) {
				if (buffer.byteLength < 4) return;
				length = view.getUint16(2);
				offset = 4;
			} else if (length === 127) {
				if (buffer.byteLength < 10) return;
				length = Number(view.getBigUint64(2));
				offset = 10;
			}
			if (buffer.byteLength < offset + length) return;
			const payload = buffer.slice(offset, offset + length);
			buffer = buffer.slice(offset + length);
			if (opcode === 8) return finish();
			if (opcode === 9) {
				write(encodeFrame(10, payload));
				continue;
			}
			if (opcode === 10) continue;
			if (opcode !== 0) fragmentOpcode = opcode;
			fragments = fragments ? concat(fragments, payload) : payload;
			if (!fin) continue;
			const message = fragments;
			fragments = null;
			emit("message", { data: fragmentOpcode === 1 ? new TextDecoder().decode(message) : message.buffer });
		}
	};
	const pump = async () => {
		try {
			drainFrames();
			while (!closed) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer = concat(buffer, value);
				drainFrames();
			}
			finish();
		} catch (error) {
			if (closed) return;
			closed = true;
			socket.close().catch(() => {});
			emit("error", error);
		}
	};
	return {
		accept: () => void pump(),
		send: (data) => write(encodeFrame(1, new TextEncoder().encode(data))),
		close: () => {
			if (closed) return;
			write(encodeFrame(8, new Uint8Array(0)));
			finish();
		},
		addEventListener: (type, listener) => {
			(listeners[type] ??= []).push(listener);
		}
	};
};

//#endregion
export { connectWorkersWebSocket };