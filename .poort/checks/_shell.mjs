// De shell van poort. Elk commando uit poort.config.json is POSIX-shell. Op macOS
// en Linux is dat sh, op Windows Git Bash: cmd.exe kent `test` en `||` niet, en
// System32\bash.exe start WSL, dat de Windows-checkout niet ziet.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const isWindows = process.platform === 'win32';
export const SHELL_HINT = 'Git Bash niet gevonden: installeer Git for Windows (winget install --id Git.Git -e) of zet POORT_SHELL op het pad naar bash.exe.';

const isWslLauncher = (p) => /[\\/]system32[\\/](bash|wsl)\.exe$/i.test(p);

// Op volgorde van voorkeur. bin\bash.exe, niet usr\bin\bash.exe: alleen die zet
// mingw64\bin en usr\bin op PATH, en vanuit PowerShell staan die er niet op.
export function bashCandidates(env = process.env, gitExecPath = '') {
  const win = path.win32;
  const roots = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA && win.join(env.LOCALAPPDATA, 'Programs')].filter(Boolean);
  return [
    env.POORT_SHELL,
    env.CLAUDE_CODE_GIT_BASH_PATH,
    gitExecPath && win.resolve(gitExecPath, '..', '..', '..', 'bin', 'bash.exe'),
    ...roots.map((r) => win.join(r, 'Git', 'bin', 'bash.exe')),
  ].filter((p) => p && !isWslLauncher(p));
}

let found;
export function findBash() {
  if (found === undefined) {
    const execPath = spawnSync('git', ['--exec-path'], { encoding: 'utf8', windowsHide: true }).stdout?.trim() || '';
    found = bashCandidates(process.env, execPath).find((p) => fs.existsSync(p)) ?? null;
  }
  return found;
}

export function shellBin(posix = 'sh') {
  if (!isWindows) return posix;
  const bash = findBash();
  if (!bash) throw new Error(SHELL_HINT);
  return bash;
}

// Een venv heeft op Windows Scripts\python.exe, zonder python3. Zo blijft één
// config goed op elk platform. Alleen relatieve paden: /opt/venv/bin is een Linux-pad.
// Een relatief venv-pad binnen `docker exec` herschrijft dit ook; zet dat in een script.
export function windowsPaths(cmd) {
  return cmd
    .replace(/(^|[\s'"=,])((?:[\w.${}-]+\/)*\.?venv)\/bin(?=[/\s'",]|$)/g, '$1$2/Scripts')
    .replace(/(\.?venv\/Scripts\/python)3(\.\d+)?(?=[\s'"]|$)/g, '$1');
}
export const shellCmd = (cmd) => (isWindows ? windowsPaths(cmd) : cmd);

// Forward slashes: een backslash in een commando is in bash een escape.
export const shellPath = (p) => (isWindows ? p.replaceAll('\\', '/') : p);

export const shellSync = (cmd, opts = {}) => spawnSync(shellBin(), ['-c', shellCmd(cmd)], { windowsHide: true, ...opts });

export const hasCommand = (tool) => shellSync(`command -v ${tool}`, { stdio: 'ignore' }).status === 0;
