#!/bin/sh
set -eu

url='https://repository.ortolang.fr/api/content/morphalou/5/Morphalou3.1_formatCSV.zip'
mkdir -p open-data/morphalou
curl --fail --location --output open-data/morphalou/Morphalou3.1_formatCSV.zip "$url"
printf '%s\n' 'Downloaded Morphalou 3.1 CSV archive.'
