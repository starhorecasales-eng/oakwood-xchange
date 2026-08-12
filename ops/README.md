# Xchange production server

The site runs locally as the Windows service `Oakwood Xchange` on
`127.0.0.1:3027`. The existing `STAR Tunnel` Windows service publishes it as
`https://xchange.oakwoodapps.co.uk` through Cloudflare Tunnel.

The web server deliberately binds only to loopback. No inbound router or
Windows Firewall port is required; Cloudflare Tunnel makes an outbound
connection to Cloudflare.

After changing application source, run `npm run build`, then restart the
`Oakwood Xchange` service. After changing `cloudflared.yml`, validate the
ingress file and restart `STAR Tunnel`.
