# Morphalou 3.1

Source: ATILF, distributed by ORTOLANG.

- Version: 3.1
- Official source: https://www.ortolang.fr/market/lexicons/morphalou/v3.1
- Download URL: https://repository.ortolang.fr/api/content/morphalou/5/Morphalou3.1_formatCSV.zip
- Persistent identifier: https://doi.org/10.82270/morphalou/v3.1
- Format used: CSV inside the official ZIP; semicolon-delimited, one inflected form per row.
- License: LGPL-LR (Lesser General Public License For Linguistic Resources).

The raw archive is downloaded locally but is not required to be committed. Re-download it with:

```bash
sh scripts/download-morphalou.sh
```

Build the fast lookup index with:

```bash
pnpm morphalou:build
```

Morphalou is used only for deterministic linguistic validation and inflection lookup. It does not decide which words are selected for study. Ambiguous surface forms retain all analyses and are not guessed into one lemma.
