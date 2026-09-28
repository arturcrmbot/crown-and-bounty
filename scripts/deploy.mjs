// Deploys run in GitHub Actions (.github/workflows/ci.yml): every push to main is checked and, once
// typecheck, the unit tests and the build pass, published to GitHub Pages. This script only says so.
console.log(
  [
    'Deploys run in GitHub Actions now: push to main (git push origin HEAD:main) and it is live about three minutes later.',
    'Watch it with `gh run watch`, or at https://github.com/arturcrmbot/kings-commission/actions',
    'Live at https://arturcrmbot.github.io/kings-commission/',
  ].join('\n'),
);
