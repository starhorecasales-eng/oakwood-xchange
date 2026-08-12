# Security Policy

## Supported version

Only the current `main` branch is supported with security updates.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the repository owner. Do not open a public issue containing exploit details, credentials, or personal data.

Include the affected URL or commit, reproduction steps, impact, and any suggested remediation. Reports will be acknowledged as soon as practical and investigated before public disclosure.

Never include Cloudflare tunnel credentials, API tokens, private keys, or `.env` files in a report committed to the repository.

## Dependency audit note

CI blocks high-severity findings in production dependencies. The static build toolchain is also reviewed, but is not shipped to the Windows production service. At the time of this policy, the upstream `vinext` build dependency still reports an `image-size` denial-of-service advisory without a non-breaking patched release; Dependabot remains enabled to surface the first compatible fix.
