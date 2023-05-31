#!/bin/bash

if [[ $1 == 'add' ]]; then
  echo "skip git add"
else
  git $@
fi
