cd "$(dirname "$0")"
rsync --verbose --compress --recursive --links --times --delete --exclude '*.sh' --exclude '.git*' --exclude 'counters.json' . jfolpf@contabo.joaopimentel.com:/var/www/geoapipt/
ssh jfolpf@contabo.joaopimentel.com -- '/usr/local/bin/pm2 reload geoapi.pt'
