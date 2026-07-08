# EOLRb Trainer

A Roux last-six-edges (EO + LR insertion) trainer, built around onionhoney's
[roux-trainers](https://github.com/onionhoney/roux-trainers) cube engine.

Generates random practice cases for a chosen EO case (4/0, 0/2, 2o/0, 2a/0,
2a/2, 2o/2, arrow, 1/1) and LR-edge subcase (which slots the two LR edges land
in), shows a 3D visual of the case, and reveals optimal-or-near-optimal
solutions on demand. Includes a per-subcase mastery checklist with progress
tracking, saved locally in your browser.

## Development

```bash
npm install
npm run dev
```

## Verifying the case generator

```bash
npx tsx scripts/verify.ts
```

Cross-checks every EO case / subcase combination against independent,
from-scratch classifiers -- not just round-tripping the generator's own logic.

## Deployment

Pushing to `main` builds and deploys automatically to GitHub Pages via
`.github/workflows/deploy.yml`.
