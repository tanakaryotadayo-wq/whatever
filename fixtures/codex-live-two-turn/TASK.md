# Codex App Server Live Two-Turn Fixture

Create `result.txt` in the current workspace.

The file must contain the externally supplied `required_value` followed by one
newline. The value is deliberately absent from this file and from the first
turn. Never guess it and never write a placeholder.

Before the value is supplied, return `INPUT_REQUIRED`. After a valid
`ContextPacketDelta` supplies the value, write the file and return `COMPLETED`.
