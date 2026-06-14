import "server-only";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_MODEL = "sonnet";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_BUFFER = 4 * 1024 * 1024;

/** Raised when the seat CLI is not installed / not reachable. */
export class SeatUnavailableError extends Error {}
/** Raised when the seat CLI ran but failed (auth, rate limit, bad envelope). */
export class SeatCallError extends Error {}

interface SeatOptions {
  model?: string;
  timeoutMs?: number;
}

/**
 * Locate the `claude` CLI executable. Prefers an explicit override, then the
 * per-user install dir, then PATH. Returns null when nothing is found.
 *
 * We target the real `.exe` rather than a `.cmd` shim so `execFile` can run it
 * without a shell (no quoting hazards on the prompt argument).
 */
function findClaude(): string | null {
  const override = process.env.CLAUDE_BIN;
  if (override && existsSync(override)) return override;

  const candidates =
    process.platform === "win32"
      ? [
          join(homedir(), ".local", "bin", "claude.exe"),
          join(homedir(), "AppData", "Local", "Programs", "claude", "claude.exe"),
        ]
      : [join(homedir(), ".local", "bin", "claude"), "/usr/local/bin/claude", "/opt/homebrew/bin/claude"];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Last resort: bare name, let the OS resolve it on PATH.
  return process.platform === "win32" ? "claude.exe" : "claude";
}

interface ClaudeEnvelope {
  is_error?: boolean;
  api_error_status?: number;
  result?: string;
  errors?: unknown;
}

/**
 * Ask Claude via the locally-installed CLI on the user's subscription seat.
 *
 * Strips ANTHROPIC_API_KEY so the CLI can never divert to the paid API, runs
 * in a neutral cwd so no project CLAUDE.md hijacks the persona, and disables
 * every agentic capability (`--tools ""`, `--strict-mcp-config`,
 * `--max-turns 1`). Returns the model's plain-text reply.
 *
 * Throws SeatUnavailableError when the CLI is absent, SeatCallError when it
 * runs but fails. Callers should catch and fall back.
 */
export async function askClaudeSeat(
  userPrompt: string,
  systemPrompt: string,
  opts: SeatOptions = {},
): Promise<string> {
  const claude = findClaude();
  if (!claude) {
    throw new SeatUnavailableError("claude CLI not found on PATH or in ~/.local/bin");
  }

  const model = opts.model ?? DEFAULT_MODEL;
  const args = [
    "-p",
    userPrompt,
    "--output-format",
    "json",
    "--model",
    model,
    "--append-system-prompt",
    systemPrompt,
    "--exclude-dynamic-system-prompt-sections",
    "--max-turns",
    "1",
    "--tools",
    "",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--setting-sources",
    "",
  ];

  // Force the personal seat: drop the API key so the CLI authenticates with
  // its own subscription login instead of falling back to a paid key.
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;

  let stdout: string;
  try {
    const r = await execFileAsync(claude, args, {
      cwd: tmpdir(),
      env,
      timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
      encoding: "utf8",
    });
    stdout = r.stdout;
  } catch (err: unknown) {
    // execFile throws on non-zero exit; the JSON envelope (with the real error
    // status) is usually still on stdout, so try to parse it before giving up.
    const e = err as { stdout?: string; code?: string; killed?: boolean };
    if (e.killed) throw new SeatCallError("claude CLI timed out");
    if (typeof e.stdout === "string" && e.stdout.trim() !== "") {
      stdout = e.stdout;
    } else if (e.code === "ENOENT") {
      throw new SeatUnavailableError("claude CLI vanished mid-call");
    } else {
      throw new SeatCallError(`claude CLI failed to launch: ${String((err as Error).message)}`);
    }
  }

  let env_: ClaudeEnvelope;
  try {
    env_ = JSON.parse(stdout) as ClaudeEnvelope;
  } catch {
    throw new SeatCallError("claude CLI returned non-JSON output");
  }

  if (env_.is_error) {
    const status = env_.api_error_status;
    if (status === 401 || status === 403) throw new SeatCallError("claude seat is not logged in");
    if (status === 429) throw new SeatCallError("claude rate/usage limit reached");
    if (status === 404) throw new SeatCallError(`claude model alias not found: ${model}`);
    throw new SeatCallError(`claude run failed (status ${status ?? "unknown"})`);
  }

  const text = (env_.result ?? "").trim();
  if (text === "") throw new SeatCallError("claude returned an empty reply");
  return text;
}
