# 🍯🐝 honeybee

![Header](https://raw.githubusercontent.com/uetchy/honeybee/master/.github/header.png)

Honeybee is a distributed YouTube live chat and moderation events collector.

## How it works

- Fetch streams index from Holodex (every 10 minutes)
- Queue newly scheduled streams to a job pool
- One of the cluster members takes it and start collecting events

## Contribute

Have ideas to improve the system? Please [open an issue](https://github.com/holodata/honeybee/issues), or join `#honeybee` channel on [holodata Discord](https://holodata.org/discord).
