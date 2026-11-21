#!/bin/bash

# TODO: Porentially make this a TS file too so that it can be more easily ported to other opperating systems

pushd $HOME/Videos/Resonite/

for f in *.mp4; do
  newName="${f//mp4/webm}"

  if ! test -f "$newName"; then
    ffmpeg -i "$f" -c:v libsvtav1 -crf 35 -preset 6 -pix_fmt yuv420p -c:a libopus -b:a 80k "$newName"
  else
    echo "Skipping already encoded file $f."
  fi
done

popd
