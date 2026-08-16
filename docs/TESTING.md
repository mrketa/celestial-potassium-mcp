# Testing

From `potassium-mcp`, run the focused Node tests with `npm test`. For deployment changes, test the exact two-script inventory, byte parity, transactional rollback, and unsafe-path rejection. Run `npm run doctor` against a configured local workspace to check canonical scripts, StyLua, configuration, launcher, and deployed parity.

Tests must preserve bounded read-only behavior and must not require a live gameplay session.
