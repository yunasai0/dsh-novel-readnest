// Inspect one DSH JSONL session locally. Never print message text, arguments,
// results, file paths, credentials, session IDs or child names.
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import { compose } from 'node:stream';

const [file, extraTool] = process.argv.slice(2);
if (!file || !/\.jsonl(?:\.zstd)?$/i.test(file)) {
  console.error('Usage: node diagnose-subagent-trace.mjs <session.v4.jsonl[.zstd]> [exact-tool-name]');
  process.exit(2);
}
const names = new Set(['subagent', 'subagent_fork', 'spawn_agent', 'fork_agent', 'send_message',
  'wait_agent', 'wait_agents', 'interrupt_agent', 'list_agents', 'Agent', 'Task']);
if (extraTool && /^[\w.-]{1,80}$/.test(extraTool)) names.add(extraTool);
const presetLabel = value => value === 'readest-companion' ? 'readest-companion' : value ? 'other' : 'unspecified';
let preset, offered, childCatalogEvents = 0, sawHeader = false;
const records = [], calls = new Map();
function record(data, name, route) {
  const row = { turn: data.turn, preset: presetLabel(preset), tool: name, route,
    inRequestHeader: offered ? offered.has(name) : null, result: 'unknown' };
  records.push(row);
  return row;
}
try {
  const input = createReadStream(file);
  const stream = /\.zstd$/i.test(file) ? compose(input, createZstdDecompress()) : input;
  for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    const data = event.data ?? {};
    switch (event.type) {
      case 'session': sawHeader = true; preset = event.agentPreset; break;
      case 'agent-preset/selected': preset = data.agentPreset; break;
      case 'request/header': offered = new Set((data.header?.tools ?? []).map(item => item.name)); break;
      case 'tool/call':
        if (names.has(data.name)) calls.set(data.callId, record(data, data.name, 'direct'));
        break;
      case 'tool/result': {
        const msg = data.message ?? {};
        const row = calls.get(msg.toolCallId ?? msg.source?.callId ?? msg.callId);
        if (row && typeof msg.isError === 'boolean') row.result = msg.isError ? 'error' : 'success';
        break;
      }
      case 'tool/ptc-dispatch':
        if (names.has(data.name)) record(data, data.name, 'PTC').result =
          typeof data.isError !== 'boolean' ? 'unknown' : data.isError ? 'error' : 'success';
        break;
      case 'subagent/catalog': childCatalogEvents++; break;
    }
  }
  if (!sawHeader) throw new Error();
  console.log(JSON.stringify({ finalPreset: presetLabel(preset), childCatalogEvents, calls: records }, null, 2));
} catch {
  console.error('无法完整读取此文件。请使用 DSH 的原始会话 JSONL 或 JSONL.ZSTD 文件。');
  process.exitCode = 1;
}
