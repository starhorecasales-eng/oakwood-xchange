# Xchange production server

The site runs locally as the Windows service `OakwoodXchange` on
`127.0.0.1:3027`. A small front server in `ops/server.mjs` serves the built
browser assets directly and invokes the bundled vinext worker for dynamic routes.
The existing `STAR Tunnel` Windows service publishes it as
`https://xchange.oakwoodapps.co.uk` through Cloudflare Tunnel.

The web server deliberately binds only to loopback. No inbound router or
Windows Firewall port is required; Cloudflare Tunnel makes an outbound
connection to Cloudflare.

After changing application source, run `npm run build`, then restart the
`Oakwood Xchange` service. After changing `cloudflared.yml`, validate the
ingress file and restart `STAR Tunnel`.
