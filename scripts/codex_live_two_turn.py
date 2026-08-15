#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import queue
import shutil
import subprocess
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class AppServerError(RuntimeError):
    pass


class CodexAppServer:
    def __init__(self, command: list[str], transcript_path: Path, timeout: float):
        self.command = command
        self.timeout = timeout
        self.transcript_path = transcript_path
        self.transcript: list[dict[str, Any]] = []
        self.stderr: list[str] = []
        self._queue: queue.Queue[str] = queue.Queue()
        self._next_id = 1
        self.process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            shell=False,
        )
        assert self.process.stdout and self.process.stderr and self.process.stdin
        threading.Thread(target=self._read_stdout, daemon=True).start()
        threading.Thread(target=self._read_stderr, daemon=True).start()

    def _read_stdout(self):
        assert self.process.stdout
        for line in self.process.stdout:
            self._queue.put(line)

    def _read_stderr(self):
        assert self.process.stderr
        for line in self.process.stderr:
            self.stderr.append(line.rstrip())

    def _record(self, direction: str, message: Any):
        self.transcript.append({
            "at": datetime.now(timezone.utc).isoformat(),
            "direction": direction,
            "message": message,
        })
        self.transcript_path.write_text(json.dumps(self.transcript, indent=2, ensure_ascii=False) + "\n")

    def send(self, message: dict[str, Any]):
        if self.process.poll() is not None:
            raise AppServerError(f"app-server exited: {self.process.returncode}; stderr={self.stderr[-20:]}")
        assert self.process.stdin
        self._record("client_to_server", message)
        self.process.stdin.write(json.dumps(message, ensure_ascii=False, separators=(",", ":")) + "\n")
        self.process.stdin.flush()

    def next_message(self, timeout: float | None = None) -> dict[str, Any]:
        deadline = timeout if timeout is not None else self.timeout
        try:
            line = self._queue.get(timeout=deadline)
        except queue.Empty as error:
            raise AppServerError(f"app-server timeout; stderr={self.stderr[-20:]}") from error
        try:
            message = json.loads(line)
        except json.JSONDecodeError as error:
            raise AppServerError(f"non-JSON app-server output: {line[:500]!r}") from error
        self._record("server_to_client", message)
        if "method" in message and "id" in message:
            self.send({
                "jsonrpc": "2.0",
                "id": message["id"],
                "error": {"code": -32601, "message": "Akashic live acceptance does not permit interactive server requests"},
            })
        return message

    def notify(self, method: str, params: dict[str, Any] | None = None):
        self.send({"jsonrpc": "2.0", "method": method, "params": params or {}})

    def request(self, method: str, params: dict[str, Any], timeout: float | None = None) -> Any:
        request_id = self._next_id
        self._next_id += 1
        self.send({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
        deadline = time.monotonic() + (timeout or self.timeout)
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise AppServerError(f"request timeout: {method}")
            message = self.next_message(remaining)
            if message.get("id") != request_id:
                continue
            if "error" in message:
                raise AppServerError(f"{method} failed: {message['error']}")
            return message.get("result")

    def wait_turn(self, thread_id: str, turn_id: str, timeout: float | None = None):
        deadline = time.monotonic() + (timeout or self.timeout)
        terminal = {"turn/completed", "turn/failed", "turn/cancelled", "turn/canceled"}
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise AppServerError(f"turn timeout: {turn_id}")
            message = self.next_message(remaining)
            method = message.get("method")
            if method not in terminal:
                continue
            params = message.get("params") or {}
            observed_thread = params.get("threadId") or params.get("thread_id") or (params.get("thread") or {}).get("id")
            turn = params.get("turn") or {}
            observed_turn = params.get("turnId") or params.get("turn_id") or turn.get("id")
            if observed_thread and observed_thread != thread_id:
                continue
            if observed_turn and observed_turn != turn_id:
                continue
            if method != "turn/completed":
                raise AppServerError(f"turn did not complete: {method}: {params}")
            return params

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
        self.transcript_path.write_text(json.dumps(self.transcript, indent=2, ensure_ascii=False) + "\n")


def nested_id(result: Any, key: str) -> str:
    candidates = []
    if isinstance(result, dict):
        candidates.extend([result.get(f"{key}Id"), result.get(f"{key}_id"), result.get("id")])
        nested = result.get(key)
        if isinstance(nested, dict):
            candidates.extend([nested.get("id"), nested.get(f"{key}Id")])
    for candidate in candidates:
        if isinstance(candidate, str) and candidate:
            return candidate
    raise AppServerError(f"could not resolve {key} id from: {result}")


def extract_texts(value: Any) -> list[str]:
    texts: list[str] = []
    if isinstance(value, dict):
        item_type = str(value.get("type") or value.get("kind") or "").lower()
        for key in ("text", "content", "message"):
            candidate = value.get(key)
            if isinstance(candidate, str) and ("agent" in item_type or "message" in item_type or key == "text"):
                texts.append(candidate)
        for nested in value.values():
            texts.extend(extract_texts(nested))
    elif isinstance(value, list):
        for nested in value:
            texts.extend(extract_texts(nested))
    return texts


def parse_outcome(texts: list[str]) -> dict[str, Any]:
    decoder = json.JSONDecoder()
    for text in reversed(texts):
        for index, character in enumerate(text):
            if character != "{":
                continue
            try:
                value, _ = decoder.raw_decode(text[index:])
            except json.JSONDecodeError:
                continue
            if isinstance(value, dict) and value.get("outcome"):
                return value
    raise AppServerError(f"no structured outcome found in agent messages: {texts[-5:]}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Official Codex app-server two-turn acceptance")
    parser.add_argument("--evidence-dir", required=True)
    parser.add_argument("--timeout", type=float, default=float(os.environ.get("CODEX_LIVE_TIMEOUT", "600")))
    args = parser.parse_args()

    if os.environ.get("AKASHIC_LIVE_CODEX") != "1":
        raise SystemExit("refusing to claim a live run without AKASHIC_LIVE_CODEX=1")

    command = json.loads(os.environ.get("CODEX_APP_SERVER_CMD_JSON", '["codex","app-server"]'))
    if not isinstance(command, list) or not command or not all(isinstance(item, str) for item in command):
        raise SystemExit("CODEX_APP_SERVER_CMD_JSON must be a JSON string array")
    if not shutil.which(command[0]):
        raise SystemExit(f"official Codex binary unavailable: {command[0]}")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    evidence_dir = Path(args.evidence_dir) / timestamp
    evidence_dir.mkdir(parents=True, exist_ok=False)
    transcript_path = evidence_dir / "app-server-transcript.json"
    evidence_path = evidence_dir / "evidence.json"
    workspace = Path(tempfile.mkdtemp(prefix="akashic-codex-live-"))
    subprocess.run(["git", "init", "-q", str(workspace)], check=True)

    evidence: dict[str, Any] = {
        "schema": "akashic.codex-live-evidence/v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "FAIL",
        "command": command,
        "workspace": str(workspace),
        "same_thread": False,
        "task_capsule_resent_on_turn_2": False,
    }
    server = CodexAppServer(command, transcript_path, args.timeout)
    try:
        initialize = server.request("initialize", {
            "clientInfo": {"name": "akashic-live-acceptance", "title": "Akashic Live Acceptance", "version": "0.7.0"},
            "capabilities": {"experimentalApi": True},
        })
        server.notify("initialized")

        thread_params = {
            "cwd": str(workspace),
            "approvalPolicy": "never",
            "sandbox": "read-only",
            "experimentalRawEvents": False,
        }
        overrides = json.loads(os.environ.get("CODEX_THREAD_START_OVERRIDES_JSON", "{}"))
        thread_result = server.request("thread/start", {**thread_params, **overrides})
        thread_id = nested_id(thread_result, "thread")

        first_prompt = """Return one JSON object and no markdown. A required context value named deployment_target is intentionally absent. Do not guess it. Return exactly the semantic shape {\"outcome\":\"INPUT_REQUIRED\",\"request_id\":\"req-live-1\",\"need\":[\"deployment_target\"],\"known\":[\"same Codex thread must continue\"],\"max_tokens\":128}."""
        first_result = server.request("turn/start", {
            "threadId": thread_id,
            "input": [{"type": "text", "text": first_prompt}],
        })
        first_turn_id = nested_id(first_result, "turn")
        server.wait_turn(thread_id, first_turn_id)
        first_thread = server.request("thread/read", {"threadId": thread_id, "includeTurns": True})
        first_outcome = parse_outcome(extract_texts(first_thread))
        if first_outcome.get("outcome") != "INPUT_REQUIRED" or first_outcome.get("request_id") != "req-live-1":
            raise AppServerError(f"turn 1 did not produce INPUT_REQUIRED: {first_outcome}")

        delta_prompt = """ContextPacketDelta: request_id=req-live-1; expected_seq=0; deployment_target=temporal-local-fixture. Using only this delta and the existing thread state, return one JSON object and no markdown: {\"outcome\":\"COMPLETED\",\"deployment_target\":\"temporal-local-fixture\",\"same_thread\":true}."""
        second_result = server.request("turn/start", {
            "threadId": thread_id,
            "input": [{"type": "text", "text": delta_prompt}],
        })
        second_turn_id = nested_id(second_result, "turn")
        server.wait_turn(thread_id, second_turn_id)
        second_thread = server.request("thread/read", {"threadId": thread_id, "includeTurns": True})
        second_outcome = parse_outcome(extract_texts(second_thread))
        if second_outcome.get("outcome") != "COMPLETED":
            raise AppServerError(f"turn 2 did not complete: {second_outcome}")
        if second_outcome.get("deployment_target") != "temporal-local-fixture" or second_outcome.get("same_thread") is not True:
            raise AppServerError(f"turn 2 did not consume the delta on the same thread: {second_outcome}")

        transcript_digest = "sha256:" + hashlib.sha256(transcript_path.read_bytes()).hexdigest()
        evidence.update({
            "status": "PASS",
            "initialize": initialize,
            "thread_id": thread_id,
            "turn_ids": [first_turn_id, second_turn_id],
            "same_thread": True,
            "turn_1": first_outcome,
            "turn_2": second_outcome,
            "transcript_digest": transcript_digest,
            "official_binary_path": shutil.which(command[0]),
        })
        return 0
    except Exception as error:
        evidence["error"] = {"type": type(error).__name__, "message": str(error)}
        evidence["stderr_tail"] = server.stderr[-50:]
        raise
    finally:
        server.close()
        evidence_path.write_text(json.dumps(evidence, indent=2, ensure_ascii=False, sort_keys=True) + "\n")
        print(json.dumps(evidence, indent=2, ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    raise SystemExit(main())
