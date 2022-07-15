# 🍯🐝 Honeybee

![Header](https://raw.githubusercontent.com/uetchy/honeybee/master/.github/media/header3.png)

Honeybee is a distributed YouTube live chat and moderation events collector.

[![Actions Status: deploy](https://github.com/holodata/honeybee/workflows/deploy/badge.svg)](https://github.com/holodata/honeybee/actions?query=deploy)

## How it works

- Fetch streams index from Holodex (every 5 minutes)
- Queue newly scheduled streams to a job pool
- One of the cluster members takes it and starts collecting events

## Contribute

Have ideas to improve Honeybee? Please [open an issue](https://github.com/holodata/honeybee/issues), or join `#honeybee` channel on [Holodata Discord](https://holodata.org/discord).
