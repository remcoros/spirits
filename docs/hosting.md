# Hosting SPirits on GitHub Pages

The public repository is [`remcoros/spirits`](https://github.com/remcoros/spirits). Its workflows deploy validated `main` commits to GitHub Pages at [spirits.boo](https://spirits.boo/), with the workshop at [spirits.boo/lab/](https://spirits.boo/lab/). The setup steps below describe the repository, domain and HTTPS configuration.

Before a custom domain is configured, the project URL is `https://remcoros.github.io/spirits/`, with the workshop at `/spirits/lab/`. The canonical address is `https://spirits.boo/`, with `www.spirits.boo` redirecting to it. Register and verify a domain before connecting it. Vite keeps `base: './'`, so the same build supports the project subdirectory and a custom-domain root without a hard-coded domain or repository path.

Both pages declare the same local site icons: a scalable SVG, 16/32px PNG fallbacks,
a 16/32/48px ICO, and a 180px Apple touch icon. `site.webmanifest` supplies 192/512px
icons for browser shortcuts, including an opaque maskable Android icon. Vite
rewrites the HTML's public asset links for each page's depth; the manifest's URLs
resolve relative to the manifest itself. This
keeps icons working in development, on the project URL and at a custom-domain
root, including direct visits to `/lab/`. The icon has its own dark background so
it stays visible in light and dark browser chrome. It requires no JavaScript or
remote asset requests.

`public/favicon.svg` is the original CC0 site mark, separate from the versioned
avatar catalogue. After editing it, run `npm run build:icons` to regenerate the
committed raster files and ICO. Ordinary site builds copy these assets unchanged.

## Enable the project site

1. Publish the repository and workflows to the intended `main` branch when ready.
2. In the repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. Review the `github-pages` environment in **Settings → Environments**. Restrict deployment branches to `main`; add required reviewers if desired.
4. Run **Actions → Pages → Run workflow**, selecting `main`, or push the next approved change to `main`. Check the validation and deployment jobs, then open the environment's deployment URL. [GitHub's custom workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) describes the artifact and environment requirements.

CI runs formatting, TypeScript/library checks, image tests, the full build, isolated package consumers and the built-site browser suite on pull requests to `main`. For pushes to `main`, Pages calls that same validation workflow once before deployment. Runners use Node.js 24 and npm 11.21.0. Chromium is installed by the lockfile's Playwright CLI; `SPIRITS_BROWSER` is resolved from `chromium.executablePath()` instead of assuming a system Chrome location. See [Playwright's browser installation guide](https://playwright.dev/docs/browsers).

Only `dist/site/` becomes the Pages artifact. It contains both static pages, local fonts/scripts and complete notices in `third-party/`. Local package tarballs and standalone modules stay in `dist/release/`; they are separate release assets. The Pages workflow has no npm publishing credentials, and its deployment job receives only Pages and OIDC write permissions. Deployment concurrency preserves an in-progress deployment. Pull requests do not deploy.

## Verify ownership before connecting spirits.boo

After registering the domain, sign into the `remcoros` account and open **profile Settings → Pages → Add a domain**. This is the account setting, separate from repository Pages settings. Add `spirits.boo`, then copy the exact DNS TXT name and value GitHub supplies into the registrar's DNS panel. The name normally resembles `_github-pages-challenge-remcoros.spirits.boo`; some panels expect only the part before `.spirits.boo`.

Check the TXT answer, return to GitHub and complete verification. Keep that TXT record afterward. Verification of the apex also protects its immediate subdomains, including `www`. Follow [GitHub's domain verification instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages) for the authoritative record value.

```sh
dig TXT _github-pages-challenge-remcoros.spirits.boo +short
```

## Connect the domain, DNS and HTTPS

1. In **remcoros/spirits → Settings → Pages → Custom domain**, save `spirits.boo` as the canonical domain before pointing web traffic at Pages.
2. At the DNS provider, replace conflicting web records at the apex with all four `A` values below. Add the four `AAAA` values if serving IPv6. Set `www` to a `CNAME` targeting `remcoros.github.io.`; omit the repository name and do not point `www` at the apex.

   | Type  | Name | Value               |
   | ----- | ---- | ------------------- |
   | A     | @    | 185.199.108.153     |
   | A     | @    | 185.199.109.153     |
   | A     | @    | 185.199.110.153     |
   | A     | @    | 185.199.111.153     |
   | AAAA  | @    | 2606:50c0:8000::153 |
   | AAAA  | @    | 2606:50c0:8001::153 |
   | AAAA  | @    | 2606:50c0:8002::153 |
   | AAAA  | @    | 2606:50c0:8003::153 |
   | CNAME | www  | remcoros.github.io. |

3. Wait for GitHub's DNS check and certificate provisioning. Enable **Enforce HTTPS** when available; GitHub notes this can take up to 24 hours. Confirm both names have valid certificates before sharing the new URL. [GitHub's custom-domain guide](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) supplies these DNS values and redirect behavior.

The `.boo` suffix is HSTS-preloaded: browsers require valid HTTPS immediately. An unready certificate cannot be worked around by visiting an HTTP version. [Google Registry documents this requirement](https://www.registry.google/domains/boo/).

With the apex canonical and both DNS names configured, GitHub redirects `www.spirits.boo` to `spirits.boo`; the old project URL also redirects to the custom domain. GitHub Actions Pages deployments ignore a repository `CNAME` file. Keep the custom domain in repository Pages settings; no source `CNAME` file or workflow URL change is needed. Avoid wildcard DNS records.

## Verify the migration

```sh
dig A spirits.boo +short
dig AAAA spirits.boo +short
dig CNAME www.spirits.boo +short
curl -I https://spirits.boo/
curl -I https://spirits.boo/lab/
curl -IL https://www.spirits.boo/
curl -IL https://remcoros.github.io/spirits/
```

Open the generator and lab, create a disposable example, and check a PNG/QR export. Confirm scripts, fonts and the third-party notices load at the canonical URL. These hosting checks are separate from the wallet-camera and print acceptance described in [validation.md](validation.md).

If answers differ between visitors, compare local DNS, an authoritative nameserver and independent public resolvers before changing records again. Old recursive answers can persist for their remaining TTL; lowering a TTL after cutover does not clear existing caches.

```sh
dig @1.1.1.1 A spirits.boo +short
dig @8.8.8.8 A spirits.boo +short
dig NS spirits.boo +short
# Replace ns.example.net with a nameserver returned above.
dig @ns.example.net A spirits.boo +norecurse
```
