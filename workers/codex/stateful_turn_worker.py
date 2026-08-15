from __future__ import annotations

import hashlib
import json
import os
import signal
import sqlite3
import subprocess
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable

TERMINAL = {"COMPLETED", "FAILED", "CANCELED"}


@dataclass(frozen=True)
class TurnRequest:
    task_id: str
    logical_attempt_id: str
    turn_no: int
    workspace: str
    prompt: str
    sandbox: str = "workspace-write"
    agent_session_id: str | None = None

    @property
    def effect_key(self) -> str:
        return f"{self.task_id}:{self.logical_attempt_id}:{self.turn_no}"

    @property
    def execution_hash(self) -> str:
        body = json.dumps(asdict(self), sort_keys=True, separators=(",", ":")).encode()
        return hashlib.sha256(body).hexdigest()


class TurnStore:
    def __init__(self, path: str | Path):
        self.path = str(path)
        self._lock = threading.RLock()
        with self._db() as db:
            db.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS turns(
                    effect_key TEXT PRIMARY KEY,
                    execution_hash TEXT NOT NULL,
                    state TEXT NOT NULL,
                    pid INTEGER,
                    returncode INTEGER,
                    result_json TEXT,
                    error_code TEXT,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS events(
                    effect_key TEXT NOT NULL,
                    seq INTEGER NOT NULL,
                    kind TEXT NOT NULL,
                    at REAL NOT NULL,
                    payload_json TEXT NOT NULL,
                    PRIMARY KEY(effect_key, seq)
                );
                """
            )
            rows = db.execute("SELECT effect_key FROM turns WHERE state='WORKING'").fetchall()
            for (effect_key,) in rows:
                self._transition(db, effect_key, "FAILED", "WORKER_RESTART_FAIL_CLOSED", {"error_code": "worker_restart"})

    def _db(self):
        db = sqlite3.connect(self.path, timeout=30, check_same_thread=False)
        db.row_factory = sqlite3.Row
        return db

    def _transition(self, db, effect_key: str, state: str, kind: str, patch: dict):
        now = time.time()
        row = db.execute("SELECT COALESCE(MAX(seq),0)+1 AS seq FROM events WHERE effect_key=?", (effect_key,)).fetchone()
        seq = int(row["seq"])
        columns = {"state": state, "updated_at": now, **patch}
        assignments = ",".join(f"{key}=?" for key in columns)
        db.execute(f"UPDATE turns SET {assignments} WHERE effect_key=?", (*columns.values(), effect_key))
        db.execute("INSERT INTO events VALUES(?,?,?,?,?)", (effect_key, seq, kind, now, json.dumps(patch, sort_keys=True)))
        db.commit()

    def submit(self, request: TurnRequest) -> tuple[dict, bool]:
        with self._lock, self._db() as db:
            row = db.execute("SELECT * FROM turns WHERE effect_key=?", (request.effect_key,)).fetchone()
            if row:
                if row["execution_hash"] != request.execution_hash:
                    raise RuntimeError("turn_effect_key_conflict")
                return dict(row), True
            now = time.time()
            db.execute("INSERT INTO turns(effect_key,execution_hash,state,created_at,updated_at) VALUES(?,?,?,?,?)", (request.effect_key, request.execution_hash, "SUBMITTED", now, now))
            db.execute("INSERT INTO events VALUES(?,?,?,?,?)", (request.effect_key, 1, "TURN_SUBMITTED", now, "{}"))
            db.commit()
            return self.get(request.effect_key), False

    def transition(self, effect_key: str, state: str, kind: str, **patch):
        with self._lock, self._db() as db:
            self._transition(db, effect_key, state, kind, patch)

    def get(self, effect_key: str) -> dict:
        with self._db() as db:
            row = db.execute("SELECT * FROM turns WHERE effect_key=?", (effect_key,)).fetchone()
            if not row:
                raise KeyError(effect_key)
            result = dict(row)
            result["result"] = json.loads(result.pop("result_json")) if result.get("result_json") else None
            return result


CommandFactory = Callable[[TurnRequest], list[str]]


class StatefulCodexTurnWorker:
    def __init__(self, store: TurnStore, command_factory: CommandFactory, timeout_seconds: int = 1800):
        self.store = store
        self.command_factory = command_factory
        self.timeout_seconds = timeout_seconds
        self._processes: dict[str, subprocess.Popen] = {}
        self._lock = threading.RLock()

    def submit(self, request: TurnRequest) -> dict:
        workspace = Path(request.workspace).expanduser().resolve()
        if not workspace.is_dir():
            raise ValueError("workspace_not_found")
        snapshot, replay = self.store.submit(request)
        if replay or snapshot["state"] in TERMINAL or snapshot["state"] == "WORKING":
            return {**snapshot, "idempotent_replay": replay}
        thread = threading.Thread(target=self._execute, args=(request,), daemon=True)
        thread.start()
        return {**snapshot, "accepted": True, "idempotent_replay": False}

    def _execute(self, request: TurnRequest):
        key = request.effect_key
        try:
            process = subprocess.Popen(
                self.command_factory(request),
                cwd=request.workspace,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                start_new_session=True,
            )
            with self._lock:
                self._processes[key] = process
            self.store.transition(key, "WORKING", "PROCESS_STARTED", pid=process.pid)
            stdout, stderr = process.communicate(request.prompt, timeout=self.timeout_seconds)
            result = {"stdout": stdout, "stderr": stderr, "returncode": process.returncode}
            state = "COMPLETED" if process.returncode == 0 else "FAILED"
            self.store.transition(key, state, "PROCESS_FINISHED", pid=None, returncode=process.returncode, result_json=json.dumps(result), error_code=None if state == "COMPLETED" else "nonzero_exit")
        except subprocess.TimeoutExpired:
            self._terminate(key)
            self.store.transition(key, "FAILED", "PROCESS_TIMEOUT", pid=None, error_code="timeout")
        except Exception as error:
            self.store.transition(key, "FAILED", "PROCESS_ERROR", pid=None, error_code=type(error).__name__, result_json=json.dumps({"message": str(error)}))
        finally:
            with self._lock:
                self._processes.pop(key, None)

    def _terminate(self, effect_key: str):
        with self._lock:
            process = self._processes.get(effect_key)
        if not process or process.poll() is not None:
            return
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=5)
        except Exception:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except Exception:
                pass

    def cancel(self, effect_key: str) -> dict:
        current = self.store.get(effect_key)
        if current["state"] in TERMINAL:
            return {**current, "idempotent_replay": True}
        self._terminate(effect_key)
        self.store.transition(effect_key, "CANCELED", "TURN_CANCELED", pid=None, error_code="canceled")
        return self.store.get(effect_key)


def official_codex_command(request: TurnRequest) -> list[str]:
    codex = os.environ.get("CODEX_BIN", "codex")
    if request.agent_session_id:
        return [codex, "exec", "resume", request.agent_session_id, "--json", "--sandbox", request.sandbox, "-"]
    return [codex, "exec", "--json", "--sandbox", request.sandbox, "-"]
