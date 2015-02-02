#! /bin/sh

set -e

if test -r "$LITEJSONLOG_FILENAME"; then
  gzip -7 "$LITEJSONLOG_FILENAME"
fi

mkdir -p `dirname "log-backups/$LITEJSONLOG_FILENAME"`
cp "$LITEJSONLOG_FILENAME.gz" "log-backups/$LITEJSONLOG_FILENAME.gz"
