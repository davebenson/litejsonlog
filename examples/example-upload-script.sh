#! /bin/sh

set -e

test -r "$LITEJSONLOG_FILENAME" || {
  gzip -7 "$LITEJSONLOG_FILENAME"
}

mkdir -p `dirname "log-backups/$LITEJSONLOG_FILENAME"`
cp "$LITEJSONLOG_FILENAME.gz" "log-backups/$LITEJSONLOG_FILENAME.gz"
