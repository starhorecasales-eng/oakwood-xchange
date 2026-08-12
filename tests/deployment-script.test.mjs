import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scriptUrl = new URL("../ops/deploy-protected-service.ps1", import.meta.url);

test("protected deployment waits for shutdown and supports LocalService", async () => {
  const script = await readFile(scriptUrl, "utf8");

  assert.match(script, /Wait-ServiceState -Name \$serviceName -State "Stopped"/);
  assert.match(script, /Wait-PortReleased -Port 3027/);
  assert.match(script, /"C:\\Program Files\\OakwoodApps\\Xchange"/);
  assert.match(script, /"C:\\Program Files\\nodejs"/);
  assert.match(script, /-Setting "AppNoConsole" -Value @\("1"\)/);
  assert.match(script, /-Setting "ObjectName" -Value @\("NT AUTHORITY\\LocalService"\)/);
});

test("application rollback leaves an unchanged tunnel running", async () => {
  const script = await readFile(scriptUrl, "utf8");
  const catchBlock = script.slice(script.indexOf("} catch {"));

  assert.match(script, /\$tunnelChanged = \$false/);
  assert.match(script, /\$tunnelChanged = \$true/);
  assert.match(
    catchBlock,
    /if \(\$tunnelChanged\) \{\s+Stop-Service -Name \$tunnelServiceName/,
  );
  assert.doesNotMatch(
    catchBlock,
    /Stop-Service -Name \$tunnelServiceName[^}]+Start-Service -Name \$serviceName/,
  );
});
