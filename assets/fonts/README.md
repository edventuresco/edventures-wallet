# Fonts for build-time images

Static TrueType instances of the two faces the site uses, for
`app/opengraph-image.tsx`: the share-image renderer reads TTF/OTF/WOFF from
disk and cannot use the woff2 files `next/font` downloads. Nothing here is
shipped to the browser.

- `Fraunces-SemiBold.ttf`: Fraunces, weight 600, by Undercase Type. SIL Open Font License 1.1.
- `Inter-Regular.ttf`: Inter, weight 400, by Rasmus Andersson. SIL Open Font License 1.1.

Both came from Google Fonts (`fonts.googleapis.com/css2?family=<Family>:wght@<weight>`, fetched with a plain client so the CSS points at a single full TTF).
