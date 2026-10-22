# Frontend workspace

- Develop and run frontend commands in WSL at /home/lihao/projects/forge-front.
- Follow /home/lihao/projects/forge/docs/token-encryption-plan.md for staged token vault work.

## Git workflow

- Automatically commit completed work, including task-related untracked files, after appropriate checks pass.
- Before editing on main or the default branch, create a dedicated codex/ branch.
- Keep work on a suitable feature branch; do not develop or commit directly on main/master.
- After development, push the branch and open a pull request against the appropriate base branch.
- Merge only after required checks and review approval pass. Never bypass review or branch protection.
- Preserve ignored local configuration, credentials, generated builds, and editor files; do not force-add them.
