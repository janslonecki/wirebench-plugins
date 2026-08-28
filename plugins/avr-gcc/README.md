# avr-gcc

The bare-C toolchain for wirebench's MCU workbench, through
[avr-gcc](https://gcc.gnu.org/wiki/avr-gcc) — a separate program run in its
own process. This plugin is the *declaration*: how to find it and how to run
it. It fetches nothing itself: bring your own, or install the
[arduino-cli](../arduino-cli/) plugin's toolchain, whose AVR core brings an
avr-gcc that this declaration knows where to look for.

## What you get

- The *avr-gcc* row in Preferences ▸ Plugins: detection and Browse….
- **Compile** in the MCU workbench for C sources — `-mmcu=atmega328p`, the
  chip the MCU element models, as a constant in this manifest.

## Licences

The plugin is GPL-3.0-or-later with the linking exception in
[EXCEPTION.md](../../EXCEPTION.md). avr-gcc is GPL-3.0, obtained by you,
from its authors — wirebench conveys none of it.
